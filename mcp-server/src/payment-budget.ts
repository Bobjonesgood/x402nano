import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { AppConfig } from "./config.js";

interface BudgetAttempt {
  id: string;
  amountAtomic: string;
  resource: string;
  reservedAt: string;
}

interface BudgetDay {
  reservedAtomic: string;
  attempts: BudgetAttempt[];
}

interface BudgetLedger {
  version: 1;
  days: Record<string, BudgetDay>;
}

export interface BudgetReservation {
  id: string;
  day: string;
  amountAtomic: bigint;
  sessionCalls: number;
  sessionReservedAtomic: bigint;
  dailyReservedAtomic: bigint;
}

export interface PaymentBudgetGuard {
  reserve(resource: string, amountAtomic: bigint): Promise<BudgetReservation>;
}

export class PaymentBudget implements PaymentBudgetGuard {
  private sessionCalls = 0;
  private sessionReservedAtomic = 0n;

  constructor(private readonly config: AppConfig) {}

  async reserve(resource: string, amountAtomic: bigint): Promise<BudgetReservation> {
    if (this.sessionCalls + 1 > this.config.sessionMaxCalls) {
      throw new Error(`Session payment call limit reached (${this.config.sessionMaxCalls}). Restarting does not reset the persistent daily budget.`);
    }
    if (this.sessionReservedAtomic + amountAtomic > this.config.sessionMaxAtomic) {
      throw new Error("Payment would exceed X402NANO_SESSION_MAX_USDC.");
    }

    const release = await this.acquireLock();
    try {
      const ledger = await this.readLedger();
      const now = new Date();
      const day = now.toISOString().slice(0, 10);
      const current = ledger.days[day] ?? { reservedAtomic: "0", attempts: [] };
      const dailyReservedAtomic = BigInt(current.reservedAtomic) + amountAtomic;

      if (dailyReservedAtomic > this.config.dailyMaxAtomic) {
        throw new Error("Payment would exceed X402NANO_DAILY_MAX_USDC. No signature was created.");
      }

      const id = crypto.randomUUID();
      current.reservedAtomic = dailyReservedAtomic.toString();
      current.attempts.push({
        id,
        amountAtomic: amountAtomic.toString(),
        resource,
        reservedAt: now.toISOString()
      });
      ledger.days[day] = current;
      this.pruneLedger(ledger, day);
      await this.writeLedger(ledger);

      this.sessionCalls += 1;
      this.sessionReservedAtomic += amountAtomic;
      return {
        id,
        day,
        amountAtomic,
        sessionCalls: this.sessionCalls,
        sessionReservedAtomic: this.sessionReservedAtomic,
        dailyReservedAtomic
      };
    } finally {
      await release();
    }
  }

  private async readLedger(): Promise<BudgetLedger> {
    try {
      const content = await fs.readFile(this.config.budgetLedgerPath, "utf8");
      const parsed = JSON.parse(content) as BudgetLedger;
      if (parsed.version !== 1 || !parsed.days || typeof parsed.days !== "object") {
        throw new Error("Unsupported payment budget ledger format.");
      }
      return parsed;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return { version: 1, days: {} };
      if (error instanceof SyntaxError) throw new Error("Payment budget ledger is invalid JSON; refusing paid calls.");
      throw error;
    }
  }

  private async writeLedger(ledger: BudgetLedger): Promise<void> {
    await fs.mkdir(path.dirname(this.config.budgetLedgerPath), { recursive: true });
    const tempPath = `${this.config.budgetLedgerPath}.${process.pid}.${crypto.randomUUID()}.tmp`;
    await fs.writeFile(tempPath, `${JSON.stringify(ledger, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    await fs.rename(tempPath, this.config.budgetLedgerPath);
  }

  private pruneLedger(ledger: BudgetLedger, currentDay: string): void {
    const cutoff = new Date(`${currentDay}T00:00:00.000Z`);
    cutoff.setUTCDate(cutoff.getUTCDate() - 31);
    for (const day of Object.keys(ledger.days)) {
      if (day < cutoff.toISOString().slice(0, 10)) delete ledger.days[day];
    }
  }

  private async acquireLock(): Promise<() => Promise<void>> {
    const lockPath = `${this.config.budgetLedgerPath}.lock`;
    await fs.mkdir(path.dirname(lockPath), { recursive: true });

    for (let attempt = 0; attempt < 50; attempt += 1) {
      try {
        const handle = await fs.open(lockPath, "wx", 0o600);
        return async () => {
          await handle.close();
          await fs.unlink(lockPath).catch(error => {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
          });
        };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        await this.removeStaleLock(lockPath);
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    throw new Error("Payment budget ledger is busy; refusing paid call.");
  }

  private async removeStaleLock(lockPath: string): Promise<void> {
    try {
      const stat = await fs.stat(lockPath);
      if (Date.now() - stat.mtimeMs > 30_000) await fs.unlink(lockPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
}
