#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadConfig } from "./config.js";
import { X402NanoClient } from "./x402nano-client.js";
const config = loadConfig();
const client = new X402NanoClient(config);
const server = new McpServer({ name: "x402nano", version: "0.1.0" });
function result(data) {
    return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        structuredContent: data
    };
}
function failure(error) {
    const message = error instanceof Error ? error.message : "Unknown x402nano MCP error.";
    return {
        isError: true,
        content: [{ type: "text", text: message }]
    };
}
server.registerTool("list_trending_markets", {
    title: "List trending prediction markets",
    description: "Lists free Polymarket market candidates for structured research before purchasing intelligence.",
    inputSchema: { limit: z.number().int().min(1).max(25).optional().describe("Maximum markets to return.") }
}, async ({ limit }) => {
    try {
        return result(await client.listTrendingMarkets(limit));
    }
    catch (error) {
        return failure(error);
    }
});
server.registerTool("get_market_pricing", {
    title: "Get x402nano pricing",
    description: "Returns public pricing, network, freshness, and payment metadata without making a payment.",
    inputSchema: {}
}, async () => {
    try {
        return result(await client.getPricing());
    }
    catch (error) {
        return failure(error);
    }
});
server.registerTool("get_market_brief", {
    title: "Purchase a market brief",
    description: "Purchases one 0.05 USDC read-only structured prediction-market intelligence brief on Base.",
    inputSchema: { slug: z.string().min(1).max(300).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).describe("Exact Polymarket market slug.") }
}, async ({ slug }) => {
    try {
        return result(await client.getMarketBrief(slug));
    }
    catch (error) {
        return failure(error);
    }
});
server.registerTool("get_market_delta", {
    title: "Purchase a market delta",
    description: "Purchases one 0.05 USDC read-only probability-change report for a market since an ISO 8601 UTC timestamp.",
    inputSchema: {
        slug: z.string().min(1).max(300).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).describe("Exact Polymarket market slug."),
        since: z.iso.datetime({ offset: false }).describe("Previous successful check time in ISO 8601 UTC format ending in Z.")
    }
}, async ({ slug, since }) => {
    try {
        return result(await client.getMarketDelta(slug, since));
    }
    catch (error) {
        return failure(error);
    }
});
const transport = new StdioServerTransport();
await server.connect(transport);
//# sourceMappingURL=index.js.map