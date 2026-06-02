const DEFAULT_GAMMA_URL = "https://gamma-api.polymarket.com";

function gammaBaseUrl() {
  return (process.env.POLYMARKET_GAMMA_URL ?? DEFAULT_GAMMA_URL).replace(/\/+$/, "");
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

function normalizeMarket(raw) {
  const outcomes = parseJsonArray(raw.outcomes ?? raw.tokens, []);
  const outcomePrices = parseJsonArray(raw.outcomePrices ?? raw.prices, []);
  const tokens = Array.isArray(raw.tokens) ? raw.tokens : [];

  const normalizedOutcomes = outcomes.length
    ? outcomes.map(outcome => typeof outcome === "string" ? outcome : outcome?.outcome ?? outcome?.name).filter(Boolean)
    : tokens.map(token => token.outcome ?? token.name).filter(Boolean);

  const prices = {};
  normalizedOutcomes.forEach((outcome, index) => {
    const tokenPrice = firstNumber(tokens[index]?.price, tokens[index]?.lastPrice);
    const price = firstNumber(outcomePrices[index], tokenPrice);
    if (price !== null) prices[outcome] = price;
  });

  return {
    id: String(raw.id ?? raw.conditionId ?? raw.slug ?? ""),
    slug: raw.slug ?? "",
    question: cleanText(raw.question ?? raw.title ?? raw.name ?? ""),
    title: cleanText(raw.title ?? raw.question ?? raw.name ?? ""),
    description: cleanText(raw.description ?? ""),
    category: cleanText(raw.category ?? raw.event?.category ?? ""),
    active: Boolean(raw.active ?? raw.isActive ?? false),
    closed: Boolean(raw.closed ?? raw.isClosed ?? false),
    endDate: raw.endDate ?? raw.end_date ?? raw.endDateIso ?? null,
    volume: firstNumber(raw.volume, raw.volumeNum, raw.volume24hr, raw.volume24hrClob),
    liquidity: firstNumber(raw.liquidity, raw.liquidityNum, raw.liquidityClob),
    outcomes: normalizedOutcomes,
    prices,
    url: raw.slug ? `https://polymarket.com/event/${raw.slug}` : "https://polymarket.com",
    raw
  };
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
