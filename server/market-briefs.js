import { cleanText as normalizeText } from "./text-normalizer.js";

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

function formatDecimal(value, digits = 3) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return number.toFixed(digits);
}

function percent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return `${(number * 100).toFixed(number < 0.01 ? 2 : 1)}%`;
}

function percentChange(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return `${number >= 0 ? "+" : ""}${(number * 100).toFixed(Math.abs(number) < 0.01 ? 2 : 1)}%`;
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

function topOutcomes(market) {
  return (market.outcomeDetails ?? [])
    .map(detail => ({
      outcome: detail.outcome,
      probability: formatPrice(detail.price),
      impliedProbability: percent(detail.price),
      clobTokenId: detail.clobTokenId ?? null
    }))
    .filter(detail => detail.probability !== null)
    .sort((a, b) => Number(b.probability) - Number(a.probability));
}

function daysUntil(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.ceil((date.getTime() - Date.now()) / 86_400_000);
}

function movementDirection(change) {
  const number = Number(change);
  if (!Number.isFinite(number) || Math.abs(number) < 0.001) return "flat";
  return number > 0 ? "up" : "down";
}

function scoreFromMovement(absChange, volume, liquidity, hasHistory) {
  const movement = Math.min(Math.abs(Number(absChange) || 0) * 1000, 55);
  const volumeScore = Math.min(Math.log10(Math.max(Number(volume) || 0, 1)) * 8, 25);
  const liquidityScore = Math.min(Math.log10(Math.max(Number(liquidity) || 0, 1)) * 6, 20);
  const score = Math.round(movement + volumeScore + liquidityScore + (hasHistory ? 0 : -10));
  return Math.max(0, Math.min(100, score));
}

function dataCompletenessScore({ market, history }) {
  const checks = [
    market.slug,
    market.question,
    Object.keys(market.prices ?? {}).length > 0,
    Number.isFinite(Number(market.volume)),
    Number.isFinite(Number(market.liquidity)),
    market.endDate,
    history?.available
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function parseTimestamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function historyPointToDeltaPoint(point) {
  if (!point) return null;
  return {
    timestamp: new Date(point.timestamp * 1000).toISOString(),
    probability: formatDecimal(point.probability)
  };
}

function pointDistanceMs(point, targetMs) {
  return Math.abs((point.timestamp * 1000) - targetMs);
}

function nearestHistoryPoint(points, targetDate) {
  if (!points.length || !targetDate) return points[0] ?? null;
  const targetMs = targetDate.getTime();
  return points.reduce((best, point) =>
    !best || pointDistanceMs(point, targetMs) < pointDistanceMs(best, targetMs) ? point : best
  , null);
}

function buildDeltaWindow(sinceDate, endPoint) {
  return {
    since: sinceDate ? sinceDate.toISOString() : null,
    until: endPoint ? new Date(endPoint.timestamp * 1000).toISOString() : new Date().toISOString(),
    requestedBy: "client-supplied timestamp",
    note: sinceDate
      ? "Delta uses the nearest available public CLOB history point to the requested since timestamp."
      : "The since timestamp was invalid or missing."
  };
}

function buildMovementBlock(market, history) {
  const points = history?.history ?? [];
  const first = points[0];
  const last = points[points.length - 1];
  const change = first && last ? last.probability - first.probability : null;
  const relativeChange = first?.probability ? change / Math.abs(first.probability) : null;

  return {
    window: "24h",
    source: history?.source ?? "polymarket:clob",
    available: Boolean(history?.available && first && last),
    outcome: history?.outcome ?? null,
    clobTokenId: history?.clobTokenId ?? null,
    start: first ? {
      timestamp: new Date(first.timestamp * 1000).toISOString(),
      probability: formatDecimal(first.probability)
    } : null,
    end: last ? {
      timestamp: new Date(last.timestamp * 1000).toISOString(),
      probability: formatDecimal(last.probability)
    } : null,
    absoluteChange: formatDecimal(change),
    relativeChange: percentChange(relativeChange),
    direction: movementDirection(change),
    trajectory: points.map(point => ({
      timestamp: new Date(point.timestamp * 1000).toISOString(),
      probability: formatDecimal(point.probability)
    })),
    note: history?.available
      ? "24h movement is computed from public Polymarket CLOB price history for the leading outcome token."
      : `24h CLOB movement was unavailable: ${history?.reason ?? "no usable history returned"}.`
  };
}

export function buildMarketBrief(market, { priceHistory24h = null } = {}) {
  const disclaimer = process.env.MARKET_BRIEF_DISCLAIMER || DEFAULT_DISCLAIMER;
  const volume = formatNumber(market.volume);
  const volume24h = formatNumber(market.volume24h);
  const volume7d = formatNumber(market.volume7d);
  const liquidity = formatNumber(market.liquidity);
  const status = market.closed ? "closed" : market.active ? "active" : "unknown";
  const leader = leadingOutcome(market.prices);
  const title = normalizeText(market.title || market.question);
  const question = normalizeText(market.question);
  const movement = buildMovementBlock(market, priceHistory24h);
  const resolutionDays = daysUntil(market.endDate);
  const absoluteChange = movement.absoluteChange === null ? null : Number(movement.absoluteChange);
  const marketMovementScore = scoreFromMovement(absoluteChange, market.volume, market.liquidity, movement.available);
  const attentionScore = Math.max(0, Math.min(100, Math.round(
    marketMovementScore * 0.55 +
    Math.min(Math.log10(Math.max(Number(market.volume24h ?? market.volume) || 0, 1)) * 10, 25) +
    Math.min(Math.log10(Math.max(Number(market.liquidity) || 0, 1)) * 8, 20)
  )));

  return {
    status: "ok",
    product: "x402nano Polymarket market brief",
    briefType: "read-only-market-intelligence",
    market: {
      id: market.id,
      slug: market.slug,
      title,
      question,
      category: normalizeText(market.category),
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
      summary: priceSummary(market.prices),
      topOutcomes: topOutcomes(market)
    },
    metrics: {
      volume,
      volume24h,
      volume7d,
      liquidity,
      volume24hChange: percentChange(market.volume24hChange),
      liquidity24hChange: percentChange(market.liquidity24hChange)
    },
    movement,
    resolution: {
      endDate: market.endDate,
      daysUntilEnd: resolutionDays,
      source: market.resolutionSource || "Use the Polymarket market page and rules for resolution criteria.",
      note: "Resolution context is informational and should be checked against the official market rules."
    },
    scores: {
      marketMovementScore,
      attentionScore,
      dataCompletenessScore: dataCompletenessScore({ market, history: priceHistory24h }),
      unusualMovementFlag: movement.available && Math.abs(absoluteChange ?? 0) >= 0.05,
      note: "Scores are descriptive heuristics from public data availability, movement size, volume, and liquidity. They are not predictions or recommendations."
    },
    neutralSummary: `${question} The public market snapshot currently shows ${leader ? `${leader.outcome} as the highest-priced outcome at ${percent(leader.price)}` : "no clear leading outcome in the available price data"}.`,
    marketRead: [
      `Current public outcome pricing: ${priceSummary(market.prices)}.`,
      movement.available ? `The leading outcome moved ${movement.direction} by ${movement.absoluteChange} over the last 24h.` : "24h movement history was not available for the leading outcome.",
      volume ? `Reported volume is approximately ${volume}.` : "Reported volume was not available in the public payload.",
      liquidity ? `Reported liquidity is approximately ${liquidity}.` : "Reported liquidity was not available in the public payload."
    ],
    watchPoints: [
      "Watch whether the leading outcome changes, flattens, or reverses over the next observation window.",
      "Compare movement with liquidity before treating the snapshot as meaningful context.",
      resolutionDays !== null && resolutionDays <= 7 ? "Resolution appears near; check official rules and timing before interpreting late movement." : "Check official rules and timing before interpreting movement near resolution.",
      "Read the official market rules, end date, and resolution criteria before interpreting the data."
    ],
    dataQuality: {
      volumeAvailable: volume !== null,
      volume24hAvailable: volume24h !== null,
      liquidityAvailable: liquidity !== null,
      pricesAvailable: Object.keys(market.prices ?? {}).length > 0,
      movement24hAvailable: movement.available,
      resolutionDateAvailable: Boolean(market.endDate),
      note: "This brief uses public Polymarket Gamma and CLOB data when available. It does not verify external facts or execute trades."
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

export function buildMarketDelta(market, { priceHistory = null, since = null } = {}) {
  const disclaimer = process.env.MARKET_BRIEF_DISCLAIMER || DEFAULT_DISCLAIMER;
  const sinceDate = parseTimestamp(since);
  const points = priceHistory?.history ?? [];
  const start = nearestHistoryPoint(points, sinceDate);
  const end = points[points.length - 1] ?? null;
  const available = Boolean(priceHistory?.available && start && end);
  const change = available ? end.probability - start.probability : null;
  const relativeChange = available && start?.probability ? change / Math.abs(start.probability) : null;
  const marketMovementScore = scoreFromMovement(change, market.volume, market.liquidity, available);
  const attentionScore = Math.max(0, Math.min(100, Math.round(
    marketMovementScore * 0.55 +
    Math.min(Math.log10(Math.max(Number(market.volume24h ?? market.volume) || 0, 1)) * 10, 25) +
    Math.min(Math.log10(Math.max(Number(market.liquidity) || 0, 1)) * 8, 20)
  )));
  const absoluteChange = Number.isFinite(Number(change)) ? Number(change) : null;
  const direction = movementDirection(change);
  const title = normalizeText(market.title || market.question);
  const question = normalizeText(market.question);

  return {
    status: "ok",
    product: "x402nano Polymarket market delta brief",
    briefType: "read-only-market-delta",
    market: {
      id: market.id,
      slug: market.slug,
      title,
      question,
      category: normalizeText(market.category),
      status: market.closed ? "closed" : market.active ? "active" : "unknown",
      endDate: market.endDate,
      url: market.url
    },
    window: buildDeltaWindow(sinceDate, end),
    change: {
      source: priceHistory?.source ?? "polymarket:clob",
      available,
      outcome: priceHistory?.outcome ?? null,
      clobTokenId: priceHistory?.clobTokenId ?? null,
      start: historyPointToDeltaPoint(start),
      end: historyPointToDeltaPoint(end),
      startProbability: start ? Number(formatDecimal(start.probability)) : null,
      endProbability: end ? Number(formatDecimal(end.probability)) : null,
      absoluteChange: formatDecimal(change),
      relativeChange: percentChange(relativeChange),
      direction,
      changed: available && Math.abs(absoluteChange ?? 0) >= 0.001,
      note: available
        ? "Change is computed from public Polymarket CLOB price history for the leading outcome token."
        : `Delta history was unavailable: ${priceHistory?.reason ?? "no usable history returned"}.`
    },
    metricsDelta: {
      volumeStart: null,
      volumeEnd: formatNumber(market.volume),
      volumeChange: null,
      liquidityStart: null,
      liquidityEnd: formatNumber(market.liquidity),
      liquidityChange: null,
      note: "Polymarket historical volume and liquidity deltas were not available in the v0 public data path; current values are included for context."
    },
    significance: {
      marketMovementScore,
      attentionScore,
      dataCompletenessScore: dataCompletenessScore({ market, history: priceHistory }),
      repeatCheckPriority: available && Math.abs(absoluteChange ?? 0) >= 0.05 ? "high" : available && Math.abs(absoluteChange ?? 0) >= 0.015 ? "medium" : "low",
      unusualMovementFlag: available && Math.abs(absoluteChange ?? 0) >= 0.05,
      summary: available
        ? `The leading outcome moved ${direction} by ${formatDecimal(change)} over the requested window.`
        : "There was not enough public history to compute a reliable delta for the requested window.",
      note: "Scores are descriptive heuristics from public data availability, movement size, volume, and liquidity. They are not predictions or recommendations."
    },
    trajectory: points.map(historyPointToDeltaPoint),
    watchPoints: [
      "Compare probability movement with liquidity before treating the change as meaningful context.",
      "Recheck if volume accelerates, liquidity changes, or the leading outcome changes.",
      "Read the official market rules, end date, and resolution criteria before interpreting the data."
    ],
    dataQuality: {
      priceHistoryAvailable: available,
      volumeDataAvailable: Number.isFinite(Number(market.volume)),
      liquidityDataAvailable: Number.isFinite(Number(market.liquidity)),
      usedNearestHistoryPoint: available && sinceDate ? start?.timestamp * 1000 !== sinceDate.getTime() : false,
      notes: [
        "Delta is computed from available public market data.",
        "If an exact historical point is unavailable, the nearest available observation may be used.",
        "This endpoint does not store caller state; clients provide the since timestamp."
      ]
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
    title: normalizeText(market.title || market.question),
    question: normalizeText(market.question),
    category: normalizeText(market.category),
    status: market.closed ? "closed" : market.active ? "active" : "unknown",
    volume: formatNumber(market.volume),
    liquidity: formatNumber(market.liquidity),
    prices: market.prices,
    briefUrl: `/api/markets/brief?slug=${encodeURIComponent(market.slug)}`
  };
}
