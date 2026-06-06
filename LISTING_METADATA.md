# x402nano Listing Metadata

Use this file for Agentic.Market, x402scan, x402 ecosystem directories, GitHub lists, and builder-community submissions.

## Service

```txt
Name: x402nano
Category: Machine-payable market intelligence API
One-line description: Polymarket intelligence for autonomous agents, paid per brief with x402.
Long description: x402nano is a live x402-protected Polymarket market intelligence API. Agents can inspect free trending markets, request a paid read-only market brief, receive an HTTP 402 challenge, retry with X-PAYMENT, pay 0.05 USDC on Base mainnet, and unlock structured JSON plus a receipt.
```

## URLs

```txt
Live app: https://x402nano.onrender.com
x402 discovery: https://x402nano.onrender.com/.well-known/x402.json
Free route: https://x402nano.onrender.com/api/markets/trending
Paid route: https://x402nano.onrender.com/api/markets/brief?slug=will-gideon-saar-be-the-next-prime-minister-of-israel
Pricing: https://x402nano.onrender.com/api/pricing
Schema: https://x402nano.onrender.com/api/schema
Proof tx: https://basescan.org/tx/0x54ba49a288a56d20046c25f4496bec405f2eefc05fe413cd511caf96227911b1
```

## Payment Metadata

```txt
Payment standard: x402
Payment flow: HTTP 402 -> X-PAYMENT -> Base USDC -> unlocked JSON
Network: Base mainnet
Network id: eip155:8453
Asset: USDC
Price: 0.05 USDC
Seller wallet: 0x4cc3831eB479aCFb6D44631d4a30814508Cf52d3
Payment header: X-PAYMENT
Scheme: exact
```

## Proof Metadata

```txt
Proof status: real mainnet unlock completed
Receipt id: f1ffa2f5cabf94c3
Proof amount: 0.05 USDC
Proof transaction: 0x54ba49a288a56d20046c25f4496bec405f2eefc05fe413cd511caf96227911b1
Proof chain: Base mainnet
Proof result: HTTP 402 challenge, X-PAYMENT retry, receipt generated, market brief JSON unlocked, on-chain USDC transfer confirmed.
```

## Suggested Tags

```txt
x402
base
usdc
polymarket
market-intelligence
ai-agents
autonomous-agents
api
machine-payable
http-402
read-only
```

## Safety And Scope

```txt
Read-only market intelligence.
Informational only.
No trading execution.
No custody.
No betting advice.
No buy/sell recommendations.
No guaranteed outcomes.
No user accounts.
No API keys.
```

## Agentic.Market Listing Text

```txt
x402nano is a machine-payable Polymarket market intelligence API for autonomous agents and bots.

Agents can call a free trending endpoint, choose a market slug, then request a paid read-only market brief. The paid route returns an HTTP 402 challenge and unlocks structured JSON after a valid X-PAYMENT retry. Price is 0.05 USDC on Base mainnet.

This is informational market context only: no custody, no trading execution, no betting advice, and no buy/sell recommendations.

Live proof: receipt f1ffa2f5cabf94c3 and Base transaction 0x54ba49a288a56d20046c25f4496bec405f2eefc05fe413cd511caf96227911b1.
```

## x402scan Submission Text

```txt
x402nano is a live x402-protected Polymarket intelligence API.

Free route:
GET https://x402nano.onrender.com/api/markets/trending

Paid route:
GET https://x402nano.onrender.com/api/markets/brief?slug=will-gideon-saar-be-the-next-prime-minister-of-israel

Payment:
0.05 USDC on Base mainnet via HTTP 402 and X-PAYMENT.

Proof:
Receipt f1ffa2f5cabf94c3
https://basescan.org/tx/0x54ba49a288a56d20046c25f4496bec405f2eefc05fe413cd511caf96227911b1

Scope:
Read-only market intelligence for agents and bots. No custody, no trading execution, no betting advice, no buy/sell recommendations.
```

## GitHub Repository Description

```txt
Machine-payable Polymarket intelligence API for autonomous agents: HTTP 402, X-PAYMENT, 0.05 USDC on Base, unlocked read-only JSON briefs.
```

## Pinned X Post

```txt
I shipped x402nano: machine-payable Polymarket intelligence for autonomous agents.

Free:
GET /api/markets/trending

Paid:
GET /api/markets/brief?slug=...

Flow:
HTTP 402 -> X-PAYMENT -> 0.05 USDC on Base -> unlocked JSON + receipt

No account.
No API key.
No custody.
No trading advice.

Mainnet proof:
Receipt: f1ffa2f5cabf94c3
Tx: https://basescan.org/tx/0x54ba49a288a56d20046c25f4496bec405f2eefc05fe413cd511caf96227911b1

Live:
https://x402nano.onrender.com

Looking for agent/API builders to test whether this is useful enough to pay for repeatedly.
```
