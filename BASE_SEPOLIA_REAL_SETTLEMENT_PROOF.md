# Base Sepolia Real Settlement Proof

Date: May 22, 2026

## Milestone

The live x402nano seller completed a real x402 Base Sepolia facilitator dry run for the LeadNestAI premium lead intelligence endpoint.

This proves the current testnet settlement flow:

```txt
buyer discovers live x402 seller
-> seller returns 402 requirements
-> buyer signs Base Sepolia USDC payment
-> facilitator verifies and settles
-> paid lead intelligence pack unlocks
-> seller records receipt and unlock events
```

## Live Dry Run

- Resource server: `https://x402nano.onrender.com`
- Paid resource: `/api/lead-intelligence/premium-pack`
- Payment mode: `facilitator`
- Settlement mode: `facilitator-onchain`
- Facilitator: `https://x402.org/facilitator`
- Network: `eip155:84532` Base Sepolia
- Asset: Base Sepolia test USDC
- Price: `0.05 USDC`

## Captured Buyer Result

The real buyer script completed successfully:

```txt
buyer: 0x6B68002505ce0D56c7108C5e8c985b2f93972989
receipt: 026cad582b7216e3
settlement: facilitator-onchain
lead intelligence records: 3
```

## Balance Proof

Before the dry run, the dedicated buyer wallet held:

```txt
Base Sepolia ETH: 0.0001
Base Sepolia test USDC: 1
```

After settlement:

```txt
buyer Base Sepolia test USDC: 0.95
seller Base Sepolia test USDC: 0.05
```

The `0.05 USDC` testnet movement matches the protected endpoint price.

## Live Seller Events

The live seller event log recorded:

```txt
event: quote_issued
event: payment_attempted
event: payment_verified
event: receipt_generated
event: lead_pack_unlocked
receiptId: 026cad582b7216e3
settlement: facilitator-onchain
timestamp: 2026-05-22T18:22:27.597Z
```

## Fixes Proven By This Dry Run

1. The seller emits Base Sepolia USDC x402 v2 payment requirements with the token contract address, atomic amount, and EIP-712 domain metadata.
2. The seller accepts the v2 `PAYMENT-SIGNATURE` buyer retry path in addition to the sandbox-era `X-PAYMENT` contract.
3. The facilitator provider recognizes the v2 `isValid` verify response before settlement.

## Honest Claim

This proves one real x402 testnet payment unlock for LeadNestAI premium lead intelligence.

It does not yet mean the public demo should stay in facilitator mode or that Base mainnet revenue is enabled. Mainnet launch still requires a production facilitator path, pricing decision, seller-wallet review, public claims review, and a deliberate go-live checklist.
