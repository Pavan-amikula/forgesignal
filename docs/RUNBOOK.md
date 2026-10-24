# Operating and reproducing ForgeSignal

## Start and stop

Use `scripts/start.ps1` on Windows or the README commands on Linux. The compiled UI and API share port 8000. Stop with Ctrl+C. Run only one API process for a database: replay ownership is local. Replay is paused at startup and must be started explicitly. A browser disconnect does not pause the server replay.

For frontend development, run the API and then `npm run dev` in `frontend`; Vite proxies API requests. The API only mounts the built UI if `frontend/dist` exists when the Python process starts. Restart after the first build.

SQLite defaults to `artifacts/forge.db`. To start a separate test workspace, set `FORGE_DB` to another file before starting the API. Tests use temporary databases. Stop the service before copying a database backup; a live WAL database requires SQLite's backup API rather than copying only the main file. No automated production backup job is supplied.

## Ingest customer-shaped telemetry

The JSONL contract appears in `data/example-events.jsonl`. Use `python -m scripts.import_telemetry data/example-events.jsonl`. All lines validate before sending begins. A network failure can leave a partial import; rerun safely because event IDs deduplicate. Sensor bounds and asset IDs are deliberately constrained to this demo. The API accepts arrival-time telemetry without the benchmark's target columns. A repeated ID with the same validated payload returns the original score without reinsertion; a different payload under that ID returns 409.

## Token mode

Set `FORGE_WRITE_TOKEN` to a random secret in the server environment. Enter that value in the browser's supervisor-token field. It stays in React memory and is not persisted in local storage. Write clients send `Authorization: Bearer ...`. In local mode with no token, writes are available to the loopback user and the audit actor is `local-demo-supervisor`. This is not an identity provider or a real separation of analyst and supervisor accounts.

## Inspect health

`GET /api/health`: process can reach SQL and model has loaded. `GET /metrics`: Prometheus request count, request-duration histogram and accepted event count. Structured request logs include `request_id`; HTTP replies carry `X-Request-ID`. Requests with errors such as 422 or 409 are counted by status. Browser stream status reports SSE connectivity, not sensor freshness or a physical connection.

If replay does not move, start it in Overview and check `/api/snapshot`. If no UI loads, build `frontend` and restart. If an LLM call fails, the visible response mode explains extractive fallback. If the write token is missing, the server returns 401. A repeated decision returns 409. Invalid/target-leaking telemetry returns 422 without insertion.

## MCP client configuration

Example shape for clients using a standard stdio configuration (replace absolute paths):

```json
{
  "mcpServers": {
    "forgesignal": {
      "command": "/absolute/path/forgesignal/.venv/bin/python",
      "args": ["-m", "backend.mcp_server"],
      "cwd": "/absolute/path/forgesignal",
      "env": {"FORGE_API_URL": "http://127.0.0.1:8000"}
    }
  }
}
```

Windows executable: `.venv/Scripts/python.exe`. Clients differ in whether `cwd` is accepted; for those that omit it, set `PYTHONPATH` to the repository root. Search is available without the API; fleet snapshots require it. Run `python -m scripts.verify_live` for actual protocol verification.

## Reproduce reports and demo

Train the model before tests. Run the commands in README. Browser recording adds a proposal and approval to the demo database; it is an integration walkthrough, not a nondestructive read. Optional browser packages: `pip install playwright imageio-ffmpeg`; `python -m playwright install chromium`.

The recording is silent with on-screen captions. MP4/GIF are rendered from the real browser video; screenshots come from Playwright. The human-readable demo describes synthetic replay throughout. No synthetic performance statistics are overlaid on the application.
