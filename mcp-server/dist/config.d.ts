export declare const BASE_NETWORK = "eip155:8453";
export declare const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
export declare const EXPECTED_SELLER = "0x4cc3831eB479aCFb6D44631d4a30814508Cf52d3";
export declare const EXPECTED_PAID_ATOMIC = 50000n;
export declare const EXPECTED_PAID_USDC = "0.05";
export declare const REAL_PAYMENT_ACK = "PAY_REAL_0.05_USDC";
export interface AppConfig {
    apiOrigin: URL;
    buyerPrivateKey?: `0x${string}`;
    paymentAcknowledged: boolean;
    maxPaymentAtomic: bigint;
    sessionMaxCalls: number;
    sessionMaxAtomic: bigint;
    dailyMaxAtomic: bigint;
    budgetLedgerPath: string;
    rpcUrl: string;
    requestTimeoutMs: number;
}
export declare function parseUsdcAtomic(value: string): bigint;
export declare function validateApiOrigin(value: string): URL;
export declare function loadConfig(env?: NodeJS.ProcessEnv): AppConfig;
