import { generateJwt } from "@coinbase/cdp-sdk/auth";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { HTTPFacilitatorClient, x402ResourceServer } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { declareDiscoveryExtension } from "@x402/extensions/bazaar";
import { createPaymentWrapper } from "@x402/mcp";
import { z } from "zod";
import { buildMarketBrief, buildMarketDelta, marketPreview } from "./market-briefs.js";
import { fetchMarketBySlug, fetchMarketPriceHistory, fetchTrendingMarkets } from "./polymarket-client.js";

const MCP_PATH = "/mcp";
const BASE_NETWORK = "eip155:8453";
const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const PRICE_USDC = "0.05";
const PRICE_ATOMIC = "50000";
const MAX_BODY_BYTES = 64 * 1024;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const COINBASE_FACILITATOR = "https://api.cdp.coinbase.com/platform/v2/x402";

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

function validateSince(value) {
  const since = new Date(value);
  if (Number.isNaN(since.getTime())) throw new Error("since must be a valid ISO 8601 UTC timestamp ending in Z.");
  if (since.getTime() > Date.now()) throw new Error("since cannot be in the future.");
  if (Date.now() - since.getTime() > 7 * 24 * 60 * 60 * 1000) {
    throw new Error("Delta v0 supports lookback windows up to 7 days.");
  }
}

function createDisabledFacilitator() {
  return {
    async getSupported() {
      return {
        kinds: [{ x402Version: 2, scheme: "exact", network: BASE_NETWORK }],
        extensions: [],
        signers: {}
      };
    },
    async verify() {
      return { isValid: false, invalidReason: "Remote MCP settlement is unavailable outside facilitator mode." };
    },
    async settle() {
      return { success: false, errorReason: "Remote MCP settlement is unavailable outside facilitator mode.", network: BASE_NETWORK };
    }
  };
}

async function cdpBearerToken(baseUrl, path, method, apiKeyId, apiKeySecret) {
  const url = new URL(path, `${baseUrl.replace(/\/$/, "")}/`);
  return generateJwt({
    apiKeyId,
    apiKeySecret,
    requestMethod: method,
    requestHost: url.host,
    requestPath: url.pathname
  });
}

function createProductionFacilitator(env) {
  const url = env.X402_FACILITATOR_URL?.trim();
  const apiKeyId = env.CDP_API_KEY_ID?.trim();
  const apiKeySecret = env.CDP_API_KEY_SECRET?.trim();
  const bearer = env.X402_FACILITATOR_API_KEY?.trim();

  if (!url) throw new Error("X402_FACILITATOR_URL is required for remote MCP settlement.");
  const facilitatorUrl = new URL(url);
  if (
    facilitatorUrl.toString().replace(/\/$/, "") !== COINBASE_FACILITATOR ||
    facilitatorUrl.username ||
    facilitatorUrl.password
  ) {
    throw new Error(`Remote MCP facilitator must be exactly ${COINBASE_FACILITATOR}.`);
  }
  if ((!apiKeyId || !apiKeySecret) && !bearer) {
    throw new Error("CDP facilitator credentials are required for remote MCP settlement.");
  }

  const httpClient = new HTTPFacilitatorClient({
    url,
    createAuthHeaders: async () => {
      if (apiKeyId && apiKeySecret) {
        const [verify, settle] = await Promise.all([
          cdpBearerToken(url, "/verify", "POST", apiKeyId, apiKeySecret),
          cdpBearerToken(url, "/settle", "POST", apiKeyId, apiKeySecret)
        ]);
        return {
          verify: { Authorization: `Bearer ${verify}` },
          settle: { Authorization: `Bearer ${settle}` }
        };
      }
      const authorization = { Authorization: `Bearer ${bearer}` };
      return { verify: authorization, settle: authorization };
    }
  });

  // CDP's production facilitator is already proven for Base exact settlement,
  // but its authenticated API does not expose the generic SDK /supported shape.
  return {
    async getSupported() {
      return {
        kinds: [{ x402Version: 2, scheme: "exact", network: BASE_NETWORK }],
        extensions: ["bazaar"],
        signers: {}
      };
    },
    verify: (paymentPayload, paymentRequirements) => httpClient.verify(paymentPayload, paymentRequirements),
    settle: (paymentPayload, paymentRequirements) => httpClient.settle(paymentPayload, paymentRequirements)
  };
}

function discoveryExtension(toolName, description, properties, required) {
  return declareDiscoveryExtension({
    toolName,
    description,
    inputSchema: { properties, required }
  });
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    let bytes = 0;
    req.on("data", chunk => {
      bytes += chunk.length;
      if (bytes <= MAX_BODY_BYTES) body += chunk;
    });
    req.on("end", () => {
      if (bytes > MAX_BODY_BYTES) return reject(new Error("MCP request body exceeds 64 KiB."));
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("MCP request body must be valid JSON."));
      }
    });
    req.on("error", reject);
  });
}

function forwardedValue(value) {
  return String(value ?? "").split(",")[0].trim();
}

export function remoteMcpManifest(origin = "https://x402nano.onrender.com") {
  return {
    $schema: "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
    name: "io.github.bobjonesgood/x402nano",
    title: "x402nano",
    description: "Machine-payable, read-only prediction-market intelligence and probability-change monitoring for AI agents.",
    repository: {
      url: "https://github.com/Bobjonesgood/x402nano",
      source: "github"
    },
    version: "0.2.0",
    remotes: [{ type: "streamable-http", url: `${origin}${MCP_PATH}` }]
  };
}

export async function createRemoteMcpService({
  env = process.env,
  sellerAddress,
  paymentMode,
  facilitatorClient,
  marketClient = {},
  onSettlement = () => {}
} = {}) {
  const mode = paymentMode ?? env.X402_PAYMENT_MODE ?? "sandbox";
  const configuredSeller = sellerAddress ?? env.SELLER_ADDRESS ?? env.PARTNER_SELLER_ADDRESS;
  const seller = /^0x[a-fA-F0-9]{40}$/.test(String(configuredSeller ?? ""))
    ? configuredSeller
    : mode === "facilitator"
      ? configuredSeller
      : "0x0000000000000000000000000000000000000001";
  if (!/^0x[a-fA-F0-9]{40}$/.test(String(seller ?? ""))) {
    throw new Error("A valid Base seller address is required for remote MCP.");
  }

  const getTrendingMarkets = marketClient.fetchTrendingMarkets ?? fetchTrendingMarkets;
  const getMarketBySlug = marketClient.fetchMarketBySlug ?? fetchMarketBySlug;
  const getMarketPriceHistory = marketClient.fetchMarketPriceHistory ?? fetchMarketPriceHistory;
  let paidHandlersPromise;

  async function paidHandlers() {
    if (!paidHandlersPromise) {
      paidHandlersPromise = (async () => {
        const facilitator = facilitatorClient ?? (mode === "facilitator" ? createProductionFacilitator(env) : createDisabledFacilitator());
        const resourceServer = new x402ResourceServer(facilitator);
        resourceServer.register(BASE_NETWORK, new ExactEvmScheme());
        await resourceServer.initialize();

        const accepts = await resourceServer.buildPaymentRequirements({
          scheme: "exact",
          network: BASE_NETWORK,
          payTo: seller,
          price: `$${PRICE_USDC}`
        });
        const requirement = accepts[0];
        if (
          !requirement ||
          requirement.scheme !== "exact" ||
          requirement.network !== BASE_NETWORK ||
          requirement.amount !== PRICE_ATOMIC ||
          requirement.asset.toLowerCase() !== BASE_USDC.toLowerCase() ||
          requirement.payTo.toLowerCase() !== String(seller).toLowerCase()
        ) {
          throw new Error("Remote MCP payment requirements did not resolve to exactly 0.05 Base USDC.");
        }

        const hooks = {
          onAfterSettlement: async ({ toolName, settlement, paymentPayload }) => {
            await onSettlement({ toolName, settlement, payer: paymentPayload.payer ?? null });
          }
        };
        const briefDescription = "Purchase a read-only structured prediction-market brief for one Polymarket market. Costs 0.05 USDC on Base.";
        const deltaDescription = "Purchase a read-only probability-change report since a prior timestamp. Costs 0.05 USDC on Base.";

        return {
          brief: createPaymentWrapper(resourceServer, {
            accepts,
            resource: { url: "mcp://x402nano/get_market_brief", description: briefDescription, mimeType: "application/json" },
            extensions: discoveryExtension("get_market_brief", briefDescription, {
              slug: { type: "string", description: "Exact Polymarket market slug." }
            }, ["slug"]),
            hooks
          })(async ({ slug }) => {
            const market = await getMarketBySlug(slug);
            const priceHistory24h = await getMarketPriceHistory(market, { interval: "1d", fidelity: 60 });
            return result(buildMarketBrief(market, { priceHistory24h }));
          }),
          delta: createPaymentWrapper(resourceServer, {
            accepts,
            resource: { url: "mcp://x402nano/get_market_delta", description: deltaDescription, mimeType: "application/json" },
            extensions: discoveryExtension("get_market_delta", deltaDescription, {
              slug: { type: "string", description: "Exact Polymarket market slug." },
              since: { type: "string", format: "date-time", description: "Previous successful check time in ISO 8601 UTC format." }
            }, ["slug", "since"]),
            hooks
          })(async ({ slug, since }) => {
            validateSince(since);
            const market = await getMarketBySlug(slug);
            const priceHistory = await getMarketPriceHistory(market, { interval: "1d", fidelity: 60 });
            return result(buildMarketDelta(market, { priceHistory, since }));
          })
        };
      })().catch(error => {
        paidHandlersPromise = undefined;
        throw error;
      });
    }
    return paidHandlersPromise;
  }

  async function createServer() {
    const server = new McpServer({ name: "x402nano", version: "0.2.0" });

    server.registerTool("list_trending_markets", {
      title: "List trending prediction markets",
      description: "Lists free Polymarket market candidates and slugs before purchasing intelligence.",
      inputSchema: { limit: z.number().int().min(1).max(25).optional().describe("Maximum markets to return.") }
    }, async ({ limit }) => {
      try {
        const markets = await getTrendingMarkets({ limit: limit ?? 10 });
        return result({ status: "ok", count: markets.length, markets: markets.map(marketPreview) });
      } catch (error) {
        return failure(error);
      }
    });

    server.registerTool("get_market_pricing", {
      title: "Get x402nano pricing",
      description: "Returns public MCP pricing, network, asset, seller, and payment metadata without making a payment.",
      inputSchema: {}
    }, async () => result({
      status: "ok",
      transport: "streamable-http",
      endpoint: "https://x402nano.onrender.com/mcp",
      network: BASE_NETWORK,
      asset: "USDC",
      assetAddress: BASE_USDC,
      seller,
      tools: {
        list_trending_markets: { priceUsdc: "0.00" },
        get_market_pricing: { priceUsdc: "0.00" },
        get_market_brief: { priceUsdc: PRICE_USDC },
        get_market_delta: { priceUsdc: PRICE_USDC }
      },
      payment: {
        protocol: "x402",
        clientRequirement: "Paid calls require an x402-aware MCP client. Buyer keys remain in the caller's environment."
      }
    }));

    server.registerTool("get_market_brief", {
      title: "Purchase a market brief",
      description: "Purchases one 0.05 USDC read-only structured prediction-market brief on Base.",
      inputSchema: { slug: z.string().min(1).max(300).regex(SLUG_PATTERN).describe("Exact Polymarket market slug.") }
    }, async (args, extra) => {
      let handlers;
      try {
        handlers = await paidHandlers();
      } catch (error) {
        return failure(error);
      }
      return handlers.brief(args, extra);
    });

    server.registerTool("get_market_delta", {
      title: "Purchase a market delta",
      description: "Purchases one 0.05 USDC read-only probability-change report since an ISO 8601 UTC timestamp.",
      inputSchema: {
        slug: z.string().min(1).max(300).regex(SLUG_PATTERN).describe("Exact Polymarket market slug."),
        since: z.iso.datetime({ offset: false }).describe("Previous successful check time in ISO 8601 UTC format ending in Z.")
      }
    }, async (args, extra) => {
      let handlers;
      try {
        validateSince(args.since);
        handlers = await paidHandlers();
      } catch (error) {
        return failure(error);
      }
      return handlers.delta(args, extra);
    });

    return server;
  }

  function validateRequestHost(req) {
    const forwardedHost = forwardedValue(req.headers["x-forwarded-host"]);
    const host = forwardedHost || forwardedValue(req.headers.host);
    const allowedHosts = new Set((env.MCP_ALLOWED_HOSTS ?? "x402nano.onrender.com,localhost,127.0.0.1")
      .split(",").map(value => value.trim().toLowerCase()).filter(Boolean));
    const hostname = host.replace(/:\d+$/, "").toLowerCase();
    if (!allowedHosts.has(hostname)) throw new Error("MCP request host is not allowed.");

    const origin = forwardedValue(req.headers.origin);
    if (origin) {
      const originUrl = new URL(origin);
      if (!allowedHosts.has(originUrl.hostname.toLowerCase())) throw new Error("MCP request origin is not allowed.");
    }
  }

  async function handle(req, res) {
    try {
      validateRequestHost(req);
    } catch (error) {
      res.writeHead(403, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      return res.end(JSON.stringify({ error: error.message }));
    }

    if (req.method !== "POST") {
      res.writeHead(405, { "Content-Type": "application/json", "Allow": "POST", "Cache-Control": "no-store" });
      return res.end(JSON.stringify({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Method not allowed. Use MCP Streamable HTTP POST requests." },
        id: null
      }));
    }

    let body;
    try {
      body = await readJsonBody(req);
    } catch (error) {
      res.writeHead(400, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      return res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32700, message: error.message }, id: null }));
    }

    const server = await createServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await server.connect(transport);
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    let cleanedUp = false;
    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      transport.close().catch(() => {});
      server.close().catch(() => {});
    };
    res.once("close", cleanup);
    try {
      await transport.handleRequest(req, res, body);
    } finally {
      if (res.writableEnded) cleanup();
    }
  }

  return { path: MCP_PATH, handle, createServer, manifest: remoteMcpManifest };
}
