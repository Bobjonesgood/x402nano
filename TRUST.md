# x402nano Trust And Safety

x402nano follows one rule:

```txt
Real proof. Clear boundaries. No fake claims.
```

## What Is Proven

x402nano has proven the core x402 flow on Base mainnet:

```txt
HTTP 402 challenge
X-PAYMENT retry
0.05 USDC settlement on Base mainnet
receipt generation
read-only Polymarket market brief unlock
```

Proof:

```txt
Receipt: f1ffa2f5cabf94c3
Transaction: 0x54ba49a288a56d20046c25f4496bec405f2eefc05fe413cd511caf96227911b1
BaseScan: https://basescan.org/tx/0x54ba49a288a56d20046c25f4496bec405f2eefc05fe413cd511caf96227911b1
```

## What Is Not Claimed

x402nano does not claim:

```txt
guaranteed outcomes
market outcomes
investment advice
betting advice
buy/sell recommendations
customer adoption
repeat revenue
```

## Product Boundary

x402nano is:

```txt
machine-payable market intelligence
read-only Polymarket public-data summaries
JSON for agents and bots
x402 payment proof infrastructure
```

x402nano is not:

```txt
a broker
a wallet
a custody product
a betting product
a trading bot
a trade execution service
a financial advisor
```

## Payment Boundary

Payments are handled through the x402 flow:

```txt
buyer/client signs payment
request retries with X-PAYMENT
facilitator verifies and settles
Base mainnet USDC moves to seller wallet
```

x402nano does not custody buyer funds and does not require user accounts or API keys.

## Data Boundary

x402nano uses public Polymarket market data for informational summaries. Market data can be delayed, incomplete, unavailable, or interpreted differently by different clients.

The API output should be treated as:

```txt
market context
public data summary
machine-readable brief
```

It should not be treated as:

```txt
trading instruction
betting advice
financial recommendation
guaranteed result
```

## Operational Boundary

The `/api/events` endpoint is an in-memory operational log for recent quotes, payments, and unlocks. It can reset after deploys or restarts.

Durable proof should rely on:

```txt
BaseScan transaction
on-chain USDC transfer
saved proof notes
receipt id when retained
```

## Launch Scope

Current scope:

```txt
GET /api/markets/trending
GET /api/markets/brief?slug=...
0.05 USDC per paid brief
Base mainnet
HTTP 402
X-PAYMENT
receipt + JSON unlock
```

Explicitly out of scope:

```txt
Telegram
dashboard
user accounts
trading execution
custody
betting advice
buy/sell recommendations
guaranteed language
```

## Verification Commands

Read-only endpoint check:

```bash
curl "https://x402nano.onrender.com/api/markets/brief?slug=will-gideon-saar-be-the-next-prime-minister-of-israel" -i
```

Expected result:

```txt
402 Payment Required
```

Proof transaction:

```txt
https://basescan.org/tx/0x54ba49a288a56d20046c25f4496bec405f2eefc05fe413cd511caf96227911b1
```
