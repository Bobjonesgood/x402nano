# LeadNestAI API Overview

This API is a commercial proof-of-concept for machine-payable lead intelligence.

## Base URL

```txt
https://x402nano.onrender.com
```

## Discovery

```txt
GET /.well-known/x402.json
GET /api/discover
```

Returns the machine-readable manifest for buyers and agents.

## Version

```txt
GET /api/version
```

Returns release metadata, payment mode, settlement mode, seller wallet status, and build metadata.

## Health

```txt
GET /api/health
```

Returns service status, payment mode, settlement mode, quote counts, receipt counts, and event count.

## Pricing

```txt
GET /api/pricing
```

Returns price, asset, network, seller wallet, payment header, and provider details.

## Schema

```txt
GET /api/schema
```

Returns the response schema for the protected LeadNestAI premium pack.

## Protected Lead Intelligence Pack

```txt
GET /api/lead-intelligence/premium-pack
```

Without payment, returns:

```txt
402 Payment Required
```

With valid `X-PAYMENT`, returns:

- receipt
- premium lead intelligence records

Example record fields:

```txt
businessName
industry
location
contactPerson
estimatedJobValue
buyingIntent
painPoints
recommendedOpener
confidenceScore
sourceType
lastUpdated
```

## Sandbox Payment Signer

```txt
POST /api/payments/sign
```

Sandbox-only endpoint that creates a demo payment payload for the current payment requirements.

This is disabled in facilitator mode.

## Browser Wallet Message

```txt
POST /api/payments/browser-wallet-message
```

Sandbox-only endpoint that prepares a message for browser wallet signing.

## Receipts

```txt
GET /api/receipts/{receiptId}
```

Returns a receipt if it is still retained in memory.

## Events

```txt
GET /api/events
```

Returns the latest retained event log entries:

- quote issued
- payment attempted
- payment verified
- lead pack unlocked
- receipt generated

This is a future metering/logging structure. It is not a production analytics database yet.

## Legacy Endpoint

The old endpoint still resolves as a compatibility alias:

```txt
GET /api/premium-leads
```

New demos and docs should use:

```txt
GET /api/lead-intelligence/premium-pack
```

## Current Mode

```txt
sandbox settlement
no real funds
real settlement prepared, not enabled
```
