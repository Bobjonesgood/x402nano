# Release Notes

## v0.1.0 - Payment-Aware Sandbox Proof

Date: 2026-05-17

Live demo:

```txt
https://x402nano.onrender.com
```

### What Shipped

- Public React demo for a payment-aware API sandbox
- Node seller server with protected premium lead endpoint
- Agent discovery through `/.well-known/x402.json`
- `402 Payment Required` challenge flow
- `X-PAYMENT` retry contract
- Sandbox USDC payment signer
- Browser wallet message-signing mode
- Receipt panel and protocol trace
- Settlement readiness panel
- Autonomous buyer script
- Live smoke test
- Recordable markdown proof transcript
- Demo report, project index, runbook, and real settlement dry-run checklist
- `/api/version` endpoint for release, build, payment mode, and live status metadata

## v0.2.0 - LeadNestAI Commercial Proof

Date: 2026-05-18

### What Changed

- Rebranded the demo around LeadNestAI
- Promoted the protected commercial endpoint to `/api/lead-intelligence/premium-pack`
- Replaced generic premium leads with structured lead intelligence records
- Added realistic business fields: industry, location, estimated job value, buying intent, pain points, recommended opener, and confidence score
- Added event logging structure for quote, payment, unlock, and receipt events
- Added `/api/events` for retained demo events
- Added `ARCHITECTURE.md`, `PAYMENT_FLOW.md`, and `API_OVERVIEW.md`
- Kept sandbox settlement in place

### Commercial Direction

LeadNestAI is the commercial front. x402-style payment flow is the infrastructure layer underneath it.

The goal is one polished workflow:

```txt
discover LeadNestAI
request premium lead intelligence
receive 402 quote
pay with X-PAYMENT
unlock lead pack
receive receipt
```

### Intentionally Sandboxed

The public deployment is intentionally running:

```txt
X402_PAYMENT_MODE=sandbox
settlement=sandbox-simulated
```

No real funds move in this release.

### How To Verify

```powershell
npm.cmd run settlement:check
$env:AGENT_API_ORIGIN="https://x402nano.onrender.com"
npm.cmd run smoke
npm.cmd run demo:record
```

Also inspect:

```txt
https://x402nano.onrender.com/api/version
https://x402nano.onrender.com/.well-known/x402.json
proofs/latest-demo-run.md
```

### Next Milestone

Prepare and run the Base Sepolia facilitator dry run from:

```txt
REAL_SETTLEMENT_DRY_RUN.md
```
