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

function percent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return `${(number * 100).toFixed(number < 0.01 ? 2 : 1)}%`;
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

function priceSummary(prices = {}) {
  const entries = Object.entries(prices)
    .map(([outcome, price]) => `${outcome}: ${formatPrice(price)}`)
    .filter(line => !line.endsWith(": null"));
  return entries.length ? entries.join(", ") : "Outcome prices were not available from the public market payload.";
}

function leadingOutcome(prices = {}) {
  const entries = Object.entries(prices)
    .map(([outcome, price]) => ({ outcome, price: Number(price) }))
    .filter(entry => Number.isFinite(entry.price))
    .sort((a, b) => b.price - a.price);
  return entries[0] ?? null;
}

export function buildMarketBrief(market) {
  const disclaimer = process.env.MARKET_BRIEF_DISCLAIMER || DEFAULT_DISCLAIMER;
  const volume = formatNumber(market.volume);
  const liquidity = formatNumber(market.liquidity);
  const status = market.closed ? "closed" : market.active ? "active" : "unknown";
  const leader = leadingOutcome(market.prices);
  const title = cleanText(market.title || market.question);
  const question = cleanText(market.question);

  return {
    status: "ok",
    product: "x402nano Polymarket market brief",
    briefType: "read-only-market-intelligence",
    market: {
      id: market.id,
      slug: market.slug,
      title,
      question,
      category: market.category,
      status,
      endDate: market.endDate,
      url: market.url
    },
    snapshot: {
      generatedAt: new Date().toISOString(),
      source: "polymarket:gamma",
      leadingOutcome: leader ? leader.outcome : null,
      leadingOutcomePrice: leader ? formatPrice(leader.price) : null,
      leadingOutcomeImpliedProbability: leader ? percent(leader.price) : null
    },
    pricing: {
      outcomes: market.outcomes,
      prices: market.prices,
      summary: priceSummary(market.prices)
    },
    metrics: {
      volume,
      liquidity
    },
    neutralSummary: `${question} The public market snapshot currently shows ${leader ? `${leader.outcome} as the highest-priced outcome at ${percent(leader.price)}` : "no clear leading outcome in the available price data"}.`,
    marketRead: [
      `Current public outcome pricing: ${priceSummary(market.prices)}.`,
      volume ? `Reported volume is approximately ${volume}.` : "Reported volume was not available in the public payload.",
      liquidity ? `Reported liquidity is approximately ${liquidity}.` : "Reported liquidity was not available in the public payload."
    ],
    watchPoints: [
      "Watch whether the leading outcome changes or the price gap narrows.",
      "Watch whether volume or liquidity increases, which can make the market snapshot more meaningful.",
      "Read the official market rules, end date, and resolution criteria before interpreting the data."
    ],
    dataQuality: {
      volumeAvailable: volume !== null,
      liquidityAvailable: liquidity !== null,
      pricesAvailable: Object.keys(market.prices ?? {}).length > 0,
      note: "This brief uses public Polymarket Gamma API data. It does not verify external facts or execute trades."
    },
    boundaries: [
      "Read-only public market data summary.",
      "No trading execution.",
      "No custody of user funds.",
      "No buy/sell/bet recommendation."
    ],
    sourceUrls: [
      market.url,
      "https://gamma-api.polymarket.com"
    ],
    disclaimer
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
