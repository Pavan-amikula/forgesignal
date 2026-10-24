# Team enablement playbook

These are proposed working practices and exercises, not claims of prior client-team participation.

## Product framing for a client workshop

Ask the operations lead which decisions the current dashboard fails to support, what makes an alert useful, who can approve maintenance, which site procedures are authoritative, and how long triage currently takes. Agree on a bounded first pilot, the data owner, false-alert tolerance and a measurable baseline. Keep model quality and business value as separate questions.

## Proposed sprint backlog

| Iteration | Story | Acceptance evidence |
|---|---|---|
| Foundation | As an analyst, see validated telemetry with clear units | Valid/invalid ingestion tests; working fleet view |
| Investigation | As an analyst, inspect sources behind guidance | Source IDs, passages, fallback mode and retrieval cases |
| Decisions | As a supervisor, review captured evidence and decide once | Conditional transition, audit tests and browser walkthrough |
| Reliability | As an engineer, reproduce results and diagnose failures | Locked setup, model report, correlation IDs and metrics |
| Next pilot | As a client lead, evaluate adoption responsibly | Ordered holdout, human guidance ratings, triage timing and data access review |

## Ceremonies and delivery discipline

Planning: confirm the user problem, smallest reviewable change and acceptance evidence. Daily sync: state the next user-visible outcome and blocker. Refinement: involve both the operator and technical owner. Review: demonstrate the workflow from a fresh workspace. Retrospective: select one delivery improvement with an owner and follow-up date. Never fabricate meeting records to make this portfolio appear like commercial teamwork.

## Pair-programming exercise

Pair on adding a sensor-quality indicator. One developer writes a failing acceptance case while the other explains the schema and frontend state flow; switch roles after a short interval. Agree what counts as stale and how it differs from stream connectivity. Review naming, user language, API compatibility and observability. This is an exercise for future practice, not evidence that pairing already occurred.

## Definition of done

- The user can complete the intended task with informative loading/error states.
- API contract and negative-path tests cover material behavior.
- TypeScript build and appropriate backend checks pass.
- Logs avoid secrets; actions have the intended authorization boundary.
- Reproducible reports and docs match observed behavior.
- Screenshots/demo show actual outputs; limitations are understandable.

## Onboarding walkthrough

Read README, run the app, trace an event through `Reading → ingest → model → events`, then trace a question through the LangGraph nodes. Approve one demo proposal and inspect its captured JSON evidence and audit record. Explain why the model score is not a time-to-failure estimate and why SQLite/replay cannot scale to multiple replicas unchanged.
