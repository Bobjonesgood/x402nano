# LeadNestAI x402 Runbook

Live seller:

```txt
https://x402nano.onrender.com
```

## Daily Check

From this project folder:

```powershell
npm.cmd run settlement:check
```

Current live expectations:

```txt
payment mode: facilitator
settlement: facilitator-onchain
network: eip155:8453
asset: USDC
product: production
CDP facilitator auth: configured
sandbox signer: disabled
```

Then open:

```txt
https://x402nano.onrender.com/api/version
https://x402nano.onrender.com/.well-known/x402.json
```

## Deploy Check

After Render redeploys:

1. Confirm `/api/version` shows the expected Git commit.
2. Run `npm.cmd run settlement:check`.
3. Confirm the readiness output says `Bazaar discovery` is declared.
4. Confirm unpaid `GET /api/lead-intelligence/premium-pack` returns `402`, not `503`.
5. Confirm product status still reports the reviewed production pack.

## Bazaar Readiness

`npm.cmd run settlement:check` checks that the paid challenge exposes:

```txt
x402.extensions.bazaar
GET method metadata
output example
output schema
```

That metadata keeps discovery narrow around the existing paid lead pack:

```txt
machine-payable lead intelligence pack for service-business sales automation
```

Catalog appearance still depends on the Bazaar/facilitator discovery process and a successfully settled paid resource.

## Local Verification

```powershell
npm.cmd run build
$env:AGENT_API_ORIGIN="https://x402nano.onrender.com"
npm.cmd run smoke
npm.cmd run leadnestai:test
```

The sandbox smoke path is still useful for API shape checks. The LeadNestAI handoff remains manual and selected-lead-only.

## Paid Endpoint Operation

Protected resource:

```txt
GET /api/lead-intelligence/premium-pack
```

Mainnet buyer preflight:

```powershell
npm.cmd run agent:mainnet
```

Fresh local buyer wallet helper:

```powershell
npm.cmd run wallet:mainnet:create
```

Keep buyer private keys local. Do not put buyer secrets in Render or chat.

## Files To Read

```txt
MAINNET_LAUNCH_CHECKLIST.md
PRODUCTION_LEAD_PACK.md
TRUST.md
ARCHITECTURE.md
```

## Rollback

If the paid product data, facilitator path, or seller-wallet review is wrong, set Render back to:

```txt
X402_PAYMENT_MODE=sandbox
LEAD_PACK_MODE=demo
X402_NETWORK=eip155:84532
```

Redeploy and run `npm.cmd run settlement:check` again.
