import { useEffect, useMemo, useState } from "react";
import { Activity, Bot, CheckCircle2, Copy, DatabaseZap, ExternalLink, FileText, Globe2, Radio, ReceiptText, ShieldCheck, WalletCards, Zap } from "lucide-react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const proofSlug = "will-gideon-saar-be-the-next-prime-minister-of-israel";
const freeEndpoint = "https://x402nano.onrender.com/api/markets/trending";
const paidEndpoint = `https://x402nano.onrender.com/api/markets/brief?slug=${proofSlug}`;
const discoveryEndpoint = "https://x402nano.onrender.com/.well-known/x402.json";
const schemaEndpoint = "https://x402nano.onrender.com/api/schema";
const mcpEndpoint = "https://x402nano.onrender.com/mcp";
const mcpManifest = "https://x402nano.onrender.com/server.json";
const proofTx = "https://basescan.org/tx/0x54ba49a288a56d20046c25f4496bec405f2eefc05fe413cd511caf96227911b1";

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
  const [mcp, setMcp] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [versionResponse, challengeResponse, mcpResponse] = await Promise.all([
          fetch("/api/version"),
          fetch(`/api/markets/brief?slug=${proofSlug}`),
          fetch("/server.json")
        ]);
        setVersion(await versionResponse.json());
        setChallenge(await challengeResponse.json());
        setMcp(await mcpResponse.json());
      } catch {
        setError("Live status could not be loaded. Refresh or check Render logs.");
      }
    }

    load();
  }, []);

  const payment = version?.payment ?? {};
  const requirements = challenge?.paymentRequirements ?? {};
  const mainnetLive = payment.mode === "facilitator" && payment.network === "eip155:8453";
  const protectedBy402 = challenge?.error === "Payment required" && requirements.amount === "0.05";

  const proofItems = useMemo(() => [
    ["Live price", `${payment.amount ?? "0.05"} ${payment.asset ?? "USDC"}`],
    ["Network", payment.network === "eip155:8453" ? "Base mainnet" : payment.network ?? "loading"],
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
            <code>GET /api/markets/brief?slug=...</code>
            <code className="warn">402 Payment Required</code>
            <code>Retry with X-PAYMENT</code>
            <code>Pay 0.05 USDC on Base</code>
            <code className="ok">Unlock movement + liquidity JSON</code>
            <code className="ok">MCP: POST /mcp</code>
          </div>
        </div>

        <div className="heroCopy">
          <span className="eyebrow">x402nano</span>
          <h1>Machine-payable prediction-market intelligence for autonomous agents.</h1>
          <p>
            Agents connect through HTTP or MCP, inspect free trending markets, pay 0.05 USDC on Base for a read-only brief or delta, and receive structured JSON plus settlement metadata.
          </p>
          <div className="heroActions">
            <a className="primaryButton" href={paidEndpoint} rel="noreferrer" target="_blank">
              <Zap size={18} />
              View 402 Challenge
            </a>
            <a className="secondaryButton" href={proofTx} rel="noreferrer" target="_blank">
              <ReceiptText size={18} />
              Mainnet Proof
            </a>
          </div>
        </div>
      </section>

      <section className="liveStatus">
        <StatusCard icon={Radio} label="Paid route" value={protectedBy402 ? "protected by 402" : challenge?.error ?? "checking"} tone={protectedBy402 ? "good" : "warn"} />
        <StatusCard icon={WalletCards} label="Settlement" value={mainnetLive ? "Base mainnet" : payment.mode ?? "loading"} tone={mainnetLive ? "good" : "warn"} />
        <StatusCard icon={DatabaseZap} label="Price" value={`${payment.amount ?? "0.05"} ${payment.asset ?? "USDC"}`} />
        <StatusCard icon={ShieldCheck} label="Remote MCP" value={mcp?.remotes?.[0]?.type === "streamable-http" ? "streamable HTTP" : "checking"} />
      </section>

      {error && <div className="error">{error}</div>}

      <section className="locationPanel">
        <div>
          <span className="eyebrow">live routes</span>
          <h2>Direct API and remote MCP.</h2>
          <p>The same read-only intelligence is available through ordinary HTTP routes and a standards-compliant MCP server, without an account or API key.</p>
        </div>
        <div className="endpointBox local">
          <span>Free trending markets</span>
          <code>{freeEndpoint}</code>
          <CopyButton value={freeEndpoint}>Copy free endpoint</CopyButton>
        </div>
        <div className="endpointBox local">
          <span>Paid market brief</span>
          <code>{paidEndpoint}</code>
          <CopyButton value={paidEndpoint}>Copy paid endpoint</CopyButton>
        </div>
      </section>

      <section className="locationPanel">
        <div>
          <span className="eyebrow">remote MCP</span>
          <h2>Connect agents directly.</h2>
          <p>Free tools work with Streamable HTTP MCP clients. Paid tools use x402 MCP payment metadata so the buyer signs locally and x402nano never receives the buyer key.</p>
        </div>
        <div className="endpointBox local">
          <span>Streamable HTTP endpoint</span>
          <code>{mcpEndpoint}</code>
          <CopyButton value={mcpEndpoint}>Copy MCP endpoint</CopyButton>
        </div>
        <div className="endpointBox local">
          <span>Registry manifest</span>
          <code>{mcpManifest}</code>
          <CopyButton value={mcpManifest}>Copy manifest URL</CopyButton>
        </div>
      </section>

      <section className="pricingPanel">
        <div className="pricingIntro">
          <span className="eyebrow">paid brief includes</span>
          <h2>What changed in the last 24 hours?</h2>
          <p>Paid JSON now includes objective market movement, liquidity context, resolution context, watch points, and safe descriptive scores.</p>
        </div>
        <div className="priceGrid">
          {[
            ["Movement", "24h", "timestamped probability trajectory", "Public CLOB price history when available."],
            ["Liquidity", "context", "volume and liquidity fields", "Helps agents judge whether movement is meaningful context."],
            ["Resolution", "rules", "date and source context", "Points clients back to official market rules."],
            ["Scores", "safe", "movement, attention, completeness", "Descriptive heuristics, not predictions or advice."]
          ].map(([name, price, volume, detail]) => (
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
            <Bot size={20} />
            <h2>How The x402 Flow Works</h2>
          </div>
          <ul className="steps">
            <li>Agent requests a paid market brief.</li>
            <li>API returns <code>402 Payment Required</code>.</li>
            <li>Agent retries with <code>X-PAYMENT</code>.</li>
            <li>0.05 USDC settles on Base mainnet.</li>
            <li>API returns receipt plus read-only JSON.</li>
          </ul>
          <div className="endpointBox">
            <span>Discovery manifest</span>
            <code>{discoveryEndpoint}</code>
            <CopyButton value={discoveryEndpoint}>Copy discovery URL</CopyButton>
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
            <span>Proof receipt</span>
            <code>f1ffa2f5cabf94c3</code>
          </div>
        </article>
      </section>

      <section className="grid three">
        <article className="panel">
          <CheckCircle2 size={22} />
          <h3>Read-only</h3>
          <p>Market briefs summarize public Polymarket data for machine-readable context.</p>
        </article>
        <article className="panel">
          <Activity size={22} />
          <h3>No custody or execution</h3>
          <p>x402nano does not hold user funds, place trades, or manage accounts.</p>
        </article>
        <article className="panel">
          <FileText size={22} />
          <h3>No trading advice</h3>
          <p>Outputs are informational only: no betting advice, no buy/sell recommendations, no guaranteed outcomes.</p>
        </article>
      </section>

      <section className="launchPanel">
        <div>
          <span className="eyebrow">builder copy</span>
          <h2>Describe x402nano in one paragraph.</h2>
        </div>
        <pre>{`x402nano is machine-payable prediction-market intelligence for autonomous agents over HTTP and MCP.

Free: GET /api/markets/trending
MCP: https://x402nano.onrender.com/mcp
Paid: Market Brief or Market Delta, 0.05 USDC each

Flow: x402 payment -> 0.05 USDC on Base -> read-only JSON + settlement metadata.

No account. No API key. No custody. No trading advice.`}</pre>
        <CopyButton value={`x402nano is machine-payable prediction-market intelligence for autonomous agents over HTTP and MCP.\n\nFree: GET /api/markets/trending\nMCP: https://x402nano.onrender.com/mcp\nPaid: Market Brief or Market Delta, 0.05 USDC each\n\nFlow: x402 payment -> 0.05 USDC on Base -> read-only JSON + settlement metadata.\n\nNo account. No API key. No custody. No trading advice.`}>
          Copy description
        </CopyButton>
      </section>

      <footer>
        <a href={schemaEndpoint} rel="noreferrer" target="_blank">
          Schema <ExternalLink size={14} />
        </a>
        <span>Machine-payable market intelligence on Base mainnet.</span>
      </footer>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
