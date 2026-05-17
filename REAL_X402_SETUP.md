# Real x402 Settlement Setup

This sandbox now has a payment-provider boundary:

- `X402_PAYMENT_MODE=sandbox` keeps the local simulated signer active.
- `X402_PAYMENT_MODE=facilitator` disables the sandbox signer and expects clients to send a real x402 payment payload in `X-PAYMENT`.

## Local Sandbox

```powershell
$env:X402_PAYMENT_MODE="sandbox"
node server/index.js
```

The frontend can still call `/api/payments/sign` to simulate a paying agent.

Run the autonomous buyer proof:

```powershell
npm.cmd run agent:buyer
```

The buyer will discover `/.well-known/x402.json`, request `/api/premium-leads`, receive `402`, create a sandbox payment, retry with `X-PAYMENT`, and print the protected leads.

## Facilitator Mode

```powershell
$env:X402_PAYMENT_MODE="facilitator"
$env:X402_FACILITATOR_URL="https://your-facilitator.example"
$env:SELLER_ADDRESS="0xYourSellerWallet"
$env:X402_NETWORK="eip155:84532"
$env:X402_ASSET="USDC"
node server/index.js
```

In this mode:

- `/.well-known/x402.json` advertises facilitator settlement.
- `/api/payments/sign` returns `501` because signing belongs to the buyer wallet or x402 client.
- `/api/premium-leads` still returns `402` with payment requirements.
- The retry still uses `X-PAYMENT`.
- The server posts the payment payload and requirements to the facilitator `/verify` and `/settle` endpoints.

For facilitator testing, prepare a real x402 payment payload with your wallet/client and pass it to the autonomous buyer:

```powershell
$env:X402_PAYMENT="base64url-real-x402-payment-payload"
npm.cmd run agent:buyer
```

Or use the official x402 EVM client path:

```powershell
$env:AGENT_API_ORIGIN="https://x402nano.onrender.com"
$env:BUYER_PRIVATE_KEY="0xYourBaseSepoliaTestPrivateKey"
$env:BASE_SEPOLIA_RPC_URL="https://your-base-sepolia-rpc"
npm.cmd run agent:real
```

Use a dedicated test wallet only. Do not use a mainnet wallet/private key for local experiments.

## Mainnet Flip

After testnet validation:

- Change `X402_NETWORK` from Base Sepolia `eip155:84532` to Base mainnet `eip155:8453`.
- Set `SELLER_ADDRESS` to your real receiving wallet.
- Use a production facilitator URL.
- Keep the same `402` challenge and `X-PAYMENT` retry contract.
