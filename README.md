# Payment-Aware Sandbox

An x402-ready seller API and autonomous buyer proof.

The app demonstrates:

- agent discovery through `/.well-known/x402.json`
- protected API access through `402 Payment Required`
- automatic payment handoff through `X-PAYMENT`
- sandbox settlement today
- facilitator settlement boundary for real x402 wiring

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

## Public Sandbox Deploy

Use these environment variables first:

```txt
X402_PAYMENT_MODE=sandbox
SELLER_ADDRESS=0xYourWallet
X402_NETWORK=eip155:84532
X402_ASSET=USDC
PRICE_USDC=0.05
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
npm.cmd run agent:buyer
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
