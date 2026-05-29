import { useEffect, useMemo, useState } from "react";
import { Activity, Bot, CheckCircle2, Copy, DatabaseZap, ExternalLink, Globe2, KeyRound, Radio, ReceiptText, ShieldCheck, WalletCards, Zap } from "lucide-react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const paidEndpoint = "https://x402nano.onrender.com/api/lead-intelligence/premium-pack";
const discoveryEndpoint = "https://x402nano.onrender.com/.well-known/x402.json";

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

  useEffect(() => {
    async function load() {
      try {
        const [versionResponse, challengeResponse] = await Promise.all([
          fetch("/api/version"),
          fetch("/api/lead-intelligence/premium-pack")
        ]);
        setVersion(await versionResponse.json());
        setChallenge(await challengeResponse.json());
      } catch {
        setError("Live status could not be loaded. Refresh or check Render logs.");
      }
    }

    load();
  }, []);

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
          <span className="eyebrow">LeadNestAI x402 paid API</span>
          <h1>Real estate lead intelligence that agents can buy with HTTP 402.</h1>
          <p>
            x402nano is a live Base mainnet paid endpoint. Buyers and autonomous agents receive a payment challenge, settle 0.05 USDC, and unlock the active LeadNestAI lead pack.
          </p>
          <div className="heroActions">
            <a className="primaryButton" href={paidEndpoint} rel="noreferrer" target="_blank">
              <Zap size={18} />
              Open Paid Endpoint
            </a>
            <a className="secondaryButton" href={discoveryEndpoint} rel="noreferrer" target="_blank">
              <Globe2 size={18} />
              View x402 Discovery
            </a>
          </div>
        </div>
      </section>

      <section className="liveStatus">
        <StatusCard icon={Radio} label="Paywall" value={protectedBy402 ? "HTTP 402 live" : "check required"} tone={protectedBy402 ? "good" : "warn"} />
        <StatusCard icon={WalletCards} label="Settlement" value={mainnetLive ? "Base mainnet" : payment.mode ?? "loading"} tone={mainnetLive ? "good" : "warn"} />
        <StatusCard icon={DatabaseZap} label="Lead pack" value={`${records} records`} />
        <StatusCard icon={ShieldCheck} label="LeadNestAI" value={leadNestAI.mode ?? "loading"} />
      </section>

      {error && <div className="error">{error}</div>}

      <section className="grid two">
        <article className="panel">
          <div className="panelTitle">
            <Bot size={20} />
            <h2>How Buyers Use It</h2>
          </div>
          <ol className="steps">
            <li>Discover the paid resource at <code>/.well-known/x402.json</code>.</li>
            <li>Call the lead pack endpoint and receive <code>402 Payment Required</code>.</li>
            <li>Submit an x402 payment payload for <code>0.05 USDC</code> on Base mainnet.</li>
            <li>Receive the unlocked real estate lead intelligence pack and receipt.</li>
          </ol>
          <div className="endpointBox">
            <span>Paid endpoint</span>
            <code>{paidEndpoint}</code>
            <CopyButton value={paidEndpoint}>Copy endpoint</CopyButton>
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
          <h3>What Customers Get</h3>
          <p>Structured business name, industry, location, buying-intent signal, pain points, source evidence, confidence score, and a recommended opener.</p>
        </article>
        <article className="panel">
          <Activity size={22} />
          <h3>Who To Sell To</h3>
          <p>AI-agent builders, real estate automation teams, CRM enrichment users, lead sellers, x402 marketplaces, and Base ecosystem builders.</p>
        </article>
        <article className="panel">
          <KeyRound size={22} />
          <h3>Owner Preview</h3>
          <p>The owner can inspect active leads through the protected admin preview route using <code>LEAD_PACK_ADMIN_TOKEN</code>.</p>
        </article>
      </section>

      <section className="launchPanel">
        <div>
          <span className="eyebrow">sales message</span>
          <h2>Copy this when pitching builders.</h2>
        </div>
        <pre>{`I launched a live x402 paid API on Base mainnet.

It returns real estate lead intelligence after a 0.05 USDC payment.

Endpoint:
${paidEndpoint}

Best fit:
- AI agents
- lead-gen automation
- real estate SaaS workflows
- x402/API marketplace buyers`}</pre>
        <CopyButton value={`I launched a live x402 paid API on Base mainnet.\n\nIt returns real estate lead intelligence after a 0.05 USDC payment.\n\nEndpoint:\n${paidEndpoint}\n\nBest fit:\n- AI agents\n- lead-gen automation\n- real estate SaaS workflows\n- x402/API marketplace buyers`}>
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
