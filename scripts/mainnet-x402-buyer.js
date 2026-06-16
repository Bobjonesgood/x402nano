import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import fs from "node:fs/promises";
import { createPublicClient, erc20Abi, formatUnits, http } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const DEFAULT_API_ORIGIN = "https://x402nano.onrender.com";
const DEFAULT_BASE_MAINNET_RPC_URL = "https://mainnet.base.org";
const MAINNET_NETWORK = "eip155:8453";
const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const PAYMENT_ACK = "PAY_REAL_0.05_USDC";
const DEFAULT_MAX_USDC = "0.05";
const EVM_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

async function loadLocalEnv(file) {
  try {
    const content = await fs.readFile(file, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2];
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

await loadLocalEnv(".env.mainnet.local");

const apiOrigin = (process.env.AGENT_API_ORIGIN ?? DEFAULT_API_ORIGIN).replace(/\/$/, "");
const privateKey = process.env.MAINNET_BUYER_PRIVATE_KEY?.trim();
const rpcUrl = process.env.BASE_MAINNET_RPC_URL?.trim() || DEFAULT_BASE_MAINNET_RPC_URL;
const paymentAck = process.env.MAINNET_PAYMENT_ACK?.trim();
const maxUsdc = process.env.MAINNET_MAX_USDC?.trim() || DEFAULT_MAX_USDC;
const expectedSeller = process.env.MAINNET_EXPECTED_SELLER_ADDRESS?.trim();
const paidPath = process.env.MAINNET_PAID_PATH?.trim() || "/api/markets/brief?slug=will-gideon-saar-be-the-next-prime-minister-of-israel";
const isDeltaProof = paidPath.startsWith("/api/markets/delta");

function toUsdcAtomic(value) {
  const [whole = "0", fraction = ""] = String(value).split(".");
  if (!/^\d+$/.test(whole) || !/^\d*$/.test(fraction)) {
    throw new Error(`Invalid USDC amount ${value}.`);
  }
  return BigInt(`${whole}${fraction.padEnd(6, "0").slice(0, 6)}`);
}

async function fetchJson(pathOrUrl, options = {}) {
  const url = new URL(pathOrUrl, apiOrigin).toString();
  const response = await fetch(url, options);
  const text = await response.text();
  let body = {};

  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`${url} did not return JSON.`);
  }

  return { url, response, body };
}

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

async function readUsdcBalance(client, address) {
  return client.readContract({
    address: BASE_USDC,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address]
  });
}

async function waitForBalanceChange(client, buyer, seller, before) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const [buyerBalance, sellerBalance] = await Promise.all([
      readUsdcBalance(client, buyer),
      readUsdcBalance(client, seller)
    ]);

    if (buyerBalance < before.buyer || sellerBalance > before.seller) {
      return { buyer: buyerBalance, seller: sellerBalance };
    }

    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  return Promise.all([
    readUsdcBalance(client, buyer),
    readUsdcBalance(client, seller)
  ]).then(([buyer, seller]) => ({ buyer, seller }));
}

function printBalances(label, balances) {
  console.log(`${label} buyer USDC: ${formatUnits(balances.buyer, 6)}`);
  console.log(`${label} seller USDC: ${formatUnits(balances.seller, 6)}`);
}

async function readReceiptEvents(receiptId) {
  const { body } = await fetchJson("/api/events");
  const expectedTypes = [
    "payment_verified",
    "receipt_generated",
    isDeltaProof ? "market_delta_unlocked" : "market_brief_unlocked"
  ];
  const foundTypes = new Set(
    (body.events ?? [])
      .filter(event => event.details?.receiptId === receiptId)
      .map(event => event.type)
  );

  for (const type of expectedTypes) {
    requireCondition(foundTypes.has(type), `Seller event log is missing ${type} for receipt ${receiptId}.`);
  }

  return expectedTypes;
}

async function run() {
  console.log("Controlled Base mainnet x402 buyer");
  console.log(`target: ${apiOrigin}`);
  console.log(`max payment: ${maxUsdc} USDC`);

  const [{ body: manifest }, { body: version }, unpaid] = await Promise.all([
    fetchJson("/.well-known/x402.json"),
    fetchJson("/api/version"),
    fetchJson(paidPath)
  ]);

  const requirements = unpaid.body.paymentRequirements;
  const accepted = unpaid.body.x402?.accepts?.[0];
  const manifestSeller = manifest.x402?.sellerWallet?.address ?? version.payment?.sellerWallet?.address;
  const paidResource = new URL(requirements?.resource ?? paidPath, apiOrigin).toString();

  requireCondition(paidResource, "Paid resource could not be resolved.");
  requireCondition(unpaid.response.status === 402, `Expected unpaid resource to return 402, got ${unpaid.response.status}.`);
  requireCondition(manifest.x402?.paymentMode === "facilitator", "Server is not in facilitator mode.");
  requireCondition(manifest.x402?.settlement === "facilitator-onchain", "Server settlement is not facilitator-onchain.");
  requireCondition(version.payment?.network === MAINNET_NETWORK, `Version endpoint is not Base mainnet ${MAINNET_NETWORK}.`);
  requireCondition(requirements?.network === MAINNET_NETWORK, `Payment requirement network is ${requirements?.network ?? "missing"}, not ${MAINNET_NETWORK}.`);
  requireCondition(requirements?.asset === "USDC", `Payment requirement asset is ${requirements?.asset ?? "missing"}, not USDC.`);
  requireCondition(requirements?.amount, "Payment requirement amount is missing.");
  requireCondition(toUsdcAtomic(requirements.amount) <= toUsdcAtomic(maxUsdc), `Payment requirement ${requirements.amount} USDC exceeds MAINNET_MAX_USDC ${maxUsdc}.`);
  requireCondition(accepted?.asset?.toLowerCase() === BASE_USDC.toLowerCase(), "Accepted asset is not Base mainnet USDC.");
  requireCondition(accepted?.network === MAINNET_NETWORK, "Accepted x402 payment is not Base mainnet.");
  requireCondition(EVM_ADDRESS_PATTERN.test(requirements.payTo ?? ""), "Payment requirement seller address is invalid.");
  requireCondition(requirements.payTo?.toLowerCase() === manifestSeller?.toLowerCase(), "Payment requirement seller does not match the discovery seller wallet.");
  if (expectedSeller) {
    requireCondition(expectedSeller.toLowerCase() === requirements.payTo.toLowerCase(), "MAINNET_EXPECTED_SELLER_ADDRESS does not match the live seller address.");
  }

  console.log(`resource: ${paidResource}`);
  console.log(`price: ${requirements.amount} ${requirements.asset}`);
  console.log(`network: ${requirements.network}`);
  console.log(`seller: ${requirements.payTo}`);
  console.log(`test type: market ${isDeltaProof ? "delta" : "brief"}`);

  if (!privateKey || paymentAck !== PAYMENT_ACK) {
    console.log("\nPreflight passed. No real payment was sent.");
    if (!privateKey) console.log("Set MAINNET_BUYER_PRIVATE_KEY for the dedicated tiny-funded mainnet buyer wallet.");
    if (privateKey) {
      const preflightAccount = privateKeyToAccount(privateKey);
      const preflightClient = createPublicClient({ chain: base, transport: http(rpcUrl) });
      const buyerUsdc = await readUsdcBalance(preflightClient, preflightAccount.address);
      console.log(`local buyer: ${preflightAccount.address}`);
      console.log(`local buyer Base USDC: ${formatUnits(buyerUsdc, 6)}`);
    }
    if (paymentAck !== PAYMENT_ACK) console.log(`Set MAINNET_PAYMENT_ACK=${PAYMENT_ACK} only when you are ready to send the first real 0.05 USDC payment.`);
    return;
  }

  const account = privateKeyToAccount(privateKey);
  const publicClient = createPublicClient({ chain: base, transport: http(rpcUrl) });
  const balancesBefore = {
    buyer: await readUsdcBalance(publicClient, account.address),
    seller: await readUsdcBalance(publicClient, requirements.payTo)
  };

  requireCondition(balancesBefore.buyer >= toUsdcAtomic(requirements.amount), "Buyer mainnet wallet does not have enough Base USDC for the controlled payment.");

  console.log(`buyer: ${account.address}`);
  printBalances("before", balancesBefore);
  console.log("\nSending one real x402 Base mainnet payment now.");

  const client = new x402Client();
  registerExactEvmScheme(client, {
    signer: account,
    networks: [MAINNET_NETWORK],
    schemeOptions: { 8453: { rpcUrl } }
  });

  const fetchWithPayment = wrapFetchWithPayment(fetch, client);
  const paidResponse = await fetchWithPayment(paidResource);
  const paidText = await paidResponse.text();
  const paidBody = paidText ? JSON.parse(paidText) : {};

  if (!paidResponse.ok) {
    throw new Error(paidBody.reason ?? paidBody.error ?? `Paid request failed with ${paidResponse.status}.`);
  }

  const balancesAfter = await waitForBalanceChange(publicClient, account.address, requirements.payTo, balancesBefore);
  const buyerDelta = balancesBefore.buyer - balancesAfter.buyer;
  const sellerDelta = balancesAfter.seller - balancesBefore.seller;

  console.log(`\nreceipt: ${paidBody.receipt?.id ?? "missing"}`);
  console.log(`receipt network: ${paidBody.receipt?.network ?? "missing"}`);
  console.log(`receipt amount: ${paidBody.receipt?.amount ?? "missing"} ${paidBody.receipt?.asset ?? ""}`.trim());
  console.log(`market ${isDeltaProof ? "delta" : "brief"} status: ${paidBody.data?.status ?? "missing"}`);
  console.log(`market ${isDeltaProof ? "delta" : "brief"} slug: ${paidBody.data?.market?.slug ?? "missing"}`);
  if (isDeltaProof) {
    console.log(`market delta priority: ${paidBody.data?.significance?.repeatCheckPriority ?? "missing"}`);
    console.log(`market delta window until: ${paidBody.data?.window?.until ?? "missing"}`);
  }
  printBalances("after", balancesAfter);
  console.log(`buyer delta USDC: ${formatUnits(buyerDelta, 6)}`);
  console.log(`seller delta USDC: ${formatUnits(sellerDelta, 6)}`);

  requireCondition(paidBody.receipt?.id, "Paid response did not include a receipt id.");
  requireCondition(paidBody.receipt?.network === MAINNET_NETWORK, "Paid receipt is not Base mainnet.");
  requireCondition(
    paidBody.data?.briefType === (isDeltaProof ? "read-only-market-delta" : "read-only-market-intelligence"),
    `Paid response did not unlock a market ${isDeltaProof ? "delta" : "brief"}.`
  );
  requireCondition(buyerDelta >= toUsdcAtomic(requirements.amount), "Buyer USDC balance did not decrease by the payment amount yet.");
  requireCondition(sellerDelta >= toUsdcAtomic(requirements.amount), "Seller USDC balance did not increase by the payment amount yet.");

  const eventTypes = await readReceiptEvents(paidBody.receipt.id);
  console.log(`seller receipt events: ${eventTypes.join(", ")}`);
  console.log("\nControlled Base mainnet x402 payment proof passed.");
}

run().catch(error => {
  console.error(`\nMainnet x402 buyer failed: ${error.message}`);
  process.exitCode = 1;
});
