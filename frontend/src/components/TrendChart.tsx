import { useState } from "react";
import { Asset, Metric, METRICS, metricValue, time } from "../types";
const COLORS = ["#315bd3", "#bf5e25", "#138077"];
export function MiniTrend({ asset }: { asset: Asset }) {
  const h = asset.history;
  const points = h.length > 1 ? h : [...h, ...h];
  return (
    <svg
      width="86"
      height="24"
      viewBox="0 0 86 24"
      aria-label={`${asset.id} recent score history`}
      role="img"
    >
      <line x1="0" x2="86" y1="23" y2="23" stroke="#e5e9ee" />
      <polyline
        points={points
          .map(
            (p, i) =>
              `${(i * 84) / Math.max(1, points.length - 1)},${22 - p.score * 20}`,
          )
          .join(" ")}
        stroke="#7187b3"
        fill="none"
        strokeWidth="1.5"
      />
    </svg>
  );
}
export function TrendChart({
  assets,
  metric,
  windowSize,
  threshold,
}: {
  assets: Asset[];
  metric: Metric;
  windowSize: number;
  threshold: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const series = assets.map((a) => ({
    ...a,
    points: a.history.slice(-windowSize),
  }));
  const length = Math.max(1, ...series.map((a) => a.points.length));
  const values = series.flatMap((a) =>
    a.points.map((p) => metricValue(p, metric)),
  );
  const max = metric === "score" ? 100 : Math.max(...values, 1) * 1.08;
  const min = metric === "score" ? 0 : Math.max(0, Math.min(...values, 0) - 5);
  const x = (i: number) => 48 + (i / Math.max(length - 1, 1)) * 778;
  const y = (n: number) => 186 - ((n - min) / Math.max(max - min, 1)) * 160;
  const selected = hover === null ? null : Math.min(hover, length - 1);
  const first = series[0]?.points;
  return (
    <div className="trend-chart">
      <div className="plot-legend">
        {series.map((s, i) => (
          <span key={s.id}>
            <i style={{ background: COLORS[i] }} />
            {s.id}
          </span>
        ))}
        <span className="plot-mode">
          Arrival order · independent synthetic observations
        </span>
      </div>
      {values.length === 0 ? (
        <div className="empty compact">No observations in this selection.</div>
      ) : (
        <>
          <svg
            className="plot"
            viewBox="0 0 850 220"
            role="img"
            aria-label={`${METRICS[metric].name} chart for ${assets.map((a) => a.id).join(", ")}`}
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setHover(
                Math.max(
                  0,
                  Math.min(
                    length - 1,
                    Math.round(
                      ((((e.clientX - rect.left) / rect.width) * 850 - 48) /
                        778) *
                        Math.max(length - 1, 1),
                    ),
                  ),
                ),
              );
            }}
            onMouseLeave={() => setHover(null)}
          >
            {[0, 0.25, 0.5, 0.75, 1].map((t) => (
              <g key={t}>
                <line
                  x1="48"
                  x2="826"
                  y1={y(min + (max - min) * t)}
                  y2={y(min + (max - min) * t)}
                  stroke="#e4e8ef"
                />
                <text
                  x="37"
                  y={y(min + (max - min) * t) + 4}
                  textAnchor="end"
                  className="axis-text"
                >
                  {Math.round(min + (max - min) * t)}
                </text>
              </g>
            ))}
            {[0, 0.25, 0.5, 0.75, 1].map((t) => (
              <g key={t}>
                <line
                  x1={48 + 778 * t}
                  x2={48 + 778 * t}
                  y1="26"
                  y2="186"
                  stroke="#edf0f5"
                />
                <text
                  x={48 + 778 * t}
                  y="207"
                  textAnchor="middle"
                  className="axis-text"
                >
                  {Math.max(1, Math.round(1 + (length - 1) * t))}
                </text>
              </g>
            ))}
            {metric === "score" && (
              <g>
                <line
                  x1="48"
                  x2="826"
                  y1={y(threshold * 100)}
                  y2={y(threshold * 100)}
                  stroke="#c67a2c"
                  strokeDasharray="5 4"
                />
                <text
                  x="820"
                  y={y(threshold * 100) - 5}
                  textAnchor="end"
                  className="threshold-label"
                >
                  Review threshold {(threshold * 100).toFixed(0)}%
                </text>
              </g>
            )}
            {series.map((a, k) => {
              const offset = length - a.points.length;
              return (
                <g key={a.id}>
                  <polyline
                    points={a.points
                      .map(
                        (o, i) =>
                          `${x(i + offset)},${y(metricValue(o, metric))}`,
                      )
                      .join(" ")}
                    stroke={COLORS[k]}
                    strokeWidth="2"
                    fill="none"
                    vectorEffect="non-scaling-stroke"
                  />
                  {a.points.map((o, i) => (
                    <circle
                      key={o.event_id}
                      cx={x(i + offset)}
                      cy={y(metricValue(o, metric))}
                      r={selected === i + offset ? 4 : 2.5}
                      fill={COLORS[k]}
                      stroke="white"
                      strokeWidth="1"
                    />
                  ))}
                </g>
              );
            })}
            {selected !== null && (
              <line
                x1={x(selected)}
                x2={x(selected)}
                y1="22"
                y2="186"
                stroke="#77859e"
                strokeDasharray="3 3"
              />
            )}
          </svg>
          <div className="plot-readout" aria-live="polite">
            {selected === null ? (
              <>
                <span>Hover the plot or scrub an observation</span>
                <b>{length} readings</b>
              </>
            ) : (
              <>
                <span>
                  Observation {selected + 1}
                  {first?.[selected]
                    ? " · " + time(first[selected].timestamp)
                    : ""}
                </span>
                {series.map((a, k) => {
                  const o = a.points[selected - (length - a.points.length)];
                  return (
                    <b key={a.id} style={{ color: COLORS[k] }}>
                      {a.id} {o ? metricValue(o, metric).toFixed(1) : "—"}{" "}
                      {METRICS[metric].unit}
                    </b>
                  );
                })}
              </>
            )}
          </div>
          <input
            className="observation-scrubber"
            type="range"
            aria-label="Inspect observation"
            min={0}
            max={Math.max(0, length - 1)}
            value={selected ?? length - 1}
            onChange={(e) => setHover(Number(e.target.value))}
          />
        </>
      )}
    </div>
  );
}
