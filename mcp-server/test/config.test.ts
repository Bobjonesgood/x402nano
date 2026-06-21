import assert from "node:assert/strict";
import test from "node:test";
import { EXPECTED_PAID_ATOMIC, loadConfig, parseUsdcAtomic, validateApiOrigin } from "../src/config.js";

test("parses the exact paid price", () => {
  assert.equal(parseUsdcAtomic("0.05"), EXPECTED_PAID_ATOMIC);
});

test("rejects non-production API origins", () => {
  assert.throws(() => validateApiOrigin("https://example.com"), /must be exactly/);
  assert.throws(() => validateApiOrigin("http://x402nano.onrender.com"), /must be exactly/);
  assert.throws(() => validateApiOrigin("https://x402nano.onrender.com/other"), /must be exactly/);
});

test("rejects a payment cap above 0.05 USDC", () => {
  assert.throws(() => loadConfig({ X402NANO_MAX_PAYMENT_USDC: "0.06" }), /cannot exceed/);
});

test("requires the exact payment acknowledgement", () => {
  assert.equal(loadConfig({ X402NANO_PAYMENT_ACK: "yes" }).paymentAcknowledged, false);
  assert.equal(loadConfig({ X402NANO_PAYMENT_ACK: "PAY_REAL_0.05_USDC" }).paymentAcknowledged, true);
});

test("uses a cold-start-tolerant timeout and rejects unsafe values", () => {
  assert.equal(loadConfig({}).requestTimeoutMs, 60_000);
  assert.throws(() => loadConfig({ X402NANO_REQUEST_TIMEOUT_MS: "200000" }), /must be an integer/);
});
