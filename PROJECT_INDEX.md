# Project Index

This is the map for the LeadNestAI machine-payable API demo.

## 1. Live Demo

Public app:

```txt
https://x402nano.onrender.com
```

What it shows:

- x402-style API discovery
- `402 Payment Required` challenge
- `X-PAYMENT` retry flow
- sandbox USDC settlement
- LeadNestAI premium lead intelligence unlock
- browser wallet signing mode
- receipt panel
- settlement readiness panel
- proof/report section

Visual proof assets:

```txt
assets/screenshots/
```

## 2. Fastest Proof

Run:

```powershell
npm.cmd run settlement:check
$env:AGENT_API_ORIGIN="https://x402nano.onrender.com"
npm.cmd run smoke
npm.cmd run demo:record
```

Then open:

```txt
proofs/latest-demo-run.md
```

That file contains the latest recorded proof that the live app completed the machine-payable API flow.

## 3. Main Docs

Start here:

```txt
README.md
```

Plain-English demo report:

```txt
DEMO_REPORT.md
```

Live x402 to LeadNestAI bridge proof:

```txt
X402_TO_LEADNESTAI_LIVE_PROOF.md
```

Base Sepolia real settlement proof:

```txt
BASE_SEPOLIA_REAL_SETTLEMENT_PROOF.md
```

Mainnet revenue readiness:

```txt
MAINNET_REVENUE_READINESS.md
```

Daily operations checklist:

```txt
RUNBOOK.md
```

Real settlement setup notes:

```txt
REAL_X402_SETUP.md
```

Real settlement preflight:

```txt
REAL_SETTLEMENT_DRY_RUN.md
```

Release notes:

```txt
RELEASE_NOTES.md
```

Trust statement:

```txt
TRUST.md
```

Public demo kit:

```txt
PUBLIC_DEMO_KIT.md
DEMO_RECORDING_CHECKLIST.md
SOCIAL_DEMO_ASSETS.md
FIRST_VIEWER_FEEDBACK.md
FEEDBACK_ITERATION_LOG.md
```

Commercial architecture:

```txt
ARCHITECTURE.md
PAYMENT_FLOW.md
API_OVERVIEW.md
LEADNESTAI_INTEGRATION.md
```

## 4. Operating Commands

Check live readiness:

```powershell
npm.cmd run settlement:check
```

Smoke test the live deployment:

```powershell
$env:AGENT_API_ORIGIN="https://x402nano.onrender.com"
npm.cmd run smoke
```

Run the autonomous buyer proof:

```powershell
$env:AGENT_API_ORIGIN="https://x402nano.onrender.com"
npm.cmd run agent:buyer
```

Run the local LeadNestAI handoff test:

```powershell
npm.cmd run leadnestai:test
```

Record a fresh proof transcript:

```powershell
npm.cmd run demo:record
```

Build locally:

```powershell
npm.cmd run build
```

Inspect release/build metadata:

```txt
https://x402nano.onrender.com/api/version
```

## 5. Current Safe State

The public demo should currently report:

```txt
payment mode: sandbox
settlement: sandbox-simulated
network: eip155:84532
asset: USDC
real settlement: off
```

This is intentional. The project is safe to show because no real funds move in sandbox mode.

## 6. Real Settlement Prep

Before touching facilitator mode, read:

```txt
REAL_SETTLEMENT_DRY_RUN.md
```

Do not switch Render to facilitator mode until the dry-run checklist is ready.

Do not put buyer private keys in Render.

Use a dedicated Base Sepolia test wallet only.

## 7. Files And Purpose

```txt
src/App.jsx                         live React demo UI
server/index.js                     seller API server
server/payment-providers.js         sandbox/facilitator provider boundary
scripts/agent-buyer.js              autonomous sandbox buyer proof
scripts/real-x402-buyer.js          real x402 buyer path for facilitator mode
scripts/smoke-test.js               deployed API smoke test
scripts/settlement-readiness.js     readiness checker
scripts/record-demo-run.js          markdown proof recorder
proofs/latest-demo-run.md           latest recorded proof transcript
DEMO_REPORT.md                      plain-English proof/pitch report
X402_TO_LEADNESTAI_LIVE_PROOF.md   live bridge proof from x402 unlock to LeadNestAI storage
BASE_SEPOLIA_REAL_SETTLEMENT_PROOF.md first Base Sepolia x402 facilitator payment proof
MAINNET_REVENUE_READINESS.md      mainnet paid-endpoint launch gates and rollback path
PRODUCTION_LEAD_PACK.md           first paid lead-pack schema, starter pack, and honesty boundary
MAINNET_LAUNCH_CHECKLIST.md        controlled Base mainnet first-payment checklist
PUBLIC_DEMO_KIT.md                  public sharing copy, demo script, and screenshot checklist
DEMO_RECORDING_CHECKLIST.md         short walkthrough recording checklist
SOCIAL_DEMO_ASSETS.md               post copy, captions, and short public explanations
FIRST_VIEWER_FEEDBACK.md            first-viewer feedback questions and notes template
FEEDBACK_ITERATION_LOG.md           running log for confusion patterns and wording changes
assets/screenshots/README.md        screenshot asset guide for public sharing
RUNBOOK.md                          operating checklist
REAL_X402_SETUP.md                  settlement setup notes
REAL_SETTLEMENT_DRY_RUN.md          preflight before real settlement
RELEASE_NOTES.md                    v0.1.0 release snapshot
TRUST.md                            proof boundaries and verification statement
ARCHITECTURE.md                     buyer, seller, receipt, and event architecture
PAYMENT_FLOW.md                     discover, quote, pay, retry, unlock workflow
API_OVERVIEW.md                     LeadNestAI API endpoint reference
LEADNESTAI_INTEGRATION.md           x402 to LeadNestAI handoff plan and test flow
```

## 8. What To Do Next

Recommended next step:

```txt
Keep the public demo in sandbox mode and use the project index, runbook, and proof transcript when sharing the build.
```

Next engineering step:

```txt
Follow REAL_SETTLEMENT_DRY_RUN.md in a controlled Base Sepolia test.
```
