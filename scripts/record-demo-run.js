import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_API_ORIGIN = "https://x402nano.onrender.com";
const DEFAULT_BUYER = "0xAutonomousAgentWallet";

const apiOrigin = (process.env.AGENT_API_ORIGIN ?? DEFAULT_API_ORIGIN).replace(/\/$/, "");
const buyer = process.env.AGENT_BUYER_ADDRESS ?? DEFAULT_BUYER;
const proofsDir = path.resolve("proofs");
const latestPath = path.join(proofsDir, "latest-demo-run.md");
const EVM_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

async function fetchJson(pathOrUrl, options = {}) {
  const url = new URL(pathOrUrl, apiOrigin).toString();
  const startedAt = Date.now();
  const response = await fetch(url, options);
  const elapsedMs = Date.now() - startedAt;
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  return { url, response, body, elapsedMs };
}

function shortValue(value, prefix = 10, suffix = 6) {
  if (!value) return "";
  if (value.length <= prefix + suffix + 3) return value;
  return `${value.slice(0, prefix)}...${value.slice(-suffix)}`;
}

function shortAddress(address) {
  if (!address) return "";
  if (!EVM_ADDRESS_PATTERN.test(address)) return address;
  return shortValue(address, 6, 4);
}

function markdownTable(rows) {
  const header = "| Step | Status | Proof |";
  const divider = "| --- | --- | --- |";
  return [header, divider, ...rows.map(row => `| ${row.step} | ${row.status} | ${row.proof} |`)].join("\n");
}

function renderTranscript({ generatedAt, manifest, challenge, payment, unlocked }) {
  const requirements = challenge.body.paymentRequirements;
  const receipt = unlocked.body.receipt;
  const leads = unlocked.body.data ?? [];
  const sellerWallet = manifest.body.x402?.sellerWallet;
  const rows = [
    {
      step: "Discover seller API",
      status: `${manifest.response.status}`,
      proof: `${manifest.body.x402?.paymentMode} / ${manifest.body.x402?.settlement}`
    },
    {
      step: "Request protected endpoint",
      status: `${challenge.response.status}`,
      proof: `quoted ${requirements.amount} ${requirements.asset}`
    },
    {
      step: "Create payment payload",
      status: `${payment.response.status}`,
      proof: payment.body.encodedPayment ? "X-PAYMENT created" : "missing payment"
    },
    {
      step: "Retry with X-PAYMENT",
      status: `${unlocked.response.status}`,
      proof: `${leads.length} protected records unlocked`
    }
  ];

  return `# Payment-Aware Sandbox Demo Run

Generated: ${generatedAt}

Target: ${apiOrigin}

## Executive Summary

This run proves that a buyer agent can discover a paid API, receive a \`402 Payment Required\` challenge, create a sandbox payment payload, retry with \`X-PAYMENT\`, and receive protected premium lead data plus a receipt.

## Live Configuration

- API: ${manifest.body.name}
- Payment mode: ${manifest.body.x402?.paymentMode}
- Settlement: ${manifest.body.x402?.settlement}
- Price: ${requirements.amount} ${requirements.asset}
- Network: ${requirements.network}
- Seller wallet: ${sellerWallet?.isValid ? shortAddress(sellerWallet.address) : requirements.payTo}
- Paid endpoint: ${manifest.body.links?.paidResource}
- Payment header: ${manifest.body.x402?.paymentHeader}

## Proof Steps

${markdownTable(rows)}

## Receipt

- Receipt: ${receipt.id}
- Payer: ${shortAddress(receipt.payer) || receipt.payer}
- Seller: ${shortAddress(receipt.seller) || receipt.seller}
- Amount: ${receipt.amount} ${receipt.asset}
- Network: ${receipt.network}
- Settlement mode: ${receipt.mode}
- Transaction: ${shortValue(receipt.transaction)}
- Settled at: ${receipt.settledAt}

## Protected Data Received

${leads.map(lead => `- ${lead.company} | ${lead.contact} | ${lead.fit}% fit | ${lead.intent}`).join("\n")}

## Result

Machine-payable API flow complete. The current run is sandbox settlement, so no real funds moved. The same discovery and retry contract is ready for facilitator settlement testing later.
`;
}

async function run() {
  const generatedAt = new Date().toISOString();
  const timestamp = generatedAt.replace(/[:.]/g, "-");
  const archivePath = path.join(proofsDir, `${timestamp}-demo-run.md`);

  console.log(`Recording demo run against ${apiOrigin}`);

  const manifest = await fetchJson("/.well-known/x402.json");
  if (manifest.response.status !== 200 || !manifest.body.links?.paidResource) {
    throw new Error(`Discovery failed with HTTP ${manifest.response.status}`);
  }

  const challenge = await fetchJson(manifest.body.links.paidResource);
  if (challenge.response.status !== 402 || !challenge.body.paymentRequirements) {
    throw new Error(`Expected 402 payment challenge, received HTTP ${challenge.response.status}`);
  }

  const signerUrl = manifest.body.links?.sandboxSigner;
  if (!signerUrl) {
    throw new Error("Recordable demo mode currently requires sandboxSigner. Use facilitator mode with a real buyer proof script later.");
  }

  const payment = await fetchJson(signerUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      payer: buyer,
      requirements: challenge.body.paymentRequirements
    })
  });
  if (!payment.response.ok || !payment.body.encodedPayment) {
    throw new Error(payment.body.reason ?? payment.body.error ?? `Payment creation failed with HTTP ${payment.response.status}`);
  }

  const unlocked = await fetchJson(manifest.body.links.paidResource, {
    headers: {
      [manifest.body.x402?.paymentHeader ?? "X-PAYMENT"]: payment.body.encodedPayment
    }
  });
  if (!unlocked.response.ok) {
    throw new Error(unlocked.body.reason ?? unlocked.body.error ?? `Unlock failed with HTTP ${unlocked.response.status}`);
  }

  const transcript = renderTranscript({ generatedAt, manifest, challenge, payment, unlocked });

  await fs.mkdir(proofsDir, { recursive: true });
  await fs.writeFile(archivePath, transcript);
  await fs.writeFile(latestPath, transcript);

  console.log(`latest: ${latestPath}`);
  console.log(`archive: ${archivePath}`);
  console.log(`receipt: ${unlocked.body.receipt.id}`);
  console.log(`protected records: ${unlocked.body.data.length}`);
}

run().catch(error => {
  console.error(`Recordable demo failed: ${error.message}`);
  process.exitCode = 1;
});
