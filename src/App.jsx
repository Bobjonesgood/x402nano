import { useEffect, useMemo, useState } from "react";
import { Activity, Bot, CheckCircle2, Copy, DatabaseZap, ExternalLink, FileText, Globe2, MapPin, Radio, ReceiptText, ShieldCheck, WalletCards, Zap } from "lucide-react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const paidEndpoint = "https://x402nano.onrender.com/api/lead-intelligence/premium-pack";
const discoveryEndpoint = "https://x402nano.onrender.com/.well-known/x402.json";

const packPlans = [
  ["Starter Sample", "$29", "5 local lead briefs", "Best for testing one city or niche before buying a bigger pack."],
  ["Market Pack", "$97", "25 local lead briefs", "A focused city, zip, county, or investor/agent prospecting pack."],
  ["Market Sprint", "$197", "60 local lead briefs", "More coverage for agents, teams, brokers, or investors working a market."],
  ["Custom Build", "$297", "priority local research", "A deeper market sprint with notes, categories, and outreach angles."]
];

function shortAddress(address) {
  if (!address) return "not configured";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function StatusCard({ icon: Icon, label, value, tone = "good" }) {
  return (
    <div className={`statusCard ${tone}`}>
      <Icon size={18} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function CopyButton({ value, children }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }

  return (
    <button className="copyButton" onClick={copy} type="button">
      <Copy size={16} />
      {copied ? "Copied" : children}
    </button>
  );
}

function App() {
  const [version, setVersion] = useState(null);
  const [challenge, setChallenge] = useState(null);
  const [error, setError] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");

  const localEndpointPath = useMemo(() => {
    const params = new URLSearchParams();
    if (city.trim()) params.set("city", city.trim());
    if (state.trim()) params.set("state", state.trim());
    if (zip.trim()) params.set("zip", zip.trim());
    const query = params.toString();
    return `/api/lead-intelligence/premium-pack${query ? `?${query}` : ""}`;
  }, [city, state, zip]);

  const localPaidEndpoint = `https://x402nano.onrender.com${localEndpointPath}`;
  const targetMarket = [city.trim(), state.trim(), zip.trim()].filter(Boolean).join(", ") || "your local market";

  useEffect(() => {
    async function load() {
      try {
        const [versionResponse, challengeResponse] = await Promise.all([
          fetch("/api/version"),
          fetch(localEndpointPath)
        ]);
        setVersion(await versionResponse.json());
        setChallenge(await challengeResponse.json());
      } catch {
        setError("Live status could not be loaded. Refresh or check Render logs.");
      }
    }

    load();
  }, [localEndpointPath]);

  const payment = version?.payment ?? {};
  const product = version?.product ?? {};
  const leadNestAI = version?.leadNestAI ?? {};
  const requirements = challenge?.paymentRequirements ?? {};
  const mainnetLive = payment.mode === "facilitator" && payment.network === "eip155:8453";
  const protectedBy402 = challenge?.error === "Payment required" && requirements.amount === "0.05";
  const records = product.records ?? "--";

  const proofItems = useMemo(() => [
    ["Live price", `${payment.amount ?? "0.05"} ${payment.asset ?? "USDC"}`],
    ["Network", payment.network === "eip155:8453" ? "Base Mainnet" : payment.network ?? "loading"],
    ["Settlement", payment.settlement ?? "loading"],
    ["Seller", shortAddress(payment.sellerWallet?.address)]
  ], [payment]);

  return (
    <main>
      <section className="hero">
        <div className="heroVisual" aria-hidden="true">
          <div className="terminal">
            <div className="terminalBar">
              <span />
              <span />
              <span />
            </div>
            <code>GET /api/lead-intelligence/premium-pack</code>
            <code className="warn">402 Payment Required</code>
            <code>Pay 0.05 USDC on Base</code>
            <code className="ok">Unlock {records} lead intelligence records</code>
          </div>
        </div>

        <div className="heroCopy">
          <span className="eyebrow">LeadNestAI local lead packs</span>
          <h1>Qualified local real estate lead packs. No monthly subscription.</h1>
          <p>
            Pick a city, zip, county, or niche. LeadNestAI turns public-source real estate signals into contact-ready lead briefs with evidence, suggested openers, confidence scores, and next steps.
          </p>
          <div className="heroActions">
            <a className="primaryButton" href={localPaidEndpoint} rel="noreferrer" target="_blank">
              <Zap size={18} />
              Preview Local Availability
            </a>
            <a className="secondaryButton" href={discoveryEndpoint} rel="noreferrer" target="_blank">
              <Globe2 size={18} />
              API Proof
            </a>
          </div>
        </div>
      </section>

      <section className="liveStatus">
        <StatusCard icon={Radio} label="Availability" value={protectedBy402 ? "pack available" : challenge?.error ?? "checking"} tone={protectedBy402 ? "good" : "warn"} />
        <StatusCard icon={WalletCards} label="Settlement" value={mainnetLive ? "Base mainnet" : payment.mode ?? "loading"} tone={mainnetLive ? "good" : "warn"} />
        <StatusCard icon={DatabaseZap} label="Active inventory" value={`${records} records`} />
        <StatusCard icon={ShieldCheck} label="LeadNestAI" value={leadNestAI.mode ?? "loading"} />
      </section>

      {error && <div className="error">{error}</div>}

      <section className="locationPanel">
        <div>
          <span className="eyebrow">build your pack</span>
          <h2>Request leads for the market you actually work.</h2>
          <p>Enter a city, state, or zip to check local inventory. If no active records match that market, the system returns no-inventory instead of selling an empty pack.</p>
        </div>
        <div className="locationForm">
          <label>
            City
            <input value={city} onChange={event => setCity(event.target.value)} placeholder="Tulsa" />
          </label>
          <label>
            State
            <input value={state} onChange={event => setState(event.target.value)} placeholder="OK" maxLength={2} />
          </label>
          <label>
            Zip
            <input value={zip} onChange={event => setZip(event.target.value)} placeholder="74103" inputMode="numeric" />
          </label>
        </div>
        <div className="endpointBox local">
          <span>Local paid endpoint</span>
          <code>{localPaidEndpoint}</code>
          <CopyButton value={localPaidEndpoint}>Copy local endpoint</CopyButton>
        </div>
      </section>

      <section className="pricingPanel">
        <div className="pricingIntro">
          <span className="eyebrow">simple pricing</span>
          <h2>Pay per pack. No subscription needed.</h2>
          <p>Start small, test the quality, then buy a larger local market sprint when you are ready.</p>
        </div>
        <div className="priceGrid">
          {packPlans.map(([name, price, volume, detail]) => (
            <article className="priceCard" key={name}>
              <span>{name}</span>
              <strong>{price}</strong>
              <b>{volume}</b>
              <p>{detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid two">
        <article className="panel">
          <div className="panelTitle">
            <MapPin size={20} />
            <h2>What Each Lead Brief Includes</h2>
          </div>
          <ul className="steps">
            <li>Local market, city, zip, or niche context.</li>
            <li>Public-source evidence so the lead is not a blind name.</li>
            <li>Why the opportunity may be worth contacting.</li>
            <li>Suggested opener and recommended next step.</li>
            <li>Confidence score for quick prioritization.</li>
          </ul>
          <div className="endpointBox">
            <span>Local inventory proof endpoint</span>
            <code>{localPaidEndpoint}</code>
            <CopyButton value={localPaidEndpoint}>Copy endpoint</CopyButton>
          </div>
        </article>

        <article className="panel">
          <div className="panelTitle">
            <ReceiptText size={20} />
            <h2>Live Proof</h2>
          </div>
          <div className="proofGrid">
            {proofItems.map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <div className="challengeBox">
            <span>Current challenge</span>
            <code>{requirements.amount ?? "0.05"} {requirements.asset ?? "USDC"} to {shortAddress(requirements.payTo)}</code>
          </div>
        </article>
      </section>

      <section className="grid three">
        <article className="panel">
          <CheckCircle2 size={22} />
          <h3>Built For Real Estate</h3>
          <p>Agents, brokers, teams, investors, and wholesalers who already understand prospecting and want better local research.</p>
        </article>
        <article className="panel">
          <Activity size={22} />
          <h3>No Empty-Pack Sales</h3>
          <p>If a requested city or zip has no matching active records, the API returns no-inventory instead of charging for an empty pack.</p>
        </article>
        <article className="panel">
          <FileText size={22} />
          <h3>API Under The Hood</h3>
          <p>x402 stays as the proof and machine-payment layer. Human buyers can still buy simple local packs without needing to understand the protocol.</p>
        </article>
      </section>

      <section className="launchPanel">
        <div>
          <span className="eyebrow">sales message</span>
          <h2>Copy this when pitching real estate buyers.</h2>
        </div>
        <pre>{`I built a local real estate lead intelligence service.

No subscription. You pick a city, zip, county, or niche and I build a public-source lead pack with:

- why each lead may be worth contacting
- source evidence
- suggested opener
- confidence score
- next step

I’m testing ${targetMarket} now. Want to see a sample pack?`}</pre>
        <CopyButton value={`I built a local real estate lead intelligence service.\n\nNo subscription. You pick a city, zip, county, or niche and I build a public-source lead pack with:\n\n- why each lead may be worth contacting\n- source evidence\n- suggested opener\n- confidence score\n- next step\n\nI’m testing ${targetMarket} now. Want to see a sample pack?`}>
          Copy sales message
        </CopyButton>
      </section>

      <footer>
        <a href="https://www.leadnestai.com" rel="noreferrer" target="_blank">
          LeadNestAI <ExternalLink size={14} />
        </a>
        <span>Machine-payable lead intelligence on Base mainnet.</span>
      </footer>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
