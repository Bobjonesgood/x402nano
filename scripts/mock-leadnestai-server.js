import crypto from "node:crypto";
import http from "node:http";

const PORT = Number(process.env.LEADNESTAI_MOCK_PORT ?? 5055);
const HOST = process.env.LEADNESTAI_MOCK_HOST ?? "127.0.0.1";
const INGEST_SECRET = process.env.X402_INGEST_SECRET ?? process.env.LEADNESTAI_INGEST_SECRET ?? "local-test-secret";

const leadsByIdempotency = new Map();
const leadsByIdentity = new Map();
const eventLog = [];

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

function json(res, statusCode, body) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Authorization,Content-Type,Idempotency-Key"
  });
  res.end(JSON.stringify(body, null, 2));
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

function identityKey(lead) {
  return [lead.businessName, lead.location, lead.industry]
    .map(value => String(value ?? "").trim().toLowerCase())
    .join("|");
}

function validateLead(lead) {
  const required = [
    "source",
    "receiptId",
    "unlockMode",
    "externalLeadId",
    "businessName",
    "industry",
    "location",
    "estimatedJobValue",
    "buyingIntent",
    "painPoints",
    "recommendedOpener",
    "confidenceScore"
  ];

  const missing = required.filter(field => lead[field] === undefined || lead[field] === null || lead[field] === "");
  if (missing.length) return `Missing required fields: ${missing.join(", ")}`;
  if (!Array.isArray(lead.painPoints)) return "painPoints must be an array.";
  return "";
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return json(res, 204, {});

  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "GET" && url.pathname === "/api/health") {
    return json(res, 200, {
      status: "ok",
      service: "LeadNestAI mock ingest",
      storedLeads: leadsByIdempotency.size,
      eventsLogged: eventLog.length,
      automaticOutreach: false
    });
  }

  if (req.method === "GET" && url.pathname === "/api/events") {
    return json(res, 200, {
      events: eventLog.slice(0, 25),
      totalRetained: eventLog.length
    });
  }

  if (req.method === "POST" && url.pathname === "/api/integrations/x402/leads") {
    const authorization = req.headers.authorization ?? "";
    if (authorization !== `Bearer ${INGEST_SECRET}`) {
      return json(res, 401, { status: "unauthorized", error: "Invalid ingest secret." });
    }

    try {
      const lead = await readBody(req);
      logEvent("x402_lead_received", {
        source: lead.source,
        receiptId: lead.receiptId,
        externalLeadId: lead.externalLeadId
      });

      const validationError = validateLead(lead);
      if (validationError) return json(res, 400, { status: "invalid", error: validationError });

      const idempotencyKey = lead.idempotencyKey ?? req.headers["idempotency-key"] ?? `${lead.source}:${lead.receiptId}:${lead.externalLeadId}`;
      const businessKey = lead.dedupeKey ?? identityKey(lead);
      const existingLeadId = leadsByIdempotency.get(idempotencyKey) ?? leadsByIdentity.get(businessKey);

      if (existingLeadId) {
        logEvent("x402_lead_duplicate", {
          idempotencyKey,
          dedupeKey: businessKey,
          leadId: existingLeadId
        });
        return json(res, 200, {
          status: "duplicate",
          duplicate: true,
          leadId: existingLeadId
        });
      }

      const leadId = `mock-lead-${String(leadsByIdempotency.size + 1).padStart(3, "0")}`;
      leadsByIdempotency.set(idempotencyKey, leadId);
      leadsByIdentity.set(businessKey, leadId);

      logEvent("x402_lead_stored", {
        leadId,
        idempotencyKey,
        dedupeKey: businessKey
      });
      logEvent("workflow_started", {
        leadId,
        mode: "manual-verification-first",
        automaticOutreach: false
      });

      return json(res, 201, {
        status: "stored",
        duplicate: false,
        leadId
      });
    } catch {
      return json(res, 400, { status: "invalid", error: "Invalid JSON payload." });
    }
  }

  return json(res, 404, { error: "Not found" });
});

server.listen(PORT, HOST, () => {
  console.log(`LeadNestAI mock ingest listening on http://${HOST}:${PORT}`);
});
