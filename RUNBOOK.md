# Payment-Aware Sandbox Runbook

Live demo: https://x402nano.onrender.com

Use this checklist when you want to operate, verify, or show the demo without guessing.

## 1. Check Live Health

```powershell
npm.cmd run settlement:check
```

Expected result:

- health is `sandbox / sandbox-simulated`
- discovery manifest loads
- price is `0.05 USDC`
- network is `eip155:84532`
- seller wallet is a valid `0x...` address
- real settlement says it is not enabled yet

This is the quickest check that the public demo is still in the right state.

## 2. Verify Settlement Mode

```powershell
npm.cmd run settlement:check
```

Look for:

```txt
payment mode - sandbox
settlement provider - sandbox-simulated
real settlement - not enabled yet
```

That is the correct current state. The public demo should stay in sandbox mode until the real facilitator path is tested deliberately.

## 3. Run The Live Smoke Test

```powershell
$env:AGENT_API_ORIGIN="https://x402nano.onrender.com"
npm.cmd run smoke
```

Expected result:

```txt
Smoke test passed.
```

This proves:

- `/.well-known/x402.json` works
- `/api/pricing` works
- `/api/schema` works
- `/api/premium-leads` returns `402` before payment
- sandbox signing works
- retry with `X-PAYMENT` unlocks protected data

## 4. Run The Buyer Agent

```powershell
$env:AGENT_API_ORIGIN="https://x402nano.onrender.com"
npm.cmd run agent:buyer
```

Expected flow:

```txt
1. Discovering seller API
2. Requesting protected data
3. Paying automatically
4. Retrying with X-PAYMENT
5. Protected data received
```

This is the best terminal demo for technical people. It shows the project is not just a website.

## 5. Record A Fresh Proof

```powershell
npm.cmd run demo:record
```

This writes:

```txt
proofs/latest-demo-run.md
proofs/<timestamp>-demo-run.md
```

Use this before sharing the project so `proofs/latest-demo-run.md` contains a fresh receipt from the live deployed app.

## 6. What To Do If Render Redeploys

After Render finishes a deploy:

```powershell
npm.cmd run settlement:check
$env:AGENT_API_ORIGIN="https://x402nano.onrender.com"
npm.cmd run smoke
npm.cmd run demo:record
```

Then refresh:

```txt
https://x402nano.onrender.com
```

Check the app shows:

- settlement readiness panel
- `sandbox`
- valid seller wallet
- real settlement `off`
- proof/report section near the bottom

## 7. What Not To Touch Yet

Do not switch these in Render yet unless you are intentionally doing a real settlement dry run:

```txt
X402_PAYMENT_MODE=facilitator
X402_FACILITATOR_URL=...
X402_FACILITATOR_API_KEY=...
```

Do not paste a mainnet private key into local env or Render.

Do not use a personal wallet/private key for buyer-agent testing. Use a dedicated Base Sepolia test wallet only.

Do not change `X402_NETWORK` to Base mainnet until Base Sepolia facilitator testing has passed.

## 8. Safe Current Render Settings

These are the safe public-demo settings:

```txt
X402_PAYMENT_MODE=sandbox
PARTNER_SELLER_ADDRESS=0xYourSellerWallet
X402_NETWORK=eip155:84532
X402_ASSET=USDC
PRICE_USDC=0.05
```

`SELLER_ADDRESS` also works, but `PARTNER_SELLER_ADDRESS` is accepted as a fallback when the hosting environment cannot reuse the same variable name.

## 9. Files To Share

Use these when showing the project:

```txt
https://x402nano.onrender.com
README.md
DEMO_REPORT.md
proofs/latest-demo-run.md
REAL_X402_SETUP.md
```

## 10. Next Bigger Step

Before touching facilitator mode, follow the real settlement dry-run checklist:

```txt
REAL_SETTLEMENT_DRY_RUN.md
```
