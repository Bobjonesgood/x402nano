import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const PORT = 4137;
const ORIGIN = `http://127.0.0.1:${PORT}`;

function waitForServer(child) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Server did not start in time.")), 10_000);
    child.stdout.on("data", chunk => {
      if (!String(chunk).includes("seller server listening")) return;
      clearTimeout(timeout);
      resolve();
    });
    child.stderr.on("data", chunk => {
      const text = String(chunk);
      if (text.includes("Invalid Base mainnet")) {
        clearTimeout(timeout);
        reject(new Error(text));
      }
    });
    child.once("exit", code => {
      clearTimeout(timeout);
      reject(new Error(`Server exited before startup with code ${code}.`));
    });
  });
}

async function postAlert(body, payment) {
  const response = await fetch(`${ORIGIN}/api/alerts/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(payment ? { "X-PAYMENT": payment } : {})
    },
    body: JSON.stringify(body)
  });
  return { response, body: await response.json() };
}

async function startServer(databasePath) {
  const child = spawn(process.execPath, ["server/index.js"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(PORT),
      X402_PAYMENT_MODE: "sandbox",
      X402_NETWORK: "eip155:84532",
      X402_ASSET: "USDC",
      PRICE_USDC: "0.05",
      ALERT_REGISTRATION_PRICE_USDC: "0.08",
      ALERT_DB_PATH: databasePath,
      MARKET_BRIEF_ENABLED: "true"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  await waitForServer(child);
  return child;
}

async function stopServer(child) {
  if (child.exitCode !== null) return;
  const exited = new Promise(resolve => child.once("exit", resolve));
  child.kill("SIGTERM");
  await exited;
}

test("POST /api/alerts/register completes the sandbox x402 flow", { timeout: 20_000 }, async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "x402nano-server-"));
  const databasePath = path.join(directory, "alerts.sqlite");
  let child = null;

  try {
    child = await startServer(databasePath);
    const registration = {
      webhookUrl: "https://agent.example/webhook",
      slugs: ["will-gideon-saar-be-the-next-prime-minister-of-israel"],
      threshold: 0.07,
      checkIntervalMinutes: 15
    };

    const unpaid = await postAlert(registration);
    assert.equal(unpaid.response.status, 402);
    assert.equal(unpaid.body.paymentRequirements.amount, "0.08");
    assert.equal(unpaid.body.x402.accepts[0].amount, "80000");

    const signingResponse = await fetch(`${ORIGIN}/api/payments/sign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requirements: unpaid.body.paymentRequirements,
        payer: "0xLocalAlertBuyer"
      })
    });
    const signed = await signingResponse.json();
    assert.equal(signingResponse.status, 200);

    const paid = await postAlert(registration, signed.encodedPayment);
    assert.equal(paid.response.status, 201);
    assert.equal(paid.body.status, "registered");
    assert.equal(paid.body.receipt.amount, "0.08");
    assert.equal(paid.body.receipt.resource, "/api/alerts/register");
    assert.equal(paid.body.alert.payerAddress, "0xLocalAlertBuyer");
    assert.equal(paid.body.alert.active, true);

    const health = await (await fetch(`${ORIGIN}/api/health`)).json();
    assert.equal(health.alerts.registeredAlerts, 1);

    await stopServer(child);
    child = await startServer(databasePath);
    const restartedHealth = await (await fetch(`${ORIGIN}/api/health`)).json();
    assert.equal(restartedHealth.alerts.storage, "sqlite");
    assert.equal(restartedHealth.alerts.registeredAlerts, 1);
    assert.equal(restartedHealth.alerts.activeAlerts, 1);
    const lightweightHealth = await (await fetch(`${ORIGIN}/health`)).json();
    assert.deepEqual(lightweightHealth, { status: "ok", alertCount: 1 });
    const alertStatus = await (await fetch(`${ORIGIN}/api/alerts/status`)).json();
    assert.equal(alertStatus.status, "ok");
    assert.equal(alertStatus.totalAlerts, 1);
    assert.equal(alertStatus.activeAlerts, 1);
    assert.equal(alertStatus.storage, "sqlite");
  } finally {
    if (child) await stopServer(child);
    await fs.rm(directory, { recursive: true, force: true });
  }
});
