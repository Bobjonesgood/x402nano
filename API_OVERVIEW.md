# x402nano API Overview

x402nano is a machine-payable Polymarket market intelligence API for autonomous agents, bots, and API builders.

It exposes a free discovery route plus paid read-only market brief and market delta routes. Paid routes use the x402 flow:

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

## Pricing

```bash
curl https://x402nano.onrender.com/api/pricing
```

Current paid brief price:

```txt
0.05 USDC
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

The response also includes a `schemas.marketDelta` object for the paid market delta response.

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

## Public Boundaries

x402nano provides:

```txt
read-only Polymarket public-data summaries
machine-readable JSON
x402 payment challenge and receipt flow
market delta briefs for agent polling loops
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
GET /api/version
GET /api/health
GET /api/events
```

`/api/events` is an in-memory operational log. It is useful for recent quote/payment/unlock debugging, but it is not a production analytics database.
