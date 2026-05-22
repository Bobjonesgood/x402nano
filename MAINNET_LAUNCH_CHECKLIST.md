# Mainnet Launch Checklist

Use this checklist for the first controlled Base mainnet paid unlock.

## 1. Review The Product

- Confirm the first paid resource is still `GET /api/lead-intelligence/premium-pack`.
- Review every record in `data/production-lead-pack.starter.json`.
- Remove any record you would not be comfortable sending to a real buyer today.
- Confirm public source URLs still load and still support the notes in `sourceEvidence`.
- Confirm the claim remains honest: these are reviewed public-source fit signals, not guaranteed customer purchases.

## 2. Prepare The Production Pack

Run:

```powershell
npm.cmd run leadpack:prepare
```

Set the printed JSON as the Render value for:

```txt
PREMIUM_LEAD_PACK_JSON
```

Set:

```txt
LEAD_PACK_MODE=production
```

## 3. Review Mainnet Environment

Render must use:

```txt
X402_PAYMENT_MODE=facilitator
X402_FACILITATOR_URL=https://api.cdp.coinbase.com/platform/v2/x402
X402_NETWORK=eip155:8453
X402_ASSET=USDC
PRICE_USDC=<approved first-launch price>
SELLER_ADDRESS=<reviewed Base mainnet receiving wallet>
CDP_API_KEY_ID=<hosting secret>
CDP_API_KEY_SECRET=<hosting secret>
LEAD_PACK_MODE=production
PREMIUM_LEAD_PACK_JSON=<reviewed first paid pack>
```

Keep buyer private keys off Render.

## 4. Redeploy And Inspect

- Wait for Render deploy success.
- Run `npm.cmd run settlement:check` against the live origin.
- Confirm health, pricing, discovery, and version show a production lead pack.
- Confirm `/api/payments/sign` is disabled in facilitator mode.
- Confirm unpaid protected access returns `402`, not `503`.

## 5. First Real Payment

- Create a fresh dedicated local buyer wallet if needed:

```powershell
npm.cmd run wallet:mainnet:create
```

- Fund only the printed public address with the tiny Base mainnet amount needed for the first proof.
- Run a no-funds preflight first:

```powershell
npm.cmd run agent:mainnet
```

- For one controlled real payment, set local-only buyer variables:

```powershell
$env:MAINNET_BUYER_PRIVATE_KEY="<dedicated tiny-funded Base mainnet buyer key>"
$env:BASE_MAINNET_RPC_URL="<Base mainnet RPC URL or use the local file default>"
$env:MAINNET_PAYMENT_ACK="PAY_REAL_0.05_USDC"
$env:MAINNET_MAX_USDC="0.05"
$env:MAINNET_EXPECTED_SELLER_ADDRESS="<reviewed seller address>"
npm.cmd run agent:mainnet
```

- Do not put buyer variables in Render.
- Make one controlled payment only.
- Confirm the paid response returns the expected receipt and first pack.
- Confirm the seller wallet receives the expected USDC amount.
- Confirm x402 seller events show quote, payment attempt, verification, receipt, and unlock.

## 6. LeadNestAI Boundary

- Keep LeadNestAI handoff manual for the first mainnet run.
- Send at most one selected lead after unlock if you want to confirm the bridge still works.
- Confirm duplicate handling still works.
- Confirm no automatic outreach fires.

## 7. Rollback

If the product claim, payment result, or pack data is wrong:

```txt
X402_PAYMENT_MODE=sandbox
LEAD_PACK_MODE=demo
```

Redeploy and confirm the live app returns to the honest public demo state.
