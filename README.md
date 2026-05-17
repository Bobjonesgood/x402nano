# Payment-Aware Sandbox

An x402-ready seller API and autonomous buyer proof.

The app demonstrates:

- agent discovery through `/.well-known/x402.json`
- protected API access through `402 Payment Required`
- automatic payment handoff through `X-PAYMENT`
- sandbox settlement today
- facilitator settlement boundary for real x402 wiring

## Demo Brief

This project is a public proof that APIs can become payment-aware resources for agents and wallets.

### What This Proves

An API can publish its price and payment rules, reject unpaid access with `402 Payment Required`, accept a payment payload on retry, and unlock protected data without a human-operated checkout page.

### How Agents Discover The API

Agents read:

```txt
/.well-known/x402.json
```

That manifest exposes the protected endpoint, price, network, asset, payment header, schema, and receipt path.

### How Payment Unlock Works

The buyer calls `/api/premium-leads` and receives `402`. The buyer then creates a payment payload, retries with `X-PAYMENT`, and receives premium lead data plus a receipt.

### What Is Sandbox Now

The current public demo uses simulated USDC settlement and browser-wallet message signatures. No real funds move in sandbox mode. This keeps the demo safe while preserving the real x402 shape.

### What Becomes Real x402 Settlement Next

Switch `X402_PAYMENT_MODE` to `facilitator`, add a facilitator URL, use a funded Base Sepolia buyer wallet, and keep the same discovery, `402`, `X-PAYMENT`, and receipt flow.

## Run Locally

```powershell
npm.cmd install
npm.cmd run build
npm.cmd start
```

Open:

```txt
http://127.0.0.1:4021
```

Run the autonomous buyer:

```powershell
npm.cmd run agent:buyer
```

Run the deploy smoke test:

```powershell
npm.cmd run smoke
```

Generate a shareable proof report:

```powershell
npm.cmd run demo:report
```

Record a markdown proof transcript:

```powershell
npm.cmd run demo:record
```

This writes `proofs/latest-demo-run.md` and a timestamped archive in `proofs/`.

Read the plain-English demo report:

```txt
DEMO_REPORT.md
```

Operate the demo with the checklist:

```txt
RUNBOOK.md
```

Prepare for testnet settlement without flipping the switch:

```txt
REAL_SETTLEMENT_DRY_RUN.md
```

Run the real x402 buyer path after switching the server to facilitator mode:

```powershell
$env:BUYER_PRIVATE_KEY="0xYourBaseSepoliaTestPrivateKey"
$env:BASE_SEPOLIA_RPC_URL="https://your-base-sepolia-rpc"
npm.cmd run agent:real
```

## Public Sandbox Deploy

Use these environment variables first:

```txt
X402_PAYMENT_MODE=sandbox
SELLER_ADDRESS=0xYourWallet
X402_NETWORK=eip155:84532
X402_ASSET=USDC
PRICE_USDC=0.05
```

`SELLER_ADDRESS` should be your receiving wallet. `PARTNER_SELLER_ADDRESS` is also accepted as a fallback if your host already uses that name. In sandbox mode it can be a placeholder, but before real settlement it must be a valid EVM address:

```txt
0x followed by 40 hexadecimal characters
```

Build command:

```txt
npm install && npm run build
```

Start command:

```txt
npm start
```

After deploy, test:

```powershell
$env:AGENT_API_ORIGIN="https://your-public-url"
npm.cmd run smoke
npm.cmd run agent:buyer
npm.cmd run demo:report
```

## Docker

```powershell
docker build -t payment-aware-sandbox .
docker run --rm -p 4021:4021 payment-aware-sandbox
```

## Real Settlement

Switch to facilitator mode after the public sandbox is stable:

```txt
X402_PAYMENT_MODE=facilitator
X402_FACILITATOR_URL=https://your-facilitator.example
SELLER_ADDRESS=0xYourSellerWallet
X402_NETWORK=eip155:84532
X402_ASSET=USDC
```

See [REAL_X402_SETUP.md](REAL_X402_SETUP.md).
