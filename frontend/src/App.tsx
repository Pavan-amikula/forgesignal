import { useEffect, useRef, useState } from "react";
import { Table2 } from "lucide-react";
import {
  Activity,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Columns3,
  Copy,
  ExternalLink,
  Factory,
  FileText,
  Filter,
  KeyRound,
  Layers,
  Link,
  Maximize2,
  PanelRightClose,
  PanelRightOpen,
  Pause,
  Play,
  Plus,
  Radio,
  Save,
  Search,
  ShieldCheck,
  Star,
  X,
  FlaskConical,
} from "lucide-react";
import {
  Asset,
  Snapshot,
  Report,
  Doc,
  Answer,
  Metric,
  METRICS,
  pct,
  time,
  download,
} from "./types";
import { TrendChart, MiniTrend } from "./components/TrendChart";
import { FacilityPlan } from "./components/FacilityPlan";
import { Dialog } from "./components/Dialog";
import { ReviewQueue } from "./components/ReviewQueue";
import { ReferenceViews } from "./components/ReferenceViews";

const PAGES = [
  { id: "monitor", name: "Asset monitor", icon: Layers },
  { id: "explorer", name: "Signal explorer", icon: Activity },
  { id: "orders", name: "Review queue", icon: ClipboardList },
  { id: "library", name: "Procedure library", icon: BookOpen },
  { id: "validation", name: "Model validation", icon: FlaskConical },
];
type SavedView = {
  name: string;
  line: string;
  status: string;
  sort: string;
  search: string;
  layout: string;
};
const query = new URLSearchParams(window.location.search);
function stored<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback;
  } catch {
    return fallback;
  }
}
export function StatePill({
  score,
  threshold,
}: {
  score: number;
  threshold: number;
}) {
  return (
    <span
      className={`state-pill ${score >= threshold ? "attention" : "normal"}`}
    >
      <i />
      {score >= threshold ? "Review" : "Monitoring"}
    </span>
  );
}
export default function App() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null),
    [report, setReport] = useState<Report | null>(null),
    [docs, setDocs] = useState<Doc[]>([]);
  const [page, setPage] = useState(
      PAGES.some((p) => p.id === query.get("page"))
        ? query.get("page")!
        : "monitor",
    ),
    [selected, setSelected] = useState(
      /^CNC-0[1-6]$/.test(query.get("asset") ?? "")
        ? query.get("asset")!
        : "CNC-01",
    );
  const [line, setLine] = useState(query.get("line") ?? "All lines"),
    [status, setStatus] = useState(query.get("status") ?? "all"),
    [search, setSearch] = useState(query.get("q") ?? ""),
    [sort, setSort] = useState(query.get("sort") ?? "score"),
    [layout, setLayout] = useState("table");
  const [frozen, setFrozen] = useState(false),
    [connected, setConnected] = useState(false),
    [streamCount, setStreamCount] = useState(0),
    [showInspector, setShowInspector] = useState(true),
    [inspectorTab, setInspectorTab] = useState("signals");
  const latest = useRef<Snapshot | null>(null),
    freezeRef = useRef(false),
    searchRef = useRef<HTMLInputElement>(null);
  const [compare, setCompare] = useState<string[]>([]),
    [metric, setMetric] = useState<Metric>("score"),
    [windowSize, setWindowSize] = useState(30);
  const [watch, setWatch] = useState<string[]>(stored("forge.watch", [])),
    [views, setViews] = useState<SavedView[]>(stored("forge.views", []));
  const [modal, setModal] = useState<
      | null
      | "command"
      | "save"
      | "proposal"
      | "investigate"
      | "source"
      | "access"
    >(null),
    [command, setCommand] = useState(""),
    [viewName, setViewName] = useState("");
  const [investigationAsset, setInvestigationAsset] = useState<Asset | null>(
      null,
    ),
    [question, setQuestion] = useState(""),
    [answer, setAnswer] = useState<Answer | null>(null);
  const [proposal, setProposal] = useState({
    asset_id: "CNC-01",
    title: "",
    priority: "normal",
    assignee: "",
    due_date: "",
    notes: "",
  });
  const [orderId, setOrderId] = useState<number | null>(null),
    [docId, setDocId] = useState("RB-01"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [token, setToken] = useState("");
  useEffect(() => {
    const event = new EventSource("/api/events");
    event.onmessage = (e) => {
      const next = JSON.parse(e.data) as Snapshot;
      latest.current = next;
      setConnected(true);
      setStreamCount((c) => c + 1);
      if (!freezeRef.current) setSnapshot(next);
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
      .then((r) => {
        if (!r.ok) throw Error("Procedure library unavailable");
        return r.json();
      })
      .then(setDocs)
      .catch((e) => setError(e.message));
    return () => event.close();
  }, []);
  useEffect(() => {
    const q = new URLSearchParams({
      page,
      asset: selected,
      line,
      status,
      sort,
    });
    if (search) q.set("q", search);
    window.history.replaceState(null, "", `${window.location.pathname}?${q}`);
  }, [page, selected, line, status, sort, search]);
  useEffect(() => {
    try {
      localStorage.setItem("forge.watch", JSON.stringify(watch));
      localStorage.setItem("forge.views", JSON.stringify(views));
    } catch {
      setError("Browser storage unavailable; changes remain in this session.");
    }
  }, [watch, views]);
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setModal((v) => (v === "command" ? null : "command"));
        setCommand("");
      } else if (
        e.key === "/" &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(
          (e.target as HTMLElement).tagName,
        )
      ) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(id);
  }, [toast]);
  useEffect(() => {
    if (page !== "monitor" && page !== "explorer" && freezeRef.current) {
      freezeRef.current = false;
      setFrozen(false);
      if (latest.current) setSnapshot(latest.current);
    }
  }, [page]);
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
      const body = await r.json().catch(() => ({ detail: "Request failed" }));
      throw Error(
        typeof body.detail === "string"
          ? body.detail
          : JSON.stringify(body.detail),
      );
    }
    const result = await r.json();
    const next = await fetch("/api/snapshot");
    if (next.ok) {
      latest.current = await next.json();
      if (!freezeRef.current) setSnapshot(latest.current);
    }
    return result;
  }
  async function act(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }
  function toggleFreeze() {
    freezeRef.current = !freezeRef.current;
    setFrozen(freezeRef.current);
    if (!freezeRef.current && latest.current) setSnapshot(latest.current);
  }
  function go(id: string) {
    setSelected(id);
    setShowInspector(true);
    setInspectorTab("signals");
  }
  function reveal(id: string) {
    go(id);
    setPage("monitor");
    setStatus("all");
    setLine("All lines");
    setSearch("");
  }
  function follow(id: string) {
    setWatch((list) =>
      list.includes(id) ? list.filter((a) => a !== id) : [...list, id],
    );
  }
  function draft(id = selected) {
    const a = snapshot?.assets.find((a) => a.id === id);
    setProposal({
      asset_id: id,
      title: `Inspect ${id}: review operating signals`,
      priority:
        (a?.score ?? 0) >= (snapshot?.threshold ?? 1) ? "high" : "normal",
      assignee: "",
      due_date: "",
      notes: "",
    });
    setModal("proposal");
  }
  function investigate(a: Asset) {
    setInvestigationAsset(a);
    setQuestion("What should I inspect for torque, cooling and tool wear?");
    setAnswer(null);
    setModal("investigate");
  }
  function applyView(v: SavedView) {
    setLine(v.line);
    setStatus(v.status);
    setSort(v.sort);
    setSearch(v.search);
    setLayout(v.layout);
    setPage("monitor");
    setToast(`View applied: ${v.name}`);
  }
  async function share() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setToast("Link copied with asset and filter selections");
    } catch {
      setToast("Copy the current address to share this view");
    }
  }
  const asset = snapshot?.assets.find((a) => a.id === selected),
    threshold = snapshot?.threshold ?? 0.24;
  const pending = snapshot?.orders.filter((o) => o.status === "pending") ?? [],
    alerts = snapshot?.assets.filter((a) => (a.score ?? 0) >= threshold) ?? [];
  const visible = (snapshot?.assets ?? [])
    .filter(
      (a) =>
        (line === "All lines" || a.line === line) &&
        `${a.id} ${a.name}`.toLowerCase().includes(search.toLowerCase()) &&
        (status === "all" ||
          (status === "attention" && (a.score ?? 0) >= threshold) ||
          (status === "following" && watch.includes(a.id)) ||
          (status === "orders" && pending.some((o) => o.asset_id === a.id))),
    )
    .sort((a, b) =>
      sort === "id"
        ? a.id.localeCompare(b.id)
        : sort === "torque"
          ? (b.reading?.torque ?? 0) - (a.reading?.torque ?? 0)
          : sort === "wear"
            ? (b.reading?.tool_wear ?? 0) - (a.reading?.tool_wear ?? 0)
            : (b.score ?? 0) - (a.score ?? 0),
    );
  const chartAssets = compare.length
    ? (snapshot?.assets.filter((a) => compare.includes(a.id)) ?? [])
    : asset
      ? [asset]
      : [];
  const pageName = PAGES.find((p) => p.id === page)?.name ?? "Asset monitor",
    activeFilters =
      Number(line !== "All lines") +
      Number(status !== "all") +
      Number(Boolean(search));
  const liveRunning =
    latest.current?.replay_running ?? snapshot?.replay_running ?? false;
  function exportAssets() {
    const rows = [
      [
        "Asset",
        "Name",
        "Line",
        "State",
        "Failure score",
        "RPM",
        "Torque (Nm)",
        "Process temperature (K)",
        "Tool wear (min)",
        "Arrival timestamp",
      ],
      ...visible.map((a) => [
        a.id,
        a.name,
        a.line,
        (a.score ?? 0) >= threshold ? "Review" : "Monitoring",
        String(a.score),
        String(a.reading?.rpm),
        String(a.reading?.torque),
        String(a.reading?.process_temperature),
        String(a.reading?.tool_wear),
        a.timestamp ?? "",
      ]),
    ];
    download(
      "forgesignal-assets.csv",
      rows
        .map((row) =>
          row.map((v) => '"' + String(v).replaceAll('"', '""') + '"').join(","),
        )
        .join("\r\n"),
      "text/csv",
    );
    setToast(`Exported ${visible.length} filtered assets`);
  }
  function toggleCompare(id: string) {
    if (compare.includes(id)) setCompare(compare.filter((a) => a !== id));
    else if (compare.length < 3) setCompare([...compare, id]);
    else setToast("Compare up to three assets at a time");
  }

  return (
    <div className="app-shell">
      <header className="masthead">
        <a className="brand" href="/" aria-label="ForgeSignal home">
          <span className="brand-mark">
            <i />
            <i />
            <i />
          </span>
          ForgeSignal<span className="product-tag">OPERATIONS</span>
        </a>
        <div className="masthead-center">
          <Factory size={15} />
          <span>Demo facility</span>
          <span className="masthead-slash">/</span>
          <span className="environment">Research workspace</span>
        </div>
        <button
          className="global-search"
          aria-label="Search workspace"
          onClick={() => {
            setModal("command");
            setCommand("");
          }}
        >
          <Search size={15} />
          <span>Jump to asset, order, procedure…</span>
          <kbd>Ctrl K</kbd>
        </button>
        {snapshot?.write_auth_required && (
          <button
            className="masthead-access"
            aria-label="Supervisor write access"
            title="Supervisor write access"
            onClick={() => setModal("access")}
          >
            <KeyRound size={14} />
          </button>
        )}
        <span className={`stream-status ${connected ? "online" : ""}`}>
          <i />
          {connected ? "Connected" : "Reconnecting"}
        </span>
      </header>
      <aside className="navigation">
        <div className="nav-section-label">WORKSPACE</div>
        <nav>
          {PAGES.map(({ id, name, icon: Icon }, i) => (
            <div key={id}>
              {i === 3 && (
                <div className="nav-section-label references-label">
                  REFERENCE
                </div>
              )}
              <button
                className={`nav-link ${page === id ? "active" : ""}`}
                aria-label={name}
                onClick={() => setPage(id)}
              >
                <Icon size={17} />
                <span>{name}</span>
                {id === "orders" && pending.length > 0 && (
                  <b>{pending.length}</b>
                )}
              </button>
            </div>
          ))}
        </nav>
        <div className="nav-section-label asset-tree-label">
          PRODUCTION LINES
        </div>
        <button
          className={`tree-line ${line === "All lines" ? "current" : ""}`}
          onClick={() => {
            setLine("All lines");
            setPage("monitor");
          }}
        >
          <Layers size={13} />
          All assets<span>6</span>
        </button>
        {["Machining A", "Machining B"].map((name) => (
          <div key={name} className="tree-group">
            <button
              className={`tree-line ${line === name ? "current" : ""}`}
              onClick={() => {
                setLine(name);
                setPage("monitor");
              }}
            >
              <ChevronDown size={12} />
              {name}
              <span>03</span>
            </button>
            {snapshot?.assets
              .filter((a) => a.line === name)
              .map((a) => (
                <button
                  key={a.id}
                  className={`tree-asset ${a.id === selected ? "current" : ""}`}
                  onClick={() => {
                    go(a.id);
                    setPage("monitor");
                  }}
                >
                  <i
                    className={`state-mark ${(a.score ?? 0) >= threshold ? "attention" : "normal"}`}
                  />
                  {a.id}
                  {watch.includes(a.id) && <Star size={10} />}
                </button>
              ))}
          </div>
        ))}
        <div className="saved-views">
          <div className="nav-section-label">
            MY VIEWS
            <button
              aria-label="Save current view"
              onClick={() => setModal("save")}
            >
              <Plus size={13} />
            </button>
          </div>
          {views.length ? (
            views.map((v, i) => (
              <div className="saved-view" key={v.name}>
                <button onClick={() => applyView(v)}>
                  <Filter size={12} />
                  <span>{v.name}</span>
                </button>
                <button
                  aria-label={`Delete view ${v.name}`}
                  onClick={() => setViews(views.filter((_, n) => n !== i))}
                >
                  <X size={11} />
                </button>
              </div>
            ))
          ) : (
            <p>Save filters you use often.</p>
          )}
        </div>
        <div className="navigation-bottom">
          <button onClick={() => setModal("source")}>
            <Radio size={14} />
            <div>
              AI4I 2020<small>Synthetic telemetry replay</small>
            </div>
            <ExternalLink size={12} />
          </button>
          {snapshot?.write_auth_required && (
            <button onClick={() => setModal("access")}>
              <KeyRound size={14} />
              <span>Write access</span>
              <i className={`state-mark ${token ? "normal" : "attention"}`} />
            </button>
          )}
          <span>Workspace data stays on this server.</span>
        </div>
      </aside>
      <main className="workspace-main">
        <div className="page-bar">
          <div className="crumb">
            Operations
            <ChevronRight size={12} />
            <b>{pageName}</b>
          </div>
          <div className="page-bar-actions">
            <button className="plain-button" onClick={share}>
              <Link size={13} />
              Share view
            </button>
            <button
              className="plain-button"
              onClick={() =>
                download(
                  "forgesignal-snapshot.json",
                  JSON.stringify(snapshot, null, 2),
                )
              }
              disabled={!snapshot}
            >
              <ArrowDownToLine size={13} />
              Snapshot
            </button>
          </div>
        </div>
        {error && (
          <div className="error-banner" role="alert">
            {error}
            <button aria-label="Dismiss error" onClick={() => setError("")}>
              <X size={16} />
            </button>
          </div>
        )}
        {!snapshot ? (
          <div className="connecting">
            <Radio size={30} />
            <h2>Connecting to the operations service</h2>
            <p>Waiting for the first telemetry snapshot on port 8000.</p>
          </div>
        ) : (
          <>
            {(page === "monitor" || page === "explorer") && (
              <>
                <section className="workspace-heading">
                  <div>
                    <div className="section-kicker">
                      PRODUCTION /{" "}
                      {line === "All lines" ? "ALL LINES" : line.toUpperCase()}
                    </div>
                    <h1>
                      {page === "monitor" ? "Asset monitor" : "Signal explorer"}
                    </h1>
                    <p>
                      {page === "monitor"
                        ? "Inspect current conditions and move the right assets into review."
                        : "Compare individual readings, inspect observations and export the evidence."}
                    </p>
                  </div>
                  <div className="live-controls">
                    <button
                      className={`button ${frozen ? "freeze-active" : "secondary"}`}
                      onClick={toggleFreeze}
                    >
                      <Pause size={13} />
                      {frozen ? "Resume live view" : "Freeze view"}
                    </button>
                    <button
                      className="button primary"
                      disabled={busy}
                      onClick={() =>
                        act(async () => {
                          await post("/api/replay", {
                            running: !liveRunning,
                          });
                          setToast(
                            liveRunning
                              ? "Replay paused"
                              : "Server replay started",
                          );
                        })
                      }
                    >
                      {liveRunning ? <Pause size={13} /> : <Play size={13} />}{" "}
                      {liveRunning ? "Pause replay" : "Start replay"}
                    </button>
                  </div>
                </section>
                <div className="operations-strip">
                  <button
                    onClick={() => {
                      setStatus("all");
                      setPage("monitor");
                    }}
                  >
                    <b>06</b>
                    <span>Assets monitored</span>
                  </button>
                  <button
                    className={alerts.length ? "attention-count" : ""}
                    onClick={() => {
                      setStatus("attention");
                      setPage("monitor");
                    }}
                  >
                    <b>{String(alerts.length).padStart(2, "0")}</b>
                    <span>Above review threshold</span>
                  </button>
                  <button onClick={() => setPage("orders")}>
                    <b>{String(pending.length).padStart(2, "0")}</b>
                    <span>Awaiting decision</span>
                  </button>
                  <div className="strip-source">
                    <span className={`dot ${liveRunning ? "live" : ""}`} />
                    <span>
                      {liveRunning
                        ? "Replay active · 2s interval"
                        : "Replay paused"}
                    </span>
                    <strong>{snapshot.events.toLocaleString()} events</strong>
                    <small>
                      {frozen
                        ? "DISPLAY FROZEN"
                        : `Received ${time(snapshot.timestamp)}`}
                    </small>
                  </div>
                </div>
                {frozen && (
                  <div className="frozen-banner">
                    <Pause size={14} />
                    <b>Display frozen at {time(snapshot.timestamp)}</b>
                    <span>
                      The server stream continues. Resume to see the latest
                      readings.
                    </span>
                    <button onClick={toggleFreeze}>
                      Resume live view
                      <ArrowRight size={13} />
                    </button>
                  </div>
                )}
                <div
                  className={`monitor-layout ${!showInspector ? "inspector-hidden" : ""}`}
                >
                  <div className="monitor-content">
                    {page === "monitor" && (
                      <section className="register surface">
                        <div className="register-toolbar">
                          <div className="register-tabs">
                            <button
                              className={status === "all" ? "selected" : ""}
                              onClick={() => setStatus("all")}
                            >
                              All assets <span>6</span>
                            </button>
                            <button
                              className={
                                status === "attention" ? "selected" : ""
                              }
                              onClick={() => setStatus("attention")}
                            >
                              Needs review <span>{alerts.length}</span>
                            </button>
                            <button
                              className={
                                status === "following" ? "selected" : ""
                              }
                              onClick={() => setStatus("following")}
                            >
                              Following <span>{watch.length}</span>
                            </button>
                            <button
                              className={status === "orders" ? "selected" : ""}
                              onClick={() => setStatus("orders")}
                            >
                              Open orders
                            </button>
                          </div>
                          <div className="view-switch">
                            <button
                              aria-label="Table view"
                              aria-pressed={layout === "table"}
                              className={layout === "table" ? "active" : ""}
                              onClick={() => setLayout("table")}
                            >
                              <Table2 size={15} />
                            </button>
                            <button
                              aria-label="Facility view"
                              aria-pressed={layout === "floor"}
                              className={layout === "floor" ? "active" : ""}
                              onClick={() => setLayout("floor")}
                            >
                              <Factory size={15} />
                            </button>
                          </div>
                        </div>
                        <div className="filter-toolbar">
                          <label className="search-field">
                            <Search size={14} />
                            <input
                              ref={searchRef}
                              aria-label="Find an asset"
                              placeholder="Search assets…"
                              value={search}
                              onChange={(e) => setSearch(e.target.value)}
                            />
                            <kbd>/</kbd>
                          </label>
                          <select
                            aria-label="Production line"
                            value={line}
                            onChange={(e) => setLine(e.target.value)}
                          >
                            <option>All lines</option>
                            <option>Machining A</option>
                            <option>Machining B</option>
                          </select>
                          <select
                            aria-label="Sort assets"
                            value={sort}
                            onChange={(e) => setSort(e.target.value)}
                          >
                            <option value="score">Highest score first</option>
                            <option value="id">Asset ID</option>
                            <option value="torque">Highest torque</option>
                            <option value="wear">Most tool wear</option>
                          </select>
                          <button
                            className="icon-btn"
                            aria-label="Save current filters"
                            title="Save filters"
                            onClick={() => {
                              setViewName("");
                              setModal("save");
                            }}
                          >
                            <Save size={15} />
                          </button>
                          <button
                            className="icon-btn"
                            aria-label="Export filtered assets CSV"
                            title="Export CSV"
                            onClick={exportAssets}
                          >
                            <ArrowDownToLine size={15} />
                          </button>
                          <button
                            className="icon-btn"
                            aria-label={
                              showInspector
                                ? "Hide inspector"
                                : "Show inspector"
                            }
                            title="Toggle inspector"
                            onClick={() => setShowInspector(!showInspector)}
                          >
                            {showInspector ? (
                              <PanelRightClose size={15} />
                            ) : (
                              <PanelRightOpen size={15} />
                            )}
                          </button>
                        </div>
                        {views.length > 0 && (
                          <div className="compact-saved-views">
                            <label htmlFor="saved-view-picker">
                              My saved views
                            </label>
                            <select
                              id="saved-view-picker"
                              aria-label="Saved asset views"
                              value=""
                              onChange={(e) => {
                                const view = views.find(
                                  (v) => v.name === e.target.value,
                                );
                                if (view) applyView(view);
                              }}
                            >
                              <option value="" disabled>
                                Choose a view…
                              </option>
                              {views.map((v) => (
                                <option key={v.name} value={v.name}>
                                  {v.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                        {activeFilters > 0 && (
                          <div className="active-filters">
                            <Filter size={12} />
                            {line !== "All lines" && (
                              <span>
                                {line}
                                <button
                                  aria-label="Clear line filter"
                                  onClick={() => setLine("All lines")}
                                >
                                  <X size={10} />
                                </button>
                              </span>
                            )}
                            {status !== "all" && (
                              <span>
                                {status}
                                <button
                                  aria-label="Clear status filter"
                                  onClick={() => setStatus("all")}
                                >
                                  <X size={10} />
                                </button>
                              </span>
                            )}
                            {search && <span>“{search}”</span>}
                            <button
                              className="reset-filter"
                              onClick={() => {
                                setLine("All lines");
                                setStatus("all");
                                setSearch("");
                              }}
                            >
                              Clear filters
                            </button>
                          </div>
                        )}
                        {visible.length === 0 ? (
                          <div className="empty">
                            <Filter size={25} />
                            <h3>No matching assets</h3>
                            <p>Try another line or remove a filter.</p>
                            <button
                              className="button secondary"
                              onClick={() => {
                                setLine("All lines");
                                setStatus("all");
                                setSearch("");
                              }}
                            >
                              Clear filters
                            </button>
                          </div>
                        ) : layout === "floor" ? (
                          <FacilityPlan
                            assets={visible}
                            selected={selected}
                            threshold={threshold}
                            onSelect={go}
                          />
                        ) : (
                          <div className="asset-table-scroll">
                            <table className="asset-table">
                              <thead>
                                <tr>
                                  <th className="check-cell">
                                    <Columns3 size={13} />
                                  </th>
                                  <th>
                                    <button onClick={() => setSort("id")}>
                                      ASSET
                                      <ChevronDown size={10} />
                                    </button>
                                  </th>
                                  <th>CONDITION</th>
                                  <th>
                                    <button onClick={() => setSort("score")}>
                                      SCORE
                                      <ChevronDown size={10} />
                                    </button>
                                  </th>
                                  <th>RPM</th>
                                  <th>
                                    <button onClick={() => setSort("torque")}>
                                      TORQUE
                                      <ChevronDown size={10} />
                                    </button>
                                  </th>
                                  <th>TREND</th>
                                  <th />
                                </tr>
                              </thead>
                              <tbody>
                                {visible.map((a) => (
                                  <tr
                                    key={a.id}
                                    className={
                                      a.id === selected ? "selected" : ""
                                    }
                                    onClick={() => go(a.id)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") go(a.id);
                                    }}
                                    tabIndex={0}
                                    aria-label={`Inspect ${a.id}`}
                                  >
                                    <td
                                      className="check-cell"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <input
                                        type="checkbox"
                                        aria-label={`Compare ${a.id}`}
                                        checked={compare.includes(a.id)}
                                        onChange={() => toggleCompare(a.id)}
                                      />
                                    </td>
                                    <td>
                                      <button
                                        className="asset-id"
                                        onClick={() => go(a.id)}
                                      >
                                        {a.id}
                                      </button>
                                      <span className="asset-name">
                                        {a.name}
                                      </span>
                                    </td>
                                    <td>
                                      <StatePill
                                        score={a.score ?? 0}
                                        threshold={threshold}
                                      />
                                    </td>
                                    <td>
                                      <span
                                        className={`score-value ${(a.score ?? 0) >= threshold ? "warning-text" : ""}`}
                                      >
                                        {pct(a.score ?? 0)}
                                      </span>
                                      <span className="micro-bar">
                                        <i
                                          style={{
                                            width: pct(a.score ?? 0),
                                            background:
                                              (a.score ?? 0) >= threshold
                                                ? "#c47a27"
                                                : "#8a9fca",
                                          }}
                                        />
                                      </span>
                                    </td>
                                    <td className="numeric">
                                      {a.reading?.rpm.toFixed(0)}
                                      <small>rpm</small>
                                    </td>
                                    <td className="numeric">
                                      {a.reading?.torque.toFixed(1)}
                                      <small>Nm</small>
                                    </td>
                                    <td>
                                      <MiniTrend asset={a} />
                                    </td>
                                    <td onClick={(e) => e.stopPropagation()}>
                                      <button
                                        className={`icon-btn follow-btn ${watch.includes(a.id) ? "followed" : ""}`}
                                        aria-label={`${watch.includes(a.id) ? "Unfollow" : "Follow"} ${a.id}`}
                                        onClick={() => follow(a.id)}
                                      >
                                        <Star
                                          size={14}
                                          fill={
                                            watch.includes(a.id)
                                              ? "currentColor"
                                              : "none"
                                          }
                                        />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                        <div className="register-footer">
                          <span>
                            {visible.length} of 6 assets
                            <span className="footer-dot">·</span>Scores ≥{" "}
                            {pct(threshold)} require review
                          </span>
                          {compare.length ? (
                            <button onClick={() => setCompare([])}>
                              {compare.length} selected for comparison
                              <X size={12} />
                            </button>
                          ) : (
                            <span>
                              Select checkboxes to compare up to 3 assets
                            </span>
                          )}
                        </div>
                      </section>
                    )}
                    {page === "explorer" && (
                      <div className="explorer-asset-picker surface">
                        <div>
                          <h2>Select assets to compare</h2>
                          <p>
                            Up to three series. Arrival order, not synchronized
                            machine histories.
                          </p>
                        </div>
                        <div>
                          {snapshot.assets.map((a) => (
                            <label key={a.id}>
                              <input
                                type="checkbox"
                                checked={compare.includes(a.id)}
                                onChange={() => toggleCompare(a.id)}
                              />
                              {a.id}
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                    <section className="signal-panel surface">
                      <div className="panel-heading">
                        <div>
                          <div className="section-kicker">SIGNAL DETAIL</div>
                          <h2>
                            {compare.length > 1
                              ? "Asset comparison"
                              : (chartAssets[0]?.id ?? "Selected asset")}
                            <span>
                              {compare.length > 1
                                ? `${compare.length} selected assets`
                                : chartAssets[0]?.name}
                            </span>
                          </h2>
                        </div>
                        <button
                          className="icon-btn"
                          aria-label={
                            page === "explorer"
                              ? "Return to asset monitor"
                              : "Expand signal explorer"
                          }
                          title="Toggle explorer"
                          onClick={() =>
                            setPage(
                              page === "explorer" ? "monitor" : "explorer",
                            )
                          }
                        >
                          {page === "explorer" ? (
                            <ArrowLeft size={15} />
                          ) : (
                            <Maximize2 size={15} />
                          )}
                        </button>
                      </div>
                      <div className="chart-toolbar">
                        <div className="metric-buttons">
                          {(
                            [
                              "score",
                              "rpm",
                              "torque",
                              "process_temperature",
                              "tool_wear",
                            ] as Metric[]
                          ).map((m) => (
                            <button
                              className={metric === m ? "active" : ""}
                              key={m}
                              onClick={() => setMetric(m)}
                            >
                              {m === "process_temperature"
                                ? "Temperature"
                                : METRICS[m].name}
                            </button>
                          ))}
                        </div>
                        <select
                          aria-label="Observation range"
                          value={windowSize}
                          onChange={(e) =>
                            setWindowSize(Number(e.target.value))
                          }
                        >
                          <option value={6}>Last 6 readings</option>
                          <option value={12}>Last 12 readings</option>
                          <option value={30}>Last 30 readings</option>
                        </select>
                      </div>
                      <TrendChart
                        assets={chartAssets}
                        metric={metric}
                        windowSize={windowSize}
                        threshold={threshold}
                      />
                      <div className="panel-footnote">
                        <span>
                          UCI AI4I · uncalibrated current-state classifier
                        </span>
                        <button
                          onClick={() => {
                            download(
                              `${selected}-observations.json`,
                              JSON.stringify(
                                chartAssets.map((a) => ({
                                  asset_id: a.id,
                                  observations: a.history.slice(-windowSize),
                                })),
                                null,
                                2,
                              ),
                            );
                            setToast("Selected observation series exported");
                          }}
                        >
                          <ArrowDownToLine size={12} />
                          Export observations
                        </button>
                      </div>
                    </section>
                    <section className="activity-ledger">
                      <div className="section-kicker">RECENT DECISIONS</div>
                      {snapshot.audit.length ? (
                        snapshot.audit.slice(0, 3).map((a) => (
                          <button
                            key={a.id}
                            onClick={() => {
                              setOrderId(a.order_id);
                              setPage("orders");
                            }}
                          >
                            <span
                              className={`ledger-icon ${a.action === "approved" ? "positive" : ""}`}
                            >
                              {a.action === "approved" ? (
                                <Check size={13} />
                              ) : (
                                <ClipboardList size={13} />
                              )}
                            </span>
                            <div>
                              <b>
                                WO-{String(a.order_id).padStart(3, "0")}{" "}
                                <span>{a.action}</span>
                              </b>
                              <small>{a.note || a.actor}</small>
                            </div>
                            <time>{time(a.timestamp)}</time>
                            <ArrowUpRight size={13} />
                          </button>
                        ))
                      ) : (
                        <p>
                          No decisions yet. Create an inspection from the
                          selected asset.
                        </p>
                      )}
                    </section>
                  </div>
                  {showInspector && asset && (
                    <aside className="asset-inspector surface">
                      <div className="inspector-top">
                        <span>ASSET INSPECTOR</span>
                        <button
                          className="icon-btn"
                          aria-label="Close asset inspector"
                          onClick={() => setShowInspector(false)}
                        >
                          <X size={14} />
                        </button>
                      </div>
                      <div className="asset-profile">
                        <div className="asset-profile-graphic">
                          <svg viewBox="0 0 180 100" aria-hidden="true">
                            <path
                              d="M22 83V28H44V13H125V28H157V83Z"
                              fill="#f1f4fa"
                              stroke="#7e90ae"
                              strokeWidth="1.5"
                            />
                            <path
                              d="M55 26H111V71H55Z"
                              fill="#fff"
                              stroke="#7e90ae"
                            />
                            <path
                              d="M83 27V45M76 45H90V51H76Z"
                              stroke="#7e90ae"
                              fill="#dbe3f2"
                            />
                            <path
                              d="M64 62H102M64 67H102M140 38V44M140 49V55"
                              stroke="#7e90ae"
                            />
                            <path
                              d="M28 84V90H43V84M136 84V90H151V84"
                              stroke="#7e90ae"
                              fill="none"
                            />
                          </svg>
                          <span>TYPE {asset.reading?.type}</span>
                        </div>
                        <div className="inspector-identity">
                          <div>
                            <h2>{asset.id}</h2>
                            <button
                              className={`icon-btn follow-btn ${watch.includes(asset.id) ? "followed" : ""}`}
                              aria-label={`${watch.includes(asset.id) ? "Unfollow" : "Follow"} selected asset`}
                              onClick={() => follow(asset.id)}
                            >
                              <Star
                                size={15}
                                fill={
                                  watch.includes(asset.id)
                                    ? "currentColor"
                                    : "none"
                                }
                              />
                            </button>
                          </div>
                          <p>{asset.name}</p>
                          <span>
                            <Factory size={11} />
                            {asset.line}
                          </span>
                        </div>
                      </div>
                      <div className="inspector-condition">
                        <StatePill
                          score={asset.score ?? 0}
                          threshold={threshold}
                        />
                        <b
                          className={
                            (asset.score ?? 0) >= threshold
                              ? "warning-text"
                              : ""
                          }
                        >
                          {pct(asset.score ?? 0)}
                          <small>failure score</small>
                        </b>
                      </div>
                      <div className="inspector-tabs">
                        {["signals", "events", "orders"].map((t) => (
                          <button
                            key={t}
                            className={inspectorTab === t ? "active" : ""}
                            onClick={() => setInspectorTab(t)}
                          >
                            {t === "signals"
                              ? "Readings"
                              : t === "events"
                                ? "Event log"
                                : `Orders (${snapshot.orders.filter((o) => o.asset_id === asset.id).length})`}
                          </button>
                        ))}
                      </div>
                      {inspectorTab === "signals" && (
                        <>
                          <div className="sensor-list">
                            {(
                              [
                                "rpm",
                                "torque",
                                "process_temperature",
                                "air_temperature",
                                "tool_wear",
                              ] as Metric[]
                            ).map((m) => (
                              <button
                                key={m}
                                className={metric === m ? "active" : ""}
                                onClick={() => setMetric(m)}
                              >
                                <span>{METRICS[m].name}</span>
                                <b>
                                  {Number(
                                    asset.reading?.[
                                      m as keyof NonNullable<Asset["reading"]>
                                    ] ?? 0,
                                  ).toFixed(
                                    m === "rpm" || m === "tool_wear" ? 0 : 1,
                                  )}
                                  <small>{METRICS[m].unit}</small>
                                </b>
                                <ArrowUpRight size={12} />
                              </button>
                            ))}
                          </div>
                          <div className="inspection-hint">
                            <b>
                              {(asset.score ?? 0) >= threshold
                                ? "Review this observation"
                                : "Continue monitoring"}
                            </b>
                            <p>
                              {(asset.score ?? 0) >= threshold
                                ? "Above the review threshold. Check sensor context and reference procedures before planning work."
                                : "Below the review threshold. This does not rule out faults or replace approved inspections."}
                            </p>
                          </div>
                        </>
                      )}
                      {inspectorTab === "events" && (
                        <div className="inspector-events">
                          {[...asset.history]
                            .reverse()
                            .slice(0, 8)
                            .map((o) => (
                              <details key={o.event_id}>
                                <summary>
                                  <Radio size={12} />
                                  <span>{time(o.timestamp)}</span>
                                  <b>{pct(o.score)}</b>
                                </summary>
                                <dl>
                                  <dt>Event ID</dt>
                                  <dd>{o.event_id}</dd>
                                  <dt>Speed / torque</dt>
                                  <dd>
                                    {o.rpm} rpm / {o.torque} Nm
                                  </dd>
                                  <dt>Wear</dt>
                                  <dd>{o.tool_wear} min</dd>
                                </dl>
                              </details>
                            ))}
                        </div>
                      )}
                      {inspectorTab === "orders" && (
                        <div className="asset-orders">
                          {snapshot.orders.filter(
                            (o) => o.asset_id === asset.id,
                          ).length ? (
                            snapshot.orders
                              .filter((o) => o.asset_id === asset.id)
                              .map((o) => (
                                <button
                                  key={o.id}
                                  onClick={() => {
                                    setOrderId(o.id);
                                    setPage("orders");
                                  }}
                                >
                                  <span>
                                    WO-{String(o.id).padStart(3, "0")}
                                    <b className={`order-state ${o.status}`}>
                                      {o.status}
                                    </b>
                                  </span>
                                  <p>{o.title}</p>
                                </button>
                              ))
                          ) : (
                            <p>No work orders for this asset.</p>
                          )}
                        </div>
                      )}
                      <div className="inspector-actions">
                        <button
                          className="button primary"
                          onClick={() => investigate(asset)}
                        >
                          <BookOpen size={14} />
                          Investigate evidence
                          <ArrowRight size={14} />
                        </button>
                        <button
                          className="button secondary"
                          onClick={() => draft(asset.id)}
                        >
                          <Plus size={14} />
                          Create work order
                        </button>
                        <small>
                          Reading received{" "}
                          {asset.timestamp ? time(asset.timestamp) : "—"}
                        </small>
                      </div>
                      <div className="inspector-bottom">
                        <ShieldCheck size={12} />
                        Planning only · no equipment control
                      </div>
                    </aside>
                  )}
                </div>
              </>
            )}
            {page === "orders" && (
              <ReviewQueue
                snapshot={snapshot}
                initialOrderId={orderId}
                draft={() => draft()}
                reveal={reveal}
                busy={busy}
                act={act}
                post={post}
                notify={setToast}
              />
            )}
            {(page === "library" || page === "validation") && (
              <ReferenceViews
                page={page}
                docs={docs}
                report={report}
                docId={docId}
                setDocId={setDocId}
                notify={setToast}
                investigate={(title) => {
                  if (asset) {
                    investigate(asset);
                    setQuestion(title);
                  }
                }}
              />
            )}
          </>
        )}
        <footer className="workspace-footer">
          <span>ForgeSignal / Operations workbench</span>
          <span>Synthetic replay · No physical equipment connected</span>
          <button onClick={() => setModal("source")}>
            Data provenance
            <ArrowUpRight size={11} />
          </button>
        </footer>
      </main>

      {modal === "command" && (
        <Dialog title="Jump to…" onClose={() => setModal(null)}>
          <div className="command-body">
            <label className="command-input">
              <Search size={18} />
              <input
                aria-label="Command search"
                autoFocus
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder="Search assets, pages, orders, procedures…"
              />
            </label>
            <div className="command-results">
              {PAGES.filter((p) =>
                p.name.toLowerCase().includes(command.toLowerCase()),
              ).map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setPage(p.id);
                    setModal(null);
                  }}
                >
                  <p.icon size={16} />
                  <b>{p.name}</b>
                  <span>Page</span>
                  <ArrowRight size={13} />
                </button>
              ))}
              {snapshot?.assets
                .filter((a) =>
                  `${a.id} ${a.name}`
                    .toLowerCase()
                    .includes(command.toLowerCase()),
                )
                .map((a) => (
                  <button
                    key={a.id}
                    onClick={() => {
                      reveal(a.id);
                      setModal(null);
                    }}
                  >
                    <Factory size={16} />
                    <b>{a.id}</b>
                    <span>{a.name}</span>
                    <ArrowRight size={13} />
                  </button>
                ))}
              {command &&
                docs
                  .filter((d) =>
                    `${d.title} ${d.id}`
                      .toLowerCase()
                      .includes(command.toLowerCase()),
                  )
                  .map((d) => (
                    <button
                      key={d.id}
                      onClick={() => {
                        setDocId(d.id);
                        setPage("library");
                        setModal(null);
                      }}
                    >
                      <BookOpen size={16} />
                      <b>{d.id}</b>
                      <span>{d.title}</span>
                    </button>
                  ))}
              {command &&
                snapshot?.orders
                  .filter((o) =>
                    `${o.title} ${o.asset_id} WO-${o.id}`
                      .toLowerCase()
                      .includes(command.toLowerCase()),
                  )
                  .slice(0, 6)
                  .map((o) => (
                    <button
                      key={o.id}
                      onClick={() => {
                        setOrderId(o.id);
                        setPage("orders");
                        setModal(null);
                      }}
                    >
                      <ClipboardList size={16} />
                      <b>WO-{String(o.id).padStart(3, "0")}</b>
                      <span>{o.title}</span>
                    </button>
                  ))}
            </div>
            <div className="command-help">
              Search the current workspace<kbd>Esc to close</kbd>
            </div>
          </div>
        </Dialog>
      )}
      {modal === "save" && (
        <Dialog title="Save this asset view" onClose={() => setModal(null)}>
          <form
            className="form-body"
            onSubmit={(e) => {
              e.preventDefault();
              if (viewName.trim()) {
                const view = {
                  name: viewName.trim(),
                  line,
                  status,
                  sort,
                  search,
                  layout,
                };
                setViews(
                  [...views.filter((v) => v.name !== view.name), view].slice(
                    -8,
                  ),
                );
                setModal(null);
                setToast("View saved in this browser");
              }
            }}
          >
            <label>
              View name
              <input
                autoFocus
                value={viewName}
                onChange={(e) => setViewName(e.target.value)}
                maxLength={40}
                placeholder="e.g. Line A · needs review"
                required
              />
            </label>
            <div className="saved-filter-summary">
              <span>
                Line<b>{line}</b>
              </span>
              <span>
                Status<b>{status}</b>
              </span>
              <span>
                Search<b>{search || "Any asset"}</b>
              </span>
              <span>
                Sort<b>{sort}</b>
              </span>
            </div>
            <p className="form-note">
              Saved locally in this browser. Use Share view to copy asset and
              filter selections.
            </p>
            <div className="form-actions">
              <button
                type="button"
                className="button secondary"
                onClick={() => setModal(null)}
              >
                Cancel
              </button>
              <button className="button primary" type="submit">
                <Save size={13} />
                Save view
              </button>
            </div>
          </form>
        </Dialog>
      )}
      {modal === "proposal" && (
        <Dialog title="Create work order" onClose={() => setModal(null)} wide>
          <form
            className="form-body proposal-form"
            onSubmit={(e) => {
              e.preventDefault();
              act(async () => {
                const result = await post("/api/orders", {
                  ...proposal,
                  due_date: proposal.due_date || null,
                });
                setOrderId(result.id);
                setModal(null);
                setPage("orders");
                setToast(
                  `WO-${String(result.id).padStart(3, "0")} created for review`,
                );
              });
            }}
          >
            <div className="proposal-intro">
              <ClipboardList size={22} />
              <p>
                Capture the inspection request and its context. Current asset
                readings will be attached when you create the order.
              </p>
            </div>
            <div className="form-grid">
              <label>
                Asset
                <select
                  aria-label="Work order asset"
                  value={proposal.asset_id}
                  onChange={(e) =>
                    setProposal({ ...proposal, asset_id: e.target.value })
                  }
                >
                  {snapshot?.assets.map((a) => (
                    <option key={a.id}>{a.id}</option>
                  ))}
                </select>
              </label>
              <label>
                Priority
                <select
                  aria-label="Work order draft priority"
                  value={proposal.priority}
                  onChange={(e) =>
                    setProposal({ ...proposal, priority: e.target.value })
                  }
                >
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </label>
            </div>
            <label>
              Inspection title
              <input
                aria-label="Inspection title"
                value={proposal.title}
                onChange={(e) =>
                  setProposal({ ...proposal, title: e.target.value })
                }
                minLength={5}
                maxLength={200}
                required
              />
            </label>
            <div className="form-grid">
              <label>
                Owner or team <span>Optional</span>
                <input
                  aria-label="Owner or team"
                  value={proposal.assignee}
                  onChange={(e) =>
                    setProposal({ ...proposal, assignee: e.target.value })
                  }
                  maxLength={100}
                  placeholder="e.g. Shift maintenance"
                />
              </label>
              <label>
                Requested date <span>Optional</span>
                <input
                  aria-label="Requested date"
                  type="date"
                  value={proposal.due_date}
                  onChange={(e) =>
                    setProposal({ ...proposal, due_date: e.target.value })
                  }
                />
              </label>
            </div>
            <label>
              Inspection notes
              <textarea
                aria-label="Inspection notes"
                value={proposal.notes}
                onChange={(e) =>
                  setProposal({ ...proposal, notes: e.target.value })
                }
                maxLength={2000}
                placeholder="What should the reviewer check? Add context or a procedure reference."
              />
            </label>
            <div className="form-note">
              <ShieldCheck size={14} />A supervisor decision is required. This
              request does not schedule or actuate equipment.
            </div>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="form-actions">
              <button
                className="button secondary"
                type="button"
                onClick={() => setModal(null)}
              >
                Cancel
              </button>
              <button className="button primary" disabled={busy} type="submit">
                <Plus size={14} />
                {busy ? "Creating…" : "Create for review"}
              </button>
            </div>
          </form>
        </Dialog>
      )}
      {modal === "investigate" && investigationAsset && (
        <Dialog
          title={`${investigationAsset.id} / Evidence investigation`}
          onClose={() => setModal(null)}
          wide
        >
          <div className="investigation-layout">
            <div className="investigation-query">
              <span className="section-kicker">CAPTURED ASSET CONTEXT</span>
              <div className="investigation-context">
                <span>
                  Failure score<b>{pct(investigationAsset.score ?? 0)}</b>
                </span>
                <span>
                  Torque<b>{investigationAsset.reading?.torque} Nm</b>
                </span>
                <span>
                  Tool wear<b>{investigationAsset.reading?.tool_wear} min</b>
                </span>
              </div>
              <label htmlFor="evidence-question">Investigation question</label>
              <textarea
                id="evidence-question"
                value={question}
                maxLength={1500}
                onChange={(e) => setQuestion(e.target.value)}
              />
              <div className="query-presets">
                {[
                  "Thermal dissipation and cooling",
                  "Torque and power load",
                  "Tool wear and overstrain",
                  "Work order approval",
                ].map((q) => (
                  <button key={q} onClick={() => setQuestion(q)}>
                    {q}
                    <ArrowUpRight size={11} />
                  </button>
                ))}
              </div>
              <button
                className="button primary"
                disabled={busy || question.trim().length < 3}
                onClick={() =>
                  act(async () => {
                    setAnswer(
                      await post("/api/assistant", {
                        question,
                        asset_id: investigationAsset.id,
                      }),
                    );
                  })
                }
              >
                <Search size={14} />
                {busy ? "Retrieving…" : "Retrieve guidance"}
              </button>
              <p className="form-note">
                Guidance uses the latest server readings at query time. Context
                above was captured when this investigation opened.
              </p>
            </div>
            <section className="evidence-response">
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              {answer ? (
                <>
                  <div className="response-mode">
                    <ShieldCheck size={14} />
                    <b>Evidence response</b>
                    <span>{answer.mode}</span>
                  </div>
                  <div className="answer-text">{answer.answer}</div>
                  <h3>
                    Supporting procedures <span>{answer.sources.length}</span>
                  </h3>
                  {answer.sources.map((s) => (
                    <details className="source-passage" key={s.id}>
                      <summary>
                        <FileText size={14} />
                        <b>{s.id}</b>
                        <span>{s.title}</span>
                        <ChevronDown size={12} />
                      </summary>
                      <p>{s.body}</p>
                    </details>
                  ))}
                  <details className="workflow-trace">
                    <summary>Inspect retrieval workflow</summary>
                    {answer.trace.map((s, i) => (
                      <p key={s}>
                        <span>{i + 1}</span>
                        {s}
                      </p>
                    ))}
                  </details>
                </>
              ) : (
                <div className="evidence-empty">
                  <BookOpen size={30} />
                  <h3>Start with a procedure.</h3>
                  <p>
                    Search five indexed maintenance references. Inspect the
                    response mode and citations before using the guidance.
                  </p>
                  <span>No API key needed for cited source passages.</span>
                </div>
              )}
            </section>
          </div>
          <div className="dialog-bottom">
            <span>
              Illustrative procedures · follow approved site instructions
            </span>
            <button
              className="button secondary"
              onClick={() => draft(investigationAsset.id)}
            >
              <Plus size={13} />
              Create work order
            </button>
          </div>
        </Dialog>
      )}
      {modal === "source" && (
        <Dialog title="Data provenance" onClose={() => setModal(null)}>
          <div className="form-body source-dialog">
            <div className="source-label">
              <Radio size={24} />
              <div>
                <h3>UCI AI4I 2020</h3>
                <p>10,000 synthetic machine observations</p>
              </div>
            </div>
            <p>
              The six assets and production lines are fictional. Replay assigns
              independent held-out observations to them; plotted order is
              arrival order, not a real machine's degradation history.
            </p>
            <p>
              Scores classify the current observation. They are uncalibrated and
              do not estimate time until failure.
            </p>
            <dl>
              <dt>License</dt>
              <dd>CC BY 4.0</dd>
              <dt>Arrival interval</dt>
              <dd>2 seconds while replay is active</dd>
              <dt>Connection</dt>
              <dd>{connected ? "Connected via SSE" : "Reconnecting"}</dd>
              <dt>Snapshots received</dt>
              <dd>{streamCount}</dd>
            </dl>
            {report && (
              <details>
                <summary>Dataset SHA-256</summary>
                <code>{report.sha256}</code>
              </details>
            )}
            <a
              className="button secondary"
              href="https://doi.org/10.24432/C5HS5C"
              target="_blank"
              rel="noreferrer"
            >
              Open dataset source
              <ExternalLink size={13} />
            </a>
          </div>
        </Dialog>
      )}
      {modal === "access" && (
        <Dialog title="Supervisor write access" onClose={() => setModal(null)}>
          <form
            className="form-body"
            onSubmit={(e) => {
              e.preventDefault();
              setModal(null);
              setToast("Write token set for this session");
            }}
          >
            <p className="form-note">
              Enter the server token to control replay, create orders, and
              record decisions. It stays in memory for this session.
            </p>
            <label>
              Write token
              <input
                autoComplete="off"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
            </label>
            <div className="form-actions">
              <button className="button primary" type="submit">
                Use token
              </button>
            </div>
          </form>
        </Dialog>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={15} />
          {toast}
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
