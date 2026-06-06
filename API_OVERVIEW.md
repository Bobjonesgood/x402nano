# x402nano API Overview

x402nano is a machine-payable Polymarket market intelligence API for autonomous agents, bots, and API builders.

It exposes a free discovery route and a paid read-only market brief route. The paid route uses the x402 flow:

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
    }
  }
}
```

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
