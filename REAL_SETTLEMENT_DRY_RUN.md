# Real Settlement Dry-Run Checklist

This checklist is for preparing a Base Sepolia facilitator test before switching the public demo from sandbox settlement to real x402 settlement.

Do not use this checklist with mainnet funds. Do not use a personal wallet. Do not paste private keys into Render.

## Goal

Prove the same buyer flow with real testnet settlement:

```txt
discover API
request premium lead intelligence
receive 402 Payment Required
create real x402 payment payload
retry with X-PAYMENT
receive protected lead intelligence and receipt
```

The discovery manifest, protected endpoint, `402` challenge, `X-PAYMENT` retry, and receipt flow should stay the same. Only the settlement provider changes.

## Current Safe State

Before starting, confirm the public demo is still safe:

```powershell
npm.cmd run settlement:check
```

Expected:

```txt
payment mode - sandbox
settlement provider - sandbox-simulated
real settlement - not enabled yet
```

If the public app is already in facilitator mode and you did not intend that, stop and switch Render back to:

```txt
X402_PAYMENT_MODE=sandbox
```

## Required Accounts And Tools

Prepare:

- Dedicated Base Sepolia buyer wallet
- Buyer wallet private key stored only on your local machine
- Base Sepolia ETH for gas
- Base Sepolia test USDC
- Valid seller wallet address
- Facilitator URL
- Base Sepolia RPC URL

Never use a mainnet private key. Never put `BUYER_PRIVATE_KEY` in Render.

## Local Buyer Env

Set buyer-only variables locally in PowerShell:

```powershell
$env:AGENT_API_ORIGIN="https://x402nano.onrender.com"
$env:BUYER_PRIVATE_KEY="0xYourDedicatedBaseSepoliaTestPrivateKey"
$env:BASE_SEPOLIA_RPC_URL="https://your-base-sepolia-rpc"
```

These are for the machine running the buyer test. They are not public server settings.

## Render Env For Facilitator Dry Run

Only when you are ready for the dry run, set these in Render:

```txt
X402_PAYMENT_MODE=facilitator
X402_FACILITATOR_URL=https://your-facilitator.example
PARTNER_SELLER_ADDRESS=0xYourSellerWallet
X402_NETWORK=eip155:84532
X402_ASSET=USDC
PRICE_USDC=0.05
```

If the facilitator requires an API key, set:

```txt
X402_FACILITATOR_API_KEY=...
```

Do not set:

```txt
BUYER_PRIVATE_KEY
BASE_SEPOLIA_RPC_URL
```

in Render.

## After Render Redeploys

Run:

```powershell
npm.cmd run settlement:check
```

Expected facilitator state:

```txt
payment mode - facilitator
settlement provider - facilitator-onchain
sandbox signer - disabled in facilitator mode
facilitator URL - present
real settlement status - server appears ready
```

Also open:

```txt
https://x402nano.onrender.com/.well-known/x402.json
```

Confirm the manifest advertises:

- `paymentMode: facilitator`
- `settlement: facilitator-onchain`
- `sandboxSigner: null`
- valid seller wallet
- `supportedNetworks` includes `eip155:84532`
- `supportedAssets` includes `USDC`

## Real Buyer Test

Run:

```powershell
npm.cmd run agent:real
```

Expected:

- discovers the seller manifest
- receives the `402` challenge
- creates a real payment through the x402 EVM client path
- retries with `X-PAYMENT`
- receives protected lead intelligence
- prints a receipt

If it fails, save the terminal output before changing settings.

## Pass Criteria

The dry run passes only if all are true:

- `npm.cmd run settlement:check` reports facilitator mode
- `/api/payments/sign` is disabled
- `/api/lead-intelligence/premium-pack` returns `402` before payment
- `npm.cmd run agent:real` unlocks protected lead intelligence
- receipt shows facilitator settlement
- buyer wallet balance changes only by expected testnet amounts
- no mainnet wallet or mainnet private key was used

## Fail Criteria

Stop and roll back if:

- seller wallet is invalid
- facilitator URL is missing
- `sandboxSigner` is still advertised in facilitator mode
- buyer wallet cannot create a payment payload
- facilitator rejects verify or settle
- lead intelligence unlocks without a valid payment
- any mainnet wallet/private key was used by mistake

## Rollback

Switch Render back to sandbox:

```txt
X402_PAYMENT_MODE=sandbox
```

Keep:

```txt
PARTNER_SELLER_ADDRESS=0xYourSellerWallet
X402_NETWORK=eip155:84532
X402_ASSET=USDC
PRICE_USDC=0.05
```

After Render redeploys:

```powershell
npm.cmd run settlement:check
$env:AGENT_API_ORIGIN="https://x402nano.onrender.com"
npm.cmd run smoke
npm.cmd run demo:record
```

Expected:

```txt
Sandbox demo is healthy. Real settlement is intentionally not enabled yet.
Smoke test passed.
```

## Notes To Capture

After a successful dry run, record:

- timestamp
- facilitator URL used
- seller wallet
- buyer wallet public address
- network
- asset
- receipt id
- transaction hash if returned
- command output from `npm.cmd run agent:real`
- whether lead intelligence unlocked

Then decide whether to keep the public app in facilitator mode or roll it back to sandbox for demos.
