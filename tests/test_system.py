import json
import os
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from backend.main import app, STATE
from backend.ml import FEATURES, ROOT
from backend.assistant import advise, retrieve


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("FORGE_DB", str(tmp_path / "test.db"))
    monkeypatch.delenv("FORGE_WRITE_TOKEN", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    STATE["running"] = False
    with TestClient(app) as c:
        yield c


def reading(event_id="test-1"):
    return dict(
        event_id=event_id,
        asset_id="CNC-01",
        type="L",
        air_temperature=300,
        process_temperature=310,
        rpm=1500,
        torque=40,
        tool_wear=100,
    )


def test_startup_and_monitoring(client):
    assert client.get("/api/health").json() == {"status": "ok", "model_loaded": True}
    state = client.get("/api/snapshot").json()
    assert len(state["assets"]) == 6 and state["events"] == 6
    assert all(a["reading"] for a in state["assets"])
    assert "forge_requests_total" in client.get("/metrics").text
    assert client.get("/api/health").headers["X-Request-ID"]


def test_idempotent_ingestion(client):
    assert client.post("/api/telemetry", json=reading()).json()["accepted"]
    assert not client.post("/api/telemetry", json=reading()).json()["accepted"]
    assert client.get("/api/snapshot").json()["events"] == 7


def test_conflicting_id_rejected(client):
    client.post("/api/telemetry", json=reading())
    changed = reading()
    changed["torque"] = 60
    assert client.post("/api/telemetry", json=changed).status_code == 409
    assert client.get("/api/snapshot").json()["events"] == 7


def test_rich_history_preserves_units_and_event_identity(client):
    client.post("/api/telemetry", json=reading("history-check"))
    history = client.get("/api/snapshot").json()["assets"][0]["history"]
    event = history[-1]
    assert event["event_id"] == "history-check"
    assert event["torque"] == 40 and event["tool_wear"] == 100
    assert event["process_temperature"] == 310 and event["timestamp"]


def test_planning_fields_and_reviewer_note_round_trip(client):
    payload = {
        "asset_id": "CNC-01",
        "title": "Inspect the coolant circuit",
        "priority": "high",
        "assignee": "Shift maintenance",
        "due_date": "2026-11-01",
        "notes": "Review the thermal runbook before inspection.",
    }
    created = client.post("/api/orders", json=payload)
    assert created.status_code == 201
    order_id = created.json()["id"]
    client.post(
        f"/api/orders/{order_id}/decision",
        json={"status": "rejected", "note": "Need the approved site procedure first."},
    )
    data = client.get("/api/snapshot").json()
    order = data["orders"][0]
    assert all(
        order[k] == payload[k] for k in ("priority", "assignee", "due_date", "notes")
    )
    assert data["audit"][0]["note"] == "Need the approved site procedure first."


def test_invalid_planning_fields_rejected(client):
    for field, value in [
        ("priority", "emergency"),
        ("due_date", "tomorrow"),
        ("assignee", "x" * 101),
    ]:
        response = client.post(
            "/api/orders",
            json={"asset_id": "CNC-01", "title": "Inspect machine", field: value},
        )
        assert response.status_code == 422


def test_existing_workspace_migration_is_idempotent(tmp_path, monkeypatch):
    import sqlite3
    from backend import store

    path = tmp_path / "legacy.db"
    with sqlite3.connect(path) as db:
        db.execute(
            "CREATE TABLE orders (id INTEGER PRIMARY KEY, asset_id TEXT,title TEXT,status TEXT,evidence TEXT,created_at TEXT)"
        )
        db.execute(
            "INSERT INTO orders VALUES (1,'CNC-01','Legacy order','pending','{}','2026-10-24')"
        )
    monkeypatch.setenv("FORGE_DB", str(path))
    store.init()
    store.init()
    with store.connect() as db:
        order = dict(db.execute("SELECT * FROM orders").fetchone())
        assert order["title"] == "Legacy order" and order["priority"] == "normal"


@pytest.mark.parametrize(
    "key,value",
    [
        ("rpm", -1),
        ("torque", 9999),
        ("type", "Z"),
        ("asset_id", "CNC-99"),
        ("tool_wear", -1),
        ("event_id", ""),
        ("Machine failure", 1),
    ],
)
def test_invalid_or_leaked_payload_rejected(client, key, value):
    payload = reading()
    payload[key] = value
    assert client.post("/api/telemetry", json=payload).status_code == 422
    assert client.get("/api/snapshot").json()["events"] == 6


def test_human_decision_state_machine(client):
    response = client.post(
        "/api/orders", json={"asset_id": "CNC-01", "title": "Inspect cooling system"}
    )
    assert response.status_code == 201
    order = response.json()["id"]
    assert (
        client.post(
            f"/api/orders/{order}/decision", json={"status": "approved"}
        ).status_code
        == 200
    )
    assert (
        client.post(
            f"/api/orders/{order}/decision", json={"status": "rejected"}
        ).status_code
        == 409
    )
    assert (
        client.post("/api/orders/999/decision", json={"status": "approved"}).status_code
        == 409
    )
    state = client.get("/api/snapshot").json()
    assert state["orders"][0]["status"] == "approved"
    evidence = json.loads(state["orders"][0]["evidence"])
    assert evidence["id"] == "CNC-01" and "score" in evidence
    assert [a["action"] for a in state["audit"]] == ["approved", "proposed"]


def test_write_authorization(client, monkeypatch):
    monkeypatch.setenv("FORGE_WRITE_TOKEN", "test-only-token")
    assert client.post("/api/replay", json={"running": True}).status_code == 401
    assert client.post("/api/telemetry", json=reading()).status_code == 401
    assert (
        client.post(
            "/api/orders", json={"asset_id": "CNC-01", "title": "Inspect cooling"}
        ).status_code
        == 401
    )
    assert (
        client.post(
            "/api/replay",
            json={"running": False},
            headers={"Authorization": "Bearer test-only-token"},
        ).status_code
        == 200
    )


def test_cited_guidance_and_abstention(client):
    result = client.post(
        "/api/assistant",
        json={"question": "tool wear overstrain inspection", "asset_id": "CNC-01"},
    ).json()
    assert result["mode"] == "extractive (no LLM key)"
    assert "[RB-03]" in result["answer"]
    assert len(result["trace"]) == 3
    assert advise("capital city of Peru")["mode"] == "abstained"


def test_provider_failure_is_explicit(monkeypatch):
    import httpx

    monkeypatch.setenv("OPENAI_API_KEY", "test-placeholder")

    def fail(*args, **kwargs):
        raise httpx.ConnectError("offline")

    monkeypatch.setattr(httpx, "post", fail)
    answer = advise("thermal cooling heat dissipation")
    assert answer["mode"].startswith("extractive fallback")
    assert "[RB-01]" in answer["answer"]


def test_provider_citation_validation(monkeypatch):
    import httpx

    monkeypatch.setenv("OPENAI_API_KEY", "test-placeholder")

    class Fake:
        def raise_for_status(self):
            pass

        def json(self):
            return {
                "choices": [{"message": {"content": "Uncited unsupported guidance"}}]
            }

    monkeypatch.setattr(httpx, "post", lambda *a, **k: Fake())
    assert advise("thermal cooling heat dissipation")["mode"].startswith(
        "extractive fallback"
    )


def test_report_contract_and_quality(client):
    report = client.get("/api/model-report").json()
    assert report["split"] == {"train": 6000, "validation": 2000, "test": 2000}
    assert len(FEATURES) == 6
    assert not set(FEATURES) & {
        "Machine failure",
        "UID",
        "Product ID",
        "TWF",
        "HDF",
        "PWF",
        "OSF",
        "RNF",
    }
    assert report["test"]["average_precision"] > report["baseline"]["average_precision"]
    assert sum(map(sum, report["test"]["confusion_matrix"])) == 2000


def test_replay_advances(client):
    from backend.main import replay_step

    replay_step()
    assert client.get("/api/snapshot").json()["events"] == 7


def test_model_is_deterministic(client):
    a = client.post("/api/telemetry", json=reading("a")).json()
    b = client.post("/api/telemetry", json=reading("b")).json()
    assert a["score"] == b["score"]
