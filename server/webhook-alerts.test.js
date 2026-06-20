import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createAlertDatabase } from "./database.js";
import { createWebhookAlertService, validateAlertRegistration } from "./webhook-alerts.js";

test("registration validation applies defaults and requires a public HTTPS webhook", () => {
  const valid = validateAlertRegistration({
    webhookUrl: "https://agent.example/webhook",
    slugs: ["market-one", "market-one"]
  });
  assert.equal(valid.ok, true);
  assert.deepEqual(valid.value.slugs, ["market-one"]);
  assert.equal(valid.value.threshold, 0.07);
  assert.equal(valid.value.checkIntervalMinutes, 15);

  const invalid = validateAlertRegistration({ webhookUrl: "http://localhost/hook", slugs: [] });
  assert.equal(invalid.ok, false);
  assert.match(invalid.errors.join(" "), /HTTPS/);
  assert.match(invalid.errors.join(" "), /at least one/);
});

test("checker establishes a baseline, detects a threshold move, and retries delivery", async () => {
  let clock = new Date("2026-06-20T09:15:00.000Z");
  const probabilities = [0.62, 0.71];
  const deliveries = [];
  const events = [];
  const database = createAlertDatabase({ databasePath: ":memory:" });
  const service = createWebhookAlertService({
    database,
    now: () => new Date(clock),
    retryDelayMs: 0,
    fetchMarketBySlug: async slug => ({ slug, prices: { Yes: probabilities.shift(), No: 0.38 } }),
    fetchImpl: async (_url, options) => {
      deliveries.push(JSON.parse(options.body));
      return { ok: deliveries.length === 3, status: deliveries.length === 3 ? 200 : 503 };
    },
    log: (event, details) => events.push({ event, details })
  });

  const alert = service.register({
    payerAddress: "0x123",
    webhookUrl: "https://agent.example/webhook",
    slugs: ["market-one"],
    threshold: 0.07,
    checkIntervalMinutes: 15
  });

  await service.checkNow();
  assert.equal(deliveries.length, 0);

  clock = new Date("2026-06-20T09:30:00.000Z");
  await service.checkNow();
  assert.equal(deliveries.length, 3);
  assert.deepEqual(deliveries[2], {
    event: "significant_delta",
    alertId: alert.id,
    slug: "market-one",
    change: {
      outcome: "Yes",
      previousProb: 0.62,
      currentProb: 0.71,
      absoluteChange: 0.09,
      direction: "up"
    },
    timestamp: "2026-06-20T09:30:00.000Z"
  });
  assert.equal(events.at(-1).event, "alert_webhook_delivered");
  assert.equal(service.status().activeAlerts, 1);
  database.close();
});

test("SQLite preserves alerts and probability baselines across service restarts", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "x402nano-alerts-"));
  const databasePath = path.join(directory, "alerts.sqlite");
  let clock = new Date("2026-06-20T09:15:00.000Z");

  try {
    const firstDatabase = createAlertDatabase({ databasePath });
    const firstService = createWebhookAlertService({
      database: firstDatabase,
      now: () => new Date(clock),
      fetchMarketBySlug: async slug => ({ slug, prices: { Yes: 0.62, No: 0.38 } })
    });
    const registered = firstService.register({
      payerAddress: "0xPersistentBuyer",
      webhookUrl: "https://agent.example/webhook",
      slugs: ["market-one"],
      threshold: 0.07,
      checkIntervalMinutes: 15
    });
    await firstService.checkNow();
    firstDatabase.close();

    clock = new Date("2026-06-20T09:30:00.000Z");
    const deliveries = [];
    const secondDatabase = createAlertDatabase({ databasePath });
    const secondService = createWebhookAlertService({
      database: secondDatabase,
      now: () => new Date(clock),
      retryDelayMs: 0,
      fetchMarketBySlug: async slug => ({ slug, prices: { Yes: 0.71, No: 0.29 } }),
      fetchImpl: async (_url, options) => {
        deliveries.push(JSON.parse(options.body));
        return { ok: true, status: 200 };
      }
    });

    assert.equal(secondService.status().registeredAlerts, 1);
    assert.equal(secondDatabase.getAllActiveAlerts()[0].id, registered.id);
    await secondService.checkNow();
    assert.equal(deliveries.length, 1);
    assert.equal(deliveries[0].change.absoluteChange, 0.09);
    assert.equal(secondDatabase.getAllActiveAlerts()[0].lastTriggered, "2026-06-20T09:30:00.000Z");
    secondDatabase.close();
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("SQLite checker lock prevents overlap across service instances", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "x402nano-lock-"));
  const databasePath = path.join(directory, "alerts.sqlite");
  const firstDatabase = createAlertDatabase({ databasePath });
  const secondDatabase = createAlertDatabase({ databasePath });
  let releaseMarketFetch;
  const marketFetchBlocked = new Promise(resolve => { releaseMarketFetch = resolve; });

  try {
    const firstService = createWebhookAlertService({
      database: firstDatabase,
      fetchMarketBySlug: async slug => {
        await marketFetchBlocked;
        return { slug, prices: { Yes: 0.62, No: 0.38 } };
      }
    });
    firstService.register({
      payerAddress: "0xLockBuyer",
      webhookUrl: "https://agent.example/webhook",
      slugs: ["market-one"],
      threshold: 0.07,
      checkIntervalMinutes: 15
    });

    const secondService = createWebhookAlertService({
      database: secondDatabase,
      fetchMarketBySlug: async slug => ({ slug, prices: { Yes: 0.62, No: 0.38 } })
    });

    const firstRun = firstService.checkNow();
    await new Promise(resolve => setTimeout(resolve, 20));
    const secondRun = await secondService.checkNow();
    assert.deepEqual(secondRun, { skipped: true, reason: "checker lock is held" });

    releaseMarketFetch();
    await firstRun;
    assert.equal(firstService.status().lastCheckStatus, "ok");
  } finally {
    releaseMarketFetch?.();
    firstDatabase.close();
    secondDatabase.close();
    await fs.rm(directory, { recursive: true, force: true });
  }
});
