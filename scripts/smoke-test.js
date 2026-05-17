const DEFAULT_API_ORIGIN = "http://127.0.0.1:4021";

const apiOrigin = (process.env.AGENT_API_ORIGIN ?? process.env.SMOKE_API_ORIGIN ?? DEFAULT_API_ORIGIN).replace(/\/$/, "");

async function fetchJson(pathOrUrl, options = {}) {
  const url = new URL(pathOrUrl, apiOrigin).toString();
  const response = await fetch(url, options);
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  return { url, response, body };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function ok(label, detail = "") {
  console.log(`ok  ${label}${detail ? ` - ${detail}` : ""}`);
}

async function run() {
  console.log(`Smoke testing ${apiOrigin}`);

  const health = await fetchJson("/api/health");
  assert(health.response.status === 200, `health returned ${health.response.status}`);
  assert(health.body.status === "ok", "health status was not ok");
  ok("health", health.body.paymentMode);

  const manifest = await fetchJson("/.well-known/x402.json");
  assert(manifest.response.status === 200, `manifest returned ${manifest.response.status}`);
  assert(manifest.body.links?.paidResource, "manifest missing links.paidResource");
  assert(manifest.body.x402?.paymentHeader, "manifest missing x402.paymentHeader");
  ok("agent discovery", manifest.body.links.paidResource);

  const pricing = await fetchJson("/api/pricing");
  assert(pricing.response.status === 200, `pricing returned ${pricing.response.status}`);
  assert(pricing.body.amount && pricing.body.asset && pricing.body.network, "pricing missing payment details");
  ok("pricing", `${pricing.body.amount} ${pricing.body.asset} on ${pricing.body.network}`);

  const schema = await fetchJson("/api/schema");
  assert(schema.response.status === 200, `schema returned ${schema.response.status}`);
  assert(schema.body.resource === "/api/premium-leads", "schema resource mismatch");
  ok("schema", schema.body.resource);

  const challenge = await fetchJson(manifest.body.links.paidResource);
  assert(challenge.response.status === 402, `paid resource should return 402 before payment, got ${challenge.response.status}`);
  assert(challenge.body.paymentRequirements?.nonce, "402 challenge missing payment requirements nonce");
  ok("payment challenge", challenge.body.paymentRequirements.nonce);

  if (manifest.body.links.sandboxSigner) {
    const sign = await fetchJson(manifest.body.links.sandboxSigner, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payer: process.env.AGENT_BUYER_ADDRESS ?? "0xAutonomousAgentWallet",
        requirements: challenge.body.paymentRequirements
      })
    });
    assert(sign.response.status === 200, `sandbox signer returned ${sign.response.status}`);
    assert(sign.body.encodedPayment, "sandbox signer missing encodedPayment");
    ok("sandbox signer");

    const unlocked = await fetchJson(manifest.body.links.paidResource, {
      headers: {
        [manifest.body.x402.paymentHeader]: sign.body.encodedPayment
      }
    });
    assert(unlocked.response.status === 200, `paid retry returned ${unlocked.response.status}`);
    assert(Array.isArray(unlocked.body.data) && unlocked.body.data.length > 0, "paid retry did not return protected data");
    ok("paid retry", `${unlocked.body.data.length} protected records`);
  } else {
    ok("paid retry skipped", "facilitator mode requires external X-PAYMENT");
  }

  console.log("\nSmoke test passed.");
}

run().catch(error => {
  console.error(`\nSmoke test failed: ${error.message}`);
  process.exitCode = 1;
});

