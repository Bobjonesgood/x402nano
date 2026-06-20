const API_ORIGIN = process.env.X402NANO_API_ORIGIN || "https://x402nano.onrender.com";
const WEBHOOK_URL = process.env.X402NANO_WEBHOOK_URL || "https://my-agent.com/webhook";
const SLUGS = (process.env.X402NANO_MARKET_SLUGS || "will-gideon-saar-be-the-next-prime-minister-of-israel")
  .split(",")
  .map(slug => slug.trim())
  .filter(Boolean);

const registration = {
  webhookUrl: WEBHOOK_URL,
  slugs: SLUGS,
  threshold: Number(process.env.X402NANO_ALERT_THRESHOLD || 0.07),
  checkIntervalMinutes: Number(process.env.X402NANO_ALERT_INTERVAL_MINUTES || 15)
};

async function postRegistration(payment) {
  const response = await fetch(new URL("/api/alerts/register", API_ORIGIN), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(payment ? { "X-PAYMENT": payment } : {})
    },
    body: JSON.stringify(registration)
  });
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

async function createXPayment(_challenge) {
  // Connect an x402 wallet/client here and return the encoded X-PAYMENT value.
  // Keep private keys in a wallet service or environment-backed signer.
  throw new Error("createXPayment() must be connected to an x402 client before registration.");
}

async function main() {
  const unpaid = await postRegistration();
  if (unpaid.response.status !== 402) {
    throw new Error(unpaid.body.reason || unpaid.body.error || `Expected 402, got ${unpaid.response.status}`);
  }

  const amount = unpaid.body.paymentRequirements?.amount;
  if (amount !== "0.08") throw new Error(`Expected a 0.08 USDC registration price, got ${amount}`);

  const payment = await createXPayment(unpaid.body.x402);
  const paid = await postRegistration(payment);
  if (!paid.response.ok) {
    throw new Error(paid.body.reason || paid.body.error || `Registration failed with ${paid.response.status}`);
  }

  console.log(JSON.stringify({
    receiptId: paid.body.receipt?.id,
    alert: paid.body.alert
  }, null, 2));
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
