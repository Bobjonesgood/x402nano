# Trust Statement

This project follows one rule:

```txt
Real proof. Clear boundaries. No fake claims.
```

## Proven

- The x402 seller publishes discovery and price metadata.
- Unpaid protected access returns `402 Payment Required`.
- The seller accepts the `X-PAYMENT` retry contract and returns receipts after verification.
- Base Sepolia facilitator settlement was proven with test USDC.
- A live x402 unlock can hand a selected record into LeadNestAI with dedupe and no automatic outreach.
- The live mainnet seller now exposes a reviewed production lead pack and a Base mainnet payment challenge.

## Not Proven Yet

- A customer has paid for the Base mainnet pack.
- A controlled self-test mainnet paid unlock has completed.
- Market demand, retention, refunds, compliance posture, and scaling economics are solved.

## Product Boundary

The built-in demo pack cannot be charged on Base mainnet. Mainnet product mode requires production records with reviewed source metadata:

```txt
sourceType
sourceUrls
sourceEvidence
reviewedAt
```

The current starter pack uses public official-business-site fit signals. It does not claim that listed businesses have agreed to buy anything.

## Safety Boundary

- Buyer private keys stay local.
- Render stores seller-side configuration only.
- LeadNestAI handoff stays manual and selected-lead-only.
- Automatic outreach remains outside this first paid-endpoint launch.

## Verify

```powershell
npm.cmd run settlement:check
```

Read:

```txt
MAINNET_LAUNCH_CHECKLIST.md
PRODUCTION_LEAD_PACK.md
BASE_SEPOLIA_REAL_SETTLEMENT_PROOF.md
X402_TO_LEADNESTAI_LIVE_PROOF.md
```
