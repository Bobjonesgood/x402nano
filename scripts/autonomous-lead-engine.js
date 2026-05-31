import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const DEFAULT_OUTPUT_FILE = path.resolve(ROOT_DIR, "data/production-lead-pack.runtime.json");
const DEFAULT_MARKET_FILE = path.resolve(ROOT_DIR, "data/lead-engine-markets.json");
const DEFAULT_INTERVAL_MS = 6 * 60 * 60 * 1000;
const USER_AGENT = process.env.LEAD_ENGINE_USER_AGENT ?? "LeadNestAI-x402nano/0.1 public-source lead research";

const realEstateTerms = [
  "real estate",
  "realtor",
  "broker",
  "brokerage",
  "property management",
  "property manager",
  "mortgage",
  "title company",
  "home inspection",
  "appraisal",
  "leasing",
  "commercial real estate"
];

const serviceFitTerms = [
  "schedule",
  "book",
  "estimate",
  "quote",
  "contact",
  "form",
  "call",
  "consultation",
  "valuation",
  "buyer",
  "seller",
  "listing",
  "lead",
  "crm"
];

const unsupportedUrlPattern = /\.(pdf|zip|docx?|xlsx?|csv)(?:[?#].*)?$/i;

function envList(name) {
  const value = process.env[name]?.trim();
  if (!value) return [];

  if (value.startsWith("[") || value.startsWith("{")) {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  }

  return value
    .split(/\r?\n|,/)
    .map(item => item.trim())
    .filter(Boolean);
}

function dedupeList(values) {
  return [...new Set(values.map(value => String(value).trim()).filter(Boolean))];
}

async function loadMarketSources(marketName) {
  if (!marketName) return { sources: [], market: null };

  const marketFile = path.resolve(process.env.LEAD_ENGINE_MARKET_FILE ?? DEFAULT_MARKET_FILE);
  const config = JSON.parse(await fs.readFile(marketFile, "utf8"));
  const market = config.markets?.[marketName];

  if (!market) {
    const available = Object.keys(config.markets ?? {}).join(", ") || "none configured";
    throw new Error(`Unknown LEAD_ENGINE_MARKET=${marketName}. Available markets: ${available}.`);
  }

  return {
    market: {
      id: marketName,
      label: market.label ?? marketName,
      areas: Array.isArray(market.areas) ? market.areas : []
    },
    sources: Array.isArray(market.sources) ? market.sources.map(String) : []
  };
}

function plainUrl(value) {
  const trimmed = value?.trim() ?? "";
  const markdownLink = trimmed.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/i);
  return markdownLink ? markdownLink[2] : trimmed;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function asPositiveInt(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function stripHtml(html) {
  return decodeHtml(html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim());
}

function decodeHtml(value) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#8211;|&ndash;/g, "-")
    .replace(/&#8212;|&mdash;/g, "-")
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/&raquo;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pageTitle(html) {
  return decodeHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
}

function absoluteUrl(href, baseUrl) {
  try {
    const url = new URL(href, baseUrl);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

function linksFromHtml(html, baseUrl) {
  const links = new Set();
  for (const match of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi)) {
    const url = absoluteUrl(match[1], baseUrl);
    if (url) links.add(url);
  }
  return [...links];
}

function looksRelevant(text) {
  const lower = text.toLowerCase();
  return realEstateTerms.some(term => lower.includes(term));
}

function signalScore(text) {
  const lower = text.toLowerCase();
  const industryHits = realEstateTerms.filter(term => lower.includes(term)).length;
  const fitHits = serviceFitTerms.filter(term => lower.includes(term)).length;
  return Math.min(92, 58 + industryHits * 7 + fitHits * 3);
}

function inferIndustry(text, businessName = "") {
  const combined = `${businessName} ${text}`;
  const lower = combined.toLowerCase();
  if (/realty|realtors?|brokerage|broker\/ realtor|broker\/realtor|real estate agents?|real estate experts|keller williams|coldwell banker|gumtree|kiamie|magee|olr realty|tm realtors/i.test(combined)) {
    if (lower.includes("investment") || lower.includes("commercial real estate")) return "Real estate sales and investment brokerage";
    return "Real estate sales and brokerage";
  }
  if (lower.includes("property management")) return "Property management";
  if (lower.includes("commercial real estate")) return "Commercial real estate";
  if (lower.includes("mortgage")) return "Mortgage and lending";
  if (lower.includes("title")) return "Title and closing services";
  if (lower.includes("home inspection")) return "Home inspection";
  return "Real estate sales and brokerage";
}

function cleanBusinessName(name, url = "") {
  let cleaned = decodeHtml(name)
    .replace(/\s+including\b.*$/i, "")
    .replace(/,\s*your\b.*$/i, "")
    .replace(/\s+-\s+your\b.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();

  if (/^coldwell banker$/i.test(cleaned) && /cbtupelo/i.test(url)) cleaned = "Coldwell Banker Southern Real Estate";
  if (/^oxford,\s*ms real estate/i.test(cleaned) && /nroxford/i.test(url)) cleaned = "Neighborhood Realty Oxford";
  if (/^gumtree realty/i.test(cleaned)) cleaned = "GumTree Realty";
  if (/^keller williams tupelo/i.test(cleaned)) cleaned = "Keller Williams Tupelo";
  return cleaned.slice(0, 90);
}

function evidenceIsWeak(sentence) {
  const lower = sentence.toLowerCase();
  return /checkbox|expressly consent|opt in|permission to contact|terms of use|privacy policy|idx|copyright|all rights reserved|skip to content|realty tips|newest properties|read more buyer|absolute pleasure|homeownership dreams|checkbox|testimonial|my realtor|answered all of my questions|highly recommend|friends and family|readily available|very knowledgeable|took very good care|recommend contacting|home inspector|worked with several|open 9am|subscribe|no results/i.test(lower);
}

function inferBusinessName(title, url) {
  const fromTitle = title
    .split(/[\-|–|—|:]/)[0]
    .replace(/\b(home|about|contact|services|real estate)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  if (fromTitle && fromTitle.length >= 3) return fromTitle.slice(0, 90);

  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    return hostname.split(".")[0].replace(/[-_]/g, " ").replace(/\b\w/g, char => char.toUpperCase()).slice(0, 90);
  } catch {
    return "Public Real Estate Lead";
  }
}

function inferBetterBusinessName(title, url) {
  const genericTitles = new Set([
    "agents",
    "agents listing",
    "about",
    "home",
    "meet the team",
    "our team",
    "tupelo office",
    "brokers category",
    "real estate brokers category"
  ]);
  const candidates = decodeHtml(title)
    .split(/\s*(?:\||-|–|—|:)\s*/g)
    .map(part => part.replace(/\b(home|about|contact|services)\b/gi, "").replace(/\s+/g, " ").trim())
    .filter(part => part.length >= 3 && !genericTitles.has(part.toLowerCase()));
  if (candidates[0]) return candidates[0].slice(0, 90);
  const branded = candidates.find(part => /realty|real estate|realtors?|properties|broker|banker|keller|agency|group|team|land/i.test(part));
  if (branded) return branded.slice(0, 90);
  return inferBusinessName(title, url);
}

function inferLocation(text) {
  const knownNorthMississippiCities = ["Tupelo", "Oxford", "Southaven", "Hernando", "Starkville", "Columbus", "Saltillo"];
  for (const city of knownNorthMississippiCities) {
    const cityPattern = new RegExp(`\\b${city}\\b\\s*,?\\s*MS\\b`, "i");
    if (cityPattern.test(text)) return `${city}, MS`;
  }

  const cityState = text.match(/\b([A-Z][a-zA-Z .'-]{2,40}),\s*([A-Z]{2})\b/);
  return cityState ? `${cityState[1].trim()}, ${cityState[2]}` : "Public web source";
}

function evidenceFromText(text) {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map(sentence => sentence.trim())
    .filter(sentence => sentence.length >= 45 && sentence.length <= 240)
    .filter(sentence => !evidenceIsWeak(sentence));
  const strongEvidence = sentences.filter(sentence => {
    const lower = sentence.toLowerCase();
    return /broker|realtor|real estate|property management|investment|commercial|residential|agents?|listings?|buyer|seller|contact|call|email|office/.test(lower);
  });
  const evidence = strongEvidence.length ? strongEvidence : sentences;
  const seen = new Set();
  return evidence.filter(sentence => {
    const key = sentence.toLowerCase().replace(/[^\w]+/g, " ").trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 3);
}

function leadId(name, url) {
  return `auto_public_${crypto.createHash("sha256").update(`${name}|${url}`).digest("hex").slice(0, 12)}`;
}

function recommendedOpenerFor(record) {
  const name = cleanBusinessName(record.businessName || "your team");
  const industry = String(record.industry || "").toLowerCase();

  if (industry.includes("property management")) {
    return `I saw ${name} handles property management and real estate inquiries. Are rental, owner, and buyer/seller leads all getting routed and followed up without anything slipping through?`;
  }

  if (industry.includes("investment") || industry.includes("commercial")) {
    return `I saw ${name} works across residential, investment, or commercial real estate. Would a tighter follow-up system help separate serious opportunities from casual inquiries faster?`;
  }

  return `I saw ${name} is actively positioned for local buyer and seller inquiries. Are new real estate leads getting contacted fast enough when agents are busy with showings and closings?`;
}

function heuristicLead(page) {
  const name = cleanBusinessName(inferBetterBusinessName(page.title, page.url), page.url);
  const combinedText = `${page.title}. ${page.text}`;
  const evidence = evidenceFromText(combinedText);
  const confidenceScore = Math.min(signalScore(combinedText), evidence.length >= 2 ? 92 : 86);
  const industry = inferIndustry(combinedText, name);

  return {
    id: leadId(name, page.url),
    businessName: name,
    industry,
    location: inferLocation(page.text),
    estimatedJobValue: "Real estate lead flow and follow-up opportunity; qualify deal value before sale.",
    buyingIntent: "Public fit signal from a real estate business web page with intake, contact, listing, or service evidence.",
    painPoints: [
      "new inquiry response speed",
      "lead routing across public contact channels",
      "follow-up consistency after buyer or seller interest"
    ],
    recommendedOpener: recommendedOpenerFor({ businessName: name, industry }),
    confidenceScore,
    sourceType: "public real estate web page",
    sourceUrls: [page.url],
    sourceEvidence: evidence.length ? evidence : ["Reviewed public page text for real estate service and lead-intake signals."],
    reviewedAt: today(),
    contactPolicy: "Use public business contact routes only. This record shows fit evidence, not a confirmed buying decision."
  };
}

function requiredFieldsOk(record) {
  const required = [
    "id",
    "businessName",
    "industry",
    "location",
    "estimatedJobValue",
    "buyingIntent",
    "painPoints",
    "recommendedOpener",
    "confidenceScore",
    "sourceType",
    "sourceUrls",
    "sourceEvidence",
    "reviewedAt"
  ];

  return required.every(field => {
    if (["painPoints", "sourceUrls", "sourceEvidence"].includes(field)) {
      return Array.isArray(record[field]) && record[field].length > 0;
    }
    return record[field] !== undefined && record[field] !== "";
  });
}

function normalizeLead(record, fallbackPage) {
  const merged = {
    ...heuristicLead(fallbackPage),
    ...record
  };
  const fallback = heuristicLead(fallbackPage);
  const combinedText = `${fallbackPage.title}. ${fallbackPage.text}`;

  merged.businessName = cleanBusinessName(merged.businessName || fallback.businessName, fallbackPage.url);
  merged.industry = inferIndustry(combinedText, merged.businessName);
  merged.id = merged.id || leadId(merged.businessName, fallbackPage.url);
  merged.painPoints = Array.isArray(merged.painPoints) ? merged.painPoints.slice(0, 5) : fallback.painPoints;
  merged.sourceUrls = Array.isArray(merged.sourceUrls) && merged.sourceUrls.length ? merged.sourceUrls : [fallbackPage.url];
  const cleanEvidence = evidenceFromText(combinedText);
  const submittedEvidence = Array.isArray(merged.sourceEvidence) ? merged.sourceEvidence.filter(sentence => !evidenceIsWeak(String(sentence))) : [];
  merged.sourceEvidence = (cleanEvidence.length ? cleanEvidence : submittedEvidence).slice(0, 5);
  merged.confidenceScore = Math.max(0, Math.min(100, Number(merged.confidenceScore) || signalScore(combinedText)));
  if (merged.sourceEvidence.length < 2) merged.confidenceScore = Math.min(merged.confidenceScore, 86);
  merged.recommendedOpener = recommendedOpenerFor(merged);
  merged.reviewedAt = merged.reviewedAt || today();
  merged.contactPolicy = merged.contactPolicy || "Use public business contact routes only. This record shows fit evidence, not a confirmed buying decision.";

  return merged;
}

async function fetchText(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,text/plain;q=0.8,*/*;q=0.5"
      },
      signal: controller.signal
    });

    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
      throw new Error(`unsupported content-type ${contentType || "unknown"}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function allowedByRobots(url, cache) {
  if (process.env.LEAD_ENGINE_RESPECT_ROBOTS === "false") return true;

  const parsed = new URL(url);
  const key = parsed.origin;
  if (!cache.has(key)) {
    try {
      const robots = await fetchText(new URL("/robots.txt", parsed.origin).toString(), 5000);
      const disallow = [];
      let applies = false;
      for (const rawLine of robots.split(/\r?\n/)) {
        const line = rawLine.replace(/#.*/, "").trim();
        if (!line) continue;
        const [name, ...rest] = line.split(":");
        const value = rest.join(":").trim();
        if (/^user-agent$/i.test(name)) applies = value === "*";
        if (applies && /^disallow$/i.test(name) && value) disallow.push(value);
      }
      cache.set(key, disallow);
    } catch {
      cache.set(key, []);
    }
  }

  return !cache.get(key).some(disallowedPath => parsed.pathname.startsWith(disallowedPath));
}

async function crawlSources(sourceUrls, options) {
  const queue = [...sourceUrls];
  const seen = new Set();
  const pages = [];
  const robots = new Map();
  const deadline = Date.now() + options.runTimeoutMs;

  while (queue.length > 0 && pages.length < options.maxPages && Date.now() < deadline) {
    const url = queue.shift();
    if (!url || seen.has(url)) continue;
    seen.add(url);

    try {
      if (unsupportedUrlPattern.test(url)) {
        console.log(`skip unsupported ${url}`);
        continue;
      }

      if (!(await allowedByRobots(url, robots))) {
        console.log(`skip robots ${url}`);
        continue;
      }

      const html = await fetchText(url, options.timeoutMs);
      const text = stripHtml(html);
      const title = pageTitle(html);
      const page = { url, title, text: text.slice(0, options.maxPageTextChars) };

      if (looksRelevant(`${title} ${text}`)) pages.push(page);

      if (options.followLinks) {
        for (const link of linksFromHtml(html, url)) {
          if (seen.has(link)) continue;
          if (!sameAllowedHost(link, sourceUrls)) continue;
          if (looksRelevant(link) || /directory|agents?|brokers?|realtors?|property|real-estate/i.test(link)) {
            queue.push(link);
          }
        }
      }

      await sleep(options.delayMs);
    } catch (error) {
      console.log(`warn crawl ${url}: ${error.message}`);
    }
  }

  if (queue.length > 0 && Date.now() >= deadline) {
    console.log(`warn crawl deadline reached after ${Math.round(options.runTimeoutMs / 1000)} seconds; using ${pages.length} collected pages`);
  }

  return pages;
}

function sameAllowedHost(url, sourceUrls) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return sourceUrls.some(source => new URL(source).hostname.replace(/^www\./, "") === host);
  } catch {
    return false;
  }
}

async function enrichWithAi(pages) {
  const apiUrl = plainUrl(process.env.AI_INFERENCE_URL);
  const apiKey = process.env.AI_API_KEY?.trim();
  const model = process.env.AI_MODEL?.trim() || "llama-3.1-8b-instant";
  const aiMaxPages = asPositiveInt(process.env.AI_INFERENCE_MAX_PAGES, 4);
  const aiMaxPageTextChars = asPositiveInt(process.env.AI_INFERENCE_MAX_PAGE_TEXT_CHARS, 1200);

  if (!apiUrl || !apiKey || pages.length === 0) {
    return pages.map(page => heuristicLead(page));
  }

  const pagesForAi = pages.slice(0, aiMaxPages);
  const prompt = [
    "Return only valid JSON: an array of qualified real estate lead records.",
    "Use only the supplied public page evidence. Do not invent private contact data.",
    "Each record must include id, businessName, industry, location, estimatedJobValue, buyingIntent, painPoints, recommendedOpener, confidenceScore, sourceType, sourceUrls, sourceEvidence, reviewedAt, contactPolicy.",
    "Make location as local as the evidence allows. Prefer City, ST. Include postalCode when a public source explicitly shows a zip code.",
    "Prefer businesses with clear buyer/seller/property inquiry or client-intake signals.",
    JSON.stringify(pagesForAi.map(page => ({
      url: page.url,
      title: page.title,
      text: page.text.slice(0, aiMaxPageTextChars)
    })))
  ].join("\n\n");

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), asPositiveInt(process.env.AI_INFERENCE_TIMEOUT_MS, 30000));
    let response;

    try {
      response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: "You clean and qualify public-source real estate business leads for B2B sales teams." },
            { role: "user", content: prompt }
          ],
          temperature: 0.2,
          response_format: { type: "json_object" }
        }),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }

    const body = await response.json();
    if (!response.ok) throw new Error(body.error?.message ?? `AI HTTP ${response.status}`);

    const content = body.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(content);
    const records = Array.isArray(parsed) ? parsed : parsed.leads ?? parsed.records ?? [];
    const aiRecords = records.map((record, index) => normalizeLead(record, pagesForAi[index] ?? pagesForAi[0])).filter(requiredFieldsOk);
    const fallbackRecords = pages
      .map(page => heuristicLead(page));
    console.log(`ai enriched records: ${aiRecords.length}; fallback records: ${fallbackRecords.length}`);
    return [...aiRecords, ...fallbackRecords];
  } catch (error) {
    console.log(`warn ai enrichment failed, using heuristic fallback: ${error.message}`);
    return pages.map(page => heuristicLead(page));
  }
}

function dedupeLeads(leads) {
  const seen = new Set();
  const deduped = [];
  for (const lead of leads) {
    const key = [lead.businessName, lead.location, lead.sourceUrls?.[0]].map(value => String(value ?? "").toLowerCase()).join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(lead);
  }
  return deduped;
}

async function readExisting(file) {
  try {
    const records = JSON.parse(await fs.readFile(file, "utf8"));
    return Array.isArray(records) ? records.filter(requiredFieldsOk) : [];
  } catch {
    return [];
  }
}

async function writePack(file, records) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(`${file}.tmp`, `${JSON.stringify(records, null, 2)}\n`);
  await fs.rename(`${file}.tmp`, file);
}

async function writePackStatus(file, status) {
  const statusFile = `${file}.status.json`;
  await fs.mkdir(path.dirname(statusFile), { recursive: true });
  await fs.writeFile(`${statusFile}.tmp`, `${JSON.stringify(status, null, 2)}\n`);
  await fs.rename(`${statusFile}.tmp`, statusFile);
}

async function runOnce() {
  const marketName = process.env.LEAD_ENGINE_MARKET?.trim() || "";
  const marketConfig = await loadMarketSources(marketName);
  const manualSourceUrls = envList("LEAD_ENGINE_SOURCE_URLS");
  const sourceMode = process.env.LEAD_ENGINE_SOURCE_MODE?.trim() || (marketName ? "market" : "manual");
  const sourceUrls = dedupeList(
    sourceMode === "append"
      ? [...marketConfig.sources, ...manualSourceUrls]
      : marketName
        ? marketConfig.sources
        : manualSourceUrls
  );

  if (sourceUrls.length === 0) {
    throw new Error("Set LEAD_ENGINE_MARKET to a configured market or LEAD_ENGINE_SOURCE_URLS to one or more public real estate directory/search URLs.");
  }

  const outputFile = path.resolve(process.env.LEAD_PACK_OUTPUT_FILE ?? process.env.LEAD_PACK_FILE ?? DEFAULT_OUTPUT_FILE);
  const maxPages = asPositiveInt(process.env.LEAD_ENGINE_MAX_PAGES, 20);
  const packLimit = asPositiveInt(process.env.LEAD_ENGINE_PACK_LIMIT, 25);
  const minConfidence = asPositiveInt(process.env.LEAD_ENGINE_MIN_CONFIDENCE, 70);
  const options = {
    maxPages,
    delayMs: asPositiveInt(process.env.LEAD_ENGINE_DELAY_MS, 1500),
    timeoutMs: asPositiveInt(process.env.LEAD_ENGINE_TIMEOUT_MS, 12000),
    runTimeoutMs: asPositiveInt(process.env.LEAD_ENGINE_RUN_TIMEOUT_MS, 180000),
    maxPageTextChars: asPositiveInt(process.env.LEAD_ENGINE_MAX_PAGE_TEXT_CHARS, 9000),
    followLinks: process.env.LEAD_ENGINE_FOLLOW_LINKS !== "false"
  };

  console.log(`lead engine run started`);
  if (marketConfig.market) {
    console.log(`market: ${marketConfig.market.id} (${marketConfig.market.label})`);
    console.log(`areas: ${marketConfig.market.areas.join(", ")}`);
  }
  console.log(`source mode: ${sourceMode}`);
  console.log(`sources: ${sourceUrls.length}`);
  console.log(`output: ${outputFile}`);

  const pages = await crawlSources(sourceUrls, options);
  const baseline = pages.map(page => heuristicLead(page));
  const enriched = await enrichWithAi(pages);
  const existing = process.env.LEAD_ENGINE_MERGE_EXISTING === "true" ? await readExisting(outputFile) : [];
  const records = dedupeLeads([...baseline, ...enriched, ...existing])
    .filter(record => requiredFieldsOk(record) && record.confidenceScore >= minConfidence)
    .slice(0, packLimit);
  console.log(`baseline records: ${baseline.length}`);

  if (records.length === 0) {
    await writePackStatus(outputFile, {
      status: "empty",
      ranAt: new Date().toISOString(),
      market: marketConfig.market,
      sourceMode,
      sources: sourceUrls,
      crawledPages: pages.length,
      enrichedRecords: enriched.length,
      qualifiedRecords: 0,
      minConfidence,
      message: "No qualified records were produced. Existing production pack was preserved."
    });
    throw new Error("No qualified lead records were produced. Keep the existing production pack unchanged.");
  }

  await writePack(outputFile, records);
  await writePackStatus(outputFile, {
    status: "ok",
    ranAt: new Date().toISOString(),
    market: marketConfig.market,
    sourceMode,
    sources: sourceUrls,
    crawledPages: pages.length,
    enrichedRecords: enriched.length,
    qualifiedRecords: records.length,
    minConfidence,
    outputFile
  });
  console.log(`lead engine run finished`);
  console.log(`qualified records: ${records.length}`);
}

async function runForever() {
  const intervalMs = asPositiveInt(process.env.LEAD_ENGINE_INTERVAL_MS, DEFAULT_INTERVAL_MS);

  for (;;) {
    try {
      await runOnce();
    } catch (error) {
      console.error(`lead engine run failed: ${error.message}`);
    }
    console.log(`next run in ${Math.round(intervalMs / 60000)} minutes`);
    await sleep(intervalMs);
  }
}

try {
  if (process.argv.includes("--loop")) {
    await runForever();
  } else {
    await runOnce();
  }
} catch (error) {
  console.error(`lead engine failed: ${error.message}`);
  process.exitCode = 1;
}
