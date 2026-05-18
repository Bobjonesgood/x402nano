# Demo Recording Checklist

Use this when recording a short walkthrough of the LeadNestAI public demo.

The goal is simple: a stranger should understand the product, the unlock flow, and the honest sandbox status in under 90 seconds.

## 1. Before Recording

Run the live checks:

```powershell
npm.cmd run settlement:check
$env:AGENT_API_ORIGIN="https://x402nano.onrender.com"
npm.cmd run smoke
npm.cmd run demo:record
```

Confirm:

- live app opens at `https://x402nano.onrender.com`
- settlement mode says sandbox
- seller wallet displays correctly
- premium lead pack starts locked
- unlock button is visible without scrolling too far
- protocol trace and receipt panel are readable
- latest proof exists at `proofs/latest-demo-run.md`

## 2. Screen Setup

- Use a clean browser window.
- Zoom around 100 percent unless text is too small.
- Keep the page width close to a normal laptop view.
- Hide unrelated tabs, bookmarks, and notifications.
- Do one silent practice run before recording.

## 3. Recording Flow

1. Start on the top of the live page.
2. Say: "This is LeadNestAI, a machine-payable lead intelligence demo."
3. Point out the simple workflow: discover, request, pay, unlock.
4. Explain what is locked: a premium lead intelligence pack.
5. Click `Unlock Premium Lead Pack`.
6. Show the receipt panel.
7. Show the protocol trace.
8. Show the unlocked lead intelligence cards.
9. Say clearly: "This public demo uses sandbox settlement, so no real funds move yet."
10. End with the value: "The point is paid lead intelligence that software agents can discover and unlock automatically."

## 4. Words To Use

Good simple phrases:

```txt
machine-payable lead intelligence
paid API resource
premium lead pack
sandbox settlement
payment challenge
X-PAYMENT retry
receipt generated
protected data unlocked
```

## 5. Words To Avoid

Avoid claims that make the demo sound like something it is not yet:

```txt
real revenue
mainnet production
passive income
fully autonomous business
guaranteed customers
real lead marketplace
production wallet settlement
```

## 6. First-Time Viewer Confusion Points

Watch for these when people react:

- Do they understand what data is being unlocked?
- Do they understand that x402 is infrastructure, not the main product?
- Do they understand sandbox means no real funds?
- Do they understand why an API would return `402 Payment Required`?
- Do they notice the receipt and proof trail?
- Do they see how this could become useful for lead sellers or service businesses?

## 7. After Recording

Save the recording with a clear name:

```txt
leadnestai-machine-payable-demo.mp4
```

Then write down:

- what confused you during the recording
- what part felt strongest
- what screen looked too crowded
- what viewers asked first
- what wording made the demo easier to understand
