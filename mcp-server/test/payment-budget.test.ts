import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { loadConfig } from "../src/config.js";
import { PaymentBudget } from "../src/payment-budget.js";

async function tempLedger() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "x402nano-budget-"));
  return { directory, ledgerPath: path.join(directory, "ledger.json") };
}

test("reserves one payment then blocks a second call in the same session", async t => {
  const { directory, ledgerPath } = await tempLedger();
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const config = loadConfig({ X402NANO_BUDGET_LEDGER_PATH: ledgerPath });
  const budget = new PaymentBudget(config);

  const reservation = await budget.reserve("https://x402nano.onrender.com/api/markets/delta?slug=test", 50_000n);
  assert.equal(reservation.sessionCalls, 1);
  assert.equal(reservation.dailyReservedAtomic, 50_000n);
  await assert.rejects(
    budget.reserve("https://x402nano.onrender.com/api/markets/brief?slug=test", 50_000n),
    /Session payment call limit reached/
  );
});

test("persistent daily budget blocks a new process after one reserved attempt", async t => {
  const { directory, ledgerPath } = await tempLedger();
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const config = loadConfig({ X402NANO_BUDGET_LEDGER_PATH: ledgerPath });

  await new PaymentBudget(config).reserve("https://x402nano.onrender.com/api/markets/delta?slug=test", 50_000n);
  await assert.rejects(
    new PaymentBudget(config).reserve("https://x402nano.onrender.com/api/markets/delta?slug=test-2", 50_000n),
    /X402NANO_DAILY_MAX_USDC/
  );
});

test("invalid ledger fails closed instead of resetting the budget", async t => {
  const { directory, ledgerPath } = await tempLedger();
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  await fs.writeFile(ledgerPath, "not json", "utf8");
  const budget = new PaymentBudget(loadConfig({ X402NANO_BUDGET_LEDGER_PATH: ledgerPath }));
  await assert.rejects(
    budget.reserve("https://x402nano.onrender.com/api/markets/delta?slug=test", 50_000n),
    /invalid JSON/
  );
});
