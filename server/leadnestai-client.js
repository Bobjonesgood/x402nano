import { createHash } from "node:crypto";

const LEAD_HANDOFF_TIMEOUT_MS = 10000;

function secretFingerprint(value) {
  if (!value) return null;
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

function canonicalLeadNestAIUrl(value) {
  const apiUrl = value.trim();
  if (!apiUrl) return "";

  try {
    const url = new URL(apiUrl);
    if (url.protocol === "https:" && url.hostname === "leadnestai.net") {
      url.hostname = "www.leadnestai.net";
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    return apiUrl;
  }
}

export function leadNestAIConfig(env = process.env) {
  return {
    enabled: env.LEAD_HANDOFF_ENABLED === "true",
    apiUrl: canonicalLeadNestAIUrl(env.LEADNESTAI_API_URL ?? ""),
    ingestSecret: (env.LEADNESTAI_INGEST_SECRET ?? "").trim(),
    source: (env.LEADNESTAI_SOURCE_ID ?? "x402nano").trim() || "x402nano"
  };
}

export function leadNestAIReadiness(config) {
  return {
    enabled: config.enabled,
    configured: Boolean(config.apiUrl && config.ingestSecret),
    apiUrl: config.apiUrl || null,
    source: config.source,
    secretFingerprint: secretFingerprint(config.ingestSecret),
    mode: "manual-selected-leads-only"
  };
}

export function leadIdentityKey(lead) {
  return [lead.businessName, lead.location, lead.industry]
    .map(value => String(value ?? "").trim().toLowerCase())
    .join("|");
}

export function buildLeadHandoffPayload({ config, receipt, lead }) {
  const externalLeadId = lead.id;

  return {
    source: config.source,
    receiptId: receipt.id,
    unlockMode: receipt.mode,
    externalLeadId,
    businessName: lead.businessName,
    industry: lead.industry,
    location: lead.location,
    estimatedJobValue: lead.estimatedJobValue,
    buyingIntent: lead.buyingIntent,
    painPoints: Array.isArray(lead.painPoints) ? lead.painPoints : [],
    recommendedOpener: lead.recommendedOpener,
    confidenceScore: lead.confidenceScore,
    idempotencyKey: `${config.source}:${receipt.id}:${externalLeadId}`,
    dedupeKey: leadIdentityKey(lead),
    workflow: {
      startAutomaticOutreach: false,
      mode: "manual-verification-first"
    }
  };
}

export async function submitLeadToLeadNestAI({ config, payload }) {
  if (!config.enabled) {
    return {
      ok: false,
      statusCode: 503,
      status: "disabled",
      reason: "LeadNestAI handoff is disabled. Set LEAD_HANDOFF_ENABLED=true after local testing."
    };
  }

  if (!config.apiUrl || !config.ingestSecret) {
    return {
      ok: false,
      statusCode: 503,
      status: "not_configured",
      reason: "LeadNestAI handoff requires LEADNESTAI_API_URL and LEADNESTAI_INGEST_SECRET."
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LEAD_HANDOFF_TIMEOUT_MS);
  const url = new URL("/api/integrations/x402/leads", config.apiUrl).toString();

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${config.ingestSecret}`,
        "Content-Type": "application/json",
        "Idempotency-Key": payload.idempotencyKey
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    const body = await response.json().catch(() => ({}));

    return {
      ok: response.ok,
      statusCode: response.status,
      status: body.status ?? (response.ok ? "accepted" : "failed"),
      leadId: body.leadId,
      duplicate: body.status === "duplicate" || body.duplicate === true,
      response: body
    };
  } catch (error) {
    return {
      ok: false,
      statusCode: 502,
      status: "failed",
      reason: error.name === "AbortError" ? "LeadNestAI handoff timed out." : error.message
    };
  } finally {
    clearTimeout(timeout);
  }
}
