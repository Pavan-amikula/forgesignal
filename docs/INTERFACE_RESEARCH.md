# Operations workbench: interface research and design decisions

Reviewed 24 October 2026. This revision changes the information architecture and operational controls, rather than only the palette. Reference product screenshots were inspected as design research; no external interface assets or layouts are redistributed in the application.

## Primary portal references

| Reference | Observed pattern | Independent ForgeSignal implementation |
|---|---|---|
| [MaintainX — View Assets](https://help.getmaintainx.com/viewing-assets), including its [asset-header screenshot](https://help.getmaintainx.com/assets/images/asset-header-4b57dbd58673e14f0690538d2ae478e9.png) | Asset list/detail context, table view, source/history tabs and reusable filters | A sortable register, persistent asset inspector, event log, asset-linked orders and locally saved views |
| [MaintainX — About Work Orders](https://help.getmaintainx.com/about-work-orders) | Requests carry the asset, responsible party and intended timing | An editable inspection request with priority, owner/team, requested date and notes; a captured evidence snapshot and a recorded reviewer note |
| [Grafana — Metrics Drilldown](https://grafana.com/docs/grafana/latest/visualizations/simplified-exploration/metrics/drill-down-metrics/), including its [filter/exploration screenshot](https://grafana.com/media/docs/explore-metrics/metrics-drilldown-choose-filters.png) | Filters, selected signals, observation ranges and exploration state stay near the data | Multi-asset plots, metric selection, reading windows, keyboard scrubbing, observation export and shareable asset/filter URLs |
| [Siemens Insights Hub — Asset views](https://docs.industrial-operations-x.siemens.cloud/r/en-us/insights-hub-how-tos/apps-and-solutions/monitor/insights-hub-monitor/monitor-the-status-of-your-assets-using-different-views?contentId=YgvqQ_dj81tfx1YS4LUzJQ) | Health filters and selectable asset layouts support locating the asset needing attention | A review filter and an original interactive facility schematic with two fictional production lanes |
| [Samsara — Equipment tracking](https://www.samsara.com/products/equipment-tracking) | Equipment inventory connects condition/context to an actionable asset view | A compact production-line tree, condition labels, current readings and direct investigation/planning actions |

## Product decisions

The primary screen is a working register, signal plot and inspector. A compact numerical strip links to the relevant filter or queue. The navigation provides five explicit destinations: Asset monitor, Signal explorer, Review queue, Procedure library and Model validation. Marketing slogans, repeated asset cards, decorative profile controls and decorative AI effects are removed.

The view uses IBM Plex Sans and Mono, a dark horizontal masthead, a light navigation rail, neutral work surfaces and cobalt selection states. Amber indicates a review threshold or high planning priority. Text and tabular numerals carry meaning independently of color. Original SVG machine schematics identify the asset type without pretending to be manufacturer photographs.

## Controls and actual state

- **Freeze view** holds the displayed snapshot while the SSE connection and server replay continue. Replay controls always use the latest server state. Leaving the monitor/explorer resumes current snapshots so the review queue remains live.
- **Comparison** supports up to three assets. Curves align by observation index, with labels explaining that these are independent synthetic readings rather than synchronized histories.
- **Following / saved views** persist in browser storage only. Shared URLs carry page, selected asset and filter/sort selections; they do not share credentials, local watchlists or database contents.
- **CSV export** contains only the currently filtered register. JSON exports retain observation/evidence structure. The chart has a keyboard-operable observation scrubber.
- **Command search** opens with Ctrl/Cmd+K and can navigate to pages, assets, matching procedures and orders. `/` focuses register search. Dialogs trap focus, close with Escape and restore prior focus.
- **Work orders** store planning fields in SQL. Approval/rejection and its reviewer note commit with the audit record. Existing workspaces receive an additive, idempotent schema migration.

These are engineering design choices, not findings from a conducted user study. The recorded browser checks verify the implemented behavior and narrow-screen overflow; they do not establish external usability-study or formal accessibility-conformance results.
