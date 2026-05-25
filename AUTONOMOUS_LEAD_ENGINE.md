# Autonomous Lead Engine

The live x402 paywall remains controlled by the existing Base mainnet settings:

```txt
X402_PAYMENT_MODE=facilitator
X402_NETWORK=eip155:8453
X402_ASSET=USDC
PRICE_USDC=0.05
SELLER_ADDRESS=0x4cc3831eB479aCFb6D44631d4a30814508Cf52d3
```

Do not put buyer keys on Render.

## Runtime Lead Pack

The server reads `PREMIUM_LEAD_PACK_JSON` at boot and can hot-refresh from:

```txt
LEAD_PACK_FILE=data/production-lead-pack.runtime.json
```

The autonomous worker writes that file atomically. The paid endpoint serves the
latest valid production pack after x402 payment verification.

## Worker Commands

Run one refresh:

```powershell
npm.cmd run leadengine:run
```

Run a persistent interval loop:

```powershell
npm.cmd run leadengine:loop
```

## Required Worker Env

Set explicit public real estate source URLs:

```txt
LEAD_ENGINE_SOURCE_URLS=https://example-public-directory.test/real-estate
LEAD_ENGINE_PACK_LIMIT=25
LEAD_ENGINE_MIN_CONFIDENCE=70
LEAD_ENGINE_INTERVAL_MS=21600000
LEAD_ENGINE_RESPECT_ROBOTS=true
LEAD_ENGINE_MERGE_EXISTING=true
```

Optional OpenAI-compatible free-credit inference:

```txt
AI_INFERENCE_URL=https://provider.example/v1/chat/completions
AI_API_KEY=<provider secret>
AI_MODEL=<low-cost/free-credit model>
```

If AI is not configured or fails, the worker falls back to deterministic public
page qualification so the pipeline remains zero out-of-pocket.

## LeadNestAI Handoff

Manual receipt-based handoff:

```txt
LEAD_HANDOFF_ENABLED=true
LEAD_HANDOFF_ON_UNLOCK=false
LEADNESTAI_API_URL=https://www.leadnestai.net
LEADNESTAI_INGEST_SECRET=<secret>
```

Automatic handoff after each paid unlock:

```txt
LEAD_HANDOFF_ENABLED=true
LEAD_HANDOFF_ON_UNLOCK=true
```

Automatic outreach remains disabled in the payload. The handoff only streams the
paid, unlocked lead data into LeadNestAI with an idempotency key.
