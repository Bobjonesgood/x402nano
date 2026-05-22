# Project Index

This repo now stays narrow: operate the live paid endpoint, understand the architecture, keep the product claim honest, and preserve the proof trail that matters.

## Live Product

```txt
https://x402nano.onrender.com
GET /api/lead-intelligence/premium-pack
```

The live seller currently exposes a Base mainnet x402 payment challenge for the reviewed first lead pack. Check the live truth before making claims:

```powershell
npm.cmd run settlement:check
```

## Keep These Docs

```txt
README.md                         product entrypoint and commands
RUNBOOK.md                        daily checks and launch operations
ARCHITECTURE.md                   payment, receipt, and LeadNestAI bridge shape
API_OVERVIEW.md                   endpoint reference
TRUST.md                          honest claims and boundaries
PRODUCTION_LEAD_PACK.md           paid lead-pack schema and reviewed data boundary
MAINNET_LAUNCH_CHECKLIST.md        first controlled mainnet payment checklist
MAINNET_REVENUE_READINESS.md       pricing, seller-wallet, and rollback gates
BASE_SEPOLIA_REAL_SETTLEMENT_PROOF.md testnet facilitator proof
X402_TO_LEADNESTAI_LIVE_PROOF.md  live handoff proof into LeadNestAI
```

## Core Files

```txt
src/App.jsx                         React demo UI
server/index.js                     x402 seller API
server/payment-providers.js         sandbox and facilitator boundary
server/leadnestai-client.js         manual LeadNestAI handoff client
data/production-lead-pack.starter.json reviewed first paid pack
scripts/mainnet-x402-buyer.js       controlled mainnet buyer proof
scripts/create-mainnet-buyer-wallet.js local-only buyer wallet helper
scripts/settlement-readiness.js     live readiness checker
scripts/smoke-test.js               deployed API smoke test
scripts/test-leadnestai-handoff.js local handoff integration test
```

## Commands

```powershell
npm.cmd install
npm.cmd run build
npm.cmd run settlement:check
$env:AGENT_API_ORIGIN="https://x402nano.onrender.com"
npm.cmd run smoke
npm.cmd run leadnestai:test
npm.cmd run agent:mainnet
```

`agent:mainnet` runs a no-payment preflight until a local dedicated buyer key and explicit acknowledgement are present.
