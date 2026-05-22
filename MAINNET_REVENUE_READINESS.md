# Mainnet Revenue Readiness

This checklist starts after the Base Sepolia real settlement proof passes.

Current proof already completed:

```txt
Base Sepolia buyer paid 0.05 test USDC
-> facilitator verified and settled
-> LeadNestAI premium lead intelligence unlocked
-> receipt and seller events were recorded
```

Mainnet is the revenue door. Open it deliberately.

## Current Boundary

The public Render app should remain:

```txt
X402_PAYMENT_MODE=sandbox
```

until each go-live requirement below is complete.

The first production x402 endpoint remains:

```txt
GET /api/lead-intelligence/premium-pack
```

Do not add more paid endpoints before one real paid endpoint is launched and understood.

## Production Go-Live Requirements

### 1. Choose The Paid Product

State the product truthfully before mainnet:

```txt
LeadNestAI premium lead intelligence pack
```

Confirm:

- what records are included
- whether records are examples, sourced leads, or enriched customer-owned leads
- what refund/support promise exists
- what price is honest for the first real release

Do not charge for demo-only or simulated lead records as if they are live customer-ready leads.

### 2. Use The Production Facilitator

Use the CDP facilitator for production/mainnet:

```txt
https://api.cdp.coinbase.com/platform/v2/x402
```

CDP production/mainnet requires API key authentication. The current x402.org test facilitator is testnet-only.

Before Render mainnet mode:

- create a Coinbase Developer Platform project
- generate CDP API credentials
- wire the CDP facilitator authentication path in the resource server
- keep API credentials in hosting secrets only

Do not assume the testnet no-auth facilitator setup is a production auth setup.

### 3. Confirm Mainnet Payment Settings

Production Render settings should be reviewed as a set:

```txt
X402_PAYMENT_MODE=facilitator
X402_FACILITATOR_URL=https://api.cdp.coinbase.com/platform/v2/x402
X402_NETWORK=eip155:8453
X402_ASSET=USDC
PRICE_USDC=<approved launch price>
SELLER_ADDRESS=<reviewed Base mainnet receiving wallet>
CDP_API_KEY_ID=<hosting secret>
CDP_API_KEY_SECRET=<hosting secret>
```

Use `SELLER_ADDRESS` or `PARTNER_SELLER_ADDRESS` consistently. Do not keep two competing seller addresses.

### 4. Keep Buyer Secrets Out Of Render

Never put these on the seller host:

```txt
BUYER_PRIVATE_KEY
BASE_SEPOLIA_RPC_URL
```

For a future mainnet buyer test, use a small dedicated buyer wallet and only the amount needed for the controlled first payment.

### 5. Verify Launch Behavior

Before opening the endpoint publicly in mainnet mode:

1. Run the live readiness check.
2. Confirm `/api/payments/sign` is disabled.
3. Confirm unpaid access returns `402`.
4. Confirm the payment requirements show Base mainnet.
5. Make one tiny controlled real payment.
6. Confirm the seller wallet receives the expected USDC amount.
7. Confirm receipt and seller event logs.
8. Confirm LeadNestAI handoff remains manual unless a separate workflow launch approves otherwise.

### 6. Rollback Path

If mainnet testing fails or the product claim is not ready, switch Render back to:

```txt
X402_PAYMENT_MODE=sandbox
```

Then verify:

```powershell
npm.cmd run settlement:check
```

Expected:

```txt
Sandbox demo is healthy. Real settlement is intentionally not enabled yet.
```

## Immediate Next Task

Prepare CDP production facilitator authentication.

That means:

1. Create or confirm the CDP project.
2. Generate CDP API credentials for x402 facilitator access.
3. Set `CDP_API_KEY_ID` and `CDP_API_KEY_SECRET` as hosting secrets for CDP facilitator mode.
4. Test CDP facilitator first on Base Sepolia if possible.
5. Only then plan the Base mainnet switch.

## Honest Claim Right Now

The project has proven:

- a live sandbox x402 to LeadNestAI handoff bridge
- one real Base Sepolia x402 facilitator payment unlock

The project has not yet proven:

- CDP production facilitator auth
- Base mainnet paid unlock
- commercial demand for the paid lead intelligence product
