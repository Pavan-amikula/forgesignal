# ForgeSignal — full project text for resume preparation

Repository: https://github.com/Pavan-amikula/forgesignal  
Project type: independent full-stack software engineering / applied AI portfolio.  
Target alignment: AI-focused full-stack engineering and client product delivery, including the supplied QuantumBlack role.

## Text to give the resume-writing chat

Use the following project facts to draft a concise, keyword-relevant resume entry. Preserve the distinction between measured implementation, authored team-enablement artifacts, optional integrations and future work. Do not invent employment, years of experience, client relationships, pair programming, mentoring activity, cloud deployment, production scale or financial impact. Select the strongest three or four bullets for the available space. Verify all links and the GitHub Actions run before describing CI or Docker results as passed. Keep job-specific keywords natural and supported by the evidence below.

## Product and problem

ForgeSignal is a manufacturing operations intelligence application that connects telemetry monitoring to an evidence-backed maintenance review. The user is an operations analyst who needs to identify a concerning machine reading, inspect sensor context, retrieve relevant procedures, and propose a maintenance task. A supervisor can approve or reject that proposal with a recorded audit trail. The core workflow is monitor → investigate → inspect citations → draft work order → review captured evidence → record a decision.

The business hypothesis is that integrated telemetry and reference evidence could reduce the friction of switching between dashboards, manuals and maintenance queues. No reduction in downtime or investigation time has been measured. The application is an independently runnable portfolio, not evidence of a commercial client deployment. Six fictional CNC assets and two production lines are used to make the user journey concrete.

## Technical implementation

Frontend: React 19 and TypeScript with strict compiler checking, Vite, original responsive CSS, and Lucide icons. The four views cover fleet overview, work orders, evidence library and model evaluation. Users can search assets, filter production lines, inspect sensor units, view score history, open an evidence drawer, inspect source passages and workflow trace, export a timestamped JSON snapshot, and make maintenance decisions. Desktop and 390px mobile browser checks are included, with a real captioned video and screenshots in the README.

Backend: Python 3.13, FastAPI, Pydantic validation, SQLite, REST APIs and Server-Sent Events. A server-owned replay worker sends synthetic held-out readings every two seconds. Validated sensor events are scored and stored transactionally. Unique event IDs make repeated imports idempotent. An indexed asset-history query supports current telemetry and recent history. Work-order creation captures the complete asset evidence snapshot; a conditional status update prevents a second decision, and the audit record commits in the same transaction. Optional shared bearer-token protection covers write routes. It is not a full identity or RBAC system.

Data pipeline: the attributed UCI AI4I 2020 CSV is included with a verified SHA-256. A download script retrieves the original source. The model uses six documented features: type, air temperature, process temperature, rotational speed, torque and tool wear. Product identifiers, the target and all five failure subtype labels are excluded to prevent direct leakage. A JSONL import CLI validates the public telemetry contract before making API calls, reports accepted and duplicate events, and supports safe retries through IDs.

Machine learning: scikit-learn histogram gradient boosting classifies the failure state associated with the current observation. A stratified split with seed 42 allocates 6,000 training, 2,000 validation and 2,000 test records. The 0.24 alert threshold is selected by validation F1. The test partition is used to report final performance against a prior DummyClassifier. The model is not a remaining-useful-life or future-failure predictor, and its scores are not calibrated probabilities. Random splits do not establish temporal generalization.

AI orchestration: a genuine LangGraph StateGraph executes retrieval, composition and validation nodes. The assistant retrieves top passages using local sparse TF-IDF vectors and cosine similarity over five original example runbooks. Without a provider key it returns cited source passages. An optional LLM mode uses a backend API call, bounded output, a 20-second timeout, a constrained evidence prompt and a citation-presence check. Provider failures or missing citations produce an explicit extractive fallback. Unsupported questions can abstain. No real LLM provider call was made for the recorded evidence, and citation presence does not prove semantic faithfulness. The sparse index is not a vector database and the graph is not an autonomous ReAct implementation.

MCP: an official Python SDK stdio server exposes two read-only tools, `search_runbooks` and `fleet_snapshot`. A real MCP client initializes a session, lists both tools and invokes each successfully. The server has no machine actuation or decision-writing tools.

Reliability and delivery: structured JSON logs, request correlation IDs, Prometheus request counts, request-duration histograms, ingestion counters, health checks, automated integration tests, strict frontend compilation, locked dependencies, a multi-stage non-root Dockerfile, Docker Compose with a persistent local volume, GitHub Actions quality checks and GHCR publication configuration. An Azure Bicep evaluation template configures a single replica, HTTPS ingress, reviewer CIDR restriction, secret-backed write token and liveness probe. Azure was not deployed. Container Apps persistence is explicitly ephemeral in that template; a shared production pilot needs a managed database and external replay scheduling. The local Docker daemon was unavailable; check the repository CI run for container build evidence.

## Observed results

On the 2,000-record synthetic test partition, including 68 positive failures:

- Average precision: **0.8233**, compared with **0.0340** for the prior baseline.
- ROC AUC: **0.9732**, compared with **0.5000** for the baseline.
- Precision: **0.7162**; recall: **0.7794**; F1: **0.7465**, at the validation-selected threshold 0.24.
- Confusion matrix: **1,911 true negatives, 21 false positives, 15 false negatives, 53 true positives**.
- **18 automated tests** passed for startup, monitoring, event deduplication, rejected telemetry, authorization, decision state transitions, captured evidence, retrieval/abstention, provider fallback, missing citations, feature/report contracts, replay and deterministic inference.
- **12/12 authored retrieval/abstention smoke cases** passed. This is not an independent relevance benchmark or a RAGAS score.
- Live verification received three SSE messages with an increasing event count; actual MCP protocol calls passed.
- **Ten browser workflow/responsive checks**, no JavaScript page errors, and no horizontal overflow at 390px viewport width.
- **8.12 ms median and 9.21 ms p95** observed for 50 sequential local loopback snapshot requests. Avoid converting this into a production latency or scalability claim.

Artifacts are available in `artifacts/` and can be regenerated using the README commands. Model metrics are benchmark results on synthetic data. There is no measured financial, uptime, adoption or field-maintenance result.

## Suggested resume entry

**ForgeSignal | Full-stack Operations Intelligence Platform**  
React, TypeScript, Python, FastAPI, SQLite, scikit-learn, LangGraph, MCP, Prometheus, Docker, GitHub Actions

- Built an end-to-end manufacturing operations application with React/TypeScript and FastAPI, combining SSE telemetry replay, SQL persistence, cited maintenance guidance and a human approval workflow with captured evidence and audit history.
- Developed a leakage-controlled, six-feature gradient-boosting pipeline on UCI AI4I; achieved **0.823 average precision and 77.9% recall** on **2,000 held-out synthetic records**, with a validation-selected threshold and documented baseline comparison.
- Implemented a bounded **LangGraph** retrieval workflow with source citations, explicit extractive/LLM modes, provider fallback and abstention; exposed and verified two read-only tools through the official **MCP** stdio protocol.
- Added **18 automated tests**, browser workflow checks, Prometheus metrics and structured request tracing; packaged reproducible setup, a Docker build, GitHub Actions delivery configuration and an Azure evaluation template.

Choose three bullets if space is limited. Use “configured” or “packaged” for cloud/container capabilities until an actual successful build/deployment is evidenced. Do not state that optional LLM mode was live-validated. Keep “synthetic” beside the evaluation claim.

## Supported keywords

Full-stack development; software engineering; React; TypeScript; responsive UI; user-centered workflow; Python; FastAPI; REST API; OpenAPI; Pydantic; SQL; SQLite; data validation; ETL; idempotency; transactional consistency; Server-Sent Events; real-time application; machine learning; scikit-learn; gradient boosting; validation/test separation; imbalanced classification; average precision; model evaluation; retrieval-augmented workflow; prompt orchestration; LangGraph; MCP; human-in-the-loop approval; automated testing; pytest; browser verification; structured logging; correlation IDs; observability; Prometheus; Docker; CI/CD; GitHub Actions; Azure infrastructure template; architecture decision records; technical documentation; team enablement.

Unsupported additions: Kubernetes, Kafka, PostgreSQL implementation, NoSQL database, dedicated vector database, RAGAS faithfulness metrics, production SLOs, actual Azure deployment, commercial savings, reduced downtime, autonomous equipment control, cross-client leadership or mentoring activity.

## Research and design reasoning to discuss in interviews

Research used UCI's original schema/license and introductory paper context; Lewis et al.'s RAG paper; Yao et al.'s ReAct paper; Es et al.'s Ragas paper; Azure's document-chat reference project; Microsoft's manufacturing operations accelerator; Grafana dashboard guidance; IBM Carbon table/status patterns; official LangGraph, MCP and Prometheus documentation. The implementation uses independent code and original demo runbooks, retaining dataset and research attribution.

Explain why average precision is more informative than accuracy for a 3.4% positive test population; why subtype labels leak the target; why threshold selection belongs on validation rather than test; why synthetic replay is not live factory validation; why a citation marker is weaker than entailment; why a bounded graph is suitable for a supervised workflow; why a transaction couples decision state and audit; why an ID supports safe retries; and why the present replay/SQLite architecture needs changes before horizontal scale.

## Team and leadership evidence

The repository includes a proposed sprint backlog, definition of done, onboarding path, pair-programming exercise, ADRs and operating runbook. These show the ability to write clear handoff materials. They are not records of actual Agile ceremonies, mentoring, pair programming, client work or leadership of a real team. The candidate's education, employment duration, communication proficiency and collaboration history must come from their own verified experience.

## Honest next steps

Before a real client pilot: evaluate an ordered holdout, calibration and operating-point costs; gather approved procedures and independent guidance ratings; add OIDC/RBAC and rate limits; move shared state to PostgreSQL, replay scheduling to an independent worker, and model/document versions to a registry; validate backup restoration and drift monitoring; test real plant telemetry; and measure workflow time against an agreed baseline. These are future improvements, not implemented achievements.
