import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  BookOpen,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  Factory,
  FlaskConical,
  LayoutDashboard,
  Pause,
  Play,
  Radio,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import "./style.css";

type Reading = {
  type: string;
  air_temperature: number;
  process_temperature: number;
  rpm: number;
  torque: number;
  tool_wear: number;
};
type Asset = {
  id: string;
  name: string;
  line: string;
  reading: Reading | null;
  score: number | null;
  timestamp: string | null;
  history: { score: number; rpm: number }[];
};
type Order = {
  id: number;
  asset_id: string;
  title: string;
  status: string;
  created_at: string;
  evidence: string;
};
type Snapshot = {
  assets: Asset[];
  events: number;
  orders: Order[];
  audit: {
    id: number;
    order_id: number;
    action: string;
    actor: string;
    timestamp: string;
  }[];
  threshold: number;
  replay_running: boolean;
  timestamp: string;
  write_auth_required: boolean;
};
type Report = {
  test: Record<string, number | number[][]>;
  baseline: Record<string, number>;
  split: Record<string, number>;
  threshold: number;
  sha256: string;
  limitations: string[];
  features: string[];
  test_positives: number;
};
type Answer = {
  answer: string;
  mode: string;
  trace: string[];
  sources: { id: string; title: string; body: string; relevance: number }[];
};
type Doc = { id: string; title: string; body: string };
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const clock = (s: string) =>
  new Date(s).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
function Sparkline({
  values,
  alert = false,
  large = false,
}: {
  values: number[];
  alert?: boolean;
  large?: boolean;
}) {
  const points = values.length > 1 ? values : [...values, ...values];
  const path = points
    .map(
      (v, i) =>
        `${(i * 300) / Math.max(points.length - 1, 1)},${70 - Math.min(v, 1) * 60}`,
    )
    .join(" ");
  return (
    <svg
      viewBox="0 0 300 80"
      preserveAspectRatio="none"
      className={large ? "spark large" : "spark"}
      role="img"
      aria-label="Recent failure score history"
    >
      <path
        d={`M${path.replaceAll(" ", " L")} L300,80 L0,80 Z`}
        fill={alert ? "#bc713310" : "#66857715"}
      />
      <polyline
        points={path}
        fill="none"
        stroke={alert ? "#b6662d" : "#527563"}
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
function App() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null),
    [tab, setTab] = useState("Overview"),
    [selected, setSelected] = useState("CNC-01"),
    [filter, setFilter] = useState(""),
    [line, setLine] = useState("All production lines"),
    [connected, setConnected] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [drawer, setDrawer] = useState(false),
    [question, setQuestion] = useState(
      "What should I inspect for high torque and tool wear?",
    ),
    [answer, setAnswer] = useState<Answer | null>(null),
    [report, setReport] = useState<Report | null>(null),
    [docs, setDocs] = useState<Doc[]>([]),
    [toast, setToast] = useState(""),
    [token, setToken] = useState("");
  useEffect(() => {
    const event = new EventSource("/api/events");
    event.onmessage = (e) => {
      setSnapshot(JSON.parse(e.data));
      setConnected(true);
      setError("");
    };
    event.onerror = () => setConnected(false);
    fetch("/api/model-report")
      .then((r) => {
        if (!r.ok) throw Error("Model report unavailable");
        return r.json();
      })
      .then(setReport)
      .catch((e) => setError(e.message));
    fetch("/api/runbooks")
      .then((r) => r.json())
      .then(setDocs)
      .catch(() => setError("Runbooks unavailable"));
    return () => event.close();
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  async function post(path: string, data: unknown) {
    const r = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(data),
    });
    if (!r.ok) {
      let msg = "Request failed";
      try {
        msg = (await r.json()).detail;
      } catch {}
      throw Error(typeof msg === "string" ? msg : JSON.stringify(msg));
    }
    const result = await r.json();
    const fresh = await fetch("/api/snapshot");
    if (fresh.ok) setSnapshot(await fresh.json());
    return result;
  }
  async function action(fn: () => Promise<void>) {
    setError("");
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }
  const asset = snapshot?.assets.find((a) => a.id === selected);
  const alerts =
    snapshot?.assets.filter((a) => (a.score ?? 0) >= snapshot.threshold) || [];
  const visible =
    snapshot?.assets.filter(
      (a) =>
        (line === "All production lines" || a.line === line) &&
        `${a.id} ${a.name}`.toLowerCase().includes(filter.toLowerCase()),
    ) || [];
  function exportSnapshot() {
    if (!snapshot) return;
    const a = document.createElement("a");
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(snapshot, null, 2)], {
        type: "application/json",
      }),
    );
    a.href = url;
    a.download = "forgesignal-snapshot.json";
    a.click();
    URL.revokeObjectURL(url);
    setToast("Timestamped snapshot exported");
  }
  return (
    <div className="shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="ForgeSignal home">
          <div className="brand-icon">
            <Activity size={23} />
          </div>
          forge<span>signal</span>
        </a>
        <div className="workspace">
          <div className="workspace-symbol">
            <Factory size={17} />
          </div>
          <div>
            Demo manufacturing<small>Operations workspace</small>
          </div>
          <ChevronDown size={14} />
        </div>
        <p className="nav-label">WORKSPACE</p>
        <nav>
          {[
            { name: "Overview", icon: LayoutDashboard },
            { name: "Work orders", icon: ClipboardCheck },
            { name: "Evidence library", icon: BookOpen },
            { name: "Model evaluation", icon: FlaskConical },
          ].map(({ name, icon: Icon }) => (
            <button
              className={tab === name ? "nav-item active" : "nav-item"}
              key={name}
              onClick={() => setTab(name)}
            >
              <Icon size={17} />
              {name}
              {name === "Work orders" && (
                <span className="nav-count">
                  {snapshot?.orders.filter((o) => o.status === "pending")
                    .length || 0}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sandbox">
            <FlaskConical size={16} />
            <b>Research sandbox</b>
            <p>
              Synthetic data. Real workflow.
              <br />
              No equipment is connected.
            </p>
            <a
              href="https://archive.ics.uci.edu/dataset/601/ai4i+2020+predictive+maintenance+dataset"
              target="_blank"
              rel="noreferrer"
            >
              View dataset <ArrowRight size={13} />
            </a>
          </div>
          <div className="profile">
            <div className="avatar">OP</div>
            <div>
              Operations analyst<small>Local demo workspace</small>
            </div>
            <CircleHelp size={17} />
          </div>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <ChevronRight size={13} /> <span>{tab}</span>
          </div>
          <div className="header-status">
            <span className={"dot " + (connected ? "green" : "amber")} />
            {connected ? "Stream connected" : "Reconnecting…"}
            <span className="divider" />
            <span>UCI AI4I / 2020</span>
          </div>
        </header>
        <div className="content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                FORGESIGNAL / OPERATIONS INTELLIGENCE
              </div>
              <h1>
                {tab === "Overview"
                  ? "A clearer view of your floor."
                  : tab === "Work orders"
                    ? "From insight to action."
                    : tab === "Evidence library"
                      ? "Evidence before answers."
                      : "Measure before you trust."}
              </h1>
              <p>
                {tab === "Overview"
                  ? "Monitor asset health, investigate signals, and plan the next right action."
                  : tab === "Work orders"
                    ? "Review maintenance proposals with a traceable human decision."
                    : tab === "Evidence library"
                      ? "Five illustrative procedures power retrieval and cited recommendations."
                      : "Reproducible holdout results. Every metric has a defined boundary."}
              </p>
            </div>
            <button
              className="button secondary"
              onClick={exportSnapshot}
              disabled={!snapshot}
            >
              <ArrowDownToLine size={16} />
              Export snapshot
            </button>
          </div>
          {error && (
            <div role="alert" className="error">
              {error}
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                <X size={15} />
              </button>
            </div>
          )}
          {snapshot?.write_auth_required && (
            <label className="auth">
              Supervisor write token{" "}
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Required for replay and decisions"
                autoComplete="off"
              />
            </label>
          )}
          {!snapshot ? (
            <div className="loading">
              <Radio />
              Connecting to the operations service…
              <p>Start the API at port 8000 to load the fleet.</p>
            </div>
          ) : (
            <>
              {tab === "Overview" && (
                <>
                  <div className="toolbar">
                    <div className="toolbar-left">
                      <span className="location">
                        <Factory size={17} />
                        Demo facility
                      </span>
                      <span className="divider" />
                      <select
                        aria-label="Production line"
                        value={line}
                        onChange={(e) => setLine(e.target.value)}
                      >
                        <option>All production lines</option>
                        <option>Machining A</option>
                        <option>Machining B</option>
                      </select>
                    </div>
                    <div className="replay-controls">
                      <span className="replay-label">
                        <span
                          className={
                            "dot " +
                            (snapshot.replay_running ? "green" : "gray")
                          }
                        />
                        {snapshot.replay_running
                          ? "Replay running"
                          : "Replay paused"}
                      </span>
                      <button
                        className="button dark small"
                        disabled={busy}
                        onClick={() =>
                          action(async () => {
                            await post("/api/replay", {
                              running: !snapshot.replay_running,
                            });
                          })
                        }
                      >
                        {snapshot.replay_running ? (
                          <Pause size={14} />
                        ) : (
                          <Play size={14} />
                        )}{" "}
                        {snapshot.replay_running ? "Pause" : "Start replay"}
                      </button>
                    </div>
                  </div>
                  <div className="metrics-grid">
                    <div className="metric">
                      <span>
                        MONITORED ASSETS
                        <Factory size={16} />
                      </span>
                      <strong>
                        {snapshot.assets.length.toString().padStart(2, "0")}
                        <small>/ 06</small>
                      </strong>
                      <p>Across 2 production lines</p>
                    </div>
                    <div className="metric">
                      <span>
                        REQUIRING ATTENTION
                        <Activity size={16} />
                      </span>
                      <strong className="amber-text">
                        {alerts.length.toString().padStart(2, "0")}
                      </strong>
                      <p>Score ≥ {pct(snapshot.threshold)} alert threshold</p>
                    </div>
                    <div className="metric">
                      <span>
                        TELEMETRY EVENTS
                        <Radio size={16} />
                      </span>
                      <strong>{snapshot.events.toLocaleString()}</strong>
                      <p>Validated and stored in SQL</p>
                    </div>
                    <div className="metric">
                      <span>
                        MODEL AVG. PRECISION
                        <FlaskConical size={16} />
                      </span>
                      <strong>
                        {report
                          ? pct(Number(report.test.average_precision))
                          : "—"}
                      </strong>
                      <p>2,000 held-out synthetic records</p>
                    </div>
                  </div>
                  {alerts.length > 0 ? (
                    <div className="attention">
                      <div className="attention-icon">
                        <Activity size={19} />
                      </div>
                      <div>
                        <b>
                          {alerts.length} asset{alerts.length > 1 ? "s" : ""}{" "}
                          above the review threshold
                        </b>
                        <p>
                          Review the operating signals and supporting procedures
                          before planning maintenance.
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setSelected(alerts[0].id);
                          document
                            .getElementById("asset-detail")
                            ?.scrollIntoView({
                              behavior: "smooth",
                              block: "center",
                            });
                        }}
                      >
                        Review signals <ArrowRight size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="attention calm">
                      <ShieldCheck size={23} />
                      <div>
                        <b>No assets above the review threshold</b>
                        <p>
                          Keep monitoring. A low score does not guarantee a
                          fault-free asset.
                        </p>
                      </div>
                    </div>
                  )}
                  <section className="fleet-section">
                    <div className="section-heading">
                      <h2>
                        Asset health <span>{visible.length} assets</span>
                      </h2>
                      <label className="search">
                        <Search size={15} />
                        <input
                          value={filter}
                          onChange={(e) => setFilter(e.target.value)}
                          placeholder="Find an asset"
                          aria-label="Find an asset"
                        />
                      </label>
                    </div>
                    <div className="asset-grid">
                      {visible.map((a) => {
                        const alert = (a.score ?? 0) >= snapshot.threshold;
                        return (
                          <button
                            key={a.id}
                            className={
                              "asset-card " +
                              (selected === a.id ? "selected " : "") +
                              (alert ? "warning" : "")
                            }
                            onClick={() => {
                              setSelected(a.id);
                              setAnswer(null);
                            }}
                            aria-pressed={selected === a.id}
                          >
                            <div className="asset-top">
                              <div className="machine-icon">
                                <Factory size={20} />
                              </div>
                              <span
                                className={
                                  "badge " + (alert ? "warn" : "healthy")
                                }
                              >
                                <span className="dot" />
                                {alert ? "Review" : "Monitoring"}
                              </span>
                            </div>
                            <div className="asset-name">
                              <b>{a.id}</b>
                              <span>{a.name}</span>
                            </div>
                            <div className="asset-line">
                              {a.line}
                              <span>Type {a.reading?.type}</span>
                            </div>
                            <div className="score-row">
                              <div>
                                <span>FAILURE SCORE</span>
                                <strong>{pct(a.score ?? 0)}</strong>
                              </div>
                              <Sparkline
                                values={a.history.map((h) => h.score)}
                                alert={alert}
                              />
                            </div>
                            <div className="asset-footer">
                              <span>
                                {a.reading?.rpm.toFixed(0)} <small>rpm</small>
                              </span>
                              <span>
                                {a.reading?.torque.toFixed(1)} <small>Nm</small>
                              </span>
                              <ChevronRight size={15} />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    {!visible.length && (
                      <p className="empty">No assets match your filters.</p>
                    )}
                  </section>
                  {asset && (
                    <section className="detail" id="asset-detail">
                      <div className="detail-main">
                        <div className="section-heading">
                          <h2>
                            {asset.id} <span>Signal detail</span>
                          </h2>
                          <span className="timestamp">
                            Updated{" "}
                            {asset.timestamp ? clock(asset.timestamp) : "—"}
                          </span>
                        </div>
                        <div className="signal-grid">
                          {[
                            [
                              "Air temperature",
                              asset.reading?.air_temperature.toFixed(1),
                              "K",
                            ],
                            [
                              "Process temperature",
                              asset.reading?.process_temperature.toFixed(1),
                              "K",
                            ],
                            [
                              "Rotational speed",
                              asset.reading?.rpm.toFixed(0),
                              "rpm",
                            ],
                            ["Torque", asset.reading?.torque.toFixed(1), "Nm"],
                            [
                              "Tool wear",
                              asset.reading?.tool_wear.toFixed(0),
                              "min",
                            ],
                          ].map(([label, value, unit]) => (
                            <div key={label}>
                              <span>{label}</span>
                              <b>
                                {value}
                                <small> {unit}</small>
                              </b>
                            </div>
                          ))}
                        </div>
                        <div className="history-label">
                          <span>Recent failure scores</span>
                          <span>
                            Last {asset.history.length} readings · replay time
                          </span>
                        </div>
                        <Sparkline
                          values={asset.history.map((h) => h.score)}
                          alert={(asset.score ?? 0) >= snapshot.threshold}
                          large
                        />
                        <div className="detail-note">
                          <CircleHelp size={14} />
                          An uncalibrated classifier score, not a
                          time-to-failure estimate.
                        </div>
                      </div>
                      <div className="next-action">
                        <div className="ai-label">
                          <Sparkles size={16} /> EVIDENCE ASSISTANT
                        </div>
                        <h3>Investigate with context.</h3>
                        <p>
                          Retrieve relevant runbook passages and inspect cited
                          guidance for this asset.
                        </p>
                        <button
                          className="button dark"
                          onClick={() => {
                            setDrawer(true);
                            setAnswer(null);
                          }}
                        >
                          Open investigation <ArrowRight size={15} />
                        </button>
                        <button
                          className="text-button"
                          disabled={busy}
                          onClick={() =>
                            action(async () => {
                              const o = await post("/api/orders", {
                                asset_id: asset.id,
                                title: `Inspect ${asset.id}: review torque, cooling and tool wear`,
                              });
                              setToast(
                                `Work order #${o.id} drafted for supervisor review`,
                              );
                            })
                          }
                        >
                          <ClipboardCheck size={15} />
                          Draft work order
                        </button>
                        <small>Planning only. Human approval required.</small>
                      </div>
                    </section>
                  )}
                </>
              )}
              {tab === "Work orders" && (
                <>
                  <div className="section-heading">
                    <h2>
                      Maintenance review queue{" "}
                      <span>{snapshot.orders.length} proposals</span>
                    </h2>
                    <span className="badge neutral">
                      <ShieldCheck size={13} />
                      Human decision required
                    </span>
                  </div>
                  <div className="panel">
                    {snapshot.orders.length === 0 ? (
                      <div className="empty">
                        <ClipboardCheck size={30} />
                        <h3>Your review queue is clear.</h3>
                        <p>
                          Select an asset in Overview and draft a work order to
                          begin.
                        </p>
                        <button
                          className="button dark"
                          onClick={() => setTab("Overview")}
                        >
                          Explore assets
                        </button>
                      </div>
                    ) : (
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>WORK ORDER</th>
                              <th>ASSET / CREATED</th>
                              <th>STATUS</th>
                              <th>DECISION</th>
                            </tr>
                          </thead>
                          <tbody>
                            {snapshot.orders.map((o) => (
                              <tr key={o.id}>
                                <td>
                                  <b>WO-{String(o.id).padStart(3, "0")}</b>
                                  <p>{o.title}</p>
                                  <details>
                                    <summary>Captured evidence</summary>
                                    <pre>
                                      {JSON.stringify(
                                        JSON.parse(o.evidence),
                                        null,
                                        2,
                                      )}
                                    </pre>
                                  </details>
                                </td>
                                <td>
                                  {o.asset_id}
                                  <small>
                                    {new Date(o.created_at).toLocaleString()}
                                  </small>
                                </td>
                                <td>
                                  <span
                                    className={
                                      "badge " +
                                      (o.status === "approved"
                                        ? "healthy"
                                        : o.status === "pending"
                                          ? "warn"
                                          : "neutral")
                                    }
                                  >
                                    {o.status}
                                  </span>
                                </td>
                                <td>
                                  {o.status === "pending" ? (
                                    <div className="decisions">
                                      <button
                                        className="button small dark"
                                        disabled={busy}
                                        onClick={() =>
                                          action(async () => {
                                            await post(
                                              `/api/orders/${o.id}/decision`,
                                              { status: "approved" },
                                            );
                                            setToast(
                                              "Approval recorded in audit log",
                                            );
                                          })
                                        }
                                      >
                                        <Check size={14} />
                                        Approve
                                      </button>
                                      <button
                                        className="button small secondary"
                                        disabled={busy}
                                        onClick={() =>
                                          action(async () => {
                                            await post(
                                              `/api/orders/${o.id}/decision`,
                                              { status: "rejected" },
                                            );
                                            setToast(
                                              "Rejection recorded in audit log",
                                            );
                                          })
                                        }
                                      >
                                        Reject
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="muted">
                                      <CheckCheck size={16} />
                                      Decision recorded
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                  <h2 className="audit-heading">Decision audit trail</h2>
                  <div className="panel audit">
                    {snapshot.audit.length ? (
                      snapshot.audit.map((a) => (
                        <div key={a.id}>
                          <span className="audit-mark" />
                          <b>
                            WO-{String(a.order_id).padStart(3, "0")} ·{" "}
                            {a.action}
                          </b>
                          <span>{a.actor}</span>
                          <time>{clock(a.timestamp)}</time>
                        </div>
                      ))
                    ) : (
                      <p className="empty">
                        Decisions appear here as they happen.
                      </p>
                    )}
                  </div>
                </>
              )}
              {tab === "Evidence library" && (
                <>
                  <div className="notice">
                    <BookOpen size={20} />
                    <p>
                      These procedures are authored examples for this demo.
                      Replace them with approved site manuals before operational
                      use. Retrieval uses local TF-IDF vectors with cosine
                      similarity.
                    </p>
                  </div>
                  <div className="docs-grid">
                    {docs.map((d) => (
                      <article className="panel doc" key={d.id}>
                        <span className="doc-id">
                          {d.id} / ILLUSTRATIVE RUNBOOK
                        </span>
                        <h2>{d.title}</h2>
                        <p>{d.body}</p>
                        <span className="badge neutral">
                          <Check size={12} />
                          Indexed · citation ready
                        </span>
                      </article>
                    ))}
                  </div>
                </>
              )}
              {tab === "Model evaluation" && report && (
                <>
                  <div className="notice">
                    <FlaskConical size={21} />
                    <p>
                      Current-state classification on a synthetic benchmark.
                      Random stratified 60/20/20 split, seed 42. Threshold
                      chosen on validation F1; final metrics below use the
                      held-out test partition.
                    </p>
                  </div>
                  <div className="metrics-grid">
                    {[
                      [
                        "Average precision",
                        Number(report.test.average_precision),
                      ],
                      ["Precision", Number(report.test.precision)],
                      ["Recall", Number(report.test.recall)],
                      ["ROC AUC", Number(report.test.roc_auc)],
                    ].map(([name, v]) => (
                      <div className="metric" key={name}>
                        <span>{name}</span>
                        <strong>{pct(Number(v))}</strong>
                        <p>
                          Test partition · n ={" "}
                          {report.split.test.toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="evaluation-grid">
                    <div className="panel eval-card">
                      <h2>Model vs. baseline</h2>
                      <p>Average precision · higher is better</p>
                      {[
                        [
                          "Gradient boosting",
                          Number(report.test.average_precision),
                        ],
                        ["Prior baseline", report.baseline.average_precision],
                      ].map(([name, val]) => (
                        <div className="bar-row" key={name}>
                          <span>{name}</span>
                          <div>
                            <i style={{ width: pct(Number(val)) }} />
                          </div>
                          <b>{pct(Number(val))}</b>
                        </div>
                      ))}
                      <div className="model-facts">
                        <span>
                          Test positives
                          <b>
                            {report.test_positives} / {report.split.test}
                          </b>
                        </span>
                        <span>
                          Decision threshold<b>{pct(report.threshold)}</b>
                        </span>
                        <span>
                          Model family<b>Histogram gradient boosting</b>
                        </span>
                      </div>
                    </div>
                    <div className="panel eval-card">
                      <h2>Confusion matrix</h2>
                      <p>Rows = actual · columns = predicted</p>
                      <div className="confusion">
                        <span />
                        <label>Healthy</label>
                        <label>Failure</label>
                        <label>Healthy</label>
                        <b>
                          {(report.test.confusion_matrix as number[][])[0][0]}
                        </b>
                        <b>
                          {(report.test.confusion_matrix as number[][])[0][1]}
                        </b>
                        <label>Failure</label>
                        <b>
                          {(report.test.confusion_matrix as number[][])[1][0]}
                        </b>
                        <b>
                          {(report.test.confusion_matrix as number[][])[1][1]}
                        </b>
                      </div>
                    </div>
                  </div>
                  <div className="panel eval-card">
                    <h2>What these results establish</h2>
                    <ul>
                      {report.limitations.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                    <h3>Leakage controls</h3>
                    <p>
                      Six input features only. UID, product ID, target and all
                      failure subtype labels are excluded. Replay asset IDs and
                      timestamps are synthetic display metadata.
                    </p>
                    <details>
                      <summary>Dataset SHA-256 and feature contract</summary>
                      <code className="hash">{report.sha256}</code>
                      <p>{report.features.join(" · ")}</p>
                    </details>
                  </div>
                </>
              )}
            </>
          )}
          <footer>
            <span>
              ForgeSignal <span className="footer-slash">/</span> Built for
              evidence-led decisions.
            </span>
            <span>
              <ShieldCheck size={13} />
              Synthetic benchmark · No physical actuation
            </span>
          </footer>
        </div>
      </main>
      {drawer && (
        <div className="overlay" onClick={() => setDrawer(false)}>
          <aside
            className="drawer"
            aria-label="Evidence investigation"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="drawer-heading">
              <div>
                <div className="eyebrow">EVIDENCE INVESTIGATION</div>
                <h2>
                  {asset?.id} <span> / {asset?.name}</span>
                </h2>
              </div>
              <button
                className="icon-button"
                aria-label="Close investigation"
                onClick={() => setDrawer(false)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="drawer-context">
              <Factory size={20} />
              <span>
                Failure score <b>{pct(asset?.score ?? 0)}</b>
              </span>
              <span>
                Torque <b>{asset?.reading?.torque} Nm</b>
              </span>
              <span>
                Tool wear <b>{asset?.reading?.tool_wear} min</b>
              </span>
            </div>
            <label className="question-label" htmlFor="question">
              What would you like to investigate?
            </label>
            <textarea
              id="question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              maxLength={1500}
            />
            <div className="suggestions">
              {[
                "Cooling and thermal dissipation",
                "Tool wear and overstrain",
                "Work order approval",
              ].map((q) => (
                <button key={q} onClick={() => setQuestion(q)}>
                  {q}
                </button>
              ))}
            </div>
            <button
              className="button dark investigate"
              disabled={busy || question.trim().length < 3}
              onClick={() =>
                action(async () => {
                  setAnswer(
                    await post("/api/assistant", {
                      question,
                      asset_id: selected,
                    }),
                  );
                })
              }
            >
              <Sparkles size={16} />
              {busy ? "Retrieving evidence…" : "Retrieve guidance"}
            </button>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            {answer ? (
              <div className="answer">
                <div className="answer-label">
                  <ShieldCheck size={16} />
                  Evidence response<span>{answer.mode}</span>
                </div>
                <div className="answer-text">{answer.answer}</div>
                <h3>Sources</h3>
                {answer.sources.map((d) => (
                  <details className="source" key={d.id}>
                    <summary>
                      <span>{d.id}</span>
                      {d.title}
                    </summary>
                    <p>{d.body}</p>
                  </details>
                ))}
                <details className="trace">
                  <summary>Workflow execution trace</summary>
                  {answer.trace.map((s) => (
                    <p key={s}>
                      <Check size={13} />
                      {s}
                    </p>
                  ))}
                </details>
              </div>
            ) : (
              <div className="assistant-empty">
                <BookOpen size={30} />
                <h3>Start with the evidence.</h3>
                <p>
                  The assistant searches five runbooks. Without an API key it
                  returns cited source passages. With a key it can synthesize
                  guidance from those passages.
                </p>
              </div>
            )}
            <div className="drawer-bottom">
              <button
                className="button secondary"
                disabled={busy}
                onClick={() =>
                  action(async () => {
                    const o = await post("/api/orders", {
                      asset_id: selected,
                      title: `Inspect ${selected}: review operating signals`,
                    });
                    setToast(`Work order #${o.id} drafted`);
                    setDrawer(false);
                    setTab("Work orders");
                  })
                }
              >
                <ClipboardCheck size={16} />
                Draft work order
              </button>
              <small>Guidance only. Follow approved site procedures.</small>
            </div>
          </aside>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          {toast}
        </div>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
