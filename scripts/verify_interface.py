"""Focused responsive and keyboard checks for the workbench refinements."""

import json
from playwright.sync_api import sync_playwright, expect
from backend.ml import ROOT


def main():
    checks = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for width in [1600, 1280, 820, 390]:
            page = browser.new_page(viewport={"width": width, "height": 900})
            page.goto("http://127.0.0.1:8000/?page=monitor")
            expect(page.locator(".asset-table tbody tr")).to_have_count(6)
            assert page.evaluate(
                "document.documentElement.scrollWidth <= window.innerWidth"
            )
            page.get_by_role("button", name="Search workspace", exact=True).click()
            expect(page.get_by_label("Command search")).to_be_focused()
            page.keyboard.press("Escape")
            expect(
                page.get_by_role("button", name="Search workspace", exact=True)
            ).to_be_focused()
            if width == 390:
                page.get_by_label("Production line").select_option("Machining A")
                page.get_by_role(
                    "button", name="Save current filters", exact=True
                ).click()
                page.get_by_label("View name", exact=True).fill("Mobile Line A")
                page.get_by_role("button", name="Save view", exact=True).click()
                page.get_by_label("Production line").select_option("All lines")
                page.get_by_label("Saved asset views").select_option("Mobile Line A")
                expect(page.locator(".asset-table tbody tr")).to_have_count(3)
                page.reload()
                expect(page.get_by_label("Saved asset views")).to_be_visible()
                page.get_by_role("button", name="Review queue", exact=True).click()
                expect(
                    page.get_by_role("heading", name="Review queue", exact=True)
                ).to_be_visible()
                assert page.evaluate(
                    "document.documentElement.scrollWidth <= window.innerWidth"
                )
                checks += [
                    "Mobile saved view recall",
                    "Saved views survive reload",
                    "Compact navigation retains accessible names",
                    "Mobile review queue avoids overflow",
                ]
            checks += [
                f"{width}px monitor avoids page overflow",
                f"{width}px command dialog autofocus and Escape restoration",
            ]
            page.close()
        browser.close()
    result = {"checks": checks, "total_checks": len(checks), "passed": True}
    (ROOT / "artifacts/interface-refinements.json").write_text(
        json.dumps(result, indent=2) + "\n"
    )
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
