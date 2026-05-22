const DEFAULT_API_ORIGIN = "https://x402nano.onrender.com";
const EVM_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

const apiOrigin = (process.env.AGENT_API_ORIGIN ?? process.env.READINESS_API_ORIGIN ?? DEFAULT_API_ORIGIN).replace(/\/$/, "");

async function fetchJson(pathOrUrl) {
  const url = new URL(pathOrUrl, apiOrigin).toString();
  const response = await fetch(url);
  const text = await response.text();
  let body = {};

  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`${url} did not return JSON`);
  }

  return { url, response, body };
}

function pass(label, detail = "") {
  console.log(`ok     ${label}${detail ? ` - ${detail}` : ""}`);
}

function warn(label, detail = "") {
  console.log(`warn   ${label}${detail ? ` - ${detail}` : ""}`);
}

function fail(label, detail = "") {
  console.log(`fail   ${label}${detail ? ` - ${detail}` : ""}`);
}

function maskAddress(address) {
  if (!address || address.length < 12) return address ?? "not set";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function localEnv(name) {
  return process.env[name]?.trim() || "";
}

function check(condition, label, successDetail, warningDetail, warnings) {
  if (condition) {
    pass(label, successDetail);
    return;
  }

  warn(label, warningDetail);
  warnings.push(`${label}: ${warningDetail}`);
}

async function run() {
  const warnings = [];
  const failures = [];

  console.log(`Real settlement readiness check`);
  console.log(`target: ${apiOrigin}\n`);

  let health;
  let manifest;
  let pricing;

  try {
    health = await fetchJson("/api/health");
    manifest = await fetchJson("/.well-known/x402.json");
    pricing = await fetchJson("/api/pricing");
  } catch (error) {
    fail("target reachable", error.message);
    process.exitCode = 1;
    return;
  }

  if (health.response.status === 200 && health.body.status === "ok") {
    pass("health", `${health.body.paymentMode} / ${health.body.settlement}`);
  } else {
    fail("health", `HTTP ${health.response.status}`);
    failures.push(`health returned HTTP ${health.response.status}`);
  }

  if (manifest.response.status === 200 && manifest.body.x402?.paymentHeader) {
    pass("discovery manifest", manifest.body.links?.self ?? "/.well-known/x402.json");
  } else {
    fail("discovery manifest", `HTTP ${manifest.response.status}`);
    failures.push(`manifest returned HTTP ${manifest.response.status}`);
  }

  if (pricing.response.status === 200 && pricing.body.amount && pricing.body.asset && pricing.body.network) {
    pass("pricing", `${pricing.body.amount} ${pricing.body.asset} on ${pricing.body.network}`);
  } else {
    fail("pricing", `HTTP ${pricing.response.status}`);
    failures.push(`pricing returned HTTP ${pricing.response.status}`);
  }

  const x402 = manifest.body.x402 ?? {};
  const links = manifest.body.links ?? {};
  const sellerWallet = x402.sellerWallet ?? pricing.body.sellerWallet ?? {};
  const sellerAddress = sellerWallet.address ?? pricing.body.seller;
  const provider = x402.provider ?? pricing.body.provider ?? {};
  const paymentMode = x402.paymentMode ?? health.body.paymentMode;
  const settlement = x402.settlement ?? health.body.settlement;
  const network = pricing.body.network ?? x402.supportedNetworks?.[0];
  const asset = pricing.body.asset ?? x402.supportedAssets?.[0];
  const product = manifest.body.product ?? pricing.body.product ?? health.body.product ?? {};

  check(paymentMode === "sandbox" || paymentMode === "facilitator", "payment mode", paymentMode, `unexpected mode ${paymentMode ?? "missing"}`, warnings);
  check(settlement === "sandbox-simulated" || settlement === "facilitator-onchain", "settlement provider", settlement, `unexpected settlement ${settlement ?? "missing"}`, warnings);
  check(sellerWallet.isValid === true || EVM_ADDRESS_PATTERN.test(sellerAddress ?? ""), "seller wallet", maskAddress(sellerAddress), "set SELLER_ADDRESS or PARTNER_SELLER_ADDRESS to a real 0x wallet before facilitator mode", warnings);
  const supportedNetwork = network === "eip155:84532" || network === "eip155:8453";
  const networkLabel = network === "eip155:8453" ? "Base mainnet configured" : "Base Sepolia configured";
  check(supportedNetwork, "network", networkLabel, `expected Base Sepolia eip155:84532 or Base mainnet eip155:8453, got ${network ?? "missing"}`, warnings);
  check(asset === "USDC", "asset", "USDC configured", `expected USDC, got ${asset ?? "missing"}`, warnings);
  check(x402.paymentHeader === "X-PAYMENT", "retry contract", "X-PAYMENT", `unexpected payment header ${x402.paymentHeader ?? "missing"}`, warnings);
  if (network === "eip155:8453") {
    check(product.mainnetReady === true, "mainnet product", product.mode ?? "production", product.reason ?? "configure LEAD_PACK_MODE=production and PREMIUM_LEAD_PACK_JSON", warnings);
  }

  if (paymentMode === "sandbox") {
    check(Boolean(links.sandboxSigner), "sandbox signer", links.sandboxSigner, "sandbox mode should expose /api/payments/sign", warnings);
    pass("public demo status", "stable sandbox demo is ready");
    warn("real settlement", "not enabled yet; set X402_PAYMENT_MODE=facilitator only after wallet/facilitator env is ready");
    warnings.push("real settlement: currently sandbox, not facilitator");
  }

  if (paymentMode === "facilitator") {
    check(!links.sandboxSigner, "sandbox signer", "disabled in facilitator mode", "sandbox signer should be null in facilitator mode", warnings);
    check(Boolean(provider.facilitatorUrl), "facilitator URL", provider.facilitatorUrl, "set X402_FACILITATOR_URL in Render", warnings);
    if (provider.facilitatorUrl?.includes("api.cdp.coinbase.com")) {
      check(provider.authMode === "cdp-jwt", "CDP facilitator auth", "CDP JWT configured", "set CDP_API_KEY_ID and CDP_API_KEY_SECRET in Render", warnings);
    }
    if (sellerWallet.isValid === true || EVM_ADDRESS_PATTERN.test(sellerAddress ?? "")) {
      pass("real settlement status", "server appears ready for npm.cmd run agent:real");
    } else {
      warn("real settlement status", "facilitator mode is on, but seller wallet is not valid yet");
    }
  }

  const localSellerAddress = localEnv("SELLER_ADDRESS") || localEnv("PARTNER_SELLER_ADDRESS");
  check(Boolean(localSellerAddress), "local seller env", localSellerAddress ? maskAddress(localSellerAddress) : "", "optional locally; required in Render before real settlement", warnings);
  check(Boolean(localEnv("BUYER_PRIVATE_KEY")), "local buyer private key", "present, not printed", "needed only when running npm.cmd run agent:real from this machine", warnings);
  check(Boolean(localEnv("BASE_SEPOLIA_RPC_URL")), "local Base Sepolia RPC", "present", "needed only when running npm.cmd run agent:real from this machine", warnings);

  console.log("\nResult:");
  if (failures.length > 0) {
    console.log("The target is not ready because required endpoints failed.");
    process.exitCode = 1;
    return;
  }

  if (paymentMode === "facilitator" && warnings.length === 0) {
    console.log("Real settlement looks enabled and ready for a buyer-agent test.");
    return;
  }

  if (paymentMode === "facilitator") {
    console.log("Facilitator mode is enabled, but review the warnings before sending real testnet payments.");
    return;
  }

  console.log("Sandbox demo is healthy. Real settlement is intentionally not enabled yet.");
}

run().catch(error => {
  console.error(`\nReadiness check failed: ${error.message}`);
  process.exitCode = 1;
});
