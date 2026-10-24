import { Asset, pct } from "../types";
export function FacilityPlan({
  assets,
  selected,
  threshold,
  onSelect,
}: {
  assets: Asset[];
  selected: string;
  threshold: number;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="facility">
      <div className="plan-note">
        <span>FACILITY SCHEMATIC</span>
        <span>Illustrative layout · not a physical plant map</span>
      </div>
      {["Machining A", "Machining B"].map((line, i) => (
        <div className="production-lane" key={line}>
          <div className="lane-label">
            <b>0{i + 1}</b>
            <span>{line}</span>
          </div>
          <div className="lane-stations">
            {assets
              .filter((a) => a.line === line)
              .map((a) => (
                <button
                  key={a.id}
                  className={`station ${selected === a.id ? "chosen" : ""} ${(a.score ?? 0) >= threshold ? "attention" : ""}`}
                  onClick={() => onSelect(a.id)}
                  aria-label={`Select ${a.id}`}
                >
                  <svg viewBox="0 0 160 95" aria-hidden="true">
                    <path
                      d="M18 75V28H37V15H115V28H141V75Z"
                      fill="#eef1f6"
                      stroke="currentColor"
                      strokeWidth="1.4"
                    />
                    <path
                      d="M46 26H100V64H46Z"
                      fill="white"
                      stroke="currentColor"
                    />
                    <path
                      d="M73 25V43M66 43H80V49H66Z"
                      stroke="currentColor"
                      fill="#d5deed"
                    />
                    <path
                      d="M55 57H91M55 62H91M124 36V40M124 46V50"
                      stroke="currentColor"
                    />
                    <rect
                      x="113"
                      y="58"
                      width="20"
                      height="10"
                      fill="currentColor"
                      opacity=".15"
                    />
                    <path
                      d="M25 76V83H39V76M119 76V83H133V76"
                      stroke="currentColor"
                      fill="none"
                    />
                  </svg>
                  <div>
                    <strong>{a.id}</strong>
                    <span>{pct(a.score ?? 0)}</span>
                  </div>
                  <small>{a.name}</small>
                </button>
              ))}
          </div>
        </div>
      ))}
      <div className="plan-key">
        <span>
          <i className="state-mark normal" />
          Below review threshold
        </span>
        <span>
          <i className="state-mark attention" />
          Review required
        </span>
        <span>Click a station to inspect its readings</span>
      </div>
    </div>
  );
}
