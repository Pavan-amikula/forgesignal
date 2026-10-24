"""Small authored smoke benchmark; not a faithfulness or generalization claim."""

import json
from backend.assistant import advise
from backend.ml import ROOT

CASES = [
    ("thermal cooling heat dissipation", "RB-01"),
    ("low process air temperature difference ventilation", "RB-01"),
    ("high torque power load operating envelope", "RB-02"),
    ("rotational speed obstruction supervisor", "RB-02"),
    ("tool wear overstrain inspection replacement", "RB-03"),
    ("remaining useful life tool wear", "RB-03"),
    ("missing stale sensor timestamp duplicates", "RB-04"),
    ("invalid telemetry units connection", "RB-04"),
    ("work order human approval escalation", "RB-05"),
    ("supervisor approve reject audit", "RB-05"),
    ("Who won the world cup?", None),
    ("Write a poem about the ocean", None),
]


def main():
    results = []
    for question, expected in CASES:
        answer = advise(question)
        ids = [d["id"] for d in answer["sources"]]
        success = expected in ids if expected else answer["mode"] == "abstained"
        results.append(
            {
                "question": question,
                "expected": expected,
                "retrieved": ids,
                "passed": success,
                "mode": answer["mode"],
            }
        )
    report = {
        "cases": results,
        "passed": sum(r["passed"] for r in results),
        "total": len(results),
        "description": "Authored 10 in-domain retrieval + 2 abstention smoke cases. No LLM judge, no semantic faithfulness score. Queries overlap indexed vocabulary; not an independent retrieval benchmark.",
    }
    (ROOT / "artifacts/retrieval-report.json").write_text(
        json.dumps(report, indent=2) + "\n"
    )
    print(json.dumps(report, indent=2))
    if report["passed"] != report["total"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
