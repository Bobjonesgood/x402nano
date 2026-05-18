# Public Demo Kit

This is the share-ready kit for explaining the LeadNestAI machine-payable lead intelligence demo clearly and honestly.

Live demo:

```txt
https://x402nano.onrender.com
```

GitHub:

```txt
https://github.com/Bobjonesgood/x402nano
```

## 1. One-Sentence Version

LeadNestAI is a machine-payable lead intelligence demo: buyers and agents can discover a paid lead pack, accept a payment challenge, retry with payment, and unlock structured lead intelligence automatically.

## 2. Short Public Version

I built a LeadNestAI demo that shows how lead intelligence can be sold through a machine-payable API. It uses sandbox settlement today, so no real funds move yet, but the live flow proves discovery, payment challenge, payment retry, receipt generation, and protected lead intelligence unlock.

The commercial idea is simple: LeadNestAI is the product, and the x402-style payment flow is the infrastructure underneath it.

## 3. Longer Public Version

LeadNestAI is a proof-of-concept for machine-payable lead intelligence infrastructure.

Instead of a normal checkout page, the API itself can publish what it costs, reject unpaid access with `402 Payment Required`, accept an `X-PAYMENT` retry, verify the payment payload, generate a receipt, and unlock a structured premium lead intelligence pack.

The current public demo is intentionally sandboxed. No real funds move yet. That keeps the project safe and honest while proving the workflow that would later connect to real facilitator settlement.

What matters is the shape of the system:

- agents can discover the API
- the seller API can price the resource
- unpaid requests get a payment challenge
- paid retries unlock protected data
- receipts and event logs make the flow observable
- the commercial value is visible as lead intelligence, not just protocol mechanics

## 4. 60-Second Demo Script

Use this when recording a short video or walking someone through the project.

```txt
This is LeadNestAI, a machine-payable lead intelligence demo.

The paid resource is a premium lead intelligence pack. It includes business names, location, industry, buying intent, estimated job value, pain points, recommended opener, and confidence score.

First, an agent or buyer discovers the API through the x402 manifest.

When it requests the protected lead pack without payment, the seller API returns 402 Payment Required with the price and payment requirements.

Then the buyer retries with an X-PAYMENT payload.

The API verifies that payment payload, generates a receipt, and unlocks the lead intelligence pack.

This public version is sandbox settlement, so no real funds move yet. The point is to prove the business workflow and the machine-payable API architecture before turning on real settlement.
```

## 5. Live Walkthrough Checklist

1. Open the live app.
2. Point to the headline and explain: machine-payable lead intelligence infrastructure.
3. Show the "How LeadNestAI Works" flow.
4. Show what the payment unlocks.
5. Click the unlock/request button.
6. Show the receipt panel.
7. Show the protocol trace.
8. Show the unlocked lead intelligence cards.
9. Explain that sandbox settlement is on purpose.
10. Optional: open `/.well-known/x402.json` or `/api/version` to show the API proof.

## 6. Screenshot Checklist

Capture these for GitHub, social posts, messages, or a pitch page:

- homepage top with the LeadNestAI value statement
- "How LeadNestAI Works" section
- "what payment unlocks" section
- locked lead pack state
- payment challenge or protocol trace
- receipt panel after unlock
- unlocked premium lead intelligence cards
- settlement readiness panel
- latest proof transcript in `proofs/latest-demo-run.md`
- `/api/version` response from the live deployment

Current screenshot assets live here:

```txt
assets/screenshots/
```

## 7. Honest Sandbox Language

Use this language when explaining the current state:

```txt
This is sandbox settlement. No real funds move.
```

```txt
The live demo proves the discovery, payment challenge, payment retry, receipt, and unlock workflow. It does not claim production settlement revenue yet.
```

```txt
Real settlement is prepared through a dry-run checklist, but it is not enabled in the public demo.
```

## 8. What Not To Claim Yet

Do not claim these until they are actually true:

- real revenue
- mainnet settlement
- production compliance
- real commercial lead-source coverage
- guaranteed customers or jobs
- passive income
- autonomous marketplace operation
- fully production-ready wallet settlement

The strongest position is the honest one: this is a live, sandboxed, machine-payable commercial proof-of-concept.

## 9. Who To Show First

Good first audiences:

- home-service business owners who understand lead value
- small agencies or lead sellers
- technical builders interested in agent-payable APIs
- local operators who buy or sell job opportunities
- people who can explain what would make a lead more useful
- developer and startup communities interested in x402-style infrastructure

## 10. Feedback Questions

Ask these after showing the demo:

- Can you explain what unlocks after payment?
- Did you understand that this is sandbox settlement?
- Would this lead format be useful to a service business?
- What field would make the lead pack more valuable?
- Would a business prefer pay-per-pack or a monthly feed?
- What confused you in the first 60 seconds?
- What would make this feel more trustworthy?

## 11. How To Talk About x402

Keep the public explanation simple:

```txt
LeadNestAI is the user-facing product. The x402-style payment flow is the infrastructure layer underneath it.
```

For non-technical people, lead with the business value:

```txt
The API can charge for lead intelligence and unlock it automatically after payment.
```

For technical people, explain the flow:

```txt
Discovery manifest -> 402 Payment Required -> X-PAYMENT retry -> verification -> receipt -> protected data unlock.
```

## 12. Share Packet

Use these links when sending the project to someone:

```txt
Live demo:
https://x402nano.onrender.com

GitHub:
https://github.com/Bobjonesgood/x402nano

Trust statement:
TRUST.md

Latest proof:
proofs/latest-demo-run.md

Architecture:
ARCHITECTURE.md

Payment flow:
PAYMENT_FLOW.md

API overview:
API_OVERVIEW.md
```

## 13. Next Public Asset

The next best proof asset is a short screen recording:

- 45 to 90 seconds
- no deep protocol lecture
- show the locked lead pack
- show the payment challenge/unlock
- show the receipt
- show the lead intelligence cards
- say clearly that settlement is sandboxed today

The goal is not to impress people with complexity. The goal is for a stranger to understand the product in under one minute.

Use the recording checklist before capturing a walkthrough:

```txt
DEMO_RECORDING_CHECKLIST.md
```

Use the social asset sheet when writing posts or captions:

```txt
SOCIAL_DEMO_ASSETS.md
```

Use the feedback sheet after showing the demo:

```txt
FIRST_VIEWER_FEEDBACK.md
```
