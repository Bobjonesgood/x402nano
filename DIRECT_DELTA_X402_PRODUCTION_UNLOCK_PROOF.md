# Direct Delta x402 Production Unlock Proof

Date: June 16, 2026

## Endpoint Tested

```http
GET /api/markets/delta?slug=will-gideon-saar-be-the-next-prime-minister-of-israel&since=2026-06-15T12%3A00%3A00Z
```

## Result

- HTTP 402 challenge issued before payment.
- X-PAYMENT retry accepted after one real Base mainnet x402 payment.
- Read-only market delta JSON unlocked.
- Receipt generated and retained by the live service.
- On-chain USDC transfer confirmed on Base mainnet.

## Payment

```txt
Network: Base mainnet, eip155:8453
Asset: USDC
Amount: 0.05 USDC
Buyer: 0x09e99EabeCFAfdF6A6bF24681369394da6B8540f
Seller: 0x4cc3831eB479aCFb6D44631d4a30814508Cf52d3
```

## Receipt

```txt
Receipt id: 75fe7c800fed47d4
Mode: facilitator-onchain
Provider: facilitator
Settled at: 2026-06-16T04:09:08.003Z
Transaction: 0x701faef1c35086f5e2ee4243a35d3a904960bd4279ffaab1890b849c1330582a
BaseScan: https://basescan.org/tx/0x701faef1c35086f5e2ee4243a35d3a904960bd4279ffaab1890b849c1330582a
```

## Balance Movement

```txt
Before buyer USDC: 0.8
Before seller USDC: 0.2
After buyer USDC: 0.75
After seller USDC: 0.25
Buyer delta: 0.05 USDC
Seller delta: 0.05 USDC
```

## Unlocked Product

```txt
Brief type: read-only-market-delta
Status: ok
Market slug: will-gideon-saar-be-the-next-prime-minister-of-israel
Repeat check priority: low
Delta window until: 2026-06-16T04:09:03.000Z
```

## Seller Events

The live `/api/events` log recorded:

```txt
payment_verified
receipt_generated
market_delta_unlocked
```

## On-Chain Receipt Check

Read-only Base RPC receipt check returned:

```txt
transactionHash: 0x701faef1c35086f5e2ee4243a35d3a904960bd4279ffaab1890b849c1330582a
status: 0x1
to: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
logs: 2
```

## Boundaries

- Read-only public market data only.
- No trading execution.
- No custody.
- No buy/sell/bet recommendation.
- Informational only; not financial advice.
