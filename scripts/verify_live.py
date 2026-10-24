"""Exercise the real SSE connection and a real MCP stdio client/server session."""

import asyncio
import json
import os
import sys
import time
import statistics
import platform
import httpx
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from backend.ml import ROOT


async def main():
    report = {}
    async with httpx.AsyncClient(
        base_url="http://127.0.0.1:8000", timeout=15
    ) as client:
        before = (await client.get("/api/snapshot")).json()["events"]
        await client.post("/api/replay", json={"running": True})
        messages = []
        async with client.stream("GET", "/api/events") as response:
            assert response.status_code == 200
            async for line in response.aiter_lines():
                if line.startswith("data: "):
                    messages.append(json.loads(line[6:]))
                    if len(messages) == 3:
                        break
        await client.post("/api/replay", json={"running": False})
        after = (await client.get("/api/snapshot")).json()["events"]
        assert after > before
        report["sse"] = {
            "messages": len(messages),
            "events_before": before,
            "events_after": after,
            "replay_advances": True,
        }
        timings = []
        for _ in range(50):
            start = time.perf_counter()
            response = await client.get("/api/snapshot")
            response.raise_for_status()
            timings.append((time.perf_counter() - start) * 1000)
        report["snapshot_latency"] = {
            "requests": 50,
            "concurrency": 1,
            "median_ms": round(statistics.median(timings), 2),
            "p95_ms": round(sorted(timings)[47], 2),
                "environment": f"Local {platform.system()} loopback; not a capacity or production SLO claim",
        }
    params = StdioServerParameters(
        command=sys.executable, args=["-m", "backend.mcp_server"], cwd=str(ROOT)
    )
    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            names = [t.name for t in (await session.list_tools()).tools]
            assert set(names) == {"search_runbooks", "fleet_snapshot"}
            result = await session.call_tool(
                "search_runbooks", {"question": "tool wear overstrain inspection"}
            )
            assert not result.isError and "RB-03" in str(result.content)
            snapshot = await session.call_tool("fleet_snapshot", {})
            assert not snapshot.isError and "CNC-01" in str(snapshot.content)
            report["mcp"] = {
                "initialized": True,
                "tools": names,
                "search_runbooks": "passed",
                "fleet_snapshot": "passed",
                "transport": "stdio",
            }
    (ROOT / "artifacts/live-verification.json").write_text(
        json.dumps(report, indent=2) + "\n"
    )
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
