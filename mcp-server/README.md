# x402nano MCP Server

MCP tools for structured prediction-market intelligence and probability-change monitoring.

## Public Remote Server

Connect a Streamable HTTP MCP client to:

```txt
https://x402nano.onrender.com/mcp
```

The registry manifest is published at `https://x402nano.onrender.com/server.json`. Free tools work with ordinary Streamable HTTP MCP clients. Paid tools require an x402-aware MCP client that places the signed payment payload in MCP request metadata. The official `@x402/mcp` package provides this client wrapper.

The remote server holds only the seller and facilitator configuration already used by x402nano. It never holds buyer keys. The caller creates the payment locally, and successful calls settle 0.05 USDC directly to the pinned x402nano seller wallet on Base.

The local stdio implementation below remains available for agents that prefer to run the buyer-side payment client themselves.

The MCP process runs in the agent user's environment. Buyer keys remain local and are used only by the official x402 client. x402nano never receives or stores a buyer private key.

## Agent Quickstart

1. Find `io.github.Bobjonesgood/x402nano` in the MCP Registry, or read `https://x402nano.onrender.com/server.json`.
2. Connect a Streamable HTTP MCP client to `https://x402nano.onrender.com/mcp`.
3. List tools and confirm `list_trending_markets`, `get_market_pricing`, `get_market_brief`, and `get_market_delta`.
4. Call `list_trending_markets` to pick a market slug.
5. Call `get_market_pricing` to confirm Base mainnet, USDC, seller, and tool prices.
6. Use an x402-aware MCP client before calling `get_market_brief` or `get_market_delta` for real paid content.

Free clients can discover tools and call the free tools. Paid calls require a locally held buyer key, an x402 payment payload, and the caller's explicit payment configuration. x402nano does not custody buyer funds or store buyer keys.

## Tools

| Tool | Price | Purpose |
| --- | ---: | --- |
| `list_trending_markets` | Free | Find market slugs before purchasing intelligence. |
| `get_market_pricing` | Free | Read current pricing and payment metadata. |
| `get_market_brief` | 0.05 USDC | Purchase one structured market brief. |
| `get_market_delta` | 0.05 USDC | Purchase one probability-change report since a prior check. |

Paid tools are restricted to `https://x402nano.onrender.com`, Base mainnet (`eip155:8453`), Base USDC, the pinned x402nano seller wallet, and exactly `50000` atomic units. Calls are serialized so one local MCP process cannot sign two paid requests simultaneously.

Paid tools also use conservative cumulative budgets. By default, one MCP process may attempt one 0.05 USDC payment, and the persistent UTC-day budget is also 0.05 USDC. A budget reservation is written before signing, so an interrupted or uncertain request cannot automatically spend again. Restarting the process does not reset the daily limit.

The default request timeout is 60 seconds to tolerate an occasional Render cold start. It can be adjusted from 5 to 120 seconds with `X402NANO_REQUEST_TIMEOUT_MS`.

The budget ledger defaults to `%LOCALAPPDATA%\x402nano\mcp-payment-budget.json` on Windows and `~/.x402nano/mcp-payment-budget.json` elsewhere. It contains payment-attempt amounts, timestamps, and resource URLs, but no wallet key or signed payment payload.

## Production Verification

The complete MCP-to-x402 payment loop was verified live on Base mainnet with one 0.05 USDC Market Delta purchase. See [PROVE_LOG.md](PROVE_LOG.md) for the transaction, receipt, seller events, dependency audit, and local safety evidence.

## Install

Requirements: Node.js 22 or newer and a dedicated Base wallet funded only with the small amount of USDC you intend to spend.

```powershell
cd mcp-server
npm.cmd install
npm.cmd run build
npm.cmd run smoke
```

`npm.cmd run smoke` launches the MCP server through stdio, calls both free tools against production, validates the live Delta `402`, and stops before signing or paying.

## Verify Free Tools

Leave payments disabled. Run the MCP Inspector:

```powershell
$env:X402NANO_PAYMENT_ACK="PREFLIGHT_ONLY"
npm.cmd run inspect
```

Call `list_trending_markets` and `get_market_pricing`. Calling a paid tool in this mode checks the live unpaid `402` challenge but refuses to sign or pay.

## Configure an MCP Client

### TypeScript Agent

Install the production MCP client SDK in the agent project:

```powershell
npm.cmd install @modelcontextprotocol/sdk
```

Launch the local stdio server from the agent while inheriting payment credentials from the agent process environment:

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: "C:\\Program Files\\nodejs\\node.exe",
  args: [
    "C:\\Users\\bobjo\\Documents\\Codex\\2026-05-17\\ok-ive-already-built-a-x402\\mcp-server\\dist\\index.js"
  ],
  env: Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined)
  )
});

const client = new Client({ name: "x402nano-agent", version: "1.0.0" });
await client.connect(transport);

const markets = await client.callTool({
  name: "list_trending_markets",
  arguments: { limit: 3 }
});

const delta = await client.callTool({
  name: "get_market_delta",
  arguments: {
    slug: "will-gideon-saar-be-the-next-prime-minister-of-israel",
    since: new Date(Date.now() - 60 * 60 * 1000).toISOString()
  }
});

await client.close();
```

The custom agent should receive `X402NANO_PAYMENT_ACK`, `X402NANO_MAX_PAYMENT_USDC`, and `X402NANO_BUYER_PRIVATE_KEY` from its own local secret manager or process environment. Do not hard-code the buyer key in source code.

Keep these cumulative controls at their defaults for a controlled installation:

```text
X402NANO_SESSION_MAX_CALLS=1
X402NANO_SESSION_MAX_USDC=0.05
X402NANO_DAILY_MAX_USDC=0.05
```

Increasing a cumulative limit is a deliberate operator decision. The implementation enforces a hard ceiling of 5.00 USDC and never raises a limit automatically.

## Authorize One Real Delta Call

Use a dedicated, minimally funded Base wallet. Never place the key in the repository, a chat message, logs, or a hosted environment.

Set these values only in the local MCP client environment:

```json
{
  "X402NANO_PAYMENT_ACK": "PAY_REAL_0.05_USDC",
  "X402NANO_MAX_PAYMENT_USDC": "0.05",
  "X402NANO_BUYER_PRIVATE_KEY": "0xYOUR_DEDICATED_BUYER_PRIVATE_KEY"
}
```

Then call `get_market_delta` once with:

```json
{
  "slug": "will-gideon-saar-be-the-next-prime-minister-of-israel",
  "since": "2026-06-20T00:00:00.000Z"
}
```

Immediately return `X402NANO_PAYMENT_ACK` to `PREFLIGHT_ONLY` after the proof call. The tool returns the unlocked JSON and receipt metadata. It does not trade, place bets, hold funds, or provide financial advice.

## Safety Policy

- Exact production HTTPS host only; redirects are not followed.
- Paid routes limited to Market Brief and Market Delta.
- Base mainnet and Base USDC only.
- Seller wallet pinned to x402nano's direct seller address.
- Exact price must be 0.05 USDC and must not exceed the local cap.
- Default session limit is one paid attempt and 0.05 USDC.
- Default persistent UTC-day limit is 0.05 USDC across process restarts.
- Budget is reserved before signing and invalid ledger data fails closed.
- Cumulative limits cannot be configured above the 5.00 USDC hard ceiling.
- Real payments require both a dedicated buyer key and the exact acknowledgement string.
- No key values are logged or returned through MCP.
