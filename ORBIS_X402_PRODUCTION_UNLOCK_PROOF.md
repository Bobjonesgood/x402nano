# Orbis x402 Production Unlock Proof

Date: June 14, 2026

## Endpoint Tested

```http
GET /api/orbis/markets/brief-9f3d2b7a6c4e4892b1a0d5f8e7c6a3b9f4e1a8c2d6?slug=will-gideon-saar-be-the-next-prime-minister-of-israel
```

## Result

- HTTP status: 200 OK
- Response time: 1746ms

## Access

```json
{
  "via": "orbis-proxy",
  "paymentHandledBy": "orbis"
}
```

## Product

x402nano Polymarket market brief

## Brief Type

read-only-market-intelligence

## Market

Will Gideon Sa'ar be the next Prime Minister of Israel?

## Proof Statement

x402nano successfully returned a paid market brief through the Orbis proxy after Orbis-handled x402 access.

## Boundaries

- Read-only data only.
- No trading execution.
- No custody.
- No buy/sell/bet recommendation.
- Informational only.

## Note

This verified the production unlock path after the Orbis numeric tier price was corrected to 0.05 USDC.
