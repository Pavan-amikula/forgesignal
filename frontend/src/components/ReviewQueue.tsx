import { useEffect, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpRight,
  Check,
  ClipboardList,
  Plus,
  Search,
  ShieldCheck,
} from "lucide-react";
import {
  Asset,
  Order,
  Snapshot,
  Metric,
  METRICS,
  pct,
  time,
  download,
} from "../types";
type Props = {
  snapshot: Snapshot;
  initialOrderId: number | null;
  draft: () => void;
  reveal: (id: string) => void;
  busy: boolean;
  act: (fn: () => Promise<void>) => Promise<void>;
  post: (path: string, data: unknown) => Promise<any>;
  notify: (message: string) => void;
};
export function ReviewQueue({
  snapshot,
  initialOrderId,
  draft,
  reveal,
  busy,
  act,
  post,
  notify,
}: Props) {
  const [status, setStatus] = useState(initialOrderId ? "all" : "pending"),
    [search, setSearch] = useState(""),
    [priority, setPriority] = useState("all"),
    [selected, setSelected] = useState(initialOrderId),
    [note, setNote] = useState("");
  useEffect(() => {
    if (initialOrderId) {
      setSelected(initialOrderId);
      setStatus("all");
      setSearch("");
      setPriority("all");
    }
  }, [initialOrderId]);
  const filtered = snapshot.orders.filter(
    (o) =>
      (status === "all" || o.status === status) &&
      (priority === "all" || o.priority === priority) &&
      `${o.title} ${o.asset_id} ${o.assignee} WO-${o.id}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const order = filtered.find((o) => o.id === selected) ?? filtered[0];
  useEffect(() => setNote(""), [order?.id]);
  async function decide(decision: string) {
    if (!order) return;
    await post(`/api/orders/${order.id}/decision`, { status: decision, note });
    setStatus("all");
    notify(
      `${decision === "approved" ? "Approval" : "Rejection"} and review note recorded`,
    );
  }
  return (
    <>
      <section className="workspace-heading">
        <div>
          <div className="section-kicker">MAINTENANCE / DECISIONS</div>
          <h1>Review queue</h1>
          <p>
            Check captured evidence, record a decision, and keep the handoff
            clear.
          </p>
        </div>
        <button className="button primary" onClick={draft}>
          <Plus size={14} />
          Create work order
        </button>
      </section>
      <div className="queue-toolbar">
        <div className="register-tabs">
          {["pending", "approved", "rejected", "all"].map((s) => (
            <button
              key={s}
              className={status === s ? "selected" : ""}
              onClick={() => {
                setStatus(s);
                setSelected(null);
              }}
            >
              {s === "pending"
                ? "Awaiting review"
                : s === "all"
                  ? "All orders"
                  : s[0].toUpperCase() + s.slice(1)}
              <span>
                {
                  snapshot.orders.filter((o) => s === "all" || o.status === s)
                    .length
                }
              </span>
            </button>
          ))}
        </div>
        <select
          aria-label="Work order priority"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
        >
          <option value="all">All priorities</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="normal">Normal</option>
        </select>
      </div>
      <div className="queue-layout surface">
        <div className="order-list">
          <label className="search-field">
            <Search size={14} />
            <input
              aria-label="Search work orders"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, asset or owner…"
            />
          </label>
          {filtered.length ? (
            filtered.map((o) => (
              <button
                className={`order-list-item ${order?.id === o.id ? "selected" : ""}`}
                key={o.id}
                onClick={() => setSelected(o.id)}
              >
                <div>
                  <b>WO-{String(o.id).padStart(3, "0")}</b>
                  <span className={`priority ${o.priority}`}>{o.priority}</span>
                </div>
                <h3>{o.title}</h3>
                <p>
                  {o.asset_id}
                  <span>·</span>
                  {o.assignee || "Unassigned"}
                </p>
                <small>
                  {new Date(o.created_at).toLocaleDateString()}
                  <span className={`order-state ${o.status}`}>{o.status}</span>
                </small>
              </button>
            ))
          ) : (
            <div className="empty compact">
              <ClipboardList size={23} />
              <p>No orders match this view.</p>
            </div>
          )}
        </div>
        <section className="order-detail">
          {order ? (
            <>
              <div className="order-detail-top">
                <span>WO-{String(order.id).padStart(3, "0")}</span>
                <span className={`order-state ${order.status}`}>
                  {order.status}
                </span>
                <button
                  className="plain-button"
                  onClick={() =>
                    download(
                      `WO-${order.id}.json`,
                      JSON.stringify(
                        {
                          order,
                          audit: snapshot.audit.filter(
                            (a) => a.order_id === order.id,
                          ),
                        },
                        null,
                        2,
                      ),
                    )
                  }
                >
                  <ArrowDownToLine size={13} />
                  Export record
                </button>
              </div>
              <h2>{order.title}</h2>
              <div className="order-meta">
                <div>
                  <span>ASSET</span>
                  <button onClick={() => reveal(order.asset_id)}>
                    {order.asset_id}
                    <ArrowUpRight size={12} />
                  </button>
                </div>
                <div>
                  <span>PRIORITY</span>
                  <b className={`priority ${order.priority}`}>
                    {order.priority}
                  </b>
                </div>
                <div>
                  <span>OWNER / TEAM</span>
                  <b>{order.assignee || "Unassigned"}</b>
                </div>
                <div>
                  <span>REQUESTED DATE</span>
                  <b>{order.due_date ?? "Not specified"}</b>
                </div>
              </div>
              {order.notes && (
                <div className="order-notes">
                  <h3>Inspection notes</h3>
                  <p>{order.notes}</p>
                </div>
              )}
              <div className="evidence-heading">
                <h3>Evidence captured at proposal</h3>
                <span>{new Date(order.created_at).toLocaleString()}</span>
              </div>
              <OrderEvidence order={order} />
              <div className="decision-timeline">
                <h3>Decision history</h3>
                {[...snapshot.audit]
                  .filter((a) => a.order_id === order.id)
                  .reverse()
                  .map((a) => (
                    <div key={a.id}>
                      <i />
                      <div>
                        <b>
                          {a.action[0].toUpperCase() + a.action.slice(1)}
                          <span>{time(a.timestamp)}</span>
                        </b>
                        <small>{a.actor}</small>
                        {a.note && <p>{a.note}</p>}
                      </div>
                    </div>
                  ))}
              </div>
              {order.status === "pending" ? (
                <form
                  className="decision-form"
                  onSubmit={(e) => e.preventDefault()}
                >
                  <label htmlFor="decision-note">
                    Review note{" "}
                    <span>Optional · recorded in the audit trail</span>
                  </label>
                  <textarea
                    id="decision-note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    maxLength={1000}
                    placeholder="What supports your decision?"
                  />
                  <div>
                    <p>
                      Approval records a planning decision.
                      <br />
                      Follow approved site procedures before any work.
                    </p>
                    <button
                      className="button secondary"
                      disabled={busy}
                      onClick={() => act(() => decide("rejected"))}
                    >
                      Reject
                    </button>
                    <button
                      className="button primary"
                      disabled={busy}
                      onClick={() => act(() => decide("approved"))}
                    >
                      <Check size={14} />
                      Approve
                    </button>
                  </div>
                </form>
              ) : (
                <div className="decision-complete">
                  <ShieldCheck size={16} />
                  Decision recorded. This order is closed for further review.
                </div>
              )}
            </>
          ) : (
            <div className="empty">
              <ClipboardList size={30} />
              <h3>Select a work order to review</h3>
              <p>
                Create an inspection request from an asset to capture its
                evidence.
              </p>
              <button className="button primary" onClick={draft}>
                Create work order
              </button>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
export function OrderEvidence({ order }: { order: Order }) {
  let evidence: Asset;
  try {
    evidence = JSON.parse(order.evidence);
  } catch {
    return <p>Evidence could not be parsed.</p>;
  }
  return (
    <div className="captured-evidence">
      <div>
        <span>Failure score</span>
        <b>{pct(evidence.score ?? 0)}</b>
      </div>
      {(["rpm", "torque", "process_temperature", "tool_wear"] as Metric[]).map(
        (m) => (
          <div key={m}>
            <span>{METRICS[m].name}</span>
            <b>
              {Number(
                evidence.reading?.[m as keyof NonNullable<Asset["reading"]>] ??
                  0,
              ).toFixed(1)}
              <small>{METRICS[m].unit}</small>
            </b>
          </div>
        ),
      )}
      <details>
        <summary>Inspect raw captured evidence</summary>
        <pre>{JSON.stringify(evidence, null, 2)}</pre>
      </details>
    </div>
  );
}
