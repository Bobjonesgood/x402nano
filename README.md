# x402nano

## Why x402nano

x402nano packages public Polymarket data into agent-ready intelligence objects: structured briefs, probability-change deltas, receipts, freshness metadata, and safety boundaries behind a native x402 payment flow.

## MCP Server

x402nano exposes a public, stateless MCP endpoint using the production Streamable HTTP transport:

```txt
https://x402nano.onrender.com/mcp
```

The remote server exposes free market discovery and pricing tools plus x402-protected 0.05 USDC Market Brief and Market Delta tools. Paid MCP calls use the official x402 MCP payment flow: the caller signs locally, the facilitator verifies and settles on Base, and x402nano never receives or stores a buyer private key.

The repository also retains the proven local stdio MCP server with conservative payment budgets. See [mcp-server/README.md](mcp-server/README.md) for both connection paths, unpaid verification, and client requirements. The standards-compliant remote server manifest is [server.json](server.json).

## Agent Quickstart

For a new MCP client or autonomous agent:

1. Find `io.github.Bobjonesgood/x402nano` in the official MCP Registry.
2. Connect to the Streamable HTTP remote: `https://x402nano.onrender.com/mcp`.
3. List tools and confirm `list_trending_markets`, `get_market_pricing`, `get_market_brief`, and `get_market_delta`.
4. Call `list_trending_markets` to choose a market slug.
5. Call `get_market_pricing` to confirm Base mainnet pricing.
6. Use an x402-aware MCP client for `get_market_brief` or `get_market_delta`.

Pricing and payment boundaries:

- Free tools: `list_trending_markets`, `get_market_pricing`.
- Paid tools: `get_market_brief`, `get_market_delta`.
- Price: `0.05 USDC` per paid tool call, `50000` atomic units.
- Network: Base mainnet, `eip155:8453`.
- Seller: `0x4cc3831eB479aCFb6D44631d4a30814508Cf52d3`.
- Buyer keys stay local to the caller. x402nano never receives or stores buyer private keys.
- Outputs are read-only market intelligence, not trading, betting, or financial advice.

## What You Are Buying

x402nano does not sell raw Polymarket data. It sells packaged, agent-ready market intelligence objects that save an agent from stitching together market metadata, current prices, movement history, scoring, receipt handling, and safety boundaries itself.

A paid market brief includes:

- market identity, question, category, status, end date, and source URL
- current leading outcome and implied probability
- outcome pricing summary and top outcomes
- volume, 24h volume, 7d volume, liquidity, and change context when available
- 24h movement summary from public price history when available
- resolution/source context and data-quality notes
- descriptive scores for movement, attention, and data completeness
- watch points for future agent checks
- receipt metadata proving the paid unlock
- no-advice boundaries

A paid market delta includes:

- what changed since the caller-supplied `since` timestamp
- leading outcome start/end probabilities when public history is available
- absolute and relative probability change
- direction, changed flag, repeat-check priority, and unusual-movement flag
- current volume/liquidity context
- trajectory points when available
- data-quality notes explaining missing or nearest-point history
- receipt metadata proving the paid unlock
- no-advice boundaries

Representative paid brief response:

```json
{
  "status": "unlocked",
  "receipt": {
    "id": "receipt-id-after-payment",
    "amount": "0.05",
    "asset": "USDC",
    "network": "eip155:8453"
  },
  "data": {
    "briefType": "read-only-market-intelligence",
    "market": {
      "slug": "example-polymarket-slug",
      "question": "Will example event happen in 2026?",
      "status": "active",
      "url": "https://polymarket.com/event/example"
    },
    "snapshot": {
      "generatedAt": "2026-06-29T12:00:00.000Z",
      "source": "polymarket:gamma",
      "leadingOutcome": "Yes",
      "leadingOutcomeImpliedProbability": "42.0%"
    },
    "metrics": {
      "volume24h": "17,260.91",
      "liquidity": "81,697.04"
    },
    "movement": {
      "window": "24h",
      "direction": "up",
      "absoluteChange": "0.032"
    },
    "scores": {
      "marketMovementScore": 61,
      "attentionScore": 72,
      "dataCompletenessScore": 100,
      "unusualMovementFlag": false
    },
    "watchPoints": [
      "Watch whether the leading outcome changes, flattens, or reverses over the next observation window."
    ],
    "boundaries": [
      "Read-only public market data summary.",
      "No trading execution.",
      "No custody of user funds.",
      "No buy/sell/bet recommendation."
    ]
  }
}
```

Representative paid delta response:

```json
{
  "status": "unlocked",
  "receipt": {
    "id": "receipt-id-after-payment",
    "amount": "0.05",
    "asset": "USDC",
    "network": "eip155:8453"
  },
  "data": {
    "briefType": "read-only-market-delta",
    "market": {
      "slug": "example-polymarket-slug",
      "question": "Will example event happen in 2026?"
    },
    "window": {
      "since": "2026-06-29T11:00:00.000Z",
      "until": "2026-06-29T12:00:00.000Z"
    },
    "change": {
      "source": "polymarket:clob",
      "outcome": "Yes",
      "startProbability": 0.388,
      "endProbability": 0.42,
      "absoluteChange": "0.032",
      "relativeChange": "+8.2%",
      "direction": "up",
      "changed": true
    },
    "significance": {
      "repeatCheckPriority": "medium",
      "unusualMovementFlag": false,
      "summary": "The leading outcome moved up by 0.032 over the requested window."
    },
    "dataQuality": {
      "priceHistoryAvailable": true,
      "usedNearestHistoryPoint": false,
      "notes": [
        "Delta is computed from available public market data.",
        "This endpoint does not store caller state; clients provide the since timestamp."
      ]
    }
  }
}
```

Freshness and methodology:

- Paid briefs and deltas are generated on request after a valid payment.
- Public freshness metadata advertises an expected max age of 90 seconds, with paid content kept behind `402` until payment.
- Brief movement uses the most recent public Polymarket data and 24h leading-outcome history when available.
- Delta movement is computed from public Polymarket CLOB price history for the leading outcome token between the caller's `since` timestamp and the latest available point.
- If exact history is unavailable, the response says so in `dataQuality` rather than pretending precision.
- Scores are descriptive heuristics from movement size, volume, liquidity, and data availability. They are not predictions or recommendations.

Machine-payable market intelligence API for AI agents and bots.

x402nano serves read-only Polymarket market briefs behind an HTTP 402 payment flow. An agent requests a market brief, receives a payment challenge, retries with `X-PAYMENT`, and receives unlocked JSON plus a receipt.

This is market intelligence infrastructure, not trading advice.

Paid briefs include 24h market movement, volume/liquidity context, resolution context, watch points, and safe descriptive scores. They do not include trading execution, custody, betting advice, or buy/sell recommendations.

## Live Endpoint

```txt
https://x402nano.onrender.com
```

Free discovery/trending endpoint:

```http
GET https://x402nano.onrender.com/api/markets/trending
```

Paid market brief endpoint:

```http
GET https://x402nano.onrender.com/api/markets/brief?slug=will-gideon-saar-be-the-next-prime-minister-of-israel
```

Paid market delta endpoint:

```http
GET https://x402nano.onrender.com/api/markets/delta?slug=will-gideon-saar-be-the-next-prime-minister-of-israel&since=2026-06-15T12:00:00Z
```

## Mainnet Proof

x402nano has completed one real paid unlock on Base mainnet.

```txt
Network: Base mainnet, eip155:8453
Asset: USDC
Price: 0.05 USDC
Seller wallet: 0x4cc3831eB479aCFb6D44631d4a30814508Cf52d3
Receipt: f1ffa2f5cabf94c3
USDC transfer tx: 0x54ba49a288a56d20046c25f4496bec405f2eefc05fe413cd511caf96227911b1
BaseScan: https://basescan.org/tx/0x54ba49a288a56d20046c25f4496bec405f2eefc05fe413cd511caf96227911b1
```

The proof run verified:

```txt
HTTP 402 challenge issued
0.05 USDC paid on Base mainnet
X-PAYMENT retry accepted
receipt generated
market brief JSON unlocked
on-chain USDC transfer confirmed
```

Delta proof:

```txt
Direct paid delta receipt: 75fe7c800fed47d4
USDC transfer tx: 0x701faef1c35086f5e2ee4243a35d3a904960bd4279ffaab1890b849c1330582a
BaseScan: https://basescan.org/tx/0x701faef1c35086f5e2ee4243a35d3a904960bd4279ffaab1890b849c1330582a
Proof note: DIRECT_DELTA_X402_PRODUCTION_UNLOCK_PROOF.md
```

Proof references:

```txt
BaseScan transaction:
https://basescan.org/tx/0x54ba49a288a56d20046c25f4496bec405f2eefc05fe413cd511caf96227911b1

In-repo proof notes:
TRUST.md
ARCHITECTURE.md
LISTING_METADATA.md
DIRECT_DELTA_X402_PRODUCTION_UNLOCK_PROOF.md
```

Note: the local buyer script exited nonzero after the real unlock because the immediate post-payment buyer balance read was stale. Seller balance updated, receipt/events were recorded, and a later no-payment balance check confirmed the buyer moved from `1.00` to `0.95` USDC.

## Buyer Flow

1. Discover the API.

```http
GET https://x402nano.onrender.com/.well-known/x402.json
```

2. Request a paid market brief.

```powershell
Invoke-WebRequest `
  -Uri "https://x402nano.onrender.com/api/markets/brief?slug=will-gideon-saar-be-the-next-prime-minister-of-israel" `
  -UseBasicParsing
```

3. Expect `402 Payment Required`.

The response includes payment requirements similar to:

```json
{
  "error": "payment_required",
  "paymentRequirements": {
    "network": "eip155:8453",
    "asset": "USDC",
    "amount": "0.05",
    "payTo": "0x4cc3831eB479aCFb6D44631d4a30814508Cf52d3",
    "resource": "/api/markets/brief?slug=will-gideon-saar-be-the-next-prime-minister-of-israel"
  }
}
```

4. Sign and send the x402 payment.

Use an x402-compatible client to sign the Base mainnet USDC payment, then retry the same request with:

```http
X-PAYMENT: <signed-x402-payment>
```

5. Receive the unlocked JSON.

Successful paid responses include a receipt and the market brief payload:

```json
{
  "receipt": {
    "id": "f1ffa2f5cabf94c3",
    "network": "eip155:8453",
    "amount": "0.05",
    "asset": "USDC"
  },
  "data": {
    "briefType": "read-only-market-intelligence",
    "status": "ok",
    "market": {
      "slug": "will-gideon-saar-be-the-next-prime-minister-of-israel"
    },
    "movement": {
      "window": "24h",
      "direction": "flat",
      "trajectory": []
    },
    "metrics": {
      "volume24h": "17,260.91",
      "liquidity": "81,697.04"
    },
    "resolution": {
      "endDate": "2026-12-31T00:00:00Z"
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

## Delta Briefs

Delta briefs are the repeat-use paid object for agent polling loops. A brief answers "what is this market right now?" A delta answers "what changed since the agent last checked?"

```http
GET https://x402nano.onrender.com/api/markets/delta?slug=will-gideon-saar-be-the-next-prime-minister-of-israel&since=2026-06-15T12:00:00Z
```

Without payment, the route returns `402 Payment Required`. With a valid `X-PAYMENT` retry, the response includes a receipt and read-only delta JSON:

```json
{
  "status": "unlocked",
  "receipt": {
    "id": "receipt-id-after-payment",
    "network": "eip155:8453",
    "amount": "0.05",
    "asset": "USDC"
  },
  "data": {
    "briefType": "read-only-market-delta",
    "market": {
      "slug": "will-gideon-saar-be-the-next-prime-minister-of-israel"
    },
    "window": {
      "since": "2026-06-15T12:00:00.000Z",
      "until": "2026-06-15T18:30:00.000Z"
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

Delta briefs are descriptive market context for agents. They do not include trading execution, custody, betting advice, predictions, or buy/sell recommendations.

Example polling clients:

```txt
examples/delta-polling.js
examples/delta-polling.py
```

Both examples show the intended agent loop: inspect freshness metadata, request a delta, handle the `402`, retry with an x402 payment from a caller-provided signing hook, parse the receipt and delta payload, then update `since` after a successful response.

## Local Proof Command

Preflight only:

```powershell
cd C:\Users\bobjo\Documents\Codex\2026-05-17\ok-ive-already-built-a-x402
$env:MAINNET_PAID_PATH="/api/markets/brief?slug=will-gideon-saar-be-the-next-prime-minister-of-israel"
$env:MAINNET_MAX_USDC="0.05"
$env:MAINNET_PAYMENT_ACK="PREFLIGHT_ONLY"
npm.cmd run agent:mainnet
```

Real payment, only when intentionally sending one `0.05 USDC` unlock:

```powershell
cd C:\Users\bobjo\Documents\Codex\2026-05-17\ok-ive-already-built-a-x402
$env:MAINNET_PAID_PATH="/api/markets/brief?slug=will-gideon-saar-be-the-next-prime-minister-of-israel"
$env:MAINNET_MAX_USDC="0.05"
$env:MAINNET_PAYMENT_ACK="PAY_REAL_0.05_USDC"
npm.cmd run agent:mainnet
```

## Launch Ask

x402nano is looking for feedback from 20 AI agent, trading bot, and market-data builders.

What to check:

```txt
Would a machine-readable market brief be useful to your agent?
Is 0.05 USDC per brief the right shape for testing?
What fields would your bot need before paying for a brief?
Would you rather call this directly, through an SDK, or through another agent framework?
```

Positioning:

```txt
Stop scraping. Use a machine-payable API for market briefs.
0.05 USDC per read-only market brief on Base.
No account. No API key. HTTP 402 and X-PAYMENT.
```

## Current Scope

In scope:

```txt
Polymarket public data
read-only market intelligence
free trending endpoint
paid market brief endpoint
paid market delta endpoint
HTTP 402 challenge
Base mainnet USDC unlock
receipt and proof
```

Out of scope for this launch:

```txt
trading advice
trade execution
Telegram bot
lead generation
x402 consulting
new product features before feedback
```

## Development

```powershell
npm.cmd install
npm.cmd run build
```

Core scripts:

```txt
npm.cmd run agent:mainnet
npm.cmd run wallet:mainnet:create
npm.cmd run build
```
