# LeadNestAI Machine-Payable Lead Intelligence

LeadNestAI is the product story. x402 is the payment-aware API layer underneath it.

Live seller:

```txt
https://x402nano.onrender.com
GET /api/lead-intelligence/premium-pack
```

## Current Status

The live seller is configured for:

```txt
Base mainnet payment challenge
USDC price: 0.05
CDP facilitator settlement path
reviewed three-record production starter pack
manual LeadNestAI handoff only
```

The live endpoint has been checked for a real Base mainnet `402 Payment Required` challenge. The first controlled mainnet paid unlock is still a separate proof step.

## What It Does

1. Buyer or agent discovers `/.well-known/x402.json`.
2. Buyer requests the paid lead pack.
3. Seller returns `402 Payment Required`.
4. Buyer retries with `X-PAYMENT`.
5. Seller verifies payment and returns a receipt plus lead intelligence.
6. A selected unlocked lead can be manually handed into LeadNestAI.

## Fast Checks

```powershell
npm.cmd install
npm.cmd run build
npm.cmd run settlement:check
$env:AGENT_API_ORIGIN="https://x402nano.onrender.com"
npm.cmd run smoke
npm.cmd run leadnestai:test
```

## Mainnet Buyer Preflight

```powershell
npm.cmd run agent:mainnet
```

That command checks the live mainnet endpoint and exits before payment until a local dedicated buyer key and explicit payment acknowledgement exist.

Create a fresh local-only buyer wallet when needed:

```powershell
npm.cmd run wallet:mainnet:create
```

The helper writes `.env.mainnet.local`, which is ignored by Git, and prints only the public address. Do not put buyer private keys in Render or chat.

## Environment Shape

Seller-side mainnet configuration:

```txt
X402_PAYMENT_MODE=facilitator
X402_FACILITATOR_URL=https://api.cdp.coinbase.com/platform/v2/x402
CDP_API_KEY_ID=<hosting secret>
CDP_API_KEY_SECRET=<hosting secret>
SELLER_ADDRESS=<reviewed Base receiving wallet>
X402_NETWORK=eip155:8453
X402_ASSET=USDC
PRICE_USDC=0.05
LEAD_PACK_MODE=production
PREMIUM_LEAD_PACK_JSON=<reviewed production pack>
```

LeadNestAI manual handoff:

```txt
LEAD_HANDOFF_ENABLED=true
LEADNESTAI_API_URL=https://www.leadnestai.net
LEADNESTAI_INGEST_SECRET=<shared secret>
LEADNESTAI_SOURCE_ID=x402nano
```

## Docs Kept

```txt
RUNBOOK.md
PROJECT_INDEX.md
ARCHITECTURE.md
API_OVERVIEW.md
TRUST.md
PRODUCTION_LEAD_PACK.md
MAINNET_LAUNCH_CHECKLIST.md
MAINNET_REVENUE_READINESS.md
```

Proof retained:

```txt
BASE_SEPOLIA_REAL_SETTLEMENT_PROOF.md
X402_TO_LEADNESTAI_LIVE_PROOF.md
```
