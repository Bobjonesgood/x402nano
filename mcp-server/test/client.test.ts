import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig } from "../src/config.js";
import { X402NanoClient } from "../src/x402nano-client.js";

const seller = "0x4cc3831eB479aCFb6D44631d4a30814508Cf52d3";
const usdc = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

function challenge(url: string, amount = "50000", includeHeader = false) {
  const paymentRequired = {
    x402Version: 2,
    resource: { url, description: "Test x402nano resource", mimeType: "application/json" },
    accepts: [{
      scheme: "exact",
      network: "eip155:8453",
      asset: usdc,
      amount,
      payTo: seller,
      maxTimeoutSeconds: 300,
      extra: { name: "USD Coin", version: "2" }
    }]
  };
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (includeHeader) headers["PAYMENT-REQUIRED"] = Buffer.from(JSON.stringify(paymentRequired)).toString("base64");
  return new Response(JSON.stringify({
    paymentRequirements: { network: "eip155:8453", asset: "USDC", amount: "0.05", payTo: seller, resource: url },
    x402: paymentRequired
  }), { status: 402, headers });
}

test("free tools do not require a wallet", async () => {
  const fetchMock: typeof fetch = async () => new Response(JSON.stringify({ count: 1, markets: [] }), { status: 200 });
  const client = new X402NanoClient(loadConfig({}), fetchMock);
  const data = await client.listTrendingMarkets(1);
  assert.equal(data.count, 1);
});

test("paid delta validates the challenge then stops before payment by default", async () => {
  let calls = 0;
  const fetchMock: typeof fetch = async input => {
    calls += 1;
    return challenge(input.toString());
  };
  const client = new X402NanoClient(loadConfig({}), fetchMock);
  await assert.rejects(
    client.getMarketDelta("example-market", "2026-06-20T00:00:00.000Z"),
    /Payment preflight passed, but real payments are disabled/
  );
  assert.equal(calls, 1);
});

test("paid tools reject a price other than exactly 0.05 USDC", async () => {
  const fetchMock: typeof fetch = async input => challenge(input.toString(), "60000");
  const client = new X402NanoClient(loadConfig({}), fetchMock);
  await assert.rejects(
    client.getMarketBrief("example-market"),
    /Expected exactly 0.05 USDC/
  );
});

test("paid retry preserves the official x402 payment signature header", async () => {
  let calls = 0;
  const fetchMock: typeof fetch = async input => {
    calls += 1;
    const url = input instanceof Request ? input.url : input.toString();
    if (calls === 1) return challenge(url);
    if (calls === 2) return challenge(url, "50000", true);

    assert.ok(input instanceof Request);
    assert.ok(input.headers.get("PAYMENT-SIGNATURE") || input.headers.get("X-PAYMENT"));
    return new Response(JSON.stringify({ status: "unlocked", receipt: { amount: "0.05" }, data: {} }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  };
  const client = new X402NanoClient(loadConfig({
    X402NANO_PAYMENT_ACK: "PAY_REAL_0.05_USDC",
    X402NANO_BUYER_PRIVATE_KEY: `0x${"11".repeat(32)}`
  }), fetchMock);

  const result = await client.getMarketDelta("example-market", "2026-06-20T00:00:00.000Z");
  assert.equal(result.status, "unlocked");
  assert.equal(calls, 3);
});
