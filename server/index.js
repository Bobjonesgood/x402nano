import crypto from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { encodePaymentRequiredHeader, encodePaymentResponseHeader } from "@x402/core/http";
import { DEFAULT_STABLECOINS } from "@x402/evm";
import { declareDiscoveryExtension } from "@x402/extensions/bazaar";
import { buildMarketBrief, marketPreview } from "./market-briefs.js";
import { createFacilitatorProvider, createSandboxProvider } from "./payment-providers.js";
import { fetchMarketBySlug, fetchMarketPriceHistory, fetchTrendingMarkets, polymarketStatus } from "./polymarket-client.js";

const PORT = Number(process.env.PORT ?? 4021);
const HOST = process.env.HOST ?? "0.0.0.0";
const PAYMENT_MODE = process.env.X402_PAYMENT_MODE ?? "sandbox";
const FACILITATOR_SECRET = process.env.FACILITATOR_SECRET ?? "sandbox-facilitator-secret";
const SELLER_ADDRESS = process.env.SELLER_ADDRESS ?? process.env.PARTNER_SELLER_ADDRESS ?? "0xSellerPremiumLeadDesk";
const BUYER_ADDRESS = process.env.BUYER_ADDRESS ?? "0xAutonomousAgentWallet";
const PRICE_USDC = process.env.PRICE_USDC ?? "0.05";
const NETWORK = process.env.X402_NETWORK ?? "eip155:84532";
const ASSET = process.env.X402_ASSET ?? "USDC";
const API_NAME = "x402nano Market Intelligence API";
const RELEASE_VERSION = process.env.RELEASE_VERSION ?? "0.2.0";
const RELEASE_NAME = process.env.RELEASE_NAME ?? "x402nano Machine-Payable Market Intelligence Proof";
const PAYMENT_HEADER = "X-PAYMENT";
const MARKET_BRIEF_PATH = "/api/markets/brief";
const RESOURCE_PATH = MARKET_BRIEF_PATH;
const ADMIN_TOKEN = process.env.LEAD_PACK_ADMIN_TOKEN?.trim() ?? "";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LEAD_PACK_MODE = process.env.LEAD_PACK_MODE ?? "demo";
const LEAD_PACK_FILE = process.env.LEAD_PACK_FILE
  ? path.resolve(process.env.LEAD_PACK_FILE)
  : path.resolve(__dirname, "../data/production-lead-pack.runtime.json");
const LEAD_PACK_FILE_REFRESH_MS = Number(process.env.LEAD_PACK_FILE_REFRESH_MS ?? 30000);
const MARKET_BRIEF_ENABLED = process.env.MARKET_BRIEF_ENABLED !== "false";
const PAYMENT_TTL_MS = 5 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 90;
const DIST_DIR = path.resolve(__dirname, "../dist");
const EVM_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

const demoLeadPack = [
  {
    id: "lnai_pack_001",
    businessName: "Riverbend Roofing & Restoration",
    industry: "Residential roofing",
    location: "Tulsa, OK",
    contactPerson: "Operations Manager",
    estimatedJobValue: "$8,500 - $18,000",
    buyingIntent: "Recent hail activity; likely quoting roof inspections and insurance-related repairs.",
    painPoints: ["storm-response lead volume", "missed inspection follow-up", "slow quote turnaround"],
    recommendedOpener: "Saw the recent storm activity around Tulsa. Are you taking on extra roof inspection requests this week, or are you already booked out?",
    confidenceScore: 94,
    sourceType: "local market signal",
    lastUpdated: "2026-05-17"
  },
  {
    id: "lnai_pack_002",
    businessName: "Blue Ridge Custom Painting",
    industry: "Residential painting",
    location: "Knoxville, TN",
    contactPerson: "Owner",
    estimatedJobValue: "$3,200 - $9,500",
    buyingIntent: "Seasonal exterior painting demand; likely wants booked estimates before peak summer heat.",
    painPoints: ["inconsistent estimate pipeline", "low-quality form leads", "needs higher-ticket exterior jobs"],
    recommendedOpener: "Are you still booking exterior paint estimates for the next few weeks? I found a few neighborhoods showing strong repaint demand.",
    confidenceScore: 91,
    sourceType: "home-service demand pattern",
    lastUpdated: "2026-05-17"
  },
  {
    id: "lnai_pack_003",
    businessName: "ClearPath Pressure Washing",
    industry: "Exterior cleaning",
    location: "Savannah, GA",
    contactPerson: "Service Coordinator",
    estimatedJobValue: "$650 - $2,400",
    buyingIntent: "Warm-weather driveway, siding, and patio cleaning demand; good fit for fast quote campaigns.",
    painPoints: ["small jobs scattered across channels", "needs bundled route density", "slow repeat-customer reactivation"],
    recommendedOpener: "Are you trying to fill pressure washing routes this month? I can point you toward homeowners likely to need driveway or siding cleaning.",
    confidenceScore: 88,
    sourceType: "seasonal service trigger",
    lastUpdated: "2026-05-17"
  }
];

const requiredLeadPackFields = [
  "id",
  "businessName",
  "industry",
  "location",
  "estimatedJobValue",
  "buyingIntent",
  "painPoints",
  "recommendedOpener",
  "confidenceScore"
];

const requiredProductionLeadPackFields = [
  ...requiredLeadPackFields,
  "sourceType",
  "sourceUrls",
  "sourceEvidence",
  "reviewedAt"
];

function parseProductionLeadPack(value) {
  if (!value) return { records: [], error: "PREMIUM_LEAD_PACK_JSON is not configured." };

  try {
    const records = JSON.parse(value);
    if (!Array.isArray(records) || records.length === 0) {
      return { records: [], error: "PREMIUM_LEAD_PACK_JSON must contain a non-empty lead record array." };
    }

    const invalidRecord = records.find(record =>
      !record ||
      typeof record !== "object" ||
      requiredProductionLeadPackFields.some(field => {
        if (field === "painPoints" || field === "sourceUrls" || field === "sourceEvidence") {
          return !Array.isArray(record[field]) || record[field].length === 0;
        }
        return record[field] === undefined || record[field] === "";
      })
    );

    if (invalidRecord) {
      return { records: [], error: "Legacy JSON is missing required fields or production source evidence." };
    }

    return { records, error: "" };
  } catch {
    return { records: [], error: "PREMIUM_LEAD_PACK_JSON is not valid JSON." };
  }
}

let productionLeadPack = parseProductionLeadPack(process.env.PREMIUM_LEAD_PACK_JSON);
let premiumLeadPack = LEAD_PACK_MODE === "production" ? productionLeadPack.records : demoLeadPack;
let leadPackSource = productionLeadPack.records.length > 0 ? "env:PREMIUM_LEAD_PACK_JSON" : "none";
let leadPackFileMtimeMs = 0;
let leadPackLastCheckedAt = 0;
let leadPackWorkerStatus = null;

async function refreshProductionLeadPack({ force = false } = {}) {
  if (LEAD_PACK_MODE !== "production") return;

  const now = Date.now();
  if (!force && now - leadPackLastCheckedAt < LEAD_PACK_FILE_REFRESH_MS) return;
  leadPackLastCheckedAt = now;
  leadPackWorkerStatus = await readLeadPackWorkerStatus();

  try {
    const stat = await fs.stat(LEAD_PACK_FILE);
    if (!force && stat.mtimeMs <= leadPackFileMtimeMs) return;

    const parsed = parseProductionLeadPack(await fs.readFile(LEAD_PACK_FILE, "utf8"));
    if (parsed.error) {
      logEvent("lead_pack_refresh_rejected", {
        source: LEAD_PACK_FILE,
        reason: parsed.error
      });
      return;
    }

    productionLeadPack = parsed;
    premiumLeadPack = parsed.records;
    leadPackSource = `file:${LEAD_PACK_FILE}`;
    leadPackFileMtimeMs = stat.mtimeMs;
    leadPackWorkerStatus = await readLeadPackWorkerStatus();
    logEvent("lead_pack_refreshed", {
      source: LEAD_PACK_FILE,
      records: parsed.records.length
    });
  } catch (error) {
    if (error.code !== "ENOENT") {
      logEvent("lead_pack_refresh_failed", {
        source: LEAD_PACK_FILE,
        reason: error.message
      });
    }
  }
}

async function readLeadPackWorkerStatus() {
  try {
    return JSON.parse(await fs.readFile(`${LEAD_PACK_FILE}.status.json`, "utf8"));
  } catch {
    return null;
  }
}

function leadPackStatus() {
  const productionConfigured = LEAD_PACK_MODE === "production" && premiumLeadPack.length > 0 && !productionLeadPack.error;
  const mainnetReady = NETWORK !== "eip155:8453" || productionConfigured;

  return {
    mode: LEAD_PACK_MODE === "production" ? "production" : "demo",
    records: premiumLeadPack.length,
    source: leadPackSource,
    worker: leadPackWorkerStatus,
    productionConfigured,
    mainnetReady,
    disclosure: productionConfigured
      ? "Legacy production records are configured for the retired resource."
      : "Legacy records are retired. Use the Polymarket market brief endpoint.",
    reason: productionConfigured ? null : productionLeadPack.error || "Set LEAD_PACK_MODE=production and PREMIUM_LEAD_PACK_JSON for the first real paid pack."
  };
}

function marketProductStatus() {
  return {
    name: "x402nano market briefs",
    status: "mainnet proof complete",
    dataSource: "Polymarket public data",
    freeResource: "/api/markets/trending",
    paidResource: `${MARKET_BRIEF_PATH}?slug={polymarket-slug}`,
    output: "read-only market intelligence JSON",
    price: `${PRICE_USDC} ${ASSET}`,
    network: NETWORK,
    disclaimer: "Informational only; no trading, betting, or financial advice."
  };
}

function mainnetProductBlocker() {
  const product = leadPackStatus();
  if (paymentProvider.mode === "facilitator" && NETWORK === "eip155:8453" && !product.mainnetReady) {
    return product.reason;
  }
  return "";
}

function productionConfigErrors() {
  const errors = [];
  const isMainnet = NETWORK === "eip155:8453";

  if (!isMainnet) return errors;
  if (PAYMENT_MODE !== "facilitator") errors.push("Base mainnet requires X402_PAYMENT_MODE=facilitator.");
  if (ASSET !== "USDC") errors.push("Base mainnet requires X402_ASSET=USDC.");
  if (PRICE_USDC !== "0.05") errors.push("Base mainnet launch requires PRICE_USDC=0.05.");
  if (!EVM_ADDRESS_PATTERN.test(SELLER_ADDRESS)) errors.push("Base mainnet requires a valid SELLER_ADDRESS.");
  if (LEAD_PACK_MODE !== "production") errors.push("Base mainnet requires LEAD_PACK_MODE=production.");
  if (productionLeadPack.error) errors.push(productionLeadPack.error);

  return errors;
}

const payments = new Map();
const issuedRequirements = new Map();
const usedNonces = new Set();
const rateLimits = new Map();
const eventLog = [];

function isProtectedResource(pathname) {
  return pathname === MARKET_BRIEF_PATH;
}

function isLeadPackResource(pathname) {
  return false;
}

function isMarketBriefResource(pathname) {
  return pathname === MARKET_BRIEF_PATH;
}

function paymentResourceFromUrl(url) {
  return `${url.pathname}${url.search}`;
}

function isPaymentResource(resource = "") {
  try {
    const parsed = new URL(resource, "https://x402nano.local");
    return isProtectedResource(parsed.pathname);
  } catch {
    return resource === MARKET_BRIEF_PATH;
  }
}

function locationFilterFromUrl(url) {
  const city = url.searchParams.get("city")?.trim() ?? "";
  const state = url.searchParams.get("state")?.trim() ?? "";
  const zip = url.searchParams.get("zip")?.trim() ?? "";
  const q = url.searchParams.get("q")?.trim() ?? "";

  return {
    active: Boolean(city || state || zip || q),
    city,
    state,
    zip,
    q
  };
}

function normalizeSearch(value) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function leadSearchText(lead) {
  return [
    lead.businessName,
    lead.industry,
    lead.location,
    lead.postalCode,
    lead.zip,
    lead.buyingIntent,
    ...(lead.sourceEvidence ?? []),
    ...(lead.sourceUrls ?? [])
  ].join(" ");
}

function leadMatchesLocation(lead, filter) {
  if (!filter.active) return true;

  const haystack = normalizeSearch(leadSearchText(lead));
  const checks = [filter.city, filter.state, filter.zip, filter.q]
    .map(normalizeSearch)
    .filter(Boolean);

  return checks.every(term => haystack.includes(term));
}

function filterLeadPack(filter) {
  return premiumLeadPack.filter(lead => leadMatchesLocation(lead, filter));
}

function logEvent(type, details = {}) {
  const event = {
    id: crypto.randomUUID(),
    type,
    timestamp: new Date().toISOString(),
    details
  };
  eventLog.unshift(event);
  eventLog.splice(100);
  return event;
}

function canonicalPayment(requirements, payer = BUYER_ADDRESS) {
  return [
    requirements.x402Version,
    requirements.scheme,
    requirements.network,
    requirements.asset,
    requirements.amount,
    requirements.payTo,
    requirements.resource,
    requirements.nonce,
    requirements.expiresAt,
    payer
  ].join("|");
}

function walletPaymentMessage(requirements, payer = BUYER_ADDRESS) {
  return [
    "x402nano Payment Authorization",
    "Sign this message to authorize sandbox access to the protected market brief.",
    "",
    `Payer: ${payer}`,
    `Seller: ${requirements.payTo}`,
    `Resource: ${requirements.resource}`,
    `Amount: ${requirements.amount} ${requirements.asset}`,
    `Network: ${requirements.network}`,
    `Nonce: ${requirements.nonce}`,
    `Expires: ${requirements.expiresAt}`
  ].join("\n");
}

const paymentProvider =
  PAYMENT_MODE === "facilitator"
    ? createFacilitatorProvider({
        facilitatorUrl: process.env.X402_FACILITATOR_URL,
        facilitatorApiKey: process.env.X402_FACILITATOR_API_KEY,
        cdpApiKeyId: process.env.CDP_API_KEY_ID,
        cdpApiKeySecret: process.env.CDP_API_KEY_SECRET
      })
    : createSandboxProvider({
        facilitatorSecret: FACILITATOR_SECRET,
        canonicalPayment,
        walletPaymentMessage
      });

const leadSchema = {
  type: "object",
  required: ["status", "receipt", "data"],
  properties: {
    status: { type: "string", enum: ["unlocked"] },
    receipt: {
      type: "object",
      required: ["id", "payer", "seller", "amount", "asset", "network", "settledAt"],
      properties: {
        id: { type: "string" },
        payer: { type: "string" },
        seller: { type: "string" },
        amount: { type: "string" },
        asset: { type: "string" },
        network: { type: "string" },
        settledAt: { type: "string", format: "date-time" }
      }
    },
    data: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "businessName", "industry", "location", "estimatedJobValue", "buyingIntent", "painPoints", "recommendedOpener", "confidenceScore"],
        properties: {
          id: { type: "string" },
          businessName: { type: "string" },
          industry: { type: "string" },
          location: { type: "string" },
          contactPerson: { type: "string" },
          estimatedJobValue: { type: "string" },
          buyingIntent: { type: "string" },
          painPoints: {
            type: "array",
            items: { type: "string" }
          },
          recommendedOpener: { type: "string" },
          confidenceScore: { type: "number", minimum: 0, maximum: 100 },
          sourceType: { type: "string" },
          sourceUrls: {
            type: "array",
            items: { type: "string" }
          },
          sourceEvidence: {
            type: "array",
            items: { type: "string" }
          },
          reviewedAt: { type: "string" },
          contactPolicy: { type: "string" },
          lastUpdated: { type: "string" }
        }
      }
    }
  }
};

const bazaarLeadPackOutputExample = {
  status: "unlocked",
  receipt: {
    id: "receipt-id-after-payment",
    payer: "external-x402-client",
    seller: "0xSellerWallet",
    amount: PRICE_USDC,
    asset: ASSET,
    network: NETWORK,
    settledAt: "2026-05-22T00:00:00.000Z"
  },
  data: [
    {
      id: "reviewed-public-fit-signal",
      businessName: "Example Home Services Co.",
      industry: "Service business",
      location: "Example City, ST",
      estimatedJobValue: "Qualify project value before sale.",
      buyingIntent: "Public fit signal from reviewed source evidence.",
      painPoints: ["lead follow-up speed", "estimate intake consistency"],
      recommendedOpener: "Are new service inquiries followed up fast enough when your team is busy?",
      confidenceScore: 84,
      sourceType: "official business website",
      sourceUrls: ["https://example.com/"],
      sourceEvidence: ["Reviewed public evidence supporting the fit signal."],
      reviewedAt: "2026-05-22",
      contactPolicy: "Use public business contact routes only."
    }
  ]
};

const bazaarLeadPackDiscovery = declareDiscoveryExtension({
  method: "GET",
  inputSchema: {
    properties: {},
    additionalProperties: false
  },
  output: {
    example: bazaarLeadPackOutputExample,
    schema: leadSchema
  }
});

const marketBriefSchema = {
  type: "object",
  required: ["status", "receipt", "data"],
  properties: {
    status: { type: "string", enum: ["unlocked"] },
    receipt: {
      type: "object",
      required: ["id", "payer", "seller", "amount", "asset", "network", "settledAt"],
      properties: {
        id: { type: "string" },
        payer: { type: "string" },
        seller: { type: "string" },
        amount: { type: "string" },
        asset: { type: "string" },
        network: { type: "string" },
        settledAt: { type: "string", format: "date-time" }
      }
    },
    data: {
      type: "object",
      required: ["briefType", "status", "market"],
      properties: {
        briefType: { type: "string", enum: ["read-only-market-intelligence"] },
        status: { type: "string" },
        market: {
          type: "object",
          required: ["slug"],
          properties: {
            slug: { type: "string" },
            question: { type: "string" },
            probability: { type: "number" },
            volume: { type: "number" },
            liquidity: { type: "number" }
          }
        },
        movement: {
          type: "object",
          properties: {
            window: { type: "string" },
            source: { type: "string" },
            available: { type: "boolean" },
            outcome: { type: ["string", "null"] },
            start: { type: ["object", "null"] },
            end: { type: ["object", "null"] },
            absoluteChange: { type: ["string", "null"] },
            relativeChange: { type: ["string", "null"] },
            direction: { type: "string" },
            trajectory: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  timestamp: { type: "string" },
                  probability: { type: ["string", "null"] }
                }
              }
            }
          }
        },
        metrics: {
          type: "object",
          properties: {
            volume: { type: ["string", "null"] },
            volume24h: { type: ["string", "null"] },
            volume7d: { type: ["string", "null"] },
            liquidity: { type: ["string", "null"] }
          }
        },
        resolution: {
          type: "object",
          properties: {
            endDate: { type: ["string", "null"] },
            daysUntilEnd: { type: ["number", "null"] },
            source: { type: "string" },
            note: { type: "string" }
          }
        },
        scores: {
          type: "object",
          properties: {
            marketMovementScore: { type: "number" },
            attentionScore: { type: "number" },
            dataCompletenessScore: { type: "number" },
            unusualMovementFlag: { type: "boolean" },
            note: { type: "string" }
          }
        },
        watchPoints: {
          type: "array",
          items: { type: "string" }
        },
        boundaries: {
          type: "array",
          items: { type: "string" }
        }
      }
    }
  }
};

const bazaarMarketBriefOutputExample = {
  status: "unlocked",
  receipt: {
    id: "receipt-id-after-payment",
    payer: "external-x402-client",
    seller: SELLER_ADDRESS,
    amount: PRICE_USDC,
    asset: ASSET,
    network: NETWORK,
    settledAt: "2026-06-05T15:30:44.641Z"
  },
  data: {
    briefType: "read-only-market-intelligence",
    status: "ok",
    market: {
      slug: "will-gideon-saar-be-the-next-prime-minister-of-israel",
      question: "Will Gideon Saar be the next Prime Minister of Israel?"
    },
    movement: {
      window: "24h",
      source: "polymarket:clob",
      available: true,
      outcome: "Yes",
      start: { timestamp: "2026-06-05T00:00:00.000Z", probability: "0.580" },
      end: { timestamp: "2026-06-06T00:00:00.000Z", probability: "0.630" },
      absoluteChange: "0.050",
      relativeChange: "+8.6%",
      direction: "up",
      trajectory: [
        { timestamp: "2026-06-05T00:00:00.000Z", probability: "0.580" },
        { timestamp: "2026-06-06T00:00:00.000Z", probability: "0.630" }
      ]
    },
    metrics: {
      volume: "120,000",
      volume24h: "8,500",
      volume7d: "42,000",
      liquidity: "18,000"
    },
    resolution: {
      endDate: "2026-12-31T00:00:00.000Z",
      daysUntilEnd: 208,
      source: "Use the Polymarket market page and rules for resolution criteria.",
      note: "Resolution context is informational and should be checked against the official market rules."
    },
    scores: {
      marketMovementScore: 72,
      attentionScore: 64,
      dataCompletenessScore: 88,
      unusualMovementFlag: true,
      note: "Scores are descriptive heuristics from public data availability, movement size, volume, and liquidity. They are not predictions or recommendations."
    },
    watchPoints: ["Compare movement with liquidity before treating the snapshot as meaningful context."],
    boundaries: ["Read-only public market data summary.", "No trading execution.", "No custody of user funds.", "No buy/sell/bet recommendation."]
  }
};

const bazaarMarketBriefDiscovery = declareDiscoveryExtension({
  method: "GET",
  input: {
    slug: "will-gideon-saar-be-the-next-prime-minister-of-israel"
  },
  inputSchema: {
    properties: {
      slug: {
        type: "string",
        description: "Polymarket market slug to summarize."
      }
    },
    required: ["slug"],
    additionalProperties: false
  },
  output: {
    example: bazaarMarketBriefOutputExample,
    schema: marketBriefSchema
  }
});

function json(res, statusCode, body, extraHeaders = {}) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Authorization,Content-Type,Idempotency-Key,X-PAYMENT,PAYMENT-SIGNATURE",
    ...extraHeaders
  });
  res.end(JSON.stringify(body, null, 2));
}

function requestUrl(req) {
  return new URL(req.url, `http://${req.headers.host}`);
}

function publicOrigin(req) {
  const proto = req.headers["x-forwarded-proto"]?.split(",")[0]?.trim() ?? "http";
  const host = req.headers["x-forwarded-host"]?.split(",")[0]?.trim() ?? req.headers.host;
  return `${proto}://${host}`;
}

function sellerWalletStatus() {
  const isValid = EVM_ADDRESS_PATTERN.test(SELLER_ADDRESS);
  return {
    address: SELLER_ADDRESS,
    isValid,
    label: isValid ? "configured" : "placeholder",
    message: isValid ? "Seller wallet is a valid EVM address." : "Set SELLER_ADDRESS or PARTNER_SELLER_ADDRESS to your real 0x seller wallet before real settlement."
  };
}

function buildInfo() {
  return {
    commit:
      process.env.RENDER_GIT_COMMIT ??
      process.env.GIT_COMMIT ??
      process.env.COMMIT_SHA ??
      process.env.SOURCE_VERSION ??
      "unknown",
    branch:
      process.env.RENDER_GIT_BRANCH ??
      process.env.GIT_BRANCH ??
      process.env.BRANCH ??
      "unknown",
    service:
      process.env.RENDER_SERVICE_NAME ??
      process.env.SERVICE_NAME ??
      "local",
    environment:
      process.env.NODE_ENV ??
      "development"
  };
}

function versionPayload() {
  return {
    status: "ok",
    service: API_NAME,
    release: {
      version: RELEASE_VERSION,
      name: RELEASE_NAME
    },
    payment: {
      mode: paymentProvider.mode,
      settlement: paymentProvider.settlement,
      network: NETWORK,
      asset: ASSET,
      amount: PRICE_USDC,
      sellerWallet: sellerWalletStatus()
    },
    product: marketProductStatus(),
    build: buildInfo()
  };
}

function publicReceipt(receipt) {
  if (!receipt) return null;
  return {
    id: receipt.id,
    payer: receipt.payer,
    seller: receipt.seller,
    amount: receipt.amount,
    asset: receipt.asset,
    network: receipt.network,
    resource: receipt.resource,
    mode: receipt.mode,
    transaction: receipt.transaction,
    provider: receipt.provider,
    settledAt: receipt.settledAt
  };
}

function clientId(req) {
  return req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ?? req.socket.remoteAddress ?? "unknown";
}

function adminAuthorized(req) {
  if (!ADMIN_TOKEN) return false;
  const auth = req.headers.authorization ?? "";
  const bearer = auth.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  const headerToken = req.headers["x-admin-token"]?.trim();
  const provided = bearer || headerToken || "";

  if (!provided || provided.length !== ADMIN_TOKEN.length) return false;
  return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(ADMIN_TOKEN));
}

function leadPackAdminSummary(filter = { active: false }) {
  const records = filterLeadPack(filter);

  return {
    status: "ok",
    product: leadPackStatus(),
    filter,
    matchedRecords: records.length,
    records: records.map(record => ({
      id: record.id,
      businessName: record.businessName,
      industry: record.industry,
      location: record.location,
      postalCode: record.postalCode ?? record.zip,
      estimatedJobValue: record.estimatedJobValue,
      buyingIntent: record.buyingIntent,
      painPoints: record.painPoints,
      recommendedOpener: record.recommendedOpener,
      confidenceScore: record.confidenceScore,
      sourceType: record.sourceType,
      sourceUrls: record.sourceUrls,
      sourceEvidence: record.sourceEvidence,
      reviewedAt: record.reviewedAt,
      contactPolicy: record.contactPolicy
    }))
  };
}

function rateLimit(req) {
  const id = clientId(req);
  const now = Date.now();
  const current = rateLimits.get(id);

  if (!current || current.resetAt <= now) {
    rateLimits.set(id, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { ok: true };
  }

  current.count += 1;
  if (current.count > RATE_LIMIT_MAX_REQUESTS) {
    return {
      ok: false,
      retryAfter: Math.ceil((current.resetAt - now) / 1000)
    };
  }

  return { ok: true };
}

function pruneExpiredRequirements() {
  const now = Date.now();
  for (const [nonce, requirement] of issuedRequirements) {
    if (new Date(requirement.expiresAt).getTime() < now) {
      issuedRequirements.delete(nonce);
      usedNonces.delete(nonce);
    }
  }
}

function paymentRequirements(resource = RESOURCE_PATH, filter = { active: false }) {
  pruneExpiredRequirements();
  const isMarketBrief = resource.startsWith(MARKET_BRIEF_PATH);

  const requirements = {
    x402Version: PAYMENT_MODE === "facilitator" ? "1" : "sandbox-1",
    scheme: "exact",
    network: NETWORK,
    asset: ASSET,
    amount: PRICE_USDC,
    payTo: SELLER_ADDRESS,
    resource,
    description: isMarketBrief
      ? "x402nano read-only Polymarket market intelligence brief. Informational only; no trading, betting, or financial advice."
      : "Legacy paid resource retired. Use /api/markets/brief?slug=... for x402nano market briefs.",
    mimeType: "application/json",
    maxTimeoutSeconds: Math.floor(PAYMENT_TTL_MS / 1000),
    expiresAt: new Date(Date.now() + PAYMENT_TTL_MS).toISOString(),
    nonce: crypto.randomUUID(),
    facilitator: paymentProvider.mode === "facilitator" ? paymentProvider.describe().facilitatorUrl : undefined
  };

  issuedRequirements.set(requirements.nonce, requirements);
  logEvent("quote_issued", {
    nonce: requirements.nonce,
    resource: requirements.resource,
    amount: requirements.amount,
    asset: requirements.asset,
    network: requirements.network,
    filter,
    paymentMode: paymentProvider.mode
  });
  return requirements;
}

function officialPaymentRequirements(requirements) {
  const exactAsset = facilitatorAssetRequirements(requirements);

  return {
    scheme: requirements.scheme,
    network: requirements.network,
    asset: exactAsset.asset,
    amount: exactAsset.amount,
    payTo: requirements.payTo,
    maxTimeoutSeconds: requirements.maxTimeoutSeconds,
    extra: {
      ...exactAsset.extra,
      nonce: requirements.nonce,
      expiresAt: requirements.expiresAt,
      resource: requirements.resource
    }
  };
}

function toAtomicAmount(amount, decimals) {
  const [whole = "0", fraction = ""] = String(amount).split(".");
  return `${whole}${fraction.padEnd(decimals, "0").slice(0, decimals)}`.replace(/^0+(?=\d)/, "") || "0";
}

function facilitatorAssetRequirements(requirements) {
  const defaultAsset = DEFAULT_STABLECOINS[requirements.network];

  if (requirements.asset !== "USDC" || !defaultAsset) {
    return { asset: requirements.asset, amount: requirements.amount, extra: {} };
  }

  return {
    asset: defaultAsset.address,
    amount: toAtomicAmount(requirements.amount, defaultAsset.decimals),
    extra: {
      name: defaultAsset.name,
      version: defaultAsset.version,
      ...(defaultAsset.assetTransferMethod ? { assetTransferMethod: defaultAsset.assetTransferMethod } : {})
    }
  };
}

function officialPaymentRequired(req, requirements, error = "Payment required") {
  const origin = publicOrigin(req);
  const isMarketBrief = requirements.resource.startsWith(MARKET_BRIEF_PATH);
  const environmentTag = paymentProvider.mode === "facilitator" && requirements.network === "eip155:8453"
    ? "mainnet"
    : requirements.network === "eip155:84532"
      ? "testnet"
      : paymentProvider.mode;

  return {
    x402Version: 2,
    error,
    resource: {
      url: `${origin}${requirements.resource}`,
      description: isMarketBrief
        ? "Machine-payable read-only Polymarket market intelligence brief. Informational only; no trading, betting, or financial advice."
        : "Legacy paid resource retired. Use the x402nano Polymarket market brief endpoint.",
      mimeType: requirements.mimeType,
      serviceName: API_NAME,
      tags: isMarketBrief
        ? ["polymarket", "market-intelligence", "x402", "base", "read-only", environmentTag]
        : ["leads", "agents", "x402", "lead-intelligence", "service-business", environmentTag]
    },
    accepts: [officialPaymentRequirements(requirements)],
    extensions: isMarketBrief ? bazaarMarketBriefDiscovery : bazaarLeadPackDiscovery
  };
}

function parsePaymentHeader(header) {
  if (!header) return null;
  try {
    return JSON.parse(Buffer.from(header, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function normalizeRequirements(requirements, payment = {}) {
  if (!requirements) return null;
  const facilitatorAsset = facilitatorAssetRequirements({
    network: requirements.network,
    asset: ASSET,
    amount: PRICE_USDC
  });
  const isFacilitatorUsdcRequirement =
    paymentProvider.mode === "facilitator" &&
    requirements.asset === facilitatorAsset.asset &&
    requirements.amount === facilitatorAsset.amount;

  return {
    x402Version: String(requirements.x402Version ?? (paymentProvider.mode === "facilitator" ? "1" : "sandbox-1")),
    scheme: requirements.scheme,
    network: requirements.network,
    asset: isFacilitatorUsdcRequirement ? ASSET : requirements.asset,
    amount: isFacilitatorUsdcRequirement ? PRICE_USDC : requirements.amount,
    payTo: requirements.payTo,
    resource: requirements.resource ?? requirements.extra?.resource ?? RESOURCE_PATH,
    description: requirements.description ?? "x402nano protected market brief",
    mimeType: requirements.mimeType ?? "application/json",
    maxTimeoutSeconds: requirements.maxTimeoutSeconds ?? Math.floor(PAYMENT_TTL_MS / 1000),
    expiresAt: requirements.expiresAt ?? requirements.extra?.expiresAt,
    nonce: requirements.nonce ?? requirements.extra?.nonce
  };
}

function requirementsMatchIssued(requirements) {
  const issued = issuedRequirements.get(requirements?.nonce);
  if (!issued) return false;
  return canonicalPayment(issued, BUYER_ADDRESS).split("|").slice(0, -1).join("|") === canonicalPayment(requirements, BUYER_ADDRESS).split("|").slice(0, -1).join("|");
}

function validateRequirements(requirements) {
  requirements = normalizeRequirements(requirements);
  if (!requirements) return "Payment requirements are missing.";
  if (!["sandbox-1", "1"].includes(requirements.x402Version)) return "Unsupported x402 version.";
  if (paymentProvider.mode === "sandbox" && requirements.x402Version !== "sandbox-1") return "Sandbox mode requires x402Version sandbox-1.";
  if (paymentProvider.mode === "facilitator" && requirements.x402Version !== "1") return "Facilitator mode requires x402Version 1.";
  if (requirements.scheme !== "exact") return "Unsupported payment scheme.";
  if (requirements.network !== NETWORK) return "Unsupported network.";
  if (requirements.asset !== ASSET) return "Unsupported payment asset.";
  if (requirements.amount !== PRICE_USDC) return "Incorrect payment amount.";
  if (requirements.payTo !== SELLER_ADDRESS) return "Incorrect seller address.";
  if (!isPaymentResource(requirements.resource)) return "Payment was signed for a different resource.";
  if (!requirements.nonce) return "Payment nonce is missing.";
  if (!requirementsMatchIssued(requirements)) return "Payment quote was not issued by this seller server.";
  if (new Date(requirements.expiresAt).getTime() < Date.now()) return "Payment quote expired.";
  return "";
}

async function verifyPayment(payment) {
  const submittedRequirements = payment?.requirements ?? payment?.accepted;
  const requirements = normalizeRequirements(submittedRequirements, payment);
  logEvent("payment_attempted", {
    resource: requirements?.resource,
    payer: payment?.payer ?? "external-x402-client",
    paymentMode: paymentProvider.mode
  });

  if (!requirements) {
    return { ok: false, reason: "Payment payload is missing payment requirements." };
  }

  if (paymentProvider.mode === "sandbox" && (!payment.signature || !payment.payer)) {
    return { ok: false, reason: "Sandbox payment payload is missing payer or signature." };
  }

  const signature = payment.signature ?? JSON.stringify(payment);
  const payer = payment.payer ?? "external-x402-client";
  if (requirements?.nonce && usedNonces.has(requirements.nonce)) {
    return { ok: false, statusCode: 409, reason: "Payment nonce has already been used." };
  }

  const requirementsError = validateRequirements(requirements);
  if (requirementsError) return { ok: false, reason: requirementsError };

  const providerRequirements = paymentProvider.mode === "sandbox" ? requirements : payment.accepted ?? officialPaymentRequirements(requirements);
  const settlement = await paymentProvider.verifyAndSettle({ payment, requirements: providerRequirements, payer });
  if (!settlement.ok) return { ok: false, statusCode: settlement.statusCode, reason: settlement.reason, data: settlement.data };

  const paymentId = crypto
    .createHash("sha256")
    .update(`${canonicalPayment(requirements, payer)}|${signature}|${JSON.stringify(settlement.settlement)}`)
    .digest("hex")
    .slice(0, 16);

  payments.set(paymentId, {
    id: paymentId,
    payer,
    seller: SELLER_ADDRESS,
    amount: requirements.amount,
    asset: requirements.asset,
    network: requirements.network,
    resource: requirements.resource,
    mode: settlement.settlement.mode,
    transaction: settlement.settlement.transaction,
    provider: paymentProvider.mode,
    facilitatorExtensionResponses: settlement.settlement.extensionResponses,
    settledAt: new Date().toISOString()
  });
  usedNonces.add(requirements.nonce);
  issuedRequirements.delete(requirements.nonce);
  logEvent("payment_verified", {
    receiptId: paymentId,
    payer,
    resource: requirements.resource,
    settlement: settlement.settlement.mode,
    facilitatorExtensionResponses: settlement.settlement.extensionResponses
  });
  logEvent("receipt_generated", {
    receiptId: paymentId,
    resource: requirements.resource,
    amount: requirements.amount,
    asset: requirements.asset
  });

  return { ok: true, receipt: payments.get(paymentId) };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
  });
}

function apiDiscovery(req) {
  const origin = publicOrigin(req);
  const exampleSlug = "will-gideon-saar-be-the-next-prime-minister-of-israel";
  const paidPath = `${MARKET_BRIEF_PATH}?slug=${exampleSlug}`;
  const paidUrl = `${origin}${paidPath}`;
  const trendingUrl = `${origin}/api/markets/trending`;

  return {
    name: API_NAME,
    description: "Machine-payable read-only Polymarket market intelligence for AI agents and bots.",
    version: "1.1.0",
    what: "x402nano is a machine-payable Polymarket market intelligence API. Agents can discover markets for free, request a paid brief, receive an HTTP 402 challenge, retry with X-PAYMENT, and get unlocked JSON plus a receipt.",
    whoFor: [
      "AI agent builders",
      "market-monitoring bots",
      "x402 and Base builders",
      "API developers testing machine-payable data",
      "Polymarket research and automation workflows"
    ],
    boundaries: [
      "Read-only public market intelligence.",
      "No trading execution.",
      "No custody.",
      "No betting advice.",
      "No buy/sell recommendation.",
      "No user account or API key required."
    ],
    x402: {
      version: PAYMENT_MODE === "facilitator" ? "1" : "sandbox-1",
      settlement: paymentProvider.settlement,
      paymentMode: paymentProvider.mode,
      provider: paymentProvider.describe(),
      productionReadySwap: "Set X402_PAYMENT_MODE=facilitator and provide X402_FACILITATOR_URL. Clients then send a real x402 payment payload in X-PAYMENT.",
      paymentHeader: PAYMENT_HEADER,
      supportedSchemes: ["exact"],
      supportedNetworks: [NETWORK],
      supportedAssets: [ASSET],
      sellerWallet: sellerWalletStatus()
    },
    product: {
      ...marketProductStatus(),
      paymentUnlocks: [
        "receipt metadata",
        "market snapshot",
        "current outcome pricing",
        "top outcome details",
        "24h probability movement when public CLOB history is available",
        "volume and liquidity context",
        "resolution date/source context",
        "market movement, attention, and data completeness scores",
        "data quality notes and safety boundaries"
      ]
    },
    links: {
      self: `${origin}/.well-known/x402.json`,
      health: `${origin}/api/health`,
      version: `${origin}/api/version`,
      pricing: `${origin}/api/pricing`,
      schema: `${origin}/api/schema`,
      trendingMarkets: trendingUrl,
      paidResource: paidUrl,
      sandboxSigner: paymentProvider.isClientSigningAvailable ? `${origin}/api/payments/sign` : null,
      receiptTemplate: `${origin}/api/receipts/{receiptId}`
    },
    endpoints: [
      {
        method: "GET",
        path: `${MARKET_BRIEF_PATH}?slug={polymarket-slug}`,
        description: "Returns a read-only Polymarket market intelligence brief after a valid x402 payment header is verified.",
        price: `${PRICE_USDC} ${ASSET}`,
        unlocks: "Unlocked JSON market brief plus receipt.",
        payment: {
          header: PAYMENT_HEADER,
          challengeStatus: 402,
          requirementsField: "paymentRequirements",
          retryBehavior: "Repeat the same request with X-PAYMENT set to the encoded payment payload."
        },
        responseSchema: "/api/schema",
        flow: ["discover", "request market brief", "receive 402 requirements", "sign payment", "retry with X-PAYMENT", "receive receipt and market brief JSON"]
      },
      {
        method: "GET",
        path: "/api/markets/trending",
        description: "Returns free Polymarket market candidates for agents to inspect before paying for a brief.",
        price: "free"
      }
    ],
    examples: {
      freeTrendingRequest: {
        curl: `curl "${trendingUrl}"`
      },
      paidBriefRequest: {
        curl: `curl -i "${paidUrl}"`,
        expectedStatusWithoutPayment: 402,
        expectedChallengeFields: ["paymentRequirements", "x402"],
        retryHeader: `${PAYMENT_HEADER}: <signed-x402-payment>`
      },
      paidBriefRetry: {
        curl: `curl "${paidUrl}" -H "${PAYMENT_HEADER}: <signed-x402-payment>"`,
        expectedStatusWithValidPayment: 200
      },
      example402Response: {
        error: "Payment required",
        paymentRequirements: {
          x402Version: PAYMENT_MODE === "facilitator" ? "1" : "sandbox-1",
          scheme: "exact",
          network: NETWORK,
          asset: ASSET,
          amount: PRICE_USDC,
          payTo: SELLER_ADDRESS,
          resource: paidPath,
          description: "x402nano read-only Polymarket market intelligence brief. Informational only; no trading, betting, or financial advice.",
          mimeType: "application/json"
        }
      },
      exampleUnlockedResponse: {
        status: "unlocked",
        receipt: {
          id: "receipt-id-after-payment",
          payer: "external-x402-client",
          seller: SELLER_ADDRESS,
          amount: PRICE_USDC,
          asset: ASSET,
          network: NETWORK,
          settledAt: "2026-06-11T00:00:00.000Z"
        },
        data: {
          briefType: "read-only-market-intelligence",
          market: {
            slug: exampleSlug,
            status: "active"
          },
          snapshot: {
            generatedAt: "2026-06-11T00:00:00.000Z",
            source: "polymarket:gamma",
            leadingOutcome: "Yes",
            leadingOutcomeImpliedProbability: "50.0%"
          },
          movement: {
            window: "24h",
            source: "polymarket:clob",
            available: true,
            direction: "up",
            absoluteChange: "0.025",
            trajectory: [
              {
                timestamp: "2026-06-10T00:00:00.000Z",
                probability: "0.475"
              },
              {
                timestamp: "2026-06-11T00:00:00.000Z",
                probability: "0.500"
              }
            ]
          },
          metrics: {
            volume24h: "17,260.91",
            liquidity: "81,697.04"
          },
          resolution: {
            endDate: "2026-12-31T00:00:00Z",
            source: "Use the Polymarket market page and rules for resolution criteria."
          },
          scores: {
            marketMovementScore: 45,
            attentionScore: 70,
            dataCompletenessScore: 100,
            unusualMovementFlag: false
          }
        }
      }
    },
    schema: {
      contentType: "application/json",
      fullSchemaUrl: `${origin}/api/schema`,
      response: marketBriefSchema
    }
  };
}

function contentTypeFor(filePath) {
  const extension = path.extname(filePath);
  return {
    ".css": "text/css",
    ".html": "text/html",
    ".js": "text/javascript",
    ".json": "application/json",
    ".map": "application/json",
    ".svg": "image/svg+xml"
  }[extension] ?? "application/octet-stream";
}

async function serveStatic(req, res) {
  const url = requestUrl(req);
  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const safePath = path
    .normalize(decodeURIComponent(requestedPath))
    .replace(/^(\.\.[/\\])+/, "")
    .replace(/^[/\\]/, "");
  const filePath = path.join(DIST_DIR, safePath);

  if (!filePath.startsWith(DIST_DIR)) {
    return json(res, 403, { error: "Forbidden" });
  }

  try {
    const file = await fs.readFile(filePath);
    res.writeHead(200, { "Content-Type": contentTypeFor(filePath) });
    return res.end(file);
  } catch {
    try {
      const index = await fs.readFile(path.join(DIST_DIR, "index.html"));
      res.writeHead(200, { "Content-Type": "text/html" });
      return res.end(index);
    } catch {
      return json(res, 404, {
        error: "Frontend build not found",
        hint: "Run npm run build, then restart the seller server."
      });
    }
  }
}

const server = http.createServer(async (req, res) => {
  const limit = rateLimit(req);
  if (!limit.ok) {
    return json(res, 429, { error: "Too many requests", retryAfterSeconds: limit.retryAfter }, { "Retry-After": String(limit.retryAfter) });
  }

  if (req.method === "OPTIONS") {
    return json(res, 204, {});
  }

  const url = requestUrl(req);
  await refreshProductionLeadPack();

  if (req.method === "GET" && (url.pathname === "/api/discover" || url.pathname === "/.well-known/x402.json")) {
    return json(res, 200, apiDiscovery(req));
  }

  if (req.method === "GET" && url.pathname === "/api/health") {
    return json(res, 200, {
      status: "ok",
      service: API_NAME,
      mode: paymentProvider.mode,
      paymentMode: paymentProvider.mode,
      settlement: paymentProvider.settlement,
      sellerWallet: sellerWalletStatus(),
      product: marketProductStatus(),
      uptimeSeconds: Math.floor(process.uptime()),
      issuedQuotes: issuedRequirements.size,
      settledPayments: payments.size,
      eventsLogged: eventLog.length
    });
  }

  if (req.method === "GET" && url.pathname === "/api/version") {
    return json(res, 200, versionPayload());
  }

  if (req.method === "GET" && url.pathname === "/api/pricing") {
    return json(res, 200, {
      resource: `${MARKET_BRIEF_PATH}?slug={polymarket-slug}`,
      freeResource: "/api/markets/trending",
      proofResource: `${MARKET_BRIEF_PATH}?slug=will-gideon-saar-be-the-next-prime-minister-of-israel`,
      amount: PRICE_USDC,
      asset: ASSET,
      network: NETWORK,
      seller: SELLER_ADDRESS,
      scheme: "exact",
      paymentHeader: PAYMENT_HEADER,
      quoteTtlSeconds: Math.floor(PAYMENT_TTL_MS / 1000),
      paymentMode: paymentProvider.mode,
      sellerWallet: sellerWalletStatus(),
      product: marketProductStatus(),
      provider: paymentProvider.describe()
    });
  }

  if (req.method === "GET" && url.pathname === "/api/schema") {
    return json(res, 200, {
      resource: `${MARKET_BRIEF_PATH}?slug={polymarket-slug}`,
      contentType: "application/json",
      schema: marketBriefSchema
    });
  }

  if (req.method === "GET" && url.pathname === "/api/events") {
    return json(res, 200, {
      events: eventLog.slice(0, 25),
      totalRetained: eventLog.length
    });
  }

  if (req.method === "GET" && url.pathname === "/api/markets/status") {
    if (!MARKET_BRIEF_ENABLED) return json(res, 404, { error: "Market brief API is disabled." });
    try {
      return json(res, 200, await polymarketStatus());
    } catch (error) {
      return json(res, 502, {
        status: "error",
        source: "polymarket:gamma",
        reason: error.message
      });
    }
  }

  if (req.method === "GET" && url.pathname === "/api/markets/trending") {
    if (!MARKET_BRIEF_ENABLED) return json(res, 404, { error: "Market brief API is disabled." });
    try {
      const limit = Math.min(Number(url.searchParams.get("limit") ?? process.env.POLYMARKET_MARKET_LIMIT ?? 10) || 10, 25);
      const markets = await fetchTrendingMarkets({ limit });
      return json(res, 200, {
        status: "ok",
        source: "polymarket:gamma",
        count: markets.length,
        markets: markets.map(marketPreview),
        disclaimer: process.env.MARKET_BRIEF_DISCLAIMER || "Informational only. Not trading, betting, or financial advice."
      });
    } catch (error) {
      return json(res, 502, {
        status: "error",
        source: "polymarket:gamma",
        reason: error.message
      });
    }
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/receipts/")) {
    const receiptId = url.pathname.split("/").pop();
    const receipt = payments.get(receiptId);
    if (!receipt) return json(res, 404, { error: "Receipt not found" });
    return json(res, 200, { receipt });
  }

  if (req.method === "POST" && url.pathname === "/api/payments/sign") {
    try {
      if (!paymentProvider.isClientSigningAvailable) {
        return json(res, 501, {
          error: "Sandbox signer disabled",
          reason: "Use a wallet or x402 client to create a real payment payload in facilitator mode."
        });
      }

      const body = await readBody(req);
      const requirementsError = validateRequirements(body.requirements);
      if (requirementsError) return json(res, 400, { error: requirementsError });

      const signed = await paymentProvider.createClientPayment({
        requirements: body.requirements,
        payer: body.payer ?? BUYER_ADDRESS
      });
      return json(res, signed.statusCode ?? 200, signed);
    } catch {
      return json(res, 400, { error: "Invalid payment signing request." });
    }
  }

  if (req.method === "POST" && url.pathname === "/api/payments/browser-wallet-message") {
    try {
      if (paymentProvider.mode !== "sandbox") {
        return json(res, 501, {
          error: "Browser wallet sandbox disabled",
          reason: "Use a real x402 wallet client when the server runs in facilitator mode."
        });
      }

      const body = await readBody(req);
      const requirementsError = validateRequirements(body.requirements);
      if (requirementsError) return json(res, 400, { error: requirementsError });
      if (!body.payer) return json(res, 400, { error: "Payer wallet address is required." });

      return json(res, 200, {
        payer: body.payer,
        requirements: body.requirements,
        message: walletPaymentMessage(body.requirements, body.payer)
      });
    } catch {
      return json(res, 400, { error: "Invalid browser wallet signing request." });
    }
  }

  if (req.method === "GET" && isProtectedResource(url.pathname)) {
    const resource = paymentResourceFromUrl(url);
    const isLeadPack = isLeadPackResource(url.pathname);
    const isMarketBrief = isMarketBriefResource(url.pathname);
    const filter = isLeadPack ? locationFilterFromUrl(url) : { active: false };
    let matchedLeadPack = [];

    if (isLeadPack) {
      return json(res, 410, {
        error: "Legacy resource retired",
        status: "retired",
        replacement: "/api/markets/brief?slug=...",
        service: API_NAME
      });
    }

    if (isMarketBrief && !MARKET_BRIEF_ENABLED) {
      return json(res, 404, { error: "Market brief API is disabled." });
    }

    if (isMarketBrief && !url.searchParams.get("slug")) {
      return json(res, 400, {
        error: "Market slug required",
        reason: "Call /api/markets/brief?slug=<market-slug> with a Polymarket market slug."
      });
    }

    const payment = parsePaymentHeader(req.headers["x-payment"] ?? req.headers["payment-signature"]);
    const verification = await verifyPayment(payment);

    if (!verification.ok) {
      const requirements = paymentRequirements(resource, filter);
      const paymentRequired = officialPaymentRequired(req, requirements, verification.reason);
      const paymentRequiredHeader = encodePaymentRequiredHeader(paymentRequired);

      return json(
        res,
        verification.statusCode ?? 402,
        {
          error: verification.statusCode === 409 ? "Payment replay rejected" : "Payment required",
          reason: verification.reason,
          paymentRequirements: requirements,
          x402: paymentRequired
        },
        {
          "X-PAYMENT-REQUIRED": "true",
          "PAYMENT-REQUIRED": paymentRequiredHeader
        }
      );
    }

    if (isMarketBrief) {
      try {
        const market = await fetchMarketBySlug(url.searchParams.get("slug"));
        const priceHistory24h = await fetchMarketPriceHistory(market, { interval: "1d", fidelity: 60 });
        const brief = buildMarketBrief(market, { priceHistory24h });
        const paymentResponse = {
          success: true,
          transaction: verification.receipt.transaction ?? verification.receipt.id,
          network: verification.receipt.network,
          amount: verification.receipt.amount,
          payer: verification.receipt.payer
        };

        logEvent("market_brief_unlocked", {
          receiptId: verification.receipt.id,
          resource,
          slug: market.slug
        });

        return json(res, 200, {
          status: "unlocked",
          receipt: publicReceipt(verification.receipt),
          data: brief
        }, {
          "PAYMENT-RESPONSE": encodePaymentResponseHeader(paymentResponse),
          "X-PAYMENT-RESPONSE": encodePaymentResponseHeader(paymentResponse)
        });
      } catch (error) {
        return json(res, 502, {
          error: "Market brief unavailable",
          reason: error.message,
          source: "polymarket:gamma"
        });
      }
    }

    return json(res, 410, {
      error: "Legacy resource retired",
      status: "retired",
      replacement: "/api/markets/brief?slug=...",
      service: API_NAME
    });
  }

  if (req.method === "GET") {
    if (url.pathname.startsWith("/api/")) {
      return json(res, 404, {
        error: "API route not found",
        service: API_NAME,
        available: ["/api/markets/trending", "/api/markets/brief?slug=..."]
      });
    }

    return serveStatic(req, res);
  }

  return json(res, 404, { error: "Not found" });
});

await refreshProductionLeadPack({ force: true });

server.listen(PORT, HOST, () => {
  const configErrors = productionConfigErrors();
  if (configErrors.length > 0) {
    console.error("Invalid Base mainnet x402 production configuration:");
    for (const error of configErrors) console.error(`- ${error}`);
    process.exit(1);
  }

  console.log(`x402 seller server listening on http://${HOST}:${PORT}`);
});
