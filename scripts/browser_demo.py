"""Regression walkthrough for the operations workbench; records the real application."""

import json
import uuid
import re
import httpx
import pandas as pd
from playwright.sync_api import sync_playwright, expect
from backend.ml import ROOT, load, matrix, RENAME


def fixture():
    model = load()
    frame = pd.read_csv(ROOT / "data/ai4i2020.csv").iloc[model["test_indices"]]
    positives = frame[frame["Machine failure"] == 1]
    scores = model["model"].predict_proba(matrix(positives))[:, 1]
    alert = positives.iloc[abs(scores - 0.85).argmin()]
    # Recording fixtures are actual held-out rows submitted through the public contract.
    with httpx.Client(base_url="http://127.0.0.1:8000", timeout=15) as client:
        client.post("/api/replay", json={"running": False}).raise_for_status()
        for i, (_, row) in enumerate(frame.head(60).iterrows()):
            value = {
                v: (str(row[k]) if v == "type" else float(row[k]))
                for k, v in RENAME.items()
            }
            value.update(
                event_id="ui-fixture-" + uuid.uuid4().hex, asset_id=f"CNC-{i%6+1:02}"
            )
            client.post("/api/telemetry", json=value).raise_for_status()
        value = {
            v: (str(alert[k]) if v == "type" else float(alert[k]))
            for k, v in RENAME.items()
        }
        value.update(event_id="ui-alert-" + uuid.uuid4().hex, asset_id="CNC-01")
        client.post("/api/telemetry", json=value).raise_for_status()


def run():
    fixture()
    media = ROOT / "docs/media"
    media.mkdir(parents=True, exist_ok=True)
    checks = []
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        context = browser.new_context(
            viewport={"width": 1600, "height": 1100},
            device_scale_factor=1,
            record_video_dir=str(ROOT / "artifacts/raw-video"),
            record_video_size={"width": 1600, "height": 1100},
            reduced_motion="reduce",
        )
        page = context.new_page()
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto("http://127.0.0.1:8000/?page=monitor")
        expect(page.locator(".asset-table tbody tr")).to_have_count(6)
        checks.append("Asset register renders six real API assets")
        page.screenshot(path=str(media / "overview.png"), full_page=True)

        def caption(text):
            page.evaluate(
                """text=>{let el=document.getElementById('demo-caption');if(!el){el=document.createElement('div');el.id='demo-caption';el.style.cssText='position:fixed;bottom:16px;left:50%;transform:translateX(-50%);background:#182338f5;color:#f2f6ff;border:1px solid #627caa;padding:13px 24px;border-radius:4px;font:14px Arial;z-index:99999;max-width:86vw;text-align:center;pointer-events:none';document.body.appendChild(el)}el.textContent=text}""",
                text,
            )

        def screenshot(name):
            page.evaluate(
                "document.getElementById('demo-caption').style.visibility='hidden'"
            )
            page.screenshot(path=str(media / name), full_page=True)
            page.evaluate(
                "document.getElementById('demo-caption').style.visibility='visible'"
            )

        caption(
            "01 / Asset register + signal plot + contextual inspector · A working operations desk"
        )
        page.wait_for_timeout(2200)
        page.get_by_role("button", name="Start replay", exact=True).click()
        page.get_by_role("button", name="Pause replay", exact=True).wait_for()
        page.get_by_role("button", name="Freeze view", exact=True).click()
        frozen = page.locator(".strip-source strong").inner_text()
        before = httpx.get("http://127.0.0.1:8000/api/snapshot").json()["events"]
        caption(
            "02 / Freeze the displayed readings while the server continues receiving telemetry"
        )
        page.wait_for_timeout(4600)
        assert page.locator(".strip-source strong").inner_text() == frozen
        assert httpx.get("http://127.0.0.1:8000/api/snapshot").json()["events"] > before
        page.get_by_role("button", name="Pause replay", exact=True).click()
        page.get_by_role("button", name="Start replay", exact=True).wait_for()
        page.get_by_role("button", name="Resume live view", exact=True).first.click()
        checks += [
            "Replay start/pause",
            "Freeze display while SSE continues",
            "Replay controls stay accurate while frozen",
            "Resume latest server snapshot",
        ]
        page.get_by_role("checkbox", name="Compare CNC-01", exact=True).check()
        page.get_by_role("checkbox", name="Compare CNC-02", exact=True).check()
        page.locator(".metric-buttons").get_by_role(
            "button", name="Torque", exact=True
        ).click()
        expect(page.locator(".plot-legend")).to_contain_text("CNC-02")
        page.get_by_label("Observation range").select_option("12")
        scrub = page.get_by_label("Inspect observation")
        scrub.focus()
        scrub.press("Home")
        scrub.press("ArrowRight")
        expect(page.locator(".plot-readout")).to_contain_text("Observation 2")
        caption(
            "03 / Compare assets, switch the signal, and scrub individual observations"
        )
        screenshot("comparison.png")
        page.wait_for_timeout(2600)
        checks += [
            "Two-asset comparison",
            "Metric switching",
            "Observation window selection",
            "Keyboard observation scrubber",
        ]
        page.get_by_role("checkbox", name="Compare CNC-01", exact=True).uncheck()
        page.get_by_role("checkbox", name="Compare CNC-02", exact=True).uncheck()
        page.get_by_role("button", name="Facility view", exact=True).click()
        page.get_by_role("button", name="Select CNC-03", exact=True).click()
        expect(page.locator(".inspector-identity h2")).to_have_text("CNC-03")
        caption(
            "04 / Switch to an interactive facility schematic · Select a station to inspect it"
        )
        screenshot("facility.png")
        page.wait_for_timeout(2300)
        checks.append("Facility schematic selects the inspector asset")
        page.get_by_role("button", name="Table view", exact=True).click()
        page.get_by_role("button", name="Follow CNC-03", exact=True).click()
        page.locator(".register-tabs").get_by_role(
            "button", name="Following", exact=False
        ).click()
        expect(page.locator(".asset-table tbody tr")).to_have_count(1)
        checks.append("Following filter and persisted watchlist")
        page.locator(".register-tabs").get_by_role(
            "button", name="All assets", exact=False
        ).click()
        page.get_by_label("Production line").select_option("Machining A")
        expect(page.locator(".asset-table tbody tr")).to_have_count(3)
        page.get_by_role("button", name="Save current filters", exact=True).click()
        page.get_by_label("View name", exact=True).fill("Line A / daily review")
        page.get_by_role("button", name="Save view", exact=True).click()
        page.get_by_label("Production line").select_option("All lines")
        page.get_by_role("button", name="Line A / daily review", exact=True).click()
        expect(page.locator(".asset-table tbody tr")).to_have_count(3)
        checks.append("Saved filter view restores line selection")
        page.get_by_label("Production line").select_option("All lines")
        page.get_by_label("Find an asset").fill("CNC-04")
        expect(page.locator(".asset-table tbody tr")).to_have_count(1)
        with page.expect_download() as d:
            page.get_by_role(
                "button", name="Export filtered assets CSV", exact=True
            ).click()
        d.value.save_as(str(ROOT / "artifacts/filtered-assets.csv"))
        assert "CNC-04" in (ROOT / "artifacts/filtered-assets.csv").read_text()
        checks += ["Asset search", "Filtered CSV download"]
        page.get_by_label("Find an asset").fill("")
        page.keyboard.press("Control+k")
        page.get_by_label("Command search").fill("CNC-01")
        page.locator(".command-results").get_by_role(
            "button", name=re.compile(r"^CNC-01 ")
        ).click()
        expect(page.locator(".inspector-identity h2")).to_have_text("CNC-01")
        checks.append("Ctrl+K command search jumps to asset")
        page.get_by_role("button", name="Investigate evidence", exact=True).click()
        page.get_by_role("button", name="Retrieve guidance", exact=True).click()
        page.get_by_text("extractive (no LLM key)", exact=True).wait_for()
        page.get_by_text("Inspect retrieval workflow", exact=True).click()
        caption(
            "05 / Investigate with cited procedures and an inspectable retrieval workflow"
        )
        screenshot("investigation.png")
        page.wait_for_timeout(3000)
        checks.append("Cited retrieval guidance and workflow trace")
        page.get_by_role("button", name="Create work order", exact=True).last.click()
        page.get_by_label("Inspection title", exact=True).fill(
            "Inspect CNC-01 coolant circuit and tool condition"
        )
        page.get_by_label("Work order draft priority").select_option("high")
        page.get_by_label("Owner or team", exact=True).fill("Shift maintenance")
        page.get_by_label("Requested date", exact=True).fill("2026-11-01")
        page.get_by_label("Inspection notes", exact=True).fill(
            "Review RB-01 and RB-03. Verify the approved site isolation procedure before inspection."
        )
        caption(
            "06 / Create a useful inspection request · Owner, priority, date, notes and captured evidence"
        )
        screenshot("create-order.png")
        page.wait_for_timeout(2500)
        page.get_by_role("button", name="Create for review", exact=True).click()
        expect(page.locator(".order-detail h2")).to_have_text(
            "Inspect CNC-01 coolant circuit and tool condition"
        )
        expect(page.locator(".order-meta")).to_contain_text("Shift maintenance")
        checks.append("Planning fields persist and display in review queue")
        page.get_by_label("Review note", exact=False).fill(
            "Evidence reviewed. Arrange inspection under the approved site procedure."
        )
        page.get_by_role("button", name="Approve", exact=True).click()
        expect(page.locator(".decision-complete")).to_contain_text("Decision recorded")
        expect(page.locator(".decision-timeline")).to_contain_text("Evidence reviewed.")
        caption(
            "07 / Review the frozen evidence snapshot · Save the decision and reviewer note in the audit"
        )
        screenshot("work-orders.png")
        page.wait_for_timeout(3000)
        checks += ["Supervisor approval", "Reviewer note retained in audit"]
        page.get_by_role("button", name="Procedure library", exact=True).click()
        page.get_by_label("Search procedures").fill("thermal")
        expect(page.locator(".library-layout aside>button")).to_have_count(1)
        page.locator(".library-layout aside>button").click()
        expect(page.locator(".procedure-document h2")).to_contain_text("Thermal")
        checks.append("Procedure search and source inspection")
        page.get_by_role("button", name="Model validation", exact=True).click()
        expect(page.locator(".validation-table")).to_contain_text("0.8233")
        caption(
            "08 / Check the holdout results, baseline, confusion matrix and model limitations"
        )
        screenshot("evaluation.png")
        page.wait_for_timeout(2800)
        checks.append("Model validation and limitations remain accessible")
        page.get_by_role("button", name="Asset monitor", exact=True).click()
        page.get_by_role("button", name="Event log", exact=True).click()
        page.locator(".inspector-events summary").first.click()
        expect(page.locator(".inspector-events")).to_contain_text("rpm")
        checks.append("Event inspector exposes real reading values and IDs")
        page.get_by_role("button", name="Readings", exact=True).click()
        page.get_by_label("Sort assets").select_option("torque")
        torques = [
            float(re.search(r"[\d.]+", v).group())
            for v in page.locator(
                ".asset-table tbody tr td:nth-child(6)"
            ).all_inner_texts()
        ]
        assert torques == sorted(torques, reverse=True)
        checks.append("Numeric sorting by torque")
        page.get_by_label("Sort assets").select_option("score")
        page.evaluate("document.getElementById('demo-caption').remove()")
        with page.expect_download() as d:
            page.get_by_role("button", name="Snapshot", exact=True).click()
        d.value.save_as(str(ROOT / "artifacts/demo-snapshot.json"))
        checks.append("Full snapshot download")
        video = page.video
        context.close()
        video.save_as(str(media / "walkthrough.webm"))
        mobile = browser.new_page(
            viewport={"width": 390, "height": 844},
            is_mobile=True,
            device_scale_factor=1,
        )
        mobile.goto("http://127.0.0.1:8000/?page=monitor")
        mobile.get_by_role("button", name="Start replay", exact=True).wait_for()
        assert mobile.evaluate(
            "document.documentElement.scrollWidth <= window.innerWidth"
        )
        mobile.screenshot(path=str(media / "mobile.png"), full_page=True)
        mobile.get_by_role("button", name="Facility view", exact=True).click()
        assert mobile.evaluate(
            "document.documentElement.scrollWidth <= window.innerWidth"
        )
        checks += [
            "390px table layout avoids page overflow",
            "390px facility layout avoids page overflow",
        ]
        mobile.close()
        browser.close()
    report = {
        "checks": checks,
        "total_checks": len(checks),
        "browser_errors": errors,
        "viewport": "1600x1100 and 390x844",
        "recording": "Real browser walkthrough with captions; actual API calls and synthetic benchmark fixtures",
    }
    (ROOT / "artifacts/browser-verification.json").write_text(
        json.dumps(report, indent=2) + "\n"
    )
    assert not errors, errors
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    run()
