export type Reading = {
  type: string;
  air_temperature: number;
  process_temperature: number;
  rpm: number;
  torque: number;
  tool_wear: number;
};
export type Observation = Reading & {
  score: number;
  timestamp: string;
  event_id: string;
  asset_id: string;
};
export type Asset = {
  id: string;
  name: string;
  line: string;
  reading: Reading | null;
  score: number | null;
  timestamp: string | null;
  history: Observation[];
};
export type Order = {
  id: number;
  asset_id: string;
  title: string;
  status: string;
  evidence: string;
  created_at: string;
  priority: string;
  assignee: string;
  due_date: string | null;
  notes: string;
};
export type Audit = {
  id: number;
  order_id: number;
  action: string;
  actor: string;
  timestamp: string;
  note: string;
};
export type Snapshot = {
  assets: Asset[];
  events: number;
  orders: Order[];
  audit: Audit[];
  threshold: number;
  replay_running: boolean;
  timestamp: string;
  write_auth_required: boolean;
};
export type Report = {
  test: Record<string, number | number[][]>;
  baseline: Record<string, number>;
  split: Record<string, number>;
  threshold: number;
  sha256: string;
  limitations: string[];
  features: string[];
  test_positives: number;
};
export type Doc = { id: string; title: string; body: string };
export type Answer = {
  answer: string;
  mode: string;
  trace: string[];
  sources: (Doc & { relevance: number })[];
};
export type Metric =
  | "score"
  | "rpm"
  | "torque"
  | "process_temperature"
  | "air_temperature"
  | "tool_wear";
export const METRICS: Record<
  Metric,
  { name: string; unit: string; color: string }
> = {
  score: { name: "Failure score", unit: "%", color: "#315bd3" },
  rpm: { name: "Rotational speed", unit: "rpm", color: "#315bd3" },
  torque: { name: "Torque", unit: "Nm", color: "#315bd3" },
  process_temperature: {
    name: "Process temperature",
    unit: "K",
    color: "#315bd3",
  },
  air_temperature: { name: "Air temperature", unit: "K", color: "#315bd3" },
  tool_wear: { name: "Tool wear", unit: "min", color: "#315bd3" },
};
export const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
export const time = (s: string) =>
  new Date(s).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
export const metricValue = (o: Observation, m: Metric) =>
  m === "score" ? o.score * 100 : o[m];
export function download(
  name: string,
  content: string,
  type = "application/json",
) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
