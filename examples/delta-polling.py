import json
import os
import time
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from urllib.error import HTTPError

API_ORIGIN = os.getenv("X402NANO_API_ORIGIN", "https://x402nano.onrender.com").rstrip("/")
SLUG = os.getenv("X402NANO_MARKET_SLUG", "will-gideon-saar-be-the-next-prime-minister-of-israel")
POLL_INTERVAL_SECONDS = int(os.getenv("X402NANO_POLL_INTERVAL_SECONDS", "300"))


def get_json(path, headers=None):
    request = Request(f"{API_ORIGIN}{path}", headers=headers or {})
    try:
        with urlopen(request, timeout=15) as response:
            return response.status, json.loads(response.read() or b"{}")
    except HTTPError as error:
        return error.code, json.loads(error.read() or b"{}")


def create_x_payment(_challenge):
    """Plug in your x402 wallet/client here and return the encoded X-PAYMENT value."""
    raise RuntimeError("create_x_payment() must be connected to an x402 client before paid polling.")


def should_pay_for_delta(freshness):
    if not freshness or not freshness.get("generatedOnRequest"):
        return False
    if freshness.get("estimatedLatencyMs", {}).get("p95", 999999) > 5000:
        return False
    return freshness.get("expectedMaxAgeSeconds", 999999) <= 120


def poll_delta_once(since):
    query = urlencode({"slug": SLUG, "since": since})
    path = f"/api/markets/delta?{query}"
    status, unpaid_body = get_json(path)

    if status != 402:
        raise RuntimeError(f"Expected 402 before payment, got {status}")

    freshness = unpaid_body.get("x402", {}).get("resource", {}).get("freshness")
    if not should_pay_for_delta(freshness):
        return {"paid": False, "since": since, "reason": "freshness metadata did not meet local policy"}

    payment = create_x_payment(unpaid_body.get("x402"))
    paid_status, paid_body = get_json(path, headers={"X-PAYMENT": payment})

    if paid_status >= 400:
        raise RuntimeError(paid_body.get("reason") or paid_body.get("error") or f"Paid request failed with {paid_status}")

    next_since = paid_body.get("data", {}).get("window", {}).get("until") or datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    return {
        "paid": True,
        "since": next_since,
        "receipt": paid_body.get("receipt", {}).get("id"),
        "repeatCheckPriority": paid_body.get("data", {}).get("significance", {}).get("repeatCheckPriority"),
        "summary": paid_body.get("data", {}).get("significance", {}).get("summary"),
    }


def main():
    since = os.getenv("X402NANO_SINCE") or (datetime.now(timezone.utc) - timedelta(minutes=15)).isoformat().replace("+00:00", "Z")

    while True:
        try:
            result = poll_delta_once(since)
            print(json.dumps(result, indent=2))
            since = result["since"]
        except Exception as error:
            print(f"poll failed: {error}")

        time.sleep(POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
