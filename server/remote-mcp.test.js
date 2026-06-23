import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createRemoteMcpService, remoteMcpManifest } from "./remote-mcp.js";

const SELLER = "0x4cc3831eB479aCFb6D44631d4a30814508Cf52d3";

function fakeFacilitator() {
  return {
    async getSupported() {
      return {
        kinds: [{ x402Version: 2, scheme: "exact", network: "eip155:8453" }],
        extensions: ["bazaar"],
        signers: {}
      };
    },
    async verify() {
      throw new Error("The unpaid test must never verify a payment.");
    },
    async settle() {
      throw new Error("The unpaid test must never settle a payment.");
    }
  };
}

async function connectedClient() {
  const service = await createRemoteMcpService({
    sellerAddress: SELLER,
    paymentMode: "facilitator",
    facilitatorClient: fakeFacilitator(),
    marketClient: {
      fetchTrendingMarkets: async () => [{
        slug: "example-market",
        title: "Example market",
        question: "Example market?",
        category: "test",
        active: true,
        closed: false,
        volume: 1000,
        liquidity: 500,
        prices: { Yes: 0.6, No: 0.4 }
      }]
    }
  });
  const server = await service.createServer();
  const client = new Client({ name: "x402nano-test", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return { client, server };
}

test("registry manifest advertises the public Streamable HTTP endpoint", () => {
  const manifest = remoteMcpManifest();
  assert.equal(manifest.name, "io.github.Bobjonesgood/x402nano");
  assert.deepEqual(manifest.remotes, [{
    type: "streamable-http",
    url: "https://x402nano.onrender.com/mcp"
  }]);
});

test("remote MCP lists four tools and free pricing is callable", async () => {
  const { client, server } = await connectedClient();
  try {
    const listed = await client.listTools();
    assert.deepEqual(listed.tools.map(tool => tool.name).sort(), [
      "get_market_brief",
      "get_market_delta",
      "get_market_pricing",
      "list_trending_markets"
    ]);

    const pricing = await client.callTool({ name: "get_market_pricing", arguments: {} });
    const body = JSON.parse(pricing.content[0].text);
    assert.equal(body.endpoint, "https://x402nano.onrender.com/mcp");
    assert.equal(body.tools.get_market_brief.priceUsdc, "0.05");
    assert.equal(body.network, "eip155:8453");
    assert.equal(body.seller, SELLER);
  } finally {
    await client.close();
    await server.close();
  }
});

test("unpaid paid-tool call returns 0.05 Base USDC requirements and no content", async () => {
  const { client, server } = await connectedClient();
  try {
    const response = await client.callTool({
      name: "get_market_brief",
      arguments: { slug: "example-market" }
    });
    assert.equal(response.isError, true);
    const text = response.content.map(item => item.type === "text" ? item.text : "").join("\n");
    assert.match(text, /x402\/error|payment required/i);
    assert.match(text, /50000/);
    assert.match(text, /eip155:8453/);
    assert.match(text, new RegExp(SELLER, "i"));
    assert.doesNotMatch(text, /Example market\?|"status":\s*"ok"/);
  } finally {
    await client.close();
    await server.close();
  }
});
