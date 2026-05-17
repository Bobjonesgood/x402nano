import crypto from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { encodePaymentRequiredHeader, encodePaymentResponseHeader } from "@x402/core/http";
import { createFacilitatorProvider, createSandboxProvider } from "./payment-providers.js";

const PORT = Number(process.env.PORT ?? 4021);
const HOST = process.env.HOST ?? "0.0.0.0";
const PAYMENT_MODE = process.env.X402_PAYMENT_MODE ?? "sandbox";
const FACILITATOR_SECRET = process.env.FACILITATOR_SECRET ?? "sandbox-facilitator-secret";
const SELLER_ADDRESS = process.env.SELLER_ADDRESS ?? process.env.PARTNER_SELLER_ADDRESS ?? "0xSellerPremiumLeadDesk";
const BUYER_ADDRESS = process.env.BUYER_ADDRESS ?? "0xAutonomousAgentWallet";
const PRICE_USDC = process.env.PRICE_USDC ?? "0.05";
const NETWORK = process.env.X402_NETWORK ?? "eip155:84532";
const ASSET = process.env.X402_ASSET ?? "USDC";
const API_NAME = "Payment-Aware Premium Lead API";
const RELEASE_VERSION = process.env.RELEASE_VERSION ?? "0.1.0";
const RELEASE_NAME = process.env.RELEASE_NAME ?? "Payment-Aware Sandbox Proof";
const PAYMENT_HEADER = "X-PAYMENT";
const PAYMENT_TTL_MS = 5 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 90;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.resolve(__dirname, "../dist");
const EVM_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

const premiumLeads = [
  {
    id: "lead_7fb2",
    company: "Northstar Robotics",
    contact: "Maya Chen",
    intent: "Evaluating autonomous procurement agents",
    budget: "$18k pilot",
    fit: 94
  },
  {
    id: "lead_31ac",
    company: "LedgerFlow Ops",
    contact: "Darius Cole",
    intent: "Needs pay-per-call API monetization",
    budget: "$42k platform upgrade",
    fit: 89
  },
  {
    id: "lead_a902",
    company: "SignalFoundry AI",
    contact: "Elena Price",
    intent: "Building agent-discoverable data feeds",
    budget: "$27k sandbox rollout",
    fit: 91
  }
];

const payments = new Map();
const issuedRequirements = new Map();
const usedNonces = new Set();
const rateLimits = new Map();

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
    "Payment-Aware Sandbox",
    "Sign this message to authorize sandbox access.",
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
        facilitatorApiKey: process.env.X402_FACILITATOR_API_KEY
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
        required: ["id", "company", "contact", "intent", "budget", "fit"],
        properties: {
          id: { type: "string" },
          company: { type: "string" },
          contact: { type: "string" },
          intent: { type: "string" },
          budget: { type: "string" },
          fit: { type: "number", minimum: 0, maximum: 100 }
        }
      }
    }
  }
};

function json(res, statusCode, body, extraHeaders = {}) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,X-PAYMENT,PAYMENT-SIGNATURE",
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
    build: buildInfo()
  };
}

function clientId(req) {
  return req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ?? req.socket.remoteAddress ?? "unknown";
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

function paymentRequirements() {
  pruneExpiredRequirements();

  const requirements = {
    x402Version: PAYMENT_MODE === "facilitator" ? "1" : "sandbox-1",
    scheme: "exact",
    network: NETWORK,
    asset: ASSET,
    amount: PRICE_USDC,
    payTo: SELLER_ADDRESS,
    resource: "/api/premium-leads",
    description: "Premium lead data for autonomous sales agents",
    mimeType: "application/json",
    maxTimeoutSeconds: Math.floor(PAYMENT_TTL_MS / 1000),
    expiresAt: new Date(Date.now() + PAYMENT_TTL_MS).toISOString(),
    nonce: crypto.randomUUID(),
    facilitator: paymentProvider.mode === "facilitator" ? paymentProvider.describe().facilitatorUrl : undefined
  };

  issuedRequirements.set(requirements.nonce, requirements);
  return requirements;
}

function officialPaymentRequirements(requirements) {
  return {
    scheme: requirements.scheme,
    network: requirements.network,
    asset: requirements.asset,
    amount: requirements.amount,
    payTo: requirements.payTo,
    maxTimeoutSeconds: requirements.maxTimeoutSeconds,
    extra: {
      nonce: requirements.nonce,
      expiresAt: requirements.expiresAt,
      resource: requirements.resource
    }
  };
}

function officialPaymentRequired(req, requirements, error = "Payment required") {
  const origin = publicOrigin(req);
  return {
    x402Version: 2,
    error,
    resource: {
      url: `${origin}${requirements.resource}`,
      description: requirements.description,
      mimeType: requirements.mimeType,
      serviceName: API_NAME,
      tags: ["leads", "agents", "x402", "sandbox"]
    },
    accepts: [officialPaymentRequirements(requirements)]
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

  return {
    x402Version: String(requirements.x402Version ?? (paymentProvider.mode === "facilitator" ? "1" : "sandbox-1")),
    scheme: requirements.scheme,
    network: requirements.network,
    asset: requirements.asset,
    amount: requirements.amount,
    payTo: requirements.payTo,
    resource: requirements.resource ?? requirements.extra?.resource ?? "/api/premium-leads",
    description: requirements.description ?? "Premium lead data for autonomous sales agents",
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
  if (requirements.resource !== "/api/premium-leads") return "Payment was signed for a different resource.";
  if (!requirements.nonce) return "Payment nonce is missing.";
  if (!requirementsMatchIssued(requirements)) return "Payment quote was not issued by this seller server.";
  if (new Date(requirements.expiresAt).getTime() < Date.now()) return "Payment quote expired.";
  return "";
}

async function verifyPayment(payment) {
  const submittedRequirements = payment?.requirements ?? payment?.accepted;
  const requirements = normalizeRequirements(submittedRequirements, payment);

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
      settledAt: new Date().toISOString()
  });
  usedNonces.add(requirements.nonce);
  issuedRequirements.delete(requirements.nonce);

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
  return {
    name: API_NAME,
    description: "An x402-ready seller endpoint that autonomous agents can discover, price, pay, retry, and unlock.",
    version: "1.0.0",
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
    links: {
      self: `${origin}/.well-known/x402.json`,
      health: `${origin}/api/health`,
      version: `${origin}/api/version`,
      pricing: `${origin}/api/pricing`,
      schema: `${origin}/api/schema`,
      paidResource: `${origin}/api/premium-leads`,
      sandboxSigner: paymentProvider.isClientSigningAvailable ? `${origin}/api/payments/sign` : null,
      receiptTemplate: `${origin}/api/receipts/{receiptId}`
    },
    endpoints: [
      {
        method: "GET",
        path: "/api/premium-leads",
        description: "Returns premium lead data after a valid x402-style payment header is verified.",
        price: `${PRICE_USDC} ${ASSET}`,
        payment: {
          header: PAYMENT_HEADER,
          challengeStatus: 402,
          requirementsField: "paymentRequirements",
          retryBehavior: "Repeat the same request with X-PAYMENT set to the encoded payment payload."
        },
        responseSchema: "/api/schema",
        flow: ["discover", "request", "receive 402 requirements", "sign payment", "retry with X-PAYMENT", "receive protected data"]
      }
    ]
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

  if (req.method === "GET" && (url.pathname === "/api/discover" || url.pathname === "/.well-known/x402.json")) {
    return json(res, 200, apiDiscovery(req));
  }

  if (req.method === "GET" && url.pathname === "/api/health") {
    return json(res, 200, {
      status: "ok",
      service: API_NAME,
      mode: "sandbox",
      paymentMode: paymentProvider.mode,
      settlement: paymentProvider.settlement,
      sellerWallet: sellerWalletStatus(),
      uptimeSeconds: Math.floor(process.uptime()),
      issuedQuotes: issuedRequirements.size,
      settledPayments: payments.size
    });
  }

  if (req.method === "GET" && url.pathname === "/api/version") {
    return json(res, 200, versionPayload());
  }

  if (req.method === "GET" && url.pathname === "/api/pricing") {
    return json(res, 200, {
      resource: "/api/premium-leads",
      amount: PRICE_USDC,
      asset: ASSET,
      network: NETWORK,
      seller: SELLER_ADDRESS,
      scheme: "exact",
      paymentHeader: PAYMENT_HEADER,
      quoteTtlSeconds: Math.floor(PAYMENT_TTL_MS / 1000),
      paymentMode: paymentProvider.mode,
      sellerWallet: sellerWalletStatus(),
      provider: paymentProvider.describe()
    });
  }

  if (req.method === "GET" && url.pathname === "/api/schema") {
    return json(res, 200, {
      resource: "/api/premium-leads",
      contentType: "application/json",
      schema: leadSchema
    });
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

  if (req.method === "GET" && url.pathname === "/api/premium-leads") {
    const payment = parsePaymentHeader(req.headers["x-payment"] ?? req.headers["payment-signature"]);
    const verification = await verifyPayment(payment);

    if (!verification.ok) {
      const requirements = paymentRequirements();
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

    const paymentResponse = {
      success: true,
      transaction: verification.receipt.transaction ?? verification.receipt.id,
      network: verification.receipt.network,
      amount: verification.receipt.amount,
      payer: verification.receipt.payer
    };

    return json(res, 200, {
      status: "unlocked",
      receipt: verification.receipt,
      data: premiumLeads
    }, {
      "PAYMENT-RESPONSE": encodePaymentResponseHeader(paymentResponse),
      "X-PAYMENT-RESPONSE": encodePaymentResponseHeader(paymentResponse)
    });
  }

  if (req.method === "GET") {
    return serveStatic(req, res);
  }

  return json(res, 404, { error: "Not found" });
});

server.listen(PORT, HOST, () => {
  console.log(`x402 seller server listening on http://${HOST}:${PORT}`);
});
