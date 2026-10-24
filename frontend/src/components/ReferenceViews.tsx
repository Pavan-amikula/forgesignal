import { useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  Copy,
  ExternalLink,
  FileText,
  Search,
  ShieldCheck,
} from "lucide-react";
import { Doc, Report, pct, download } from "../types";
export function ReferenceViews({
  page,
  docs,
  report,
  docId,
  setDocId,
  notify,
  investigate,
}: {
  page: string;
  docs: Doc[];
  report: Report | null;
  docId: string;
  setDocId: (id: string) => void;
  notify: (message: string) => void;
  investigate: (title: string) => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = docs.filter((d) =>
    `${d.title} ${d.body} ${d.id}`.toLowerCase().includes(search.toLowerCase()),
  );
  const procedure = docs.find((d) => d.id === docId) ?? docs[0];
  if (page === "library")
    return (
      <>
        <section className="workspace-heading">
          <div>
            <div className="section-kicker">REFERENCE / MAINTENANCE</div>
            <h1>Procedure library</h1>
            <p>Inspect the source material behind every evidence response.</p>
          </div>
          <span className="text-label">05 indexed procedures</span>
        </section>
        <div className="library-layout surface">
          <aside>
            <label className="search-field">
              <Search size={14} />
              <input
                aria-label="Search procedures"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search procedures…"
              />
            </label>
            {filtered.map((d) => (
              <button
                className={docId === d.id ? "selected" : ""}
                key={d.id}
                onClick={() => setDocId(d.id)}
              >
                <span>
                  {d.id}
                  <FileText size={14} />
                </span>
                <b>{d.title}</b>
              </button>
            ))}
            {!filtered.length && (
              <p className="empty compact">No matching procedures.</p>
            )}
          </aside>
          <article className="procedure-document">
            {procedure && (
              <>
                <div className="document-meta">
                  <span>{procedure.id} / DEMONSTRATION PROCEDURE</span>
                  <span>Indexed for retrieval</span>
                </div>
                <h2>{procedure.title}</h2>
                <div className="document-warning">
                  <ShieldCheck size={17} />
                  <p>
                    Illustrative project content. Use approved manufacturer and
                    site procedures for real maintenance.
                  </p>
                </div>
                <div className="procedure-body">
                  {procedure.body.split(/(?<=\.)\s+/).map((sentence, i) => (
                    <div key={i}>
                      <span>{String(i + 1).padStart(2, "0")}</span>
                      <p>{sentence}</p>
                    </div>
                  ))}
                </div>
                <div className="procedure-footer">
                  <p>This source can be retrieved with a stable citation ID.</p>
                  <button
                    className="button secondary"
                    onClick={() => {
                      navigator.clipboard
                        .writeText(`[${procedure.id}] ${procedure.title}`)
                        .then(() => notify("Citation copied"))
                        .catch(() =>
                          notify(
                            `Citation: [${procedure.id}] ${procedure.title}`,
                          ),
                        );
                    }}
                  >
                    <Copy size={13} />
                    Copy citation
                  </button>
                  <button
                    className="button primary"
                    onClick={() => investigate(procedure.title)}
                  >
                    Use in investigation
                    <ArrowRight size={13} />
                  </button>
                </div>
              </>
            )}
          </article>
        </div>
      </>
    );
  if (!report) return <p className="empty">Loading model evidence…</p>;
  return (
    <>
      <section className="workspace-heading">
        <div>
          <div className="section-kicker">REFERENCE / MODEL CARD</div>
          <h1>Model validation</h1>
          <p>
            Held-out evidence, baseline comparison, and the boundary of each
            result.
          </p>
        </div>
        <button
          className="button secondary"
          onClick={() =>
            download("model-report.json", JSON.stringify(report, null, 2))
          }
        >
          <ArrowDownToLine size={14} />
          Download report
        </button>
      </section>
      <div className="model-banner">
        <div>
          <span>MODEL</span>
          <b>Histogram gradient boosting</b>
        </div>
        <div>
          <span>DATASET</span>
          <b>AI4I 2020 · synthetic</b>
        </div>
        <div>
          <span>SPLIT / SEED</span>
          <b>60 / 20 / 20 · 42</b>
        </div>
        <div>
          <span>OPERATING THRESHOLD</span>
          <b>{pct(report.threshold)}</b>
        </div>
      </div>
      <div className="validation-grid">
        <section className="surface validation-table">
          <div className="panel-heading">
            <h2>Classifier performance</h2>
            <span>2,000 test records · 68 failures</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>METRIC</th>
                <th>GRADIENT BOOSTING</th>
                <th>PRIOR BASELINE</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Average precision", "average_precision"],
                ["ROC AUC", "roc_auc"],
                ["Precision", "precision"],
                ["Recall", "recall"],
                ["F1 score", "f1"],
              ].map(([label, key]) => (
                <tr key={key}>
                  <td>{label}</td>
                  <td className="numeric">
                    <b>{Number(report.test[key]).toFixed(4)}</b>
                  </td>
                  <td className="numeric">
                    {Number(report.baseline[key]).toFixed(4)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            Threshold chosen using validation F1. The test set is used for final
            reporting.
          </p>
        </section>
        <section className="surface confusion-panel">
          <div className="panel-heading">
            <h2>Confusion matrix</h2>
          </div>
          <div className="matrix-label">Predicted state →</div>
          <div className="matrix">
            <span />
            <label>Healthy</label>
            <label>Failure</label>
            <label>Healthy</label>
            <b>
              {(report.test.confusion_matrix as number[][])[0][0]}
              <small>True negatives</small>
            </b>
            <b className="matrix-error">
              {(report.test.confusion_matrix as number[][])[0][1]}
              <small>False positives</small>
            </b>
            <label>Failure</label>
            <b className="matrix-error">
              {(report.test.confusion_matrix as number[][])[1][0]}
              <small>False negatives</small>
            </b>
            <b>
              {(report.test.confusion_matrix as number[][])[1][1]}
              <small>True positives</small>
            </b>
          </div>
          <p>Rows = actual state · columns = prediction</p>
        </section>
      </div>
      <div className="surface model-boundaries">
        <h2>Interpretation & limitations</h2>
        <div>
          {report.limitations.map((s, i) => (
            <p key={s}>
              <span>0{i + 1}</span>
              {s}
            </p>
          ))}
        </div>
        <h3>Feature contract</h3>
        <p>{report.features.join(" / ")}</p>
        <p>
          Identifiers and all failure labels are excluded from inputs. Replay
          uses fictional assets and independent observations; it does not
          establish real degradation trajectories.
        </p>
        <details>
          <summary>Dataset provenance and checksum</summary>
          <code>{report.sha256}</code>
          <a
            href="https://doi.org/10.24432/C5HS5C"
            target="_blank"
            rel="noreferrer"
          >
            UCI AI4I · CC BY 4.0
            <ExternalLink size={12} />
          </a>
        </details>
      </div>
    </>
  );
}
