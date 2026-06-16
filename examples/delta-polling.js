const API_ORIGIN = process.env.X402NANO_API_ORIGIN || "https://x402nano.onrender.com";
const SLUG = process.env.X402NANO_MARKET_SLUG || "will-gideon-saar-be-the-next-prime-minister-of-israel";
const POLL_INTERVAL_MS = Number(process.env.X402NANO_POLL_INTERVAL_MS || 5 * 60 * 1000);

async function getJson(path, options = {}) {
  const response = await fetch(new URL(path, API_ORIGIN), options);
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

async function createXPayment(_challenge) {
  // Plug in your x402 wallet/client here. Return the encoded X-PAYMENT value.
  // Keep private keys outside this file, for example in a wallet service or env-backed signer.
  throw new Error("createXPayment() must be connected to an x402 client before paid polling.");
}

function shouldPayForDelta(freshness) {
  if (!freshness?.generatedOnRequest) return false;
  if ((freshness.estimatedLatencyMs?.p95 ?? Infinity) > 5000) return false;
  return freshness.expectedMaxAgeSeconds <= 120;
}

async function pollDeltaOnce(since) {
  const path = `/api/markets/delta?slug=${encodeURIComponent(SLUG)}&since=${encodeURIComponent(since)}`;
  const unpaid = await getJson(path);

  if (unpaid.response.status !== 402) {
    throw new Error(`Expected 402 before payment, got ${unpaid.response.status}`);
  }

  const freshness = unpaid.body.x402?.resource?.freshness;
  if (!shouldPayForDelta(freshness)) {
    return { paid: false, since, reason: "freshness metadata did not meet local policy" };
  }

  const payment = await createXPayment(unpaid.body.x402);
  const paid = await getJson(path, { headers: { "X-PAYMENT": payment } });

  if (!paid.response.ok) {
    throw new Error(paid.body.reason || paid.body.error || `Paid request failed with ${paid.response.status}`);
  }

  const nextSince = paid.body.data?.window?.until || new Date().toISOString();
  return {
    paid: true,
    since: nextSince,
    receipt: paid.body.receipt?.id,
    repeatCheckPriority: paid.body.data?.significance?.repeatCheckPriority,
    summary: paid.body.data?.significance?.summary
  };
}

async function main() {
  let since = process.env.X402NANO_SINCE || new Date(Date.now() - 15 * 60 * 1000).toISOString();

  while (true) {
    try {
      const result = await pollDeltaOnce(since);
      console.log(JSON.stringify(result, null, 2));
      since = result.since;
    } catch (error) {
      console.error(`poll failed: ${error.message}`);
    }

    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
