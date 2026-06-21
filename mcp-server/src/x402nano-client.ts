import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";
import {
  BASE_NETWORK,
  BASE_USDC,
  EXPECTED_PAID_ATOMIC,
  EXPECTED_PAID_USDC,
  EXPECTED_SELLER,
  type AppConfig
} from "./config.js";

const PAID_PATHS = new Set(["/api/markets/brief", "/api/markets/delta"]);
const FREE_PATHS = new Set(["/api/markets/trending", "/api/pricing"]);

type JsonObject = Record<string, unknown>;

export interface PaymentChallengeSummary {
  network: string;
  asset: string;
  amountAtomic: bigint;
  payTo: string;
  resource: string;
}

export class X402NanoClient {
  private paidQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly config: AppConfig,
    private readonly baseFetch: typeof globalThis.fetch = globalThis.fetch
  ) {}

  async listTrendingMarkets(limit?: number): Promise<JsonObject> {
    const url = this.apiUrl("/api/markets/trending");
    if (limit !== undefined) url.searchParams.set("limit", String(limit));
    return this.fetchJson(url, false);
  }

  async getPricing(): Promise<JsonObject> {
    return this.fetchJson(this.apiUrl("/api/pricing"), false);
  }

  async getMarketBrief(slug: string): Promise<JsonObject> {
    const url = this.apiUrl("/api/markets/brief");
    url.searchParams.set("slug", slug);
    return this.enqueuePaidCall(() => this.fetchPaidJson(url));
  }

  async getMarketDelta(slug: string, since: string): Promise<JsonObject> {
    const url = this.apiUrl("/api/markets/delta");
    url.searchParams.set("slug", slug);
    url.searchParams.set("since", since);
    return this.enqueuePaidCall(() => this.fetchPaidJson(url));
  }

  private apiUrl(path: string): URL {
    const url = new URL(path, this.config.apiOrigin);
    this.assertAllowedUrl(url, [...FREE_PATHS, ...PAID_PATHS]);
    return url;
  }

  private assertAllowedUrl(url: URL, allowedPaths: string[]): void {
    if (url.origin !== this.config.apiOrigin.origin || !allowedPaths.includes(url.pathname)) {
      throw new Error("Refused request outside the approved x402nano production API routes.");
    }
  }

  private async request(input: URL | Request, init: RequestInit = {}): Promise<Response> {
    const url = input instanceof Request ? new URL(input.url) : input;
    this.assertAllowedUrl(url, [...FREE_PATHS, ...PAID_PATHS]);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);
    try {
      return await this.baseFetch(input, { ...init, redirect: "manual", signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  }

  private async parseJson(response: Response): Promise<JsonObject> {
    const text = await response.text();
    try {
      return text ? (JSON.parse(text) as JsonObject) : {};
    } catch {
      throw new Error(`x402nano returned non-JSON content with HTTP ${response.status}.`);
    }
  }

  private async fetchJson(url: URL, allow402: boolean): Promise<JsonObject> {
    const response = await this.request(url);
    const body = await this.parseJson(response);
    if (!response.ok && !(allow402 && response.status === 402)) {
      const message = typeof body.reason === "string" ? body.reason : typeof body.error === "string" ? body.error : `HTTP ${response.status}`;
      throw new Error(`x402nano request failed: ${message}`);
    }
    return body;
  }

  private challengeFrom(body: JsonObject, requestedUrl: URL): PaymentChallengeSummary {
    const x402 = body.x402 as JsonObject | undefined;
    const accepts = x402?.accepts as JsonObject[] | undefined;
    const accepted = accepts?.[0];
    const legacy = body.paymentRequirements as JsonObject | undefined;

    if (!accepted || !legacy) throw new Error("Paid route did not provide complete x402 payment requirements.");

    const network = String(accepted.network ?? legacy.network ?? "");
    const asset = String(accepted.asset ?? legacy.asset ?? "");
    const amountAtomic = BigInt(String(accepted.amount ?? accepted.maxAmountRequired ?? "-1"));
    const payTo = String(accepted.payTo ?? legacy.payTo ?? "");
    const resourceValue = String((x402?.resource as JsonObject | undefined)?.url ?? legacy.resource ?? "");
    const resource = new URL(resourceValue, this.config.apiOrigin);

    if (network !== BASE_NETWORK) throw new Error(`Refused non-Base payment network: ${network || "missing"}.`);
    if (asset.toLowerCase() !== BASE_USDC.toLowerCase()) throw new Error("Refused payment asset other than Base USDC.");
    if (amountAtomic !== EXPECTED_PAID_ATOMIC) throw new Error(`Expected exactly ${EXPECTED_PAID_USDC} USDC, received ${amountAtomic} atomic units.`);
    if (amountAtomic > this.config.maxPaymentAtomic) throw new Error("Payment exceeds X402NANO_MAX_PAYMENT_USDC.");
    if (payTo.toLowerCase() !== EXPECTED_SELLER.toLowerCase()) throw new Error("Payment recipient does not match the pinned x402nano seller wallet.");
    if (resource.origin !== requestedUrl.origin || resource.pathname !== requestedUrl.pathname || resource.search !== requestedUrl.search) {
      throw new Error("Payment resource does not exactly match the requested x402nano URL.");
    }

    return { network, asset, amountAtomic, payTo, resource: resource.toString() };
  }

  private async fetchPaidJson(url: URL): Promise<JsonObject> {
    this.assertAllowedUrl(url, [...PAID_PATHS]);

    const preflightResponse = await this.request(url);
    const preflightBody = await this.parseJson(preflightResponse);
    if (preflightResponse.status !== 402) {
      throw new Error(`Paid route preflight expected HTTP 402, received ${preflightResponse.status}.`);
    }
    this.challengeFrom(preflightBody, url);

    if (!this.config.paymentAcknowledged) {
      throw new Error("Payment preflight passed, but real payments are disabled. Set X402NANO_PAYMENT_ACK=PAY_REAL_0.05_USDC to authorize paid MCP tools.");
    }
    if (!this.config.buyerPrivateKey) {
      throw new Error("Payment preflight passed, but X402NANO_BUYER_PRIVATE_KEY is not configured.");
    }

    const account = privateKeyToAccount(this.config.buyerPrivateKey);
    const paymentClient = new x402Client();
    registerExactEvmScheme(paymentClient, {
      signer: account,
      networks: [BASE_NETWORK],
      schemeOptions: { 8453: { rpcUrl: this.config.rpcUrl } }
    });
    paymentClient.registerPolicy((_version, requirements) =>
      requirements.filter(requirement => {
        const amount = BigInt(String(requirement.amount ?? -1));
        return requirement.scheme === "exact" &&
          requirement.network === BASE_NETWORK &&
          String(requirement.asset).toLowerCase() === BASE_USDC.toLowerCase() &&
          String(requirement.payTo).toLowerCase() === EXPECTED_SELLER.toLowerCase() &&
          amount === EXPECTED_PAID_ATOMIC &&
          amount <= this.config.maxPaymentAtomic;
      })
    );

    const guardedFetch: typeof globalThis.fetch = async (input, init) => {
      const requestUrl = input instanceof Request ? new URL(input.url) : new URL(input.toString());
      this.assertAllowedUrl(requestUrl, [...PAID_PATHS]);
      return this.request(input instanceof Request ? input : requestUrl, init);
    };
    const fetchWithPayment = wrapFetchWithPayment(guardedFetch, paymentClient);
    const response = await fetchWithPayment(url);
    const body = await this.parseJson(response);
    if (!response.ok) {
      const reason = typeof body.reason === "string" ? body.reason : typeof body.error === "string" ? body.error : `HTTP ${response.status}`;
      throw new Error(`Paid x402nano request failed: ${reason}`);
    }
    return body;
  }

  private async enqueuePaidCall<T>(task: () => Promise<T>): Promise<T> {
    const previous = this.paidQueue;
    let release!: () => void;
    this.paidQueue = new Promise<void>(resolve => { release = resolve; });
    await previous;
    try {
      return await task();
    } finally {
      release();
    }
  }
}
