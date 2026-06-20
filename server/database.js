import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCAL_DB_PATH = path.resolve(__dirname, "../data/x402nano-alerts.sqlite");
const RENDER_DB_PATH = "/data/alerts.db";
let defaultStore = null;

function defaultDatabasePath() {
  if (process.env.ALERT_DB_PATH) return process.env.ALERT_DB_PATH;
  return process.env.RENDER ? RENDER_DB_PATH : LOCAL_DB_PATH;
}

function parseSlugs(value) {
  try {
    const slugs = JSON.parse(value);
    return Array.isArray(slugs) ? slugs : [];
  } catch {
    return [];
  }
}

function rowToAlert(row) {
  if (!row) return null;
  return {
    id: row.id,
    payerAddress: row.payer_address,
    webhookUrl: row.webhook_url,
    slugs: parseSlugs(row.slugs),
    threshold: row.threshold,
    checkIntervalMinutes: row.check_interval_minutes,
    active: Boolean(row.active),
    createdAt: row.created_at,
    lastChecked: row.last_checked,
    lastTriggered: row.last_triggered
  };
}

export function createAlertDatabase({ databasePath = defaultDatabasePath() } = {}) {
  if (databasePath !== ":memory:") fs.mkdirSync(path.dirname(databasePath), { recursive: true });

  const db = new Database(databasePath);
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  if (databasePath !== ":memory:") db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      payer_address TEXT NOT NULL,
      webhook_url TEXT NOT NULL,
      slugs TEXT NOT NULL,
      threshold REAL NOT NULL,
      check_interval_minutes INTEGER NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      last_checked TEXT,
      last_triggered TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_alerts_active ON alerts(active);

    CREATE TABLE IF NOT EXISTS alert_snapshots (
      alert_id TEXT NOT NULL,
      slug TEXT NOT NULL,
      outcome TEXT NOT NULL,
      probability REAL NOT NULL,
      checked_at TEXT NOT NULL,
      PRIMARY KEY (alert_id, slug),
      FOREIGN KEY (alert_id) REFERENCES alerts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS alert_checker_locks (
      id TEXT PRIMARY KEY,
      acquired_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS alert_checker_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      last_started_at TEXT,
      last_completed_at TEXT,
      last_error_at TEXT,
      last_error TEXT
    );

    INSERT OR IGNORE INTO alert_checker_state (id) VALUES (1);
  `);

  const upsertAlert = db.prepare(`
    INSERT INTO alerts (
      id, payer_address, webhook_url, slugs, threshold,
      check_interval_minutes, active, created_at, last_checked, last_triggered
    ) VALUES (
      @id, @payerAddress, @webhookUrl, @slugs, @threshold,
      @checkIntervalMinutes, @active, @createdAt, @lastChecked, @lastTriggered
    )
    ON CONFLICT(id) DO UPDATE SET
      payer_address = excluded.payer_address,
      webhook_url = excluded.webhook_url,
      slugs = excluded.slugs,
      threshold = excluded.threshold,
      check_interval_minutes = excluded.check_interval_minutes,
      active = excluded.active,
      created_at = excluded.created_at,
      last_checked = excluded.last_checked,
      last_triggered = excluded.last_triggered
  `);
  const selectActive = db.prepare("SELECT * FROM alerts WHERE active = 1 ORDER BY created_at ASC");
  const updateAlertStatement = db.prepare(`
    UPDATE alerts SET
      payer_address = @payerAddress,
      webhook_url = @webhookUrl,
      slugs = @slugs,
      threshold = @threshold,
      check_interval_minutes = @checkIntervalMinutes,
      active = @active,
      created_at = @createdAt,
      last_checked = @lastChecked,
      last_triggered = @lastTriggered
    WHERE id = @id
  `);
  const deleteAlertStatement = db.prepare("DELETE FROM alerts WHERE id = ?");
  const selectCounts = db.prepare(`
    SELECT COUNT(*) AS registered, SUM(CASE WHEN active = 1 THEN 1 ELSE 0 END) AS active
    FROM alerts
  `);
  const selectSnapshot = db.prepare("SELECT * FROM alert_snapshots WHERE alert_id = ? AND slug = ?");
  const upsertSnapshot = db.prepare(`
    INSERT INTO alert_snapshots (alert_id, slug, outcome, probability, checked_at)
    VALUES (@alertId, @slug, @outcome, @probability, @checkedAt)
    ON CONFLICT(alert_id, slug) DO UPDATE SET
      outcome = excluded.outcome,
      probability = excluded.probability,
      checked_at = excluded.checked_at
  `);
  const deleteExpiredLocks = db.prepare("DELETE FROM alert_checker_locks WHERE expires_at <= ?");
  const insertCheckerLock = db.prepare(`
    INSERT OR IGNORE INTO alert_checker_locks (id, acquired_at, expires_at)
    VALUES (@id, @acquiredAt, @expiresAt)
  `);
  const deleteCheckerLock = db.prepare("DELETE FROM alert_checker_locks WHERE id = ?");
  const selectCheckerState = db.prepare("SELECT * FROM alert_checker_state WHERE id = 1");
  const markCheckerStarted = db.prepare(`
    UPDATE alert_checker_state
    SET last_started_at = ?, last_error_at = NULL, last_error = NULL
    WHERE id = 1
  `);
  const markCheckerCompleted = db.prepare(`
    UPDATE alert_checker_state
    SET last_completed_at = ?, last_error_at = NULL, last_error = NULL
    WHERE id = 1
  `);
  const markCheckerFailed = db.prepare(`
    UPDATE alert_checker_state
    SET last_error_at = ?, last_error = ?
    WHERE id = 1
  `);
  const acquireCheckerLock = db.transaction(({ id, acquiredAt, expiresAt }) => {
    deleteExpiredLocks.run(acquiredAt);
    return insertCheckerLock.run({ id, acquiredAt, expiresAt }).changes === 1;
  });

  function alertParams(alert) {
    return {
      ...alert,
      slugs: JSON.stringify(alert.slugs),
      active: alert.active ? 1 : 0,
      lastChecked: alert.lastChecked ?? null,
      lastTriggered: alert.lastTriggered ?? null
    };
  }

  return {
    databasePath,
    saveAlert(alert) {
      upsertAlert.run(alertParams(alert));
      return { ...alert, slugs: [...alert.slugs] };
    },
    getAllActiveAlerts() {
      return selectActive.all().map(rowToAlert);
    },
    updateAlert(alert) {
      const result = updateAlertStatement.run(alertParams(alert));
      if (result.changes === 0) throw new Error(`Alert not found: ${alert.id}`);
      return { ...alert, slugs: [...alert.slugs] };
    },
    deleteAlert(id) {
      return deleteAlertStatement.run(id).changes > 0;
    },
    getAlertCounts() {
      const counts = selectCounts.get();
      return { registered: counts.registered, active: counts.active ?? 0 };
    },
    getSnapshot(alertId, slug) {
      const row = selectSnapshot.get(alertId, slug);
      return row ? { outcome: row.outcome, probability: row.probability, checkedAt: row.checked_at } : null;
    },
    saveSnapshot({ alertId, slug, outcome, probability, checkedAt }) {
      upsertSnapshot.run({ alertId, slug, outcome, probability, checkedAt });
    },
    acquireCheckerLock({ id, acquiredAt, expiresAt }) {
      return acquireCheckerLock({ id, acquiredAt, expiresAt });
    },
    releaseCheckerLock(id) {
      deleteCheckerLock.run(id);
    },
    markCheckerStarted(timestamp) {
      markCheckerStarted.run(timestamp);
    },
    markCheckerCompleted(timestamp) {
      markCheckerCompleted.run(timestamp);
    },
    markCheckerFailed(timestamp, error) {
      markCheckerFailed.run(timestamp, String(error).slice(0, 1000));
    },
    getCheckerState() {
      const row = selectCheckerState.get();
      return {
        lastStartedAt: row.last_started_at,
        lastCompletedAt: row.last_completed_at,
        lastErrorAt: row.last_error_at,
        lastError: row.last_error
      };
    },
    close() {
      if (db.open) db.close();
    }
  };
}

export function initDb(options) {
  if (!defaultStore) defaultStore = createAlertDatabase(options);
  return defaultStore;
}

function store() {
  if (!defaultStore) throw new Error("Alert database is not initialized. Call initDb() first.");
  return defaultStore;
}

export function saveAlert(alert) {
  return store().saveAlert(alert);
}

export function getAllActiveAlerts() {
  return store().getAllActiveAlerts();
}

export function updateAlert(alert) {
  return store().updateAlert(alert);
}

export function deleteAlert(id) {
  return store().deleteAlert(id);
}

export function closeDb() {
  if (!defaultStore) return;
  defaultStore.close();
  defaultStore = null;
}
