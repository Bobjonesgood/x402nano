const DEFAULT_API_ORIGIN = "http://127.0.0.1:4021";
const DEFAULT_BUYER = "0xAutonomousAgentWallet";

const apiOrigin = (process.env.AGENT_API_ORIGIN ?? DEFAULT_API_ORIGIN).replace(/\/$/, "");
const buyer = process.env.AGENT_BUYER_ADDRESS ?? DEFAULT_BUYER;
const externalPayment = process.env.X402_PAYMENT;

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  return { response, body };
}

function printStep(label, detail) {
  console.log(`\n${label}`);
  if (detail) console.log(detail);
}

async function createPayment({ manifest, requirements }) {
  if (externalPayment) {
    printStep("3. Using externally supplied X-PAYMENT", "A wallet or x402 client prepared the payment payload.");
    return externalPayment;
  }

  if (!manifest.links?.sandboxSigner) {
    throw new Error(
      "No sandbox signer is advertised. Set X402_PAYMENT to a real x402 payment payload from your buyer wallet/client."
    );
  }

  printStep("3. Paying automatically", `POST ${manifest.links.sandboxSigner}`);
  const { response, body } = await fetchJson(manifest.links.sandboxSigner, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payer: buyer, requirements })
  });

  if (!response.ok || !body.encodedPayment) {
    throw new Error(body.reason ?? body.error ?? `Payment creation failed with ${response.status}.`);
  }

  console.log(`payer: ${body.payer}`);
  console.log(`signature: ${body.signature.slice(0, 18)}...`);
  return body.encodedPayment;
}

async function run() {
  printStep("1. Discovering seller API", `GET ${apiOrigin}/.well-known/x402.json`);
  const { body: manifest } = await fetchJson(`${apiOrigin}/.well-known/x402.json`);
  const paidResource = manifest.links?.paidResource;

  if (!paidResource) {
    throw new Error("Discovery manifest did not include links.paidResource.");
  }

  console.log(`api: ${manifest.name}`);
  console.log(`mode: ${manifest.x402?.paymentMode}`);
  console.log(`settlement: ${manifest.x402?.settlement}`);
  console.log(`resource: ${paidResource}`);

  printStep("2. Requesting premium lead intelligence", `GET ${paidResource}`);
  const challenge = await fetchJson(paidResource);

  if (challenge.response.status !== 402) {
    throw new Error(`Expected 402 Payment Required, received ${challenge.response.status}.`);
  }

  const requirements = challenge.body.paymentRequirements;
  console.log(`status: ${challenge.response.status}`);
  console.log(`price: ${requirements.amount} ${requirements.asset}`);
  console.log(`network: ${requirements.network}`);
  console.log(`seller: ${requirements.payTo}`);
  console.log(`nonce: ${requirements.nonce}`);

  const paymentHeader = await createPayment({ manifest, requirements });

  printStep("4. Retrying with X-PAYMENT", `GET ${paidResource}`);
  const unlocked = await fetchJson(paidResource, {
    headers: {
      [manifest.x402?.paymentHeader ?? "X-PAYMENT"]: paymentHeader
    }
  });

  if (!unlocked.response.ok) {
    throw new Error(unlocked.body.reason ?? unlocked.body.error ?? `Unlock failed with ${unlocked.response.status}.`);
  }

  printStep("5. Protected data received");
  console.log(`receipt: ${unlocked.body.receipt.id}`);
  console.log(`settlement: ${unlocked.body.receipt.mode}`);
  console.log(`lead intelligence records: ${unlocked.body.data.length}`);

  for (const lead of unlocked.body.data) {
    console.log(`- ${lead.businessName ?? lead.company} | ${lead.industry ?? "lead intelligence"} | ${lead.confidenceScore ?? lead.fit}% confidence | ${lead.buyingIntent ?? lead.intent}`);
    if (lead.recommendedOpener) console.log(`  opener: ${lead.recommendedOpener}`);
  }
}

run().catch(error => {
  console.error(`\nAgent buyer failed: ${error.message}`);
  process.exitCode = 1;
});
