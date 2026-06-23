import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const endpoint = process.env.X402NANO_MCP_URL ?? "http://127.0.0.1:4021/mcp";
const client = new Client({ name: "x402nano-remote-smoke", version: "1.0.0" });
const transport = new StreamableHTTPClientTransport(new URL(endpoint));

try {
  await client.connect(transport);
  const listed = await client.listTools();
  const toolNames = listed.tools.map(tool => tool.name).sort();
  assert.deepEqual(toolNames, [
    "get_market_brief",
    "get_market_delta",
    "get_market_pricing",
    "list_trending_markets"
  ]);

  const pricing = await client.callTool({ name: "get_market_pricing", arguments: {} });
  const pricingBody = JSON.parse(pricing.content[0].text);
  assert.equal(pricingBody.tools.get_market_brief.priceUsdc, "0.05");
  assert.equal(pricingBody.network, "eip155:8453");

  const unpaid = await client.callTool({
    name: "get_market_brief",
    arguments: { slug: "will-gideon-saar-be-the-next-prime-minister-of-israel" }
  });
  const unpaidText = unpaid.content.map(item => item.type === "text" ? item.text : "").join("\n");
  assert.equal(unpaid.isError, true);
  assert.match(unpaidText, /x402\/error|payment required/i);
  assert.match(unpaidText, /50000/);
  assert.doesNotMatch(unpaidText, /"status":\s*"ok"/);

  console.log(JSON.stringify({
    status: "ok",
    endpoint,
    transport: "streamable-http",
    tools: toolNames,
    unpaidPaidTool: "payment-required",
    amountAtomic: "50000",
    paidContentLeaked: false
  }, null, 2));
} finally {
  await client.close();
}

