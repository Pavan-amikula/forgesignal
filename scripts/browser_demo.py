"""Real browser walkthrough, assertions, screenshots and a silent captioned recording."""

import json
import uuid
import httpx
import pandas as pd
from pathlib import Path
from playwright.sync_api import sync_playwright
from backend.ml import ROOT, load, matrix, RENAME


def run():
    media = ROOT / "docs/media"
    media.mkdir(parents=True, exist_ok=True)
    errors = []
    # Explicit recording fixture, chosen only for a useful visible alert after model freeze.
    model = load()
    frame = pd.read_csv(ROOT / "data/ai4i2020.csv").iloc[model["test_indices"]]
    positives = frame[frame["Machine failure"] == 1]
    scores = model["model"].predict_proba(matrix(positives))[:, 1]
    row = positives.iloc[abs(scores - 0.85).argmin()]
    fixture = {
        v: (str(row[k]) if v == "type" else float(row[k])) for k, v in RENAME.items()
    }
    fixture.update(event_id="recording-fixture-" + uuid.uuid4().hex, asset_id="CNC-01")
    httpx.post(
        "http://127.0.0.1:8000/api/telemetry", json=fixture, timeout=15
    ).raise_for_status()
    with sync_playwright() as p:
        browser = p.chromium.launch()
        context = browser.new_context(
            viewport={"width": 1440, "height": 1080},
            device_scale_factor=1,
            record_video_dir=str(ROOT / "artifacts/raw-video"),
            record_video_size={"width": 1440, "height": 1080},
            reduced_motion="reduce",
        )
        page = context.new_page()
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto("http://127.0.0.1:8000")
        page.get_by_role("button", name="Start replay", exact=True).wait_for()
        page.wait_for_timeout(1200)
        page.screenshot(path=str(media / "overview.png"), full_page=True)

        def caption(text):
            page.evaluate(
                """text=>{let el=document.getElementById('demo-caption');if(!el){el=document.createElement('div');el.id='demo-caption';el.style.cssText='position:fixed;bottom:18px;left:50%;transform:translateX(-50%);background:#202723ed;color:#f5f6f0;border:1px solid #8c9a7b;padding:13px 25px;border-radius:6px;font:14px sans-serif;z-index:99999;box-shadow:0 8px 30px #0003;max-width:86vw;text-align:center;pointer-events:none';document.body.appendChild(el)}el.textContent=text}""",
                text,
            )

        caption("01 / A working operations workbench · React + FastAPI + SQLite")
        page.wait_for_timeout(3500)
        page.get_by_role("button", name="Start replay", exact=True).click()
        caption(
            "02 / Start a live server replay of held-out synthetic telemetry · SSE updates every 2 seconds"
        )
        page.wait_for_timeout(6500)
        page.get_by_role("button", name="Pause", exact=True).click()
        page.get_by_role("button", name="Open investigation").click()
        page.get_by_role("button", name="Retrieve guidance").click()
        page.get_by_text("extractive (no LLM key)", exact=True).wait_for()
        caption(
            "03 / Retrieve cited maintenance evidence · LangGraph workflow · No API key required"
        )
        page.wait_for_timeout(1000)
        page.evaluate(
            "document.getElementById('demo-caption').style.visibility='hidden'"
        )
        page.screenshot(path=str(media / "investigation.png"))
        page.evaluate(
            "document.getElementById('demo-caption').style.visibility='visible'"
        )
        page.wait_for_timeout(4500)
        page.get_by_text("Workflow execution trace", exact=True).click()
        caption(
            "04 / Inspect retrieval, response mode, citations and the execution trace"
        )
        page.wait_for_timeout(3500)
        page.get_by_role("button", name="Draft work order", exact=True).last.click()
        page.get_by_role("heading", name="From insight to action.").wait_for()
        caption(
            "05 / A proposal captures the asset evidence · A supervisor makes the decision"
        )
        page.wait_for_timeout(3000)
        page.get_by_role("button", name="Approve", exact=True).first.click()
        page.get_by_text("Decision recorded", exact=True).first.wait_for()
        caption(
            "06 / Approval is persisted with a decision audit trail · No physical machine commands"
        )
        page.wait_for_timeout(1000)
        page.evaluate(
            "document.getElementById('demo-caption').style.visibility='hidden'"
        )
        page.screenshot(path=str(media / "work-orders.png"), full_page=True)
        page.evaluate(
            "document.getElementById('demo-caption').style.visibility='visible'"
        )
        page.wait_for_timeout(3500)
        page.get_by_role("button", name="Model evaluation", exact=True).click()
        page.get_by_role("heading", name="Measure before you trust.").wait_for()
        caption(
            "07 / Held-out results with a baseline, confusion matrix, split and explicit limitations"
        )
        page.wait_for_timeout(1000)
        page.evaluate(
            "document.getElementById('demo-caption').style.visibility='hidden'"
        )
        page.screenshot(path=str(media / "evaluation.png"), full_page=True)
        page.evaluate(
            "document.getElementById('demo-caption').style.visibility='visible'"
        )
        page.wait_for_timeout(4500)
        page.get_by_role("button", name="Evidence library", exact=True).click()
        caption(
            "08 / Inspect source procedures · Reproducible reports and source research ship in the repository"
        )
        page.wait_for_timeout(4000)
        page.get_by_role("button", name="Overview", exact=True).click()
        page.get_by_role("textbox", name="Find an asset").fill("CNC-01")
        assert page.locator(".asset-card").count() == 1
        page.get_by_role("textbox", name="Find an asset").fill("")
        page.get_by_label("Production line").select_option("Machining A")
        assert page.locator(".asset-card").count() == 3
        page.get_by_label("Production line").select_option("All production lines")
        with page.expect_download() as download:
            page.get_by_role("button", name="Export snapshot").click()
        download.value.save_as(str(ROOT / "artifacts/demo-snapshot.json"))
        page.evaluate("document.getElementById('demo-caption').remove()")
        video = page.video
        context.close()
        video.save_as(str(media / "walkthrough.webm"))
        # A separate mobile pass verifies responsive layout without changing demo video.
        mobile = browser.new_page(
            viewport={"width": 390, "height": 844},
            is_mobile=True,
            device_scale_factor=1,
        )
        mobile.goto("http://127.0.0.1:8000")
        mobile.get_by_role("button", name="Start replay", exact=True).wait_for()
        assert mobile.evaluate(
            "document.documentElement.scrollWidth <= window.innerWidth"
        )
        mobile.screenshot(path=str(media / "mobile.png"), full_page=True)
        mobile.close()
        browser.close()
    result = {
        "checks": [
            "Live replay start/pause",
            "Cited evidence response",
            "Work-order draft",
            "Supervisor approval and audit",
            "Evaluation view",
            "Evidence library",
            "Asset search",
            "Line filtering",
            "JSON export",
            "390px mobile overflow check",
        ],
        "browser_errors": errors,
        "viewport": "1440x1080 and 390x844",
        "recording": "Silent, captioned real browser walkthrough; synthetic data replay",
    }
    (ROOT / "artifacts/browser-verification.json").write_text(
        json.dumps(result, indent=2) + "\n"
    )
    assert not errors, errors
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    run()
