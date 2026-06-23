import type { AppConfig } from "./config.js";
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
export declare class PaymentBudget implements PaymentBudgetGuard {
    private readonly config;
    private sessionCalls;
    private sessionReservedAtomic;
    constructor(config: AppConfig);
    reserve(resource: string, amountAtomic: bigint): Promise<BudgetReservation>;
    private readLedger;
    private writeLedger;
    private pruneLedger;
    private acquireLock;
    private removeStaleLock;
}
