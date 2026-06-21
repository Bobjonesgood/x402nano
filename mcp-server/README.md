# x402nano MCP Server

Local stdio MCP tools for structured prediction-market intelligence and probability-change monitoring.

The MCP process runs in the agent user's environment. Buyer keys remain local and are used only by the official x402 client. x402nano never receives or stores a buyer private key.

## Tools

| Tool | Price | Purpose |
| --- | ---: | --- |
| `list_trending_markets` | Free | Find market slugs before purchasing intelligence. |
| `get_market_pricing` | Free | Read current pricing and payment metadata. |
| `get_market_brief` | 0.05 USDC | Purchase one structured market brief. |
| `get_market_delta` | 0.05 USDC | Purchase one probability-change report since a prior check. |

Paid tools are restricted to `https://x402nano.onrender.com`, Base mainnet (`eip155:8453`), Base USDC, the pinned x402nano seller wallet, and exactly `50000` atomic units. Calls are serialized so one local MCP process cannot sign two paid requests simultaneously.

The default request timeout is 60 seconds to tolerate an occasional Render cold start. It can be adjusted from 5 to 120 seconds with `X402NANO_REQUEST_TIMEOUT_MS`.

## Install

Requirements: Node.js 22 or newer and a dedicated Base wallet funded only with the small amount of USDC you intend to spend.

```powershell
cd mcp-server
npm install
npm run build
npm run smoke
```

`npm run smoke` launches the MCP server through stdio, calls both free tools against production, validates the live Delta `402`, and stops before signing or paying.

## Verify Free Tools

Leave payments disabled. Run the MCP Inspector:

```powershell
$env:X402NANO_PAYMENT_ACK="PREFLIGHT_ONLY"
npm run inspect
```

Call `list_trending_markets` and `get_market_pricing`. Calling a paid tool in this mode checks the live unpaid `402` challenge but refuses to sign or pay.

## Configure an MCP Client

Point Claude Desktop, Cursor, or another stdio-capable MCP client at the built entrypoint. Use the absolute path on your machine:

```json
{
  "mcpServers": {
    "x402nano": {
      "command": "node",
      "args": ["C:/absolute/path/to/x402nano/mcp-server/dist/index.js"],
      "env": {
        "X402NANO_PAYMENT_ACK": "PREFLIGHT_ONLY",
        "X402NANO_MAX_PAYMENT_USDC": "0.05"
      }
    }
  }
}
```

Restart the MCP client after changing its configuration.

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
- Real payments require both a dedicated buyer key and the exact acknowledgement string.
- No key values are logged or returned through MCP.
