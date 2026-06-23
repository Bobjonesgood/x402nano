import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
export class PaymentBudget {
    config;
    sessionCalls = 0;
    sessionReservedAtomic = 0n;
    constructor(config) {
        this.config = config;
    }
    async reserve(resource, amountAtomic) {
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
        }
        finally {
            await release();
        }
    }
    async readLedger() {
        try {
            const content = await fs.readFile(this.config.budgetLedgerPath, "utf8");
            const parsed = JSON.parse(content);
            if (parsed.version !== 1 || !parsed.days || typeof parsed.days !== "object") {
                throw new Error("Unsupported payment budget ledger format.");
            }
            return parsed;
        }
        catch (error) {
            if (error.code === "ENOENT")
                return { version: 1, days: {} };
            if (error instanceof SyntaxError)
                throw new Error("Payment budget ledger is invalid JSON; refusing paid calls.");
            throw error;
        }
    }
    async writeLedger(ledger) {
        await fs.mkdir(path.dirname(this.config.budgetLedgerPath), { recursive: true });
        const tempPath = `${this.config.budgetLedgerPath}.${process.pid}.${crypto.randomUUID()}.tmp`;
        await fs.writeFile(tempPath, `${JSON.stringify(ledger, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
        await fs.rename(tempPath, this.config.budgetLedgerPath);
    }
    pruneLedger(ledger, currentDay) {
        const cutoff = new Date(`${currentDay}T00:00:00.000Z`);
        cutoff.setUTCDate(cutoff.getUTCDate() - 31);
        for (const day of Object.keys(ledger.days)) {
            if (day < cutoff.toISOString().slice(0, 10))
                delete ledger.days[day];
        }
    }
    async acquireLock() {
        const lockPath = `${this.config.budgetLedgerPath}.lock`;
        await fs.mkdir(path.dirname(lockPath), { recursive: true });
        for (let attempt = 0; attempt < 50; attempt += 1) {
            try {
                const handle = await fs.open(lockPath, "wx", 0o600);
                return async () => {
                    await handle.close();
                    await fs.unlink(lockPath).catch(error => {
                        if (error.code !== "ENOENT")
                            throw error;
                    });
                };
            }
            catch (error) {
                if (error.code !== "EEXIST")
                    throw error;
                await this.removeStaleLock(lockPath);
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }
        throw new Error("Payment budget ledger is busy; refusing paid call.");
    }
    async removeStaleLock(lockPath) {
        try {
            const stat = await fs.stat(lockPath);
            if (Date.now() - stat.mtimeMs > 30_000)
                await fs.unlink(lockPath);
        }
        catch (error) {
            if (error.code !== "ENOENT")
                throw error;
        }
    }
}
//# sourceMappingURL=payment-budget.js.map