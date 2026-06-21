# x402nano MCP Production Proof Log

## Verification Result

The local x402nano stdio MCP server completed a real machine-to-machine Market Delta purchase on Base mainnet. The MCP client discovered the tool, validated the live payment challenge, signed with a dedicated local buyer wallet, paid exactly 0.05 USDC, and received the unlocked structured Delta response.

Verified on: `2026-06-21`

## On-Chain Settlement

| Field | Verified value |
| --- | --- |
| x402nano receipt | `ceb0089b0e4d1441` |
| Base transaction | [`0x167777729887fc5b299ab1aead024872ce171490729dd16e575b7a2ba6e96fef`](https://basescan.org/tx/0x167777729887fc5b299ab1aead024872ce171490729dd16e575b7a2ba6e96fef) |
| Amount | `0.05 USDC` (`50000` atomic units) |
| Network | `eip155:8453` (Base mainnet) |
| Settlement | `facilitator-onchain` |
| Settled at | `2026-06-21T13:12:31.689Z` |
| Buyer | `0x09e99EabeCFAfdF6A6bF24681369394da6B8540f` |
| Seller | `0x4cc3831eB479aCFb6D44631d4a30814508Cf52d3` |
| Buyer balance | `0.75 USDC` before, `0.70 USDC` after |

Protected resource:

```text
/api/markets/delta?slug=will-gideon-saar-be-the-next-prime-minister-of-israel&since=2026-06-21T12%3A12%3A26.887Z
```

## Unlocked MCP Result

The `get_market_delta` MCP tool returned:

```json
{
  "status": "unlocked",
  "receiptId": "ceb0089b0e4d1441",
  "amount": "0.05",
  "asset": "USDC",
  "network": "eip155:8453",
  "briefType": "read-only-market-delta",
  "marketSlug": "will-gideon-saar-be-the-next-prime-minister-of-israel",
  "repeatCheckPriority": "low",
  "windowUntil": "2026-06-21T13:12:03.000Z"
}
```

## Confirmed Seller Events

The public seller event log recorded all required proof events for receipt `ceb0089b0e4d1441`:

| Event | Timestamp |
| --- | --- |
| `payment_verified` | `2026-06-21T13:12:31.689Z` |
| `receipt_generated` | `2026-06-21T13:12:31.690Z` |
| `market_delta_unlocked` | `2026-06-21T13:12:32.162Z` |

## MCP and Dependency Verification

- All four tools were discovered through the stdio transport: `list_trending_markets`, `get_market_pricing`, `get_market_brief`, and `get_market_delta`.
- Both free tools returned clean structured JSON from production.
- The unpaid Delta challenge was validated before signing.
- Nine automated tests passed, including exact-price rejection and payment-signature header preservation.
- `npm audit --omit=dev` reported `0 vulnerabilities` after installation.

## Local Safety Properties

- The buyer private key remained in the local process environment and was never sent to x402nano, committed, printed, or included in this proof.
- The payment authorization existed only for the controlled proof process and disappeared when that process exited.
- The API origin is restricted to the exact HTTPS host `x402nano.onrender.com`.
- Redirects are not followed.
- Paid calls are restricted to the direct Market Brief and Market Delta routes.
- Payments are restricted to Base mainnet and the Base USDC contract.
- The seller wallet is pinned to the direct x402nano seller address.
- A paid call must request exactly 0.05 USDC and remain within the local 0.05 USDC cap.
- Real payment requires the exact `PAY_REAL_0.05_USDC` acknowledgement and a locally supplied dedicated buyer key.
- Paid tool calls are serialized within each MCP process.

## Product Boundary

x402nano remains read-only, non-custodial, and informational. The MCP tool does not trade, place bets, manage positions, hold buyer funds, or provide financial advice.

## Post-Proof Safety Hardening

After the production proof, the local MCP client added conservative cumulative controls for broader use:

- One paid attempt per process by default.
- A 0.05 USDC session budget by default.
- A persistent 0.05 USDC UTC-day budget by default.
- Budget reservation before payment signing.
- Fail-closed behavior for corrupt ledger data.
- A hard 5.00 USDC ceiling on configurable cumulative budgets.

These controls do not modify the verified x402nano backend, payment price, seller wallet, or endpoint behavior.
