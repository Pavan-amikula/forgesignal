"""Validate JSONL event payloads and POST using the public ingestion contract."""

import argparse
import json
import os
import httpx
from backend.main import Reading


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("file")
    p.add_argument("--url", default="http://127.0.0.1:8000")
    args = p.parse_args()
    with open(args.file, encoding="utf-8") as stream:
        events = [
            Reading.model_validate_json(line).model_dump()
            for line in stream
            if line.strip()
        ]
    headers = (
        {"Authorization": "Bearer " + os.environ["FORGE_WRITE_TOKEN"]}
        if os.getenv("FORGE_WRITE_TOKEN")
        else {}
    )
    accepted = 0
    with httpx.Client(base_url=args.url, headers=headers, timeout=10) as client:
        for value in events:
            r = client.post("/api/telemetry", json=value)
            r.raise_for_status()
            accepted += r.json()["accepted"]
    print(
        json.dumps(
            {
                "validated": len(events),
                "accepted": accepted,
                "duplicates": len(events) - accepted,
            }
        )
    )


if __name__ == "__main__":
    main()
