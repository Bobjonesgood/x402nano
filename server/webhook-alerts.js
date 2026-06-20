import crypto from "node:crypto";
import net from "node:net";

const DEFAULT_THRESHOLD = 0.07;
const DEFAULT_CHECK_INTERVAL_MINUTES = 15;
const MAX_SLUGS = 20;
const WEBHOOK_TIMEOUT_MS = 10_000;
const CHECKER_LOCK_ID = "webhook-alert-checker";

function isPrivateAddress(hostname) {
  if (hostname === "localhost" || hostname.endsWith(".localhost")) return true;
  if (!net.isIP(hostname)) return false;

  if (hostname === "::1" || hostname.startsWith("fc") || hostname.startsWith("fd") || hostname.startsWith("fe80:")) {
    return true;
  }

  const parts = hostname.split(".").map(Number);
  if (parts.length !== 4) return false;
  return parts[0] === 10 ||
    parts[0] === 127 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168);
}

function validateWebhookUrl(value) {
  try {
    const url = new URL(String(value ?? ""));
    if (url.protocol !== "https:") return "webhookUrl must use HTTPS.";
    if (url.username || url.password) return "webhookUrl must not contain credentials.";
    if (isPrivateAddress(url.hostname.toLowerCase())) return "webhookUrl must use a public HTTPS host.";
    if (url.href.length > 2048) return "webhookUrl is too long.";
    return null;
  } catch {
    return "webhookUrl must be a valid HTTPS URL.";
  }
}

export function validateAlertRegistration(input) {
  const body = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const errors = [];
  const webhookError = validateWebhookUrl(body.webhookUrl);
  if (webhookError) errors.push(webhookError);

  const slugs = Array.isArray(body.slugs)
    ? [...new Set(body.slugs.map(slug => String(slug ?? "").trim()).filter(Boolean))]
    : [];
  if (slugs.length === 0) errors.push("slugs must contain at least one Polymarket market slug.");
  if (slugs.length > MAX_SLUGS) errors.push(`slugs supports at most ${MAX_SLUGS} markets per registration.`);
  if (slugs.some(slug => !/^[a-z0-9][a-z0-9-]{0,199}$/.test(slug))) {
    errors.push("Each slug must contain only lowercase letters, numbers, and hyphens.");
  }

  const threshold = body.threshold === undefined ? DEFAULT_THRESHOLD : Number(body.threshold);
  if (!Number.isFinite(threshold) || threshold <= 0 || threshold > 1) {
    errors.push("threshold must be a number greater than 0 and at most 1.");
  }

  const checkIntervalMinutes = body.checkIntervalMinutes === undefined
    ? DEFAULT_CHECK_INTERVAL_MINUTES
    : Number(body.checkIntervalMinutes);
  if (!Number.isInteger(checkIntervalMinutes) || checkIntervalMinutes < 10 || checkIntervalMinutes > 1440) {
    errors.push("checkIntervalMinutes must be an integer between 10 and 1440.");
  }

  return {
    ok: errors.length === 0,
    errors,
    value: {
      webhookUrl: String(body.webhookUrl ?? "").trim(),
      slugs,
      threshold,
      checkIntervalMinutes
    }
  };
}

function monitoredOutcome(market) {
  const entries = Object.entries(market?.prices ?? {})
    .map(([outcome, probability]) => ({ outcome, probability: Number(probability) }))
    .filter(entry => Number.isFinite(entry.probability));
  if (entries.length === 0) return null;

  return entries.find(entry => entry.outcome.toLowerCase() === "yes") ?? entries[0];
}

function delay(ms) {
  return ms > 0 ? new Promise(resolve => setTimeout(resolve, ms)) : Promise.resolve();
}

export function createWebhookAlertService({
  database,
  fetchMarketBySlug,
  fetchImpl = fetch,
  now = () => new Date(),
  schedulerIntervalMs = 10 * 60 * 1000,
  retryDelayMs = 1000,
  log = () => {}
}) {
  if (!database) throw new Error("database is required.");
  if (typeof fetchMarketBySlug !== "function") throw new Error("fetchMarketBySlug is required.");

  let timer = null;
  let checkerRunning = false;

  function dbCall(operation, callback) {
    try {
      return callback();
    } catch (error) {
      error.databaseOperation = error.databaseOperation ?? operation;
      log("alert_database_failed", { operation, reason: error.message });
      throw error;
    }
  }

  function register({ payerAddress, webhookUrl, slugs, threshold, checkIntervalMinutes }) {
    const alert = {
      id: crypto.randomUUID(),
      payerAddress,
      webhookUrl,
      slugs: [...slugs],
      threshold,
      checkIntervalMinutes,
      active: true,
      createdAt: now().toISOString(),
      lastChecked: null,
      lastTriggered: null
    };
    return dbCall("saveAlert", () => database.saveAlert(alert));
  }

  async function deliver(alert, payload) {
    let lastError = null;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const response = await fetchImpl(alert.webhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "x402nano-webhook-alerts/0.1"
          },
          body: JSON.stringify(payload),
          redirect: "error",
          signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS)
        });
        if (response.ok) return { ok: true, attempts: attempt };
        lastError = `Webhook returned HTTP ${response.status}.`;
      } catch (error) {
        lastError = error.message;
      }

      if (attempt < 3) await delay(retryDelayMs * (2 ** (attempt - 1)));
    }

    return { ok: false, attempts: 3, error: lastError ?? "Webhook delivery failed." };
  }

  async function checkAlert(alert, checkedAt) {
    if (!alert.active) return;
    if (alert.lastChecked) {
      const elapsedMs = checkedAt.getTime() - new Date(alert.lastChecked).getTime();
      if (elapsedMs < alert.checkIntervalMinutes * 60 * 1000) return;
    }

    alert.lastChecked = checkedAt.toISOString();
    dbCall("updateAlert:lastChecked", () => database.updateAlert(alert));

    for (const slug of alert.slugs) {
      try {
        const market = await fetchMarketBySlug(slug);
        const current = monitoredOutcome(market);
        if (!current) {
          log("alert_market_unavailable", { alertId: alert.id, slug, reason: "No market probability was available." });
          continue;
        }

        const previous = dbCall("getSnapshot", () => database.getSnapshot(alert.id, slug));
        dbCall("saveSnapshot", () => database.saveSnapshot({
          alertId: alert.id,
          slug,
          outcome: current.outcome,
          probability: current.probability,
          checkedAt: checkedAt.toISOString()
        }));
        if (!previous || previous.outcome !== current.outcome) continue;

        const signedChange = current.probability - previous.probability;
        const absoluteChange = Number(Math.abs(signedChange).toFixed(6));
        if (absoluteChange < alert.threshold) continue;

        const payload = {
          event: "significant_delta",
          alertId: alert.id,
          slug,
          change: {
            outcome: current.outcome,
            previousProb: previous.probability,
            currentProb: current.probability,
            absoluteChange,
            direction: signedChange > 0 ? "up" : "down"
          },
          timestamp: checkedAt.toISOString()
        };
        alert.lastTriggered = checkedAt.toISOString();
        dbCall("updateAlert:lastTriggered", () => database.updateAlert(alert));
        const delivery = await deliver(alert, payload);
        log(delivery.ok ? "alert_webhook_delivered" : "alert_webhook_failed", {
          alertId: alert.id,
          slug,
          attempts: delivery.attempts,
          reason: delivery.error
        });
      } catch (error) {
        if (error.databaseOperation) throw error;
        log("alert_market_check_failed", { alertId: alert.id, slug, reason: error.message });
      }
    }
  }

  async function checkNow() {
    if (checkerRunning) return { skipped: true, reason: "checker already running" };
    checkerRunning = true;
    const checkedAt = now();
    let lockAcquired = false;
    try {
      const expiresAt = new Date(checkedAt.getTime() + Math.max(schedulerIntervalMs * 3, 30 * 60 * 1000)).toISOString();
      lockAcquired = dbCall("acquireCheckerLock", () => database.acquireCheckerLock({
        id: CHECKER_LOCK_ID,
        acquiredAt: checkedAt.toISOString(),
        expiresAt
      }));
      if (!lockAcquired) return { skipped: true, reason: "checker lock is held" };

      dbCall("markCheckerStarted", () => database.markCheckerStarted(checkedAt.toISOString()));
      const alerts = dbCall("getAllActiveAlerts", () => database.getAllActiveAlerts());
      for (const alert of alerts) await checkAlert(alert, checkedAt);
      dbCall("markCheckerCompleted", () => database.markCheckerCompleted(now().toISOString()));
      return { skipped: false, activeAlerts: alerts.filter(alert => alert.active).length };
    } catch (error) {
      try {
        dbCall("markCheckerFailed", () => database.markCheckerFailed(now().toISOString(), error.message));
      } catch {
        // The original database failure remains the actionable error.
      }
      log("alert_checker_failed", { reason: error.message });
      throw error;
    } finally {
      if (lockAcquired) {
        try {
          dbCall("releaseCheckerLock", () => database.releaseCheckerLock(CHECKER_LOCK_ID));
        } catch {
          // The lock expires automatically if release fails.
        }
      }
      checkerRunning = false;
    }
  }

  function start() {
    if (timer) return;
    timer = setInterval(() => {
      checkNow().catch(() => {});
    }, schedulerIntervalMs);
    timer.unref?.();
  }

  function stop() {
    if (!timer) return;
    clearInterval(timer);
    timer = null;
  }

  function status() {
    const counts = dbCall("getAlertCounts", () => database.getAlertCounts());
    const checker = dbCall("getCheckerState", () => database.getCheckerState());
    const lastStarted = checker.lastStartedAt ? new Date(checker.lastStartedAt).getTime() : 0;
    const lastCompleted = checker.lastCompletedAt ? new Date(checker.lastCompletedAt).getTime() : 0;
    const lastError = checker.lastErrorAt ? new Date(checker.lastErrorAt).getTime() : 0;
    const lastCheckStatus = checkerRunning || lastStarted > Math.max(lastCompleted, lastError)
      ? "running"
      : lastError > lastCompleted
        ? "error"
        : lastCompleted
          ? "ok"
          : "never";
    return {
      storage: "sqlite",
      registeredAlerts: counts.registered,
      activeAlerts: counts.active,
      schedulerIntervalMinutes: schedulerIntervalMs / 60_000,
      lastCheckAt: checker.lastCompletedAt ?? checker.lastStartedAt,
      lastCheckStatus,
      lastErrorAt: checker.lastErrorAt,
      lastError: checker.lastError,
      persistenceWarning: "Durability requires ALERT_DB_PATH to use storage retained by the hosting platform."
    };
  }

  return { register, checkNow, start, stop, status };
}
