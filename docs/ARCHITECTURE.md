# Architecture decisions

## Product boundary

User: a manufacturing operations analyst triaging sensor observations, and a supervisor deciding whether a maintenance proposal should proceed. The software records decisions; it never actuates machinery. The primary journey is overview → selected asset → evidence → proposal → approval/rejection → audit.

The business hypothesis is that consolidated telemetry, inspectable evidence and an explicit review queue could shorten investigation time. No business impact has been measured. A pilot would measure median triage time, useful recommendation rate, alert burden and decision reversals against an agreed baseline.

## ADR 01: React, TypeScript and FastAPI

React delivers a responsive, stateful workspace; TypeScript checks data rendering paths. FastAPI provides a typed HTTP boundary and generated OpenAPI schema. A Vite build is served from the Python process, keeping the deployment at one origin. The dev server proxies `/api` during frontend development. Component UI and server contracts are intentionally compact; the next team step would generate the TypeScript API types from OpenAPI to avoid manual drift.

## ADR 02: SQLite and one replay owner

SQLite is sufficient for a portable, low-volume demonstration. Events use unique external IDs, an indexed `(asset_id, seq)` access path, and WAL transactions. Work orders capture the full asset snapshot at creation. State transition and audit insert commit together, and the conditional update prevents a second decision. The audit is application-managed and not tamper-proof against a database administrator.

The process-local replay worker is not a distributed scheduler. Run one Uvicorn worker and one app replica. A real deployment would use PostgreSQL for shared state, a broker or managed event stream, independent ingestion workers, retention/partition policies, tenant scoping and an outbox for reliable downstream tasks. Avoid mounting WAL SQLite on network file shares; use a proper database service for shared persistence.

## ADR 03: current-state classifier, not prognostics

Inputs are six publicly documented feature columns. Identifiers and every failure label are excluded. Only validation labels select the threshold. Histogram gradient boosting captures nonlinear interactions without model downloads. The main artifact records exact split sizes, seed, checksum, baseline and class counts.

A random stratified split does not establish temporal independence: AI4I's generated temperatures have sequential structure. An ordered split, multiple-seed confidence intervals, calibration, costs of false negatives/positives, drift evaluation and validation on real client telemetry are prerequisites to serious operational adoption. The UI avoids remaining-useful-life and savings claims. Display scores are uncalibrated model outputs, even though percentages are used for readability.

## ADR 04: bounded evidence orchestration

LangGraph has three explicit nodes: retrieve, compose, validate. Retrieval uses word/bigram TF-IDF and cosine similarity over five original example documents. There is no dense embedding model or dedicated vector database. The low retrieval threshold and authored smoke questions are suitable for a demo corpus, not a large multilingual knowledge system.

The no-key mode returns exact retrieved passages with IDs. Optional provider mode receives only the question, selected asset snapshot and retrieved evidence. It has a finite output limit and 20-second timeout. Provider errors or missing required source IDs produce an explicit extractive fallback. The code checks citation presence, not whether a cited sentence is entailed; it cannot guarantee hallucination prevention. Independent retrieval questions, human factuality labels and provider-mode faithfulness evaluation remain future work.

## ADR 05: MCP is read-only

The stdio adapter exposes only retrieval and fleet inspection. It uses the official v1 SDK and is tested with a real `ClientSession`, initialization, tool listing and both tool calls. It is not an HTTP endpoint pretending to be MCP. Fleet reads require the local API. The maintenance decision route is deliberately absent from the tool surface.

## ADR 06: observability and security

JSON request logs record correlation ID, method, path, status and duration without body contents or tokens. Prometheus labels contain only method and status to avoid unbounded cardinality. Metrics count HTTP requests and accepted events and record request-duration histograms. The current SSE request duration measures stream setup rather than full connection lifetime. Model-specific latency and active-stream gauges would improve future instrumentation.

Loopback is the default. The optional bearer token protects write routes; it is a shared demo credential, not user identity or RBAC. Read routes and the assistant have no application-level user authentication. Azure's evaluation template restricts ingress to one CIDR. Production needs OIDC/SSO, per-role authorization, rate limits, TLS, a secrets service, private network boundaries, data retention, threat review and backup/restore tests. No multi-tenant or production-readiness claim is made.
