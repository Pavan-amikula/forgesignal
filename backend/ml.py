"""Reproducible current-state classifier. Target-derived columns never enter X."""

from pathlib import Path
import hashlib
import json
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.dummy import DummyClassifier
from sklearn.metrics import (
    average_precision_score,
    precision_recall_fscore_support,
    roc_auc_score,
    confusion_matrix,
)
from sklearn.model_selection import train_test_split

ROOT = Path(__file__).resolve().parents[1]
FEATURES = [
    "Type",
    "Air temperature [K]",
    "Process temperature [K]",
    "Rotational speed [rpm]",
    "Torque [Nm]",
    "Tool wear [min]",
]
RENAME = dict(
    zip(
        FEATURES,
        [
            "type",
            "air_temperature",
            "process_temperature",
            "rpm",
            "torque",
            "tool_wear",
        ],
    )
)


def matrix(frame):
    x = frame[FEATURES].copy()
    x["Type"] = x["Type"].map({"L": 0, "M": 1, "H": 2})
    return x


def metric(y, p, threshold):
    pred = p >= threshold
    precision, recall, f1, _ = precision_recall_fscore_support(
        y, pred, average="binary", zero_division=0
    )
    return dict(
        average_precision=round(average_precision_score(y, p), 4),
        roc_auc=round(roc_auc_score(y, p), 4),
        precision=round(precision, 4),
        recall=round(recall, 4),
        f1=round(f1, 4),
        confusion_matrix=confusion_matrix(y, pred).tolist(),
    )


def train():
    path = ROOT / "data/ai4i2020.csv"
    df = pd.read_csv(path)
    train_idx, test_idx = train_test_split(
        np.arange(len(df)),
        test_size=0.2,
        random_state=42,
        stratify=df["Machine failure"],
    )
    fit_idx, val_idx = train_test_split(
        train_idx,
        test_size=0.25,
        random_state=42,
        stratify=df.iloc[train_idx]["Machine failure"],
    )
    x, y = matrix(df), df["Machine failure"]
    model = HistGradientBoostingClassifier(
        max_iter=180, max_leaf_nodes=15, l2_regularization=2, random_state=42
    )
    model.fit(x.iloc[fit_idx], y.iloc[fit_idx])
    vp = model.predict_proba(x.iloc[val_idx])[:, 1]
    candidates = np.arange(0.05, 0.81, 0.01)
    threshold = float(
        max(candidates, key=lambda t: metric(y.iloc[val_idx], vp, t)["f1"])
    )
    p = model.predict_proba(x.iloc[test_idx])[:, 1]
    baseline = DummyClassifier(strategy="prior").fit(x.iloc[fit_idx], y.iloc[fit_idx])
    report = dict(
        dataset="UCI AI4I 2020 (synthetic)",
        sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
        task="Current-state failure classification; not future failure forecasting",
        seed=42,
        split={
            "train": len(fit_idx),
            "validation": len(val_idx),
            "test": len(test_idx),
        },
        features=FEATURES,
        threshold=round(threshold, 2),
        threshold_selection="Maximum validation F1; test set used once for final report",
        test=metric(y.iloc[test_idx], p, threshold),
        baseline=metric(
            y.iloc[test_idx], baseline.predict_proba(x.iloc[test_idx])[:, 1], threshold
        ),
        test_positives=int(y.iloc[test_idx].sum()),
        limitations=[
            "Synthetic benchmark, no field validation",
            "Random stratified split is not a temporal generalization test",
            "Scores are not calibrated probabilities",
            "Maintenance and financial impact are not measured",
        ],
    )
    (ROOT / "artifacts").mkdir(exist_ok=True)
    joblib.dump(
        {"model": model, "threshold": threshold, "test_indices": test_idx.tolist()},
        ROOT / "artifacts/model.joblib",
    )
    (ROOT / "artifacts/model-report.json").write_text(
        json.dumps(report, indent=2) + "\n"
    )
    return report


def load():
    if not (ROOT / "artifacts/model.joblib").exists():
        train()
    return joblib.load(ROOT / "artifacts/model.joblib")


def score(model, reading):
    raw = {k: reading[v] for k, v in RENAME.items()}
    return float(model.predict_proba(matrix(pd.DataFrame([raw])))[:, 1][0])


if __name__ == "__main__":
    print(json.dumps(train(), indent=2))
