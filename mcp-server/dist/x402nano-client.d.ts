import { type AppConfig } from "./config.js";
import { type PaymentBudgetGuard } from "./payment-budget.js";
type JsonObject = Record<string, unknown>;
export interface PaymentChallengeSummary {
    network: string;
    asset: string;
    amountAtomic: bigint;
    payTo: string;
    resource: string;
}
export declare class X402NanoClient {
    private readonly config;
    private readonly baseFetch;
    private readonly budget;
    private paidQueue;
    constructor(config: AppConfig, baseFetch?: typeof globalThis.fetch, budget?: PaymentBudgetGuard);
    listTrendingMarkets(limit?: number): Promise<JsonObject>;
    getPricing(): Promise<JsonObject>;
    getMarketBrief(slug: string): Promise<JsonObject>;
    getMarketDelta(slug: string, since: string): Promise<JsonObject>;
    private apiUrl;
    private assertAllowedUrl;
    private request;
    private parseJson;
    private fetchJson;
    private challengeFrom;
    private fetchPaidJson;
    private enqueuePaidCall;
}
export {};
