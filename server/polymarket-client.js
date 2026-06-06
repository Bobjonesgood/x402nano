import { cleanText as normalizeText } from "./text-normalizer.js";

const DEFAULT_GAMMA_URL = "https://gamma-api.polymarket.com";
const DEFAULT_CLOB_URL = "https://clob.polymarket.com";

function gammaBaseUrl() {
  return (process.env.POLYMARKET_GAMMA_URL ?? DEFAULT_GAMMA_URL).replace(/\/+$/, "");
}

function clobBaseUrl() {
  return (process.env.POLYMARKET_CLOB_URL ?? DEFAULT_CLOB_URL).replace(/\/+$/, "");
}

function asPositiveInt(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback;
}

function parseJsonArray(value, fallback = []) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string" || value.trim() === "") return fallback;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function cleanText(value) {
  return String(value ?? "")
    .replace(/Â°F/g, "°F")
    .replace(/Â°C/g, "°C")
    .replace(/Â®/g, "®")
    .replace(/â€™/g, "'")
    .replace(/â€œ|â€/g, "\"")
    .replace(/â€“|â€”/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function firstNumber(...values) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function normalizePriceHistory(body) {
  const history = Array.isArray(body?.history) ? body.history : Array.isArray(body) ? body : [];
  return history
    .map(point => ({
      timestamp: Number(point.t ?? point.timestamp ?? point.time),
      probability: firstNumber(point.p, point.price, point.value)
    }))
    .filter(point => Number.isFinite(point.timestamp) && Number.isFinite(point.probability))
    .sort((a, b) => a.timestamp - b.timestamp);
}

function normalizeMarket(raw) {
  const outcomes = parseJsonArray(raw.outcomes ?? raw.tokens, []);
  const outcomePrices = parseJsonArray(raw.outcomePrices ?? raw.prices, []);
  const tokens = Array.isArray(raw.tokens) ? raw.tokens : [];
  const clobTokenIds = parseJsonArray(raw.clobTokenIds, []);

  const normalizedOutcomes = outcomes.length
    ? outcomes.map(outcome => normalizeText(typeof outcome === "string" ? outcome : outcome?.outcome ?? outcome?.name)).filter(Boolean)
    : tokens.map(token => normalizeText(token.outcome ?? token.name)).filter(Boolean);

  const prices = {};
  const outcomeDetails = [];
  normalizedOutcomes.forEach((outcome, index) => {
    const tokenPrice = firstNumber(tokens[index]?.price, tokens[index]?.lastPrice);
    const price = firstNumber(outcomePrices[index], tokenPrice);
    if (price !== null) prices[outcome] = price;
    outcomeDetails.push({
      outcome,
      price,
      clobTokenId: firstString(
        tokens[index]?.token_id,
        tokens[index]?.tokenId,
        tokens[index]?.id,
        clobTokenIds[index],
        Array.isArray(raw.clobTokenIds) ? raw.clobTokenIds[index] : null
      )
    });
  });

  return {
    id: String(raw.id ?? raw.conditionId ?? raw.slug ?? ""),
    slug: normalizeText(raw.slug ?? ""),
    question: normalizeText(raw.question ?? raw.title ?? raw.name ?? ""),
    title: normalizeText(raw.title ?? raw.question ?? raw.name ?? ""),
    description: normalizeText(raw.description ?? ""),
    category: normalizeText(raw.category ?? raw.event?.category ?? ""),
    active: Boolean(raw.active ?? raw.isActive ?? false),
    closed: Boolean(raw.closed ?? raw.isClosed ?? false),
    endDate: raw.endDate ?? raw.end_date ?? raw.endDateIso ?? null,
    resolutionSource: cleanText(raw.resolutionSource ?? raw.resolution_source ?? raw.resolutionCriteria ?? raw.rules ?? ""),
    volume: firstNumber(raw.volume, raw.volumeNum, raw.volume24hr, raw.volume24hrClob),
    volume24h: firstNumber(raw.volume24hr, raw.volume24hrClob, raw.volume24h, raw.volume1d),
    volume7d: firstNumber(raw.volume1wk, raw.volume7d, raw.volume1w),
    liquidity: firstNumber(raw.liquidity, raw.liquidityNum, raw.liquidityClob),
    liquidity24hChange: firstNumber(raw.liquidityChange24hr, raw.liquidity24hChange),
    volume24hChange: firstNumber(raw.volumeChange24hr, raw.volume24hChange),
    outcomes: normalizedOutcomes,
    outcomeDetails,
    prices,
    url: raw.slug ? `https://polymarket.com/event/${raw.slug}` : "https://polymarket.com",
    raw
  };
}

async function clobGet(pathname, params = {}) {
  const url = new URL(`${clobBaseUrl()}${pathname}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    headers: {
      "Accept": "application/json",
      "User-Agent": process.env.POLYMARKET_USER_AGENT ?? "x402nano-market-briefs/0.1"
    }
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`Polymarket CLOB ${response.status}: ${JSON.stringify(body)?.slice(0, 240)}`);
  }

  return body;
}

async function gammaGet(pathname, params = {}) {
  const url = new URL(`${gammaBaseUrl()}${pathname}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    headers: {
      "Accept": "application/json",
      "User-Agent": process.env.POLYMARKET_USER_AGENT ?? "x402nano-market-briefs/0.1"
    }
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`Polymarket Gamma ${response.status}: ${JSON.stringify(body)?.slice(0, 240)}`);
  }

  return body;
}

export async function fetchTrendingMarkets({ limit = asPositiveInt(process.env.POLYMARKET_MARKET_LIMIT, 10) } = {}) {
  const poolLimit = Math.max(limit * 5, asPositiveInt(process.env.POLYMARKET_MARKET_POOL_LIMIT, 50));
  const minVolume = Number(process.env.POLYMARKET_MIN_VOLUME ?? 100);
  const minLiquidity = Number(process.env.POLYMARKET_MIN_LIQUIDITY ?? 500);
  const body = await gammaGet("/markets", {
    active: true,
    closed: false,
    limit: poolLimit,
    order: "volume",
    ascending: false
  });

  const markets = Array.isArray(body) ? body : body?.markets ?? body?.data ?? [];
  return markets
    .map(normalizeMarket)
    .filter(market => market.slug && market.question && market.active && !market.closed)
    .filter(market => (market.volume ?? 0) >= minVolume || (market.liquidity ?? 0) >= minLiquidity)
    .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0) || (b.liquidity ?? 0) - (a.liquidity ?? 0))
    .slice(0, limit);
}

export async function fetchMarketBySlug(slug) {
  const cleanSlug = String(slug ?? "").trim();
  if (!cleanSlug) throw new Error("Market slug is required.");

  const body = await gammaGet("/markets", { slug: cleanSlug, limit: 1 });
  const markets = Array.isArray(body) ? body : body?.markets ?? body?.data ?? [];
  const exact = markets.find(market => market.slug === cleanSlug) ?? markets[0];
  if (!exact) throw new Error(`Market not found for slug=${cleanSlug}`);

  return normalizeMarket(exact);
}

export async function fetchMarketPriceHistory(market, { interval = "1d", fidelity = 60 } = {}) {
  const token = market.outcomeDetails
    ?.filter(outcome => outcome.clobTokenId && Number.isFinite(Number(outcome.price)))
    ?.sort((a, b) => Number(b.price) - Number(a.price))[0];

  if (!token?.clobTokenId) {
    return {
      available: false,
      source: "polymarket:clob",
      reason: "No CLOB token id was available for the leading outcome."
    };
  }

  try {
    const body = await clobGet("/prices-history", {
      market: token.clobTokenId,
      interval,
      fidelity
    });
    const history = normalizePriceHistory(body);
    return {
      available: history.length >= 2,
      source: "polymarket:clob",
      interval,
      fidelityMinutes: fidelity,
      outcome: token.outcome,
      clobTokenId: token.clobTokenId,
      history,
      reason: history.length >= 2 ? null : "CLOB price history returned fewer than two usable points."
    };
  } catch (error) {
    return {
      available: false,
      source: "polymarket:clob",
      interval,
      fidelityMinutes: fidelity,
      outcome: token.outcome,
      clobTokenId: token.clobTokenId,
      reason: error.message
    };
  }
}

export async function polymarketStatus() {
  const startedAt = Date.now();
  const markets = await fetchTrendingMarkets({ limit: 1 });
  return {
    status: "ok",
    source: "polymarket:gamma",
    gammaUrl: gammaBaseUrl(),
    latencyMs: Date.now() - startedAt,
    sampleMarkets: markets.length
  };
}
