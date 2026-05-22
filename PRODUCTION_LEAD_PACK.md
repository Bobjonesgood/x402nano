# Production Lead Pack

This file defines the first paid-resource data boundary for:

```txt
GET /api/lead-intelligence/premium-pack
```

The first mainnet pack should be small, reviewed, and honest. A buyer should receive lead intelligence that has public source evidence and a clear explanation of what is known versus inferred.

## Required Record Shape

Production mode requires every record in `PREMIUM_LEAD_PACK_JSON` to include:

```txt
id
businessName
industry
location
estimatedJobValue
buyingIntent
painPoints
recommendedOpener
confidenceScore
sourceType
sourceUrls
sourceEvidence
reviewedAt
```

`sourceUrls` and `sourceEvidence` must be non-empty arrays.

Recommended extra field:

```txt
contactPolicy
```

Use `contactPolicy` to keep outreach claims and handling rules visible beside the data.

## Honest Meaning

For this starter pack:

- `buyingIntent` means a public fit signal, not a confirmed buying decision.
- `confidenceScore` means confidence that the business matches the LeadNestAI workflow use case.
- `estimatedJobValue` is a qualification note unless a reviewed source supports a tighter number.
- `sourceEvidence` should summarize what the public source actually showed.

Do not sell:

- fabricated leads
- scraped private data
- personal contact details you are not prepared to handle lawfully
- claims that the business has agreed to buy anything when it has not

## Starter Pack

The reviewed starter file is:

```txt
data/production-lead-pack.starter.json
```

It contains three official-website-sourced candidate records for the first paid pack review:

- Arrowhead Roofing in Tulsa
- Walkers Painting Inc. in Knoxville
- Squeaky Clean in Savannah

Review each record immediately before launch. If a source changes, update or remove the record.

## Prepare Render Value

Validate and print the minified environment value:

```powershell
npm.cmd run leadpack:prepare
```

That command reads the starter file by default. To prepare another reviewed pack:

```powershell
$env:LEAD_PACK_FILE="C:\path\to\reviewed-pack.json"
npm.cmd run leadpack:prepare
```

The command prints the JSON value for:

```txt
PREMIUM_LEAD_PACK_JSON
```

Do not commit secrets with the pack. Public source URLs and reviewed lead-intelligence notes are acceptable only when you are comfortable selling that specific pack.
