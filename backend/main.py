import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timezone
import json
import logging
import os
from pathlib import Path
import time
import uuid

import pandas as pd
from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.responses import StreamingResponse, Response, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, ConfigDict
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
from backend import store
from backend.ml import ROOT, RENAME, load, score, matrix
from backend.assistant import advise, DOCS

logging.basicConfig(level=logging.INFO, format="%(message)s")
LOG = logging.getLogger("forgesignal")
REQUESTS = Counter("forge_requests_total", "HTTP requests", ["method", "status"])
LATENCY = Histogram("forge_request_seconds", "HTTP request duration")
INGESTED = Counter("forge_ingested_total", "Accepted telemetry events")
ASSETS = [
    {"id": f"CNC-{i:02}", "name": name, "line": line}
    for i, name, line in [
        (1, "Precision mill 01", "Machining A"),
        (2, "Precision mill 02", "Machining A"),
        (3, "Turning center 03", "Machining A"),
        (4, "Finishing mill 04", "Machining B"),
        (5, "Turning center 05", "Machining B"),
        (6, "Precision mill 06", "Machining B"),
    ]
]
STATE = {"running": False, "cursor": 0, "model": None, "pool": None}


def now():
    return datetime.now(timezone.utc).isoformat()


class Reading(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    event_id: str = Field(min_length=1, max_length=100)
    asset_id: str = Field(pattern=r"^CNC-0[1-6]$")
    type: str = Field(pattern="^[LMH]$")
    air_temperature: float = Field(ge=250, le=400)
    process_temperature: float = Field(ge=250, le=500)
    rpm: float = Field(ge=100, le=10000)
    torque: float = Field(ge=0, le=200)
    tool_wear: float = Field(ge=0, le=1000)


def ingest(reading):
    value = reading.model_dump()
    risk = score(STATE["model"]["model"], value)
    with store.connect() as db:
        cur = db.execute(
            "INSERT OR IGNORE INTO events(event_id,asset_id,timestamp,payload,score) VALUES (?,?,?,?,?)",
            (value["event_id"], value["asset_id"], now(), json.dumps(value), risk),
        )
        accepted = cur.rowcount == 1
        if not accepted:
            previous = db.execute(
                "SELECT payload,score FROM events WHERE event_id=?",
                (value["event_id"],),
            ).fetchone()
            if json.loads(previous["payload"]) != value:
                raise HTTPException(
                    409, "Event ID already belongs to a different payload"
                )
            risk = previous["score"]
    if accepted:
        INGESTED.inc()
    return {"accepted": accepted, "score": round(risk, 4)}


def replay_step():
    pool = STATE["pool"]
    i = STATE["cursor"]
    row = pool.iloc[i % len(pool)]
    value = {
        v: (str(row[k]) if v == "type" else float(row[k])) for k, v in RENAME.items()
    }
    value.update(
        event_id="replay-" + uuid.uuid4().hex, asset_id=ASSETS[i % len(ASSETS)]["id"]
    )
    STATE["cursor"] += 1
    return ingest(Reading(**value))


async def ticker():
    while True:
        await asyncio.sleep(2)
        if STATE["running"]:
            await asyncio.to_thread(replay_step)


@asynccontextmanager
async def lifespan(app):
    store.init()
    STATE["model"] = load()
    frame = pd.read_csv(ROOT / "data/ai4i2020.csv")
    # Replay uses only the untouched evaluation partition; labels stay out of payloads.
    pool = frame.iloc[STATE["model"]["test_indices"]].reset_index(drop=True)
    STATE["pool"] = pool
    with store.connect() as db:
        count = db.execute("SELECT count(*) FROM events").fetchone()[0]
    if not count:
        # Seed a representative, explicit demo fixture: one alert and five healthy readings.
        positives = pool[pool["Machine failure"] == 1]
        healthy = pool[pool["Machine failure"] == 0]
        demo_scores = STATE["model"]["model"].predict_proba(matrix(positives))[:, 1]
        demo_index = abs(demo_scores - 0.85).argmin()
        seeds = [positives.iloc[demo_index]] + [healthy.iloc[j] for j in range(5)]
        for i, row in enumerate(seeds):
            val = {
                v: (str(row[k]) if v == "type" else float(row[k]))
                for k, v in RENAME.items()
            }
            val.update(event_id=f"seed-{i}", asset_id=ASSETS[i]["id"])
            ingest(Reading(**val))
    task = asyncio.create_task(ticker())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


app = FastAPI(title="ForgeSignal API", version="1.0.0", lifespan=lifespan)


@app.middleware("http")
async def observability(request, call_next):
    start = time.perf_counter()
    request_id = uuid.uuid4().hex
    response = await call_next(request)
    elapsed = time.perf_counter() - start
    REQUESTS.labels(request.method, str(response.status_code)).inc()
    LATENCY.observe(elapsed)
    response.headers["X-Request-ID"] = request_id
    LOG.info(
        json.dumps(
            {
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "status": response.status_code,
                "duration_ms": round(elapsed * 1000, 2),
            }
        )
    )
    return response


def write_access(request: Request):
    token = os.getenv("FORGE_WRITE_TOKEN")
    if token and request.headers.get("Authorization") != f"Bearer {token}":
        raise HTTPException(401, "Write token required")
    return "authenticated-supervisor" if token else "local-demo-supervisor"


def snapshot():
    with store.connect() as db:
        assets = []
        for asset in ASSETS:
            rows = db.execute(
                "SELECT * FROM events WHERE asset_id=? ORDER BY seq DESC LIMIT 30",
                (asset["id"],),
            ).fetchall()
            latest = rows[0] if rows else None
            assets.append(
                dict(
                    asset,
                    reading=json.loads(latest["payload"]) if latest else None,
                    score=round(latest["score"], 4) if latest else None,
                    timestamp=latest["timestamp"] if latest else None,
                    history=[
                        {
                            "score": round(r["score"], 4),
                            "rpm": json.loads(r["payload"])["rpm"],
                        }
                        for r in reversed(rows)
                    ],
                )
            )
        count = db.execute("SELECT count(*) FROM events").fetchone()[0]
        orders = [
            dict(r)
            for r in db.execute("SELECT * FROM orders ORDER BY id DESC LIMIT 100")
        ]
        audit = [
            dict(r)
            for r in db.execute("SELECT * FROM audit ORDER BY id DESC LIMIT 100")
        ]
    return {
        "assets": assets,
        "events": count,
        "orders": orders,
        "audit": audit,
        "replay_running": STATE["running"],
        "threshold": round(STATE["model"]["threshold"], 2),
        "source": "UCI AI4I synthetic replay",
        "timestamp": now(),
        "write_auth_required": bool(os.getenv("FORGE_WRITE_TOKEN")),
    }


@app.get("/api/health")
def health():
    with store.connect() as db:
        db.execute("SELECT 1")
    return {"status": "ok", "model_loaded": STATE["model"] is not None}


@app.get("/api/snapshot")
def get_snapshot():
    return snapshot()


@app.get("/api/model-report")
def model_report():
    return json.loads((ROOT / "artifacts/model-report.json").read_text())


@app.get("/api/runbooks")
def runbooks():
    return DOCS


@app.get("/metrics")
def metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


@app.get("/api/events")
async def events(request: Request):
    async def stream():
        while not await request.is_disconnected():
            value = await asyncio.to_thread(snapshot)
            yield "data: " + json.dumps(value) + "\n\n"
            await asyncio.sleep(2)

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


class Replay(BaseModel):
    running: bool


@app.post("/api/replay", dependencies=[Depends(write_access)])
def replay(body: Replay):
    STATE["running"] = body.running
    return {"running": STATE["running"]}


@app.post("/api/telemetry", dependencies=[Depends(write_access)])
def telemetry(body: Reading):
    return ingest(body)


class Question(BaseModel):
    question: str = Field(min_length=3, max_length=1500)
    asset_id: str = Field(pattern=r"^CNC-0[1-6]$")


@app.post("/api/assistant")
def assistant(body: Question):
    asset = next(a for a in snapshot()["assets"] if a["id"] == body.asset_id)
    return advise(body.question, asset)


class Proposal(BaseModel):
    asset_id: str = Field(pattern=r"^CNC-0[1-6]$")
    title: str = Field(min_length=5, max_length=200)


@app.post("/api/orders", status_code=201)
def propose(body: Proposal, actor=Depends(write_access)):
    asset = next(a for a in snapshot()["assets"] if a["id"] == body.asset_id)
    with store.connect() as db:
        cur = db.execute(
            "INSERT INTO orders(asset_id,title,status,evidence,created_at) VALUES (?,?,?,?,?)",
            (body.asset_id, body.title, "pending", json.dumps(asset), now()),
        )
        db.execute(
            "INSERT INTO audit(order_id,action,actor,timestamp) VALUES (?,?,?,?)",
            (cur.lastrowid, "proposed", actor, now()),
        )
        return {"id": cur.lastrowid, "status": "pending"}


class Decision(BaseModel):
    status: str = Field(pattern="^(approved|rejected)$")


@app.post("/api/orders/{order_id}/decision")
def decision(order_id: int, body: Decision, actor=Depends(write_access)):
    with store.connect() as db:
        cur = db.execute(
            "UPDATE orders SET status=? WHERE id=? AND status='pending'",
            (body.status, order_id),
        )
        if cur.rowcount != 1:
            raise HTTPException(409, "Order missing or already decided")
        db.execute(
            "INSERT INTO audit(order_id,action,actor,timestamp) VALUES (?,?,?,?)",
            (order_id, body.status, actor, now()),
        )
    return {"id": order_id, "status": body.status}


# In production the Python service serves Vite's immutable build from the same origin.
DIST = ROOT / "frontend/dist"
if DIST.exists():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/")
    def index():
        return FileResponse(DIST / "index.html")
