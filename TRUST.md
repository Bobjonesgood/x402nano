# Trust Statement

This project is built around a simple standard:

```txt
Real proof. Clear boundaries. No fake claims.
```

## What This Demo Proves

The Payment-Aware Sandbox proves that an API can expose a machine-payable access pattern:

- publish a discovery manifest at `/.well-known/x402.json`
- reject unpaid access with `402 Payment Required`
- return payment requirements to the buyer
- accept a payment payload through `X-PAYMENT`
- unlock protected data after verification
- return a receipt
- provide scripts that reproduce the flow from the command line

That is the core infrastructure proof.

## What This Demo Does Not Claim

This public deployment does not claim that real funds are currently moving.

It does not claim mainnet settlement.

It does not claim production payment compliance.

It does not claim that the demo lead data is a real commercial dataset.

It does not ask anyone to trust a hidden process. The API exposes its discovery, health, version, readiness, and proof files.

## What Is Sandboxed

The current public deployment is intentionally running:

```txt
payment mode: sandbox
settlement: sandbox-simulated
```

In sandbox mode:

- no real funds move
- `/api/payments/sign` creates a simulated payment payload
- browser wallet mode signs an authorization message
- receipts prove the unlock flow, not final onchain settlement

This keeps the demo safe while preserving the same discovery, `402`, `X-PAYMENT`, and receipt shape needed for real settlement.

## What Is Real

These parts are real in the current public demo:

- deployed API server
- public React app
- discovery manifest
- protected endpoint
- `402 Payment Required` behavior
- `X-PAYMENT` retry path
- receipt generation
- autonomous buyer script
- smoke test
- readiness checker
- recordable proof transcript
- release/version endpoint
- valid seller wallet address in metadata

## How To Verify

Open:

```txt
https://x402nano.onrender.com
https://x402nano.onrender.com/.well-known/x402.json
https://x402nano.onrender.com/api/version
```

Run:

```powershell
npm.cmd run settlement:check
$env:AGENT_API_ORIGIN="https://x402nano.onrender.com"
npm.cmd run smoke
npm.cmd run demo:record
```

Read:

```txt
proofs/latest-demo-run.md
DEMO_REPORT.md
RUNBOOK.md
REAL_SETTLEMENT_DRY_RUN.md
```

## Before Real Funds

Before real settlement is enabled, the project requires a controlled Base Sepolia dry run:

- dedicated test wallet
- Base Sepolia ETH for gas
- Base Sepolia test USDC
- facilitator URL confirmed
- seller wallet confirmed
- buyer private key kept local only
- `npm.cmd run settlement:check` passes in facilitator mode
- `npm.cmd run agent:real` unlocks protected data with testnet funds

The checklist lives in:

```txt
REAL_SETTLEMENT_DRY_RUN.md
```

## Current Position

The honest status is:

```txt
Sandbox proof complete.
Real settlement prepared, not rushed.
```
