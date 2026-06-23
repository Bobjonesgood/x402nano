# x402nano API Overview

x402nano is a machine-payable Polymarket market intelligence API for autonomous agents, bots, and API builders.

It exposes a free discovery route plus paid read-only market briefs, market deltas, and webhook alert registrations. Paid routes use the x402 flow:

```txt
HTTP 402 -> X-PAYMENT -> Base USDC -> unlocked JSON brief
```

x402nano is informational only. It does not execute trades, custody funds, provide betting advice, or make buy/sell recommendations.

## Base URL

```txt
https://x402nano.onrender.com
```

## Discovery

```bash
curl https://x402nano.onrender.com/.well-known/x402.json
```

## Remote MCP

The public MCP endpoint uses the production Streamable HTTP transport:

```txt
https://x402nano.onrender.com/mcp
```

Machine-readable server metadata is available at:

```txt
https://x402nano.onrender.com/server.json
https://x402nano.onrender.com/.well-known/mcp.json
```

Available MCP tools:

| Tool | Price | Purpose |
| --- | ---: | --- |
| `list_trending_markets` | Free | Find active market slugs. |
| `get_market_pricing` | Free | Inspect Base, USDC, seller, and tool pricing. |
| `get_market_brief` | 0.05 USDC | Purchase one structured market brief. |
| `get_market_delta` | 0.05 USDC | Purchase one probability-change report. |

Any MCP client with Streamable HTTP support can connect and discover the tools. Automatic paid calls require an x402-aware MCP client, such as a client wrapped with the official `@x402/mcp` package. Standard MCP clients without x402 signing support can use the free tools and inspect paid tools, but cannot complete a USDC payment automatically.

The remote server never accepts or stores buyer private keys. Payment payloads are supplied in MCP request metadata, verified by the configured facilitator, and settled to the pinned x402nano seller wallet on Base.

Returns the machine-readable x402 manifest, seller metadata, supported network, price, payment header, and paid resource.

## Free Trending Markets

```bash
curl "https://x402nano.onrender.com/api/markets/trending"
```

Returns public Polymarket market candidates that agents can inspect before paying for a brief.

## Paid Market Brief

```bash
curl -i "https://x402nano.onrender.com/api/markets/brief?slug=will-gideon-saar-be-the-next-prime-minister-of-israel"
```

Without payment, the route returns:

```txt
402 Payment Required
```

The response includes payment requirements similar to:

```json
{
  "error": "Payment required",
  "paymentRequirements": {
    "x402Version": "1",
    "scheme": "exact",
    "network": "eip155:8453",
    "asset": "USDC",
    "amount": "0.05",
    "payTo": "0x4cc3831eB479aCFb6D44631d4a30814508Cf52d3",
    "resource": "/api/markets/brief?slug=will-gideon-saar-be-the-next-prime-minister-of-israel",
    "description": "x402nano read-only Polymarket market intelligence brief. Informational only; no trading, betting, or financial advice.",
    "mimeType": "application/json"
  }
}
```

With a valid x402 payment payload, the buyer retries the same request with:

```bash
curl "https://x402nano.onrender.com/api/markets/brief?slug=will-gideon-saar-be-the-next-prime-minister-of-israel" \
  -H "X-PAYMENT: <signed-x402-payment>"
```

Successful paid responses include a receipt and unlocked JSON:

```json
{
  "status": "unlocked",
  "receipt": {
    "id": "receipt-id-after-payment",
    "payer": "external-x402-client",
    "seller": "0x4cc3831eB479aCFb6D44631d4a30814508Cf52d3",
    "amount": "0.05",
    "asset": "USDC",
    "network": "eip155:8453"
  },
  "data": {
    "briefType": "read-only-market-intelligence",
    "status": "ok",
    "market": {
      "slug": "will-gideon-saar-be-the-next-prime-minister-of-israel"
    },
    "movement": {
      "window": "24h",
      "available": true,
      "direction": "flat",
      "trajectory": [
        {
          "timestamp": "2026-06-06T12:00:00.000Z",
          "probability": "0.995"
        }
      ]
    },
    "metrics": {
      "volume24h": "17,260.91",
      "liquidity": "81,697.04"
    },
    "resolution": {
      "endDate": "2026-12-31T00:00:00Z",
      "source": "Use the Polymarket market page and rules for resolution criteria."
    },
    "scores": {
      "marketMovementScore": 45,
      "attentionScore": 70,
      "dataCompletenessScore": 100,
      "unusualMovementFlag": false
    }
  }
}
```

The paid brief is intentionally descriptive. Movement, liquidity, resolution context, and scores are public-data context for agents. They are not predictions, betting advice, or buy/sell recommendations.

## Paid Market Delta

```bash
curl -i "https://x402nano.onrender.com/api/markets/delta?slug=will-gideon-saar-be-the-next-prime-minister-of-israel&since=2026-06-15T12:00:00Z"
```

Without payment, the route returns:

```txt
402 Payment Required
```

The delta endpoint uses the same x402 payment flow and price as the market brief endpoint. With a valid x402 payment payload, the buyer retries the same request with:

```bash
curl "https://x402nano.onrender.com/api/markets/delta?slug=will-gideon-saar-be-the-next-prime-minister-of-israel&since=2026-06-15T12:00:00Z" \
  -H "X-PAYMENT: <signed-x402-payment>"
```

Successful paid responses include a receipt and unlocked delta JSON:

```json
{
  "status": "unlocked",
  "receipt": {
    "id": "receipt-id-after-payment",
    "payer": "external-x402-client",
    "seller": "0x4cc3831eB479aCFb6D44631d4a30814508Cf52d3",
    "amount": "0.05",
    "asset": "USDC",
    "network": "eip155:8453"
  },
  "data": {
    "briefType": "read-only-market-delta",
    "status": "ok",
    "market": {
      "slug": "will-gideon-saar-be-the-next-prime-minister-of-israel"
    },
    "window": {
      "since": "2026-06-15T12:00:00.000Z",
      "until": "2026-06-15T18:30:00.000Z",
      "requestedBy": "client-supplied timestamp"
    },
    "change": {
      "available": true,
      "outcome": "Yes",
      "absoluteChange": "0.050",
      "relativeChange": "+11.9%",
      "direction": "up",
      "changed": true
    },
    "significance": {
      "repeatCheckPriority": "high",
      "unusualMovementFlag": true,
      "summary": "The leading outcome moved up by 0.050 over the requested window."
    }
  }
}
```

The delta brief is designed for agent polling loops: it reports what changed since the client-supplied timestamp, using public market data when available. It is descriptive context, not a prediction, betting instruction, or buy/sell recommendation.

Example polling clients are available in:

```txt
examples/delta-polling.js
examples/delta-polling.py
```

They show the intended loop: discover freshness metadata, decide whether to pay, handle the `402`, retry with `X-PAYMENT`, parse receipt + delta data, update `since`, and back off on errors.

## Webhook Alert Registration

```bash
curl -i -X POST "https://x402nano.onrender.com/api/alerts/register" \
  -H "Content-Type: application/json" \
  -d '{"webhookUrl":"https://my-agent.com/webhook","slugs":["will-gideon-saar-be-the-next-prime-minister-of-israel"],"threshold":0.07,"checkIntervalMinutes":15}'
```

A valid unpaid request returns `402 Payment Required` with an amount of `0.08 USDC`. Retry the same body with a valid payment:

```bash
curl -X POST "https://x402nano.onrender.com/api/alerts/register" \
  -H "Content-Type: application/json" \
  -H "X-PAYMENT: <signed-x402-payment>" \
  -d '{"webhookUrl":"https://my-agent.com/webhook","slugs":["will-gideon-saar-be-the-next-prime-minister-of-israel"],"threshold":0.07,"checkIntervalMinutes":15}'
```

Successful registration returns `201 Created`:

```json
{
  "status": "registered",
  "receipt": {
    "id": "receipt-id-after-payment",
    "amount": "0.08",
    "asset": "USDC",
    "network": "eip155:8453"
  },
  "alert": {
    "id": "2f7b2f37-a66c-49de-9893-f43c5af83db4",
    "payerAddress": "external-x402-client",
    "webhookUrl": "https://my-agent.com/webhook",
    "slugs": ["will-gideon-saar-be-the-next-prime-minister-of-israel"],
    "threshold": 0.07,
    "checkIntervalMinutes": 15,
    "active": true,
    "createdAt": "2026-06-20T09:45:12.000Z",
    "lastChecked": null,
    "lastTriggered": null
  }
}
```

The in-process checker wakes every 10 minutes and respects each registration's `checkIntervalMinutes`. Its first check establishes a baseline. A later absolute probability change at or above `threshold` produces a `significant_delta` POST. Failed webhook deliveries are attempted up to three times.

Webhook payload:

```json
{
  "event": "significant_delta",
  "alertId": "2f7b2f37-a66c-49de-9893-f43c5af83db4",
  "slug": "will-gideon-saar-be-the-next-prime-minister-of-israel",
  "change": {
    "outcome": "Yes",
    "previousProb": 0.62,
    "currentProb": 0.71,
    "absoluteChange": 0.09,
    "direction": "up"
  },
  "timestamp": "2026-06-20T09:45:12.000Z"
}
```

Webhook destinations must use public HTTPS. Each registration accepts 1–20 unique slugs. Defaults are `threshold: 0.07` (seven probability points) and `checkIntervalMinutes: 15`.

Webhook Alerts use SQLite at `ALERT_DB_PATH`. The local default is `./data/x402nano-alerts.sqlite`; Render uses `/data/alerts.db`. Active alerts, checker state, and probability baselines are reloaded after process restart and on every checker run. The example client is `examples/register-alert.js`.

On Render, `/data` must be a Persistent Disk mounted on a paid single-instance web service. The checker uses an in-process guard plus an expiring SQLite lock to prevent overlapping runs. The scheduler wakes every 10 minutes, so alerts are generally checked every 10-20 minutes depending on Render uptime, scheduler alignment, and each alert's configured interval.

## Pricing

```bash
curl https://x402nano.onrender.com/api/pricing
```

Current prices:

```txt
Market brief: 0.05 USDC
Market delta: 0.05 USDC
Alert registration: 0.08 USDC
```

Network:

```txt
Base mainnet, eip155:8453
```

Seller wallet:

```txt
0x4cc3831eB479aCFb6D44631d4a30814508Cf52d3
```

## Schema

```bash
curl https://x402nano.onrender.com/api/schema
```

Returns the JSON schema for the paid market brief response.

The response also includes `schemas.marketDelta` and `schemas.alertRegistration` objects.

## Receipts

```txt
GET /api/receipts/{receiptId}
```

Receipts are retained in server memory for operational proof and debugging. The on-chain USDC transfer is the durable payment proof.

## Mainnet Proof

x402nano completed a real paid unlock on Base mainnet.

```txt
Receipt: f1ffa2f5cabf94c3
Amount: 0.05 USDC
Network: Base mainnet, eip155:8453
USDC transfer tx: 0x54ba49a288a56d20046c25f4496bec405f2eefc05fe413cd511caf96227911b1
BaseScan: https://basescan.org/tx/0x54ba49a288a56d20046c25f4496bec405f2eefc05fe413cd511caf96227911b1
```

The proof verified:

```txt
HTTP 402 challenge issued
X-PAYMENT retry accepted
0.05 USDC settled on Base mainnet
receipt generated
read-only market brief JSON unlocked
```

x402nano also completed a real direct paid delta unlock on Base mainnet.

```txt
Receipt: 75fe7c800fed47d4
Amount: 0.05 USDC
Network: Base mainnet, eip155:8453
USDC transfer tx: 0x701faef1c35086f5e2ee4243a35d3a904960bd4279ffaab1890b849c1330582a
BaseScan: https://basescan.org/tx/0x701faef1c35086f5e2ee4243a35d3a904960bd4279ffaab1890b849c1330582a
Proof note: DIRECT_DELTA_X402_PRODUCTION_UNLOCK_PROOF.md
```

## Public Boundaries

x402nano provides:

```txt
read-only Polymarket public-data summaries
machine-readable JSON
x402 payment challenge and receipt flow
market delta briefs for agent polling loops
webhook alerts for significant probability changes
```

x402nano does not provide:

```txt
trading execution
custody
betting advice
buy/sell recommendations
guaranteed outcomes
user accounts
API keys
```

## Operational Endpoints

```txt
GET /health
GET /api/version
GET /api/health
GET /api/events
GET /api/alerts/status
```

`/api/events` is an in-memory operational log. It is useful for recent quote/payment/unlock debugging, but it is not a production analytics database.

`/health` is the lightweight Render/GitHub liveness endpoint and returns the active alert count. `/api/alerts/status` returns total and active alert counts, persisted last-check state, scheduler interval, SQLite storage mode, and the latest sanitized checker error.

Render setup requires a persistent disk mounted at `/data`, `ALERT_DB_PATH=/data/alerts.db`, a disk-compatible paid plan, one service instance, and `/health` as the health-check path. The repository Blueprint configures these values. Persistent disks disable horizontal scaling and zero-downtime deploys for this service.
