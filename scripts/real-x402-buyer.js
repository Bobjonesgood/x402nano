import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

const DEFAULT_API_ORIGIN = "https://x402nano.onrender.com";

const apiOrigin = (process.env.AGENT_API_ORIGIN ?? DEFAULT_API_ORIGIN).replace(/\/$/, "");
const privateKey = process.env.BUYER_PRIVATE_KEY;
const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL;

if (!privateKey) {
  console.error("BUYER_PRIVATE_KEY is required for the real x402 buyer.");
  console.error("Use a Base Sepolia test wallet only. Do not use a mainnet/private production wallet here.");
  process.exit(1);
}

async function fetchJson(pathOrUrl, options = {}) {
  const url = new URL(pathOrUrl, apiOrigin).toString();
  const response = await fetch(url, options);
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  return { response, body };
}

async function run() {
  console.log(`Real x402 buyer targeting ${apiOrigin}`);

  const { body: manifest } = await fetchJson("/.well-known/x402.json");
  const paidResource = manifest.links?.paidResource;

  if (!paidResource) {
    throw new Error("Discovery manifest did not include links.paidResource.");
  }

  console.log(`api: ${manifest.name}`);
  console.log(`mode: ${manifest.x402?.paymentMode}`);
  console.log(`settlement: ${manifest.x402?.settlement}`);
  console.log(`resource: ${paidResource}`);

  if (manifest.x402?.paymentMode !== "facilitator") {
    console.log("Heads up: the server is not in facilitator mode yet. This script is for the real settlement path.");
  }

  const account = privateKeyToAccount(privateKey);
  console.log(`buyer: ${account.address}`);

  const client = new x402Client();
  registerExactEvmScheme(client, {
    signer: account,
    networks: [manifest.x402?.supportedNetworks?.[0] ?? "eip155:84532"],
    ...(rpcUrl ? { schemeOptions: { 84532: { rpcUrl } } } : {})
  });

  const fetchWithPayment = wrapFetchWithPayment(fetch, client);
  const response = await fetchWithPayment(paidResource);
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(body.reason ?? body.error ?? `Paid request failed with ${response.status}.`);
  }

  console.log(`receipt: ${body.receipt?.id}`);
  console.log(`settlement: ${body.receipt?.mode}`);
  console.log(`lead intelligence records: ${body.data?.length ?? 0}`);

  for (const lead of body.data ?? []) {
    console.log(`- ${lead.businessName ?? lead.company} | ${lead.industry ?? "lead intelligence"} | ${lead.confidenceScore ?? lead.fit}% confidence | ${lead.buyingIntent ?? lead.intent}`);
    if (lead.recommendedOpener) console.log(`  opener: ${lead.recommendedOpener}`);
  }
}

run().catch(error => {
  console.error(`\nReal x402 buyer failed: ${error.message}`);
  process.exitCode = 1;
});
