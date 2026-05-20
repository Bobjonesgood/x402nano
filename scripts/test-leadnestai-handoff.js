import { spawn } from "node:child_process";

const X402_PORT = 4121;
const MOCK_PORT = 5055;
const SECRET = "local-test-secret";
const X402_ORIGIN = `http://127.0.0.1:${X402_PORT}`;
const MOCK_ORIGIN = `http://127.0.0.1:${MOCK_PORT}`;

function startProcess(command, args, env) {
  const child = spawn(command, args, {
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  child.stdout.on("data", chunk => process.stdout.write(chunk));
  child.stderr.on("data", chunk => process.stderr.write(chunk));
  return child;
}

function stopProcess(child) {
  if (child && !child.killed) child.kill();
}

async function waitForHealth(url, label) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(`${label} did not become healthy at ${url}`);
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

function encodePayment(payment) {
  return Buffer.from(JSON.stringify(payment)).toString("base64url");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function run() {
  const mock = startProcess("node", ["scripts/mock-leadnestai-server.js"], {
    LEADNESTAI_MOCK_PORT: String(MOCK_PORT),
    X402_INGEST_SECRET: SECRET
  });

  const seller = startProcess("node", ["server/index.js"], {
    PORT: String(X402_PORT),
    HOST: "127.0.0.1",
    X402_PAYMENT_MODE: "sandbox",
    LEAD_HANDOFF_ENABLED: "true",
    LEADNESTAI_API_URL: MOCK_ORIGIN,
    LEADNESTAI_INGEST_SECRET: SECRET,
    LEADNESTAI_SOURCE_ID: "x402nano-local-test"
  });

  try {
    await waitForHealth(`${MOCK_ORIGIN}/api/health`, "LeadNestAI mock");
    await waitForHealth(`${X402_ORIGIN}/api/health`, "x402 seller");

    const unpaid = await requestJson(`${X402_ORIGIN}/api/lead-intelligence/premium-pack`);
    assert(unpaid.response.status === 402, "expected protected endpoint to return 402 before payment");

    const signed = await requestJson(`${X402_ORIGIN}/api/payments/sign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payer: "0xAutonomousAgentWallet",
        requirements: unpaid.body.paymentRequirements
      })
    });
    assert(signed.response.ok, "sandbox signer failed");

    const unlocked = await requestJson(`${X402_ORIGIN}/api/lead-intelligence/premium-pack`, {
      headers: {
        "X-PAYMENT": signed.body.encodedPayment ?? encodePayment({
          payer: "0xAutonomousAgentWallet",
          requirements: unpaid.body.paymentRequirements,
          signature: signed.body.signature
        })
      }
    });
    assert(unlocked.response.ok, "paid retry failed");
    assert(unlocked.body.data?.length > 0, "expected unlocked lead records");

    const lead = unlocked.body.data[0];
    const firstHandoff = await requestJson(`${X402_ORIGIN}/api/leadnestai/handoff`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        receiptId: unlocked.body.receipt.id,
        externalLeadId: lead.id
      })
    });
    assert(firstHandoff.response.status === 201, "expected first handoff to store lead");
    assert(firstHandoff.body.status === "stored", "expected stored status");

    const duplicateHandoff = await requestJson(`${X402_ORIGIN}/api/leadnestai/handoff`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        receiptId: unlocked.body.receipt.id,
        externalLeadId: lead.id
      })
    });
    assert(duplicateHandoff.response.ok, "expected duplicate handoff response to be ok");
    assert(duplicateHandoff.body.status === "duplicate", "expected duplicate status");

    const events = await requestJson(`${X402_ORIGIN}/api/events`);
    const eventTypes = events.body.events.map(event => event.type);
    assert(eventTypes.includes("lead_handoff_attempted"), "missing handoff attempted event");
    assert(eventTypes.includes("lead_handoff_succeeded"), "missing handoff succeeded event");

    const mockEvents = await requestJson(`${MOCK_ORIGIN}/api/events`);
    const mockEventTypes = mockEvents.body.events.map(event => event.type);
    assert(mockEventTypes.includes("x402_lead_received"), "missing mock receive event");
    assert(mockEventTypes.includes("x402_lead_stored"), "missing mock stored event");
    assert(mockEventTypes.includes("x402_lead_duplicate"), "missing mock duplicate event");
    assert(mockEventTypes.includes("workflow_started"), "missing mock workflow_started event");

    console.log("LeadNestAI handoff test passed.");
    console.log(`receipt: ${unlocked.body.receipt.id}`);
    console.log(`lead: ${lead.businessName}`);
    console.log(`stored lead id: ${firstHandoff.body.leadId}`);
  } finally {
    stopProcess(seller);
    stopProcess(mock);
  }
}

run().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
