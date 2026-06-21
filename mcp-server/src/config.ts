import os from "node:os";
import path from "node:path";

const DEFAULT_API_ORIGIN = "https://x402nano.onrender.com";
const ALLOWED_API_HOST = "x402nano.onrender.com";

export const BASE_NETWORK = "eip155:8453";
export const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
export const EXPECTED_SELLER = "0x4cc3831eB479aCFb6D44631d4a30814508Cf52d3";
export const EXPECTED_PAID_ATOMIC = 50_000n;
export const EXPECTED_PAID_USDC = "0.05";
export const REAL_PAYMENT_ACK = "PAY_REAL_0.05_USDC";

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

export function parseUsdcAtomic(value: string): bigint {
  const match = /^(\d+)(?:\.(\d{0,6}))?$/.exec(value.trim());
  if (!match) throw new Error(`Invalid USDC amount: ${value}`);
  const whole = match[1] ?? "0";
  const fraction = (match[2] ?? "").padEnd(6, "0");
  return BigInt(whole) * 1_000_000n + BigInt(fraction || "0");
}

export function validateApiOrigin(value: string): URL {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.hostname !== ALLOWED_API_HOST ||
    url.port ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(`X402NANO_API_ORIGIN must be exactly ${DEFAULT_API_ORIGIN}.`);
  }
  return url;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const apiOrigin = validateApiOrigin(env.X402NANO_API_ORIGIN?.trim() || DEFAULT_API_ORIGIN);
  const maxPaymentAtomic = parseUsdcAtomic(env.X402NANO_MAX_PAYMENT_USDC?.trim() || EXPECTED_PAID_USDC);

  if (maxPaymentAtomic > EXPECTED_PAID_ATOMIC) {
    throw new Error(`X402NANO_MAX_PAYMENT_USDC cannot exceed ${EXPECTED_PAID_USDC}.`);
  }

  const sessionMaxCalls = Number(env.X402NANO_SESSION_MAX_CALLS?.trim() || "1");
  if (!Number.isInteger(sessionMaxCalls) || sessionMaxCalls < 1 || sessionMaxCalls > 100) {
    throw new Error("X402NANO_SESSION_MAX_CALLS must be an integer from 1 through 100.");
  }

  const sessionMaxAtomic = parseUsdcAtomic(env.X402NANO_SESSION_MAX_USDC?.trim() || EXPECTED_PAID_USDC);
  const dailyMaxAtomic = parseUsdcAtomic(env.X402NANO_DAILY_MAX_USDC?.trim() || EXPECTED_PAID_USDC);
  const hardBudgetCeiling = parseUsdcAtomic("5.00");
  if (sessionMaxAtomic < EXPECTED_PAID_ATOMIC || sessionMaxAtomic > hardBudgetCeiling) {
    throw new Error("X402NANO_SESSION_MAX_USDC must be from 0.05 through 5.00.");
  }
  if (dailyMaxAtomic < sessionMaxAtomic || dailyMaxAtomic > hardBudgetCeiling) {
    throw new Error("X402NANO_DAILY_MAX_USDC must be at least the session maximum and no more than 5.00.");
  }

  const defaultDataDir = env.LOCALAPPDATA?.trim()
    ? path.join(env.LOCALAPPDATA.trim(), "x402nano")
    : path.join(os.homedir(), ".x402nano");
  const budgetLedgerPath = path.resolve(env.X402NANO_BUDGET_LEDGER_PATH?.trim() || path.join(defaultDataDir, "mcp-payment-budget.json"));

  const requestTimeoutMs = Number(env.X402NANO_REQUEST_TIMEOUT_MS?.trim() || "60000");
  if (!Number.isInteger(requestTimeoutMs) || requestTimeoutMs < 5_000 || requestTimeoutMs > 120_000) {
    throw new Error("X402NANO_REQUEST_TIMEOUT_MS must be an integer from 5000 through 120000.");
  }

  const key = env.X402NANO_BUYER_PRIVATE_KEY?.trim();
  if (key && !/^0x[a-fA-F0-9]{64}$/.test(key)) {
    throw new Error("X402NANO_BUYER_PRIVATE_KEY must be a 32-byte 0x-prefixed private key.");
  }

  return {
    apiOrigin,
    buyerPrivateKey: key as `0x${string}` | undefined,
    paymentAcknowledged: env.X402NANO_PAYMENT_ACK?.trim() === REAL_PAYMENT_ACK,
    maxPaymentAtomic,
    sessionMaxCalls,
    sessionMaxAtomic,
    dailyMaxAtomic,
    budgetLedgerPath,
    rpcUrl: env.X402NANO_BASE_RPC_URL?.trim() || "https://mainnet.base.org",
    requestTimeoutMs
  };
}
