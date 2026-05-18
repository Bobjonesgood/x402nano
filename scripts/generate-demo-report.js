import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_API_ORIGIN = "https://x402nano.onrender.com";

const apiOrigin = (process.env.AGENT_API_ORIGIN ?? DEFAULT_API_ORIGIN).replace(/\/$/, "");
const outputPath = process.env.DEMO_REPORT_PATH ?? path.resolve("demo-report.json");

async function fetchJson(pathOrUrl, options = {}) {
  const url = new URL(pathOrUrl, apiOrigin).toString();
  const startedAt = Date.now();
  const response = await fetch(url, options);
  const elapsedMs = Date.now() - startedAt;
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  return { url, status: response.status, elapsedMs, body };
}

function summarizeLeads(leads) {
  return leads.map(lead => ({
    id: lead.id,
    businessName: lead.businessName ?? lead.company,
    industry: lead.industry,
    location: lead.location,
    estimatedJobValue: lead.estimatedJobValue,
    buyingIntent: lead.buyingIntent ?? lead.intent,
    recommendedOpener: lead.recommendedOpener,
    confidenceScore: lead.confidenceScore ?? lead.fit
  }));
}

async function run() {
  const report = {
    generatedAt: new Date().toISOString(),
    apiOrigin,
    proof: "Autonomous buyer discovers the LeadNestAI paid API, receives 402, pays, retries with X-PAYMENT, and receives protected lead intelligence.",
    steps: []
  };

  const discovery = await fetchJson("/.well-known/x402.json");
  report.steps.push({
    name: "discover",
    method: "GET",
    url: discovery.url,
    status: discovery.status,
    elapsedMs: discovery.elapsedMs,
    paymentMode: discovery.body.x402?.paymentMode,
    settlement: discovery.body.x402?.settlement,
    paidResource: discovery.body.links?.paidResource
  });

  const challenge = await fetchJson(discovery.body.links.paidResource);
  report.steps.push({
    name: "request-protected-resource",
    method: "GET",
    url: challenge.url,
    status: challenge.status,
    elapsedMs: challenge.elapsedMs,
    challenge: {
      amount: challenge.body.paymentRequirements?.amount,
      asset: challenge.body.paymentRequirements?.asset,
      network: challenge.body.paymentRequirements?.network,
      seller: challenge.body.paymentRequirements?.payTo,
      nonce: challenge.body.paymentRequirements?.nonce
    }
  });

  const signerUrl = discovery.body.links?.sandboxSigner;
  if (!signerUrl) {
    throw new Error("Demo report requires sandboxSigner. Facilitator mode needs an external X-PAYMENT payload.");
  }

  const payment = await fetchJson(signerUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      payer: process.env.AGENT_BUYER_ADDRESS ?? "0xAutonomousAgentWallet",
      requirements: challenge.body.paymentRequirements
    })
  });
  report.steps.push({
    name: "create-payment",
    method: "POST",
    url: payment.url,
    status: payment.status,
    elapsedMs: payment.elapsedMs,
    payer: payment.body.payer,
    paymentHeaderCreated: Boolean(payment.body.encodedPayment)
  });

  const unlocked = await fetchJson(discovery.body.links.paidResource, {
    headers: {
      [discovery.body.x402.paymentHeader]: payment.body.encodedPayment
    }
  });
  report.steps.push({
    name: "retry-with-payment",
    method: "GET",
    url: unlocked.url,
    status: unlocked.status,
    elapsedMs: unlocked.elapsedMs,
    receipt: unlocked.body.receipt,
    protectedRecords: Array.isArray(unlocked.body.data) ? unlocked.body.data.length : 0
  });

  report.result = {
    ok: unlocked.status === 200,
    receiptId: unlocked.body.receipt?.id,
    settlement: unlocked.body.receipt?.mode,
    leads: summarizeLeads(unlocked.body.data ?? [])
  };

  await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Demo report written to ${outputPath}`);
  console.log(`receipt: ${report.result.receiptId}`);
  console.log(`protected records: ${report.result.leads.length}`);
}

run().catch(error => {
  console.error(`Demo report failed: ${error.message}`);
  process.exitCode = 1;
});
