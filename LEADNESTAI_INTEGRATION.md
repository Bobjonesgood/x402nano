# LeadNestAI Integration

This is the first controlled bridge between the x402 unlock layer and the LeadNestAI workflow layer.

The goal is not to start a new build. The goal is to connect two existing systems in the safest minimal way.

```txt
x402 unlocks premium lead intelligence
-> selected lead is manually sent to LeadNestAI
-> LeadNestAI receives it
-> LeadNestAI deduplicates it
-> LeadNestAI stores it
-> handoff event is logged
-> no real funds yet
-> no automatic outreach yet
```

## System Roles

```txt
x402 = payment-aware lead unlock layer
LeadNestAI = lead workflow and automation layer
```

## x402 Endpoint

The browser calls the x402 server:

```txt
POST /api/leadnestai/handoff
```

Request:

```json
{
  "receiptId": "receipt-id-from-unlock",
  "externalLeadId": "lnai_pack_001"
}
```

The x402 server validates:

- current mode is sandbox
- the receipt exists
- the selected lead exists in the unlocked premium pack

Then it forwards the selected lead to LeadNestAI.

## LeadNestAI Endpoint

LeadNestAI should expose:

```txt
POST /api/integrations/x402/leads
Authorization: Bearer {LEADNESTAI_INGEST_SECRET}
```

## Payload Fields

The forwarded payload includes:

```txt
source
receiptId
unlockMode
externalLeadId
businessName
industry
location
estimatedJobValue
buyingIntent
painPoints
recommendedOpener
confidenceScore
idempotencyKey
dedupeKey
workflow.startAutomaticOutreach=false
workflow.mode=manual-verification-first
```

## Dedupe Rules

Primary idempotency key:

```txt
source + receiptId + externalLeadId
```

Business identity fallback:

```txt
businessName + location + industry
```

If either matches an existing LeadNestAI record, return:

```json
{
  "status": "duplicate",
  "duplicate": true,
  "leadId": "existing-lead-id"
}
```

## x402 Logs

The x402 server logs:

```txt
lead_handoff_attempted
lead_handoff_succeeded
lead_handoff_failed
```

## LeadNestAI Logs

LeadNestAI should log:

```txt
x402_lead_received
x402_lead_duplicate
x402_lead_stored
workflow_started
```

For this first version, `workflow_started` means normal intake/workflow handling only. It must not trigger automatic outreach yet.

## Environment Variables

x402 side:

```txt
LEAD_HANDOFF_ENABLED=false
LEADNESTAI_API_URL=
LEADNESTAI_INGEST_SECRET=
LEADNESTAI_SOURCE_ID=x402nano
```

LeadNestAI side:

```txt
X402_INGEST_SECRET=
X402_INGEST_ENABLED=true
```

## Local Test

Run:

```powershell
npm.cmd run leadnestai:test
```

The test starts:

- x402 seller server on `http://127.0.0.1:4121`
- mock LeadNestAI receiver on `http://127.0.0.1:5055`

Then it verifies:

- sandbox unlock works
- selected lead handoff stores one lead
- duplicate handoff does not create a second lead
- x402 handoff logs are present
- LeadNestAI receive/store/duplicate/workflow logs are present

## Live Test

After local testing passes, configure Render:

```txt
LEAD_HANDOFF_ENABLED=true
LEADNESTAI_API_URL=https://leadnestai.net
LEADNESTAI_INGEST_SECRET=<shared-secret>
LEADNESTAI_SOURCE_ID=x402nano
```

Then:

1. Open `https://x402nano.onrender.com`.
2. Unlock the premium lead pack.
3. Click `Send to LeadNestAI` on one selected lead.
4. Confirm LeadNestAI receives or deduplicates it.
5. Confirm `/api/events` shows the handoff events.
6. Do not enable automatic outreach until the handoff has been verified cleanly.

## Scope Guardrails

- Sandbox only.
- Manual selected lead only.
- No real settlement.
- No automatic outreach yet.
- No marketplace behavior.
- No unrelated automation expansion.
