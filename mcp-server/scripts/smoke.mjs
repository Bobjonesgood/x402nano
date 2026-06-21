import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const env = Object.fromEntries(Object.entries(process.env).filter(([, value]) => value !== undefined));
env.X402NANO_PAYMENT_ACK = "PREFLIGHT_ONLY";
env.X402NANO_REQUEST_TIMEOUT_MS = "120000";
delete env.X402NANO_BUYER_PRIVATE_KEY;

const requestOptions = { timeout: 130000 };

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [new URL("../dist/index.js", import.meta.url).pathname.replace(/^\/(?:([A-Za-z]:))/, "$1")],
  env
});
const client = new Client({ name: "x402nano-smoke", version: "0.1.0" });

try {
  await client.connect(transport);
  const tools = await client.listTools();
  const names = tools.tools.map(tool => tool.name).sort();
  const expected = ["get_market_brief", "get_market_delta", "get_market_pricing", "list_trending_markets"].sort();
  if (JSON.stringify(names) !== JSON.stringify(expected)) throw new Error(`Unexpected MCP tools: ${names.join(", ")}`);

  const trending = await client.callTool({ name: "list_trending_markets", arguments: { limit: 1 } }, undefined, requestOptions);
  if (trending.isError) throw new Error(`list_trending_markets returned an MCP error: ${JSON.stringify(trending.content)}`);

  const pricing = await client.callTool({ name: "get_market_pricing", arguments: {} }, undefined, requestOptions);
  if (pricing.isError) throw new Error(`get_market_pricing returned an MCP error: ${JSON.stringify(pricing.content)}`);

  const delta = await client.callTool({
    name: "get_market_delta",
    arguments: {
      slug: "will-gideon-saar-be-the-next-prime-minister-of-israel",
      since: new Date(Date.now() - 60 * 60 * 1000).toISOString()
    }
  }, undefined, requestOptions);
  const deltaMessage = delta.content?.[0]?.type === "text" ? delta.content[0].text : "";
  if (!delta.isError || !deltaMessage.includes("Payment preflight passed, but real payments are disabled")) {
    throw new Error(`Paid preflight did not stop safely: ${deltaMessage}`);
  }

  console.log(`tools: ${names.join(", ")}`);
  console.log("free tools: live and callable");
  console.log("paid delta: live 402 validated; no payment sent");
} finally {
  await client.close();
}
