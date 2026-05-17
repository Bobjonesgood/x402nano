# Project Index

This is the map for the Payment-Aware Sandbox project.

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
- browser wallet signing mode
- receipt panel
- settlement readiness panel
- proof/report section

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
RUNBOOK.md                          operating checklist
REAL_X402_SETUP.md                  settlement setup notes
REAL_SETTLEMENT_DRY_RUN.md          preflight before real settlement
RELEASE_NOTES.md                    v0.1.0 release snapshot
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
