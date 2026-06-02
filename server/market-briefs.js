const DEFAULT_DISCLAIMER = "Informational only. Not trading, betting, or financial advice. No buy/sell recommendation, no custody, and no trade execution.";

function formatNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(number);
}

function formatPrice(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return number.toFixed(3);
}

function priceSummary(prices = {}) {
  const entries = Object.entries(prices)
    .map(([outcome, price]) => `${outcome}: ${formatPrice(price)}`)
    .filter(line => !line.endsWith(": null"));
  return entries.length ? entries.join(", ") : "Outcome prices were not available from the public market payload.";
}

export function buildMarketBrief(market) {
  const disclaimer = process.env.MARKET_BRIEF_DISCLAIMER || DEFAULT_DISCLAIMER;
  const volume = formatNumber(market.volume);
  const liquidity = formatNumber(market.liquidity);
  const status = market.closed ? "closed" : market.active ? "active" : "unknown";

  return {
    status: "ok",
    product: "x402nano Polymarket market brief",
    market: {
      id: market.id,
      slug: market.slug,
      title: market.title || market.question,
      question: market.question,
      category: market.category,
      status,
      endDate: market.endDate,
      url: market.url
    },
    outcomes: market.outcomes,
    prices: market.prices,
    metrics: {
      volume,
      liquidity
    },
    summary: `${market.question} This read-only brief summarizes the public Polymarket data currently available for the market.`,
    marketContext: [
      `Current public outcome pricing: ${priceSummary(market.prices)}.`,
      volume ? `Reported market volume is approximately ${volume}.` : "Reported market volume was not available in the public payload.",
      liquidity ? `Reported liquidity is approximately ${liquidity}.` : "Reported liquidity was not available in the public payload."
    ],
    watchPoints: [
      "Watch whether public prices, volume, or liquidity change materially over time.",
      "Check the market's official rules, end date, and resolution criteria before interpreting any movement.",
      "Compare this market with related public markets before drawing conclusions."
    ],
    sourceUrls: [
      market.url,
      "https://gamma-api.polymarket.com"
    ],
    disclaimer,
    generatedAt: new Date().toISOString()
  };
}

export function marketPreview(market) {
  return {
    slug: market.slug,
    title: market.title || market.question,
    question: market.question,
    category: market.category,
    status: market.closed ? "closed" : market.active ? "active" : "unknown",
    volume: formatNumber(market.volume),
    liquidity: formatNumber(market.liquidity),
    prices: market.prices,
    briefUrl: `/api/markets/brief?slug=${encodeURIComponent(market.slug)}`
  };
}
