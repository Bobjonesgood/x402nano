# LeadNestAI Machine-Payable Demo Report

Live demo: https://x402nano.onrender.com

## One-Line Thesis

This project proves that LeadNestAI can become a machine-payable lead intelligence resource: an autonomous buyer can discover the endpoint, receive a `402 Payment Required` challenge, submit a payment payload, retry the request, and receive protected lead intelligence.

## What This Proves

The build demonstrates the core shape of autonomous monetized APIs:

- Public agent discovery through `/.well-known/x402.json`
- Protected access through `402 Payment Required`
- Payment handoff through the `X-PAYMENT` retry contract
- Seller-side receipt generation
- Browser wallet signing as a human-visible buyer mode
- Autonomous buyer scripting for machine-to-machine access
- A clean boundary between sandbox settlement and future facilitator settlement

The important proof is the commercial workflow: LeadNestAI can sell structured lead intelligence at the API layer, without a checkout page, invoice flow, sales call, or human approval loop.

## How Agents Discover The API

The seller publishes a machine-readable manifest:

```txt
/.well-known/x402.json
```

That manifest tells a buyer agent:

- what protected resource exists
- where the paid endpoint lives
- what asset is required
- what network is expected
- what payment header to use
- where to find pricing and schema information
- whether the public demo is running sandbox or facilitator mode

This is the discovery step that lets a buyer agent understand the API before attempting to pay it.

## How Payment Unlock Works

The buyer flow is:

1. Request `/api/lead-intelligence/premium-pack` without payment.
2. Receive `402 Payment Required`.
3. Read the payment requirements returned by the seller.
4. Create a payment payload.
5. Retry the same endpoint with `X-PAYMENT`.
6. Receive protected lead data and a receipt.

That retry loop is the key infrastructure pattern. The website is only the visual demo; the real product shape is the machine-payable API contract.

## What Is Simulated Today

The public app is intentionally running in sandbox mode.

Sandbox mode means:

- no real funds move
- the app simulates USDC settlement
- `/api/payments/sign` creates a demo payment payload
- browser wallet mode signs an authorization message
- the receipt proves the unlock path, not final onchain settlement

This keeps the demo safe while preserving the same discovery, challenge, retry, and receipt architecture that real x402 settlement will use.

## What Becomes Real x402 Settlement Next

The next production step is to switch the payment provider from sandbox signing to facilitator settlement.

That means setting:

```txt
X402_PAYMENT_MODE=facilitator
X402_FACILITATOR_URL=...
PARTNER_SELLER_ADDRESS=0xYourSellerWallet
X402_NETWORK=eip155:84532
X402_ASSET=USDC
```

The discovery manifest and retry contract stay the same. The difference is that the payment payload is verified and settled by a real facilitator instead of the sandbox module.

## Why This Matters For Autonomous Agents

Agents need APIs they can discover, price, pay, and use without waiting for a person. Today, most APIs still assume humans manage subscriptions, dashboards, API keys, billing pages, and approvals.

This project points at a different model:

- agents discover paid capabilities directly
- APIs quote price at request time
- payment happens as part of the protocol
- access unlocks immediately after verification
- sellers can monetize per request, per dataset, per action, or per outcome

That is the infrastructure pattern behind autonomous monetized APIs.

## Current Status

- Public sandbox deployed on Render
- Seller wallet configured as a valid EVM address
- Base Sepolia and USDC advertised in discovery
- Real settlement intentionally disabled
- Readiness checker available through `npm.cmd run settlement:check`
- Live smoke test validates discovery, challenge, payment retry, and lead intelligence unlock

## Revenue Model Ideas

This kind of API could charge for:

- premium data records
- lead enrichment
- agent research calls
- compliance checks
- identity, risk, or scoring endpoints
- paid automation actions
- high-value workflow triggers

The likely early revenue model is simple pay-per-call pricing, then tiered pricing once usage patterns are clear. For example, `0.01` to `0.25` USDC per request for lightweight data, and higher prices for richer data, expensive compute, or high-intent business leads.

Revenue depends on traffic, data value, conversion quality, and trust. The demo does not prove revenue by itself; it proves that the payment rail and seller-side unlock mechanism can exist.
