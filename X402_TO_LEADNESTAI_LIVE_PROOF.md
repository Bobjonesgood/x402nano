# x402 To LeadNestAI Live Proof

Date: May 22, 2026

## Milestone

The live sandbox bridge between x402nano and LeadNestAI successfully stored a selected premium lead in LeadNestAI.

This proves the current controlled workflow:

```txt
x402 premium lead pack unlock
-> manual selected lead handoff
-> authenticated LeadNestAI ingest
-> LeadNestAI storage
-> logged handoff result
```

## Live Systems

- x402 sender: `https://x402nano.onrender.com`
- LeadNestAI receiver: `https://www.leadnestai.net/api/integrations/x402/leads`
- x402 sender mode: `manual-selected-leads-only`
- payment mode during proof: `sandbox`
- automatic outreach during proof: `false`

## Captured Success

The live x402 event log captured this successful handoff result before later Render restarts cleared the in-memory event buffer:

```txt
event: lead_handoff_succeeded
status: stored
statusCode: 201
receiptId: adff34c4ad4e331e
externalLeadId: lnai_pack_001
leadId: 2e418bb5-7b8a-46db-aafe-56987dda0cd9
duplicate: false
target: https://www.leadnestai.net
timestamp: 2026-05-22T15:27:17.831Z
```

The stored LeadNestAI lead was then confirmed in the LeadNestAI/Supabase side of the bridge.

## What Was Verified

- x402 unlocked a sandbox LeadNestAI premium lead pack after the protected API payment flow.
- A single selected lead was handed off manually from the unlocked pack.
- LeadNestAI accepted the bearer-authenticated ingest request.
- LeadNestAI returned a stored lead id.
- x402 logged the successful handoff.
- The live bridge stayed separated from real funds.
- Automatic outreach remained disabled.

## Issues Resolved During The Live Test

1. The sender and receiver shared secret values were aligned and checked with non-secret fingerprints.
2. The x402 sender now trims configured LeadNestAI env values before sending bearer auth.
3. The sender now targets the canonical `www.leadnestai.net` receiver URL so the ingest request does not lose its bearer header on an apex-domain redirect.

## Honest Claim

This is a working sandbox payment-aware lead intelligence ingestion pipeline.

It does not yet prove real-funds settlement or automatic outreach. It proves the controlled bridge:

```txt
payment-aware unlock layer -> LeadNestAI workflow intake layer
```
