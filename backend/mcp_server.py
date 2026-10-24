"""Read-only MCP adapter, separate stdio process; never authorizes work orders."""

import os
import httpx
from mcp.server.fastmcp import FastMCP
from backend.assistant import retrieve

mcp = FastMCP("ForgeSignal evidence")


@mcp.tool()
def search_runbooks(question: str) -> list[dict]:
    """Find illustrative maintenance evidence and citation IDs."""
    return retrieve(question)


@mcp.tool()
def fleet_snapshot() -> dict:
    """Read current telemetry from the running ForgeSignal API."""
    r = httpx.get(
        os.getenv("FORGE_API_URL", "http://127.0.0.1:8000") + "/api/snapshot", timeout=5
    )
    r.raise_for_status()
    return r.json()


if __name__ == "__main__":
    mcp.run()
