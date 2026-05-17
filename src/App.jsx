import { useEffect, useMemo, useState } from "react";
import { Bot, CheckCircle2, CircleDollarSign, DatabaseZap, KeyRound, Loader2, Play, Radar, ReceiptText, ShieldCheck, Wallet } from "lucide-react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const buyerAddress = "0xAutonomousAgentWallet";

function Step({ icon: Icon, title, detail, active, done }) {
  return (
    <div className={`step ${active ? "active" : ""} ${done ? "done" : ""}`}>
      <div className="stepIcon">
        <Icon size={18} />
      </div>
      <div>
        <p>{title}</p>
        <span>{detail}</span>
      </div>
    </div>
  );
}

function encodePayment(payment) {
  return btoa(JSON.stringify(payment)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function shortAddress(address) {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function shortValue(value) {
  if (!value) return "--";
  if (value.length <= 18) return value;
  return `${value.slice(0, 10)}...${value.slice(-6)}`;
}

function ReceiptPanel({ receipt }) {
  if (!receipt) return null;

  const rows = [
    ["Receipt", shortValue(receipt.id)],
    ["Payer", shortAddress(receipt.payer) || receipt.payer],
    ["Seller", shortAddress(receipt.seller) || receipt.seller],
    ["Amount", `${receipt.amount} ${receipt.asset}`],
    ["Network", receipt.network],
    ["Settlement", receipt.mode],
    ["Transaction", shortValue(receipt.transaction)]
  ];

  return (
    <div className="receiptPanel">
      <div className="receiptTitle">
        <ReceiptText size={19} />
        <h3>Wallet Receipt</h3>
      </div>
      <div className="receiptGrid">
        {rows.map(([label, value]) => (
          <div className="receiptRow" key={label}>
            <span>{label}</span>
            <strong>{value || "--"}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function App() {
  const [discovery, setDiscovery] = useState(null);
  const [demoMode, setDemoMode] = useState("agent");
  const [phase, setPhase] = useState("idle");
  const [requirements, setRequirements] = useState(null);
  const [signature, setSignature] = useState("");
  const [receipt, setReceipt] = useState(null);
  const [leads, setLeads] = useState([]);
  const [log, setLog] = useState([]);
  const [error, setError] = useState("");
  const [autonomous, setAutonomous] = useState(true);
  const [walletAddress, setWalletAddress] = useState("");

  const paid = Boolean(receipt);
  const busy = phase === "requesting" || phase === "signing" || phase === "unlocking" || phase === "wallet";
  const modeCopy = {
    agent: {
      title: "Auto Agent",
      heading: "Autonomous API Buyer",
      body: "Discover, price, pay, retry, and receive protected data without a wallet popup."
    },
    wallet: {
      title: "Browser Wallet",
      heading: "Browser Wallet Buyer",
      body: "Connect a wallet, sign the payment authorization, and unlock the protected endpoint."
    },
    trace: {
      title: "Protocol Trace",
      heading: "Protocol Trace",
      body: "Inspect the discovery links, payment requirements, receipt, signature, and event log."
    }
  };

  const totalFit = useMemo(() => {
    if (!leads.length) return 0;
    return Math.round(leads.reduce((sum, lead) => sum + lead.fit, 0) / leads.length);
  }, [leads]);

  useEffect(() => {
    fetch("/.well-known/x402.json")
      .then(response => response.json())
      .then(data => {
        setDiscovery(data);
        appendLog("Loaded /.well-known/x402.json agent discovery manifest.");
      })
      .catch(() => setError("Could not reach the seller server."));
  }, []);

  useEffect(() => {
    if (!window.ethereum) return;

    let mounted = true;

    window.ethereum
      .request({ method: "eth_accounts" })
      .then(accounts => {
        const address = accounts?.[0] ?? "";
        if (mounted && address) {
          setWalletAddress(address);
          appendLog(`Browser wallet restored: ${shortAddress(address)}.`);
        }
      })
      .catch(() => {});

    function handleAccountsChanged(accounts) {
      const address = accounts?.[0] ?? "";
      setWalletAddress(address);
      if (address) {
        appendLog(`Browser wallet connected: ${shortAddress(address)}.`);
      } else {
        appendLog("Browser wallet disconnected.");
      }
    }

    window.ethereum.on?.("accountsChanged", handleAccountsChanged);

    return () => {
      mounted = false;
      window.ethereum.removeListener?.("accountsChanged", handleAccountsChanged);
    };
  }, []);

  function appendLog(message) {
    setLog(current => [`${new Date().toLocaleTimeString()}  ${message}`, ...current].slice(0, 8));
  }

  async function connectWallet() {
    setError("");
    if (!window.ethereum) {
      setError("No browser wallet found. Open this page in Coinbase Wallet, MetaMask, or a wallet-enabled browser.");
      return "";
    }

    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    const address = accounts?.[0] ?? "";
    setWalletAddress(address);
    appendLog(`Browser wallet connected: ${shortAddress(address)}.`);
    return address;
  }

  async function requestPremiumLeadData() {
    setError("");
    setLeads([]);
    setReceipt(null);
    setSignature("");
    setRequirements(null);

    try {
      setPhase("requesting");
      appendLog("Agent requested /api/premium-leads without payment.");
      const firstResponse = await fetch("/api/premium-leads");
      const paymentChallenge = await firstResponse.json();

      if (firstResponse.status !== 402) {
        throw new Error("Expected a 402 payment challenge from the seller API.");
      }

      setRequirements(paymentChallenge.paymentRequirements);
      appendLog("Seller returned 402 Payment Required with x402 requirements.");

      if (!autonomous) {
        setPhase("challenged");
        return;
      }

      await signAndRetry(paymentChallenge.paymentRequirements);
    } catch (requestError) {
      setPhase("idle");
      setError(requestError.message);
      appendLog(`Flow stopped: ${requestError.message}`);
    }
  }

  async function signAndRetry(activeRequirements = requirements) {
    try {
      setPhase("signing");
      appendLog("Agent prepared USDC payment signature for the protected resource.");

      const signResponse = await fetch("/api/payments/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payer: buyerAddress, requirements: activeRequirements })
      });
      const signed = await signResponse.json();
      setSignature(signed.signature);

      setPhase("unlocking");
      appendLog("Agent retried the API call with X-PAYMENT.");

      const unlockedResponse = await fetch("/api/premium-leads", {
        headers: {
          "X-PAYMENT": signed.encodedPayment ?? encodePayment({
            payer: buyerAddress,
            requirements: activeRequirements,
            signature: signed.signature
          })
        }
      });
      const unlocked = await unlockedResponse.json();

      if (!unlockedResponse.ok) {
        throw new Error(unlocked.reason ?? "Payment verification failed.");
      }

      setReceipt(unlocked.receipt);
      setLeads(unlocked.data);
      setPhase("complete");
      appendLog("Payment verified. Premium lead data unlocked.");
    } catch (paymentError) {
      setPhase("challenged");
      setError(paymentError.message);
      appendLog(`Unlock failed: ${paymentError.message}`);
    }
  }

  async function requestWithBrowserWallet() {
    setError("");
    setLeads([]);
    setReceipt(null);
    setSignature("");
    setRequirements(null);

    try {
      const payer = walletAddress || (await connectWallet());
      if (!payer) return;

      setPhase("requesting");
      appendLog("Browser wallet buyer requested /api/premium-leads without payment.");
      const firstResponse = await fetch("/api/premium-leads");
      const paymentChallenge = await firstResponse.json();

      if (firstResponse.status !== 402) {
        throw new Error("Expected a 402 payment challenge from the seller API.");
      }

      const activeRequirements = paymentChallenge.paymentRequirements;
      setRequirements(activeRequirements);
      appendLog("Seller returned 402 challenge for browser wallet signing.");

      setPhase("wallet");
      const messageResponse = await fetch("/api/payments/browser-wallet-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payer, requirements: activeRequirements })
      });
      const messagePayload = await messageResponse.json();

      if (!messageResponse.ok) {
        throw new Error(messagePayload.reason ?? messagePayload.error ?? "Could not prepare wallet signing message.");
      }

      appendLog("Wallet signature requested.");
      const walletSignature = await window.ethereum.request({
        method: "personal_sign",
        params: [messagePayload.message, payer]
      });
      setSignature(walletSignature);

      setPhase("unlocking");
      appendLog("Browser wallet signature captured. Retrying with X-PAYMENT.");
      const unlockedResponse = await fetch("/api/premium-leads", {
        headers: {
          "X-PAYMENT": encodePayment({
            payer,
            requirements: activeRequirements,
            signature: walletSignature,
            signatureType: "browser-wallet",
            message: messagePayload.message
          })
        }
      });
      const unlocked = await unlockedResponse.json();

      if (!unlockedResponse.ok) {
        throw new Error(unlocked.reason ?? "Wallet payment verification failed.");
      }

      setReceipt(unlocked.receipt);
      setLeads(unlocked.data);
      setPhase("complete");
      appendLog("Browser wallet payment verified. Premium lead data unlocked.");
    } catch (walletError) {
      setPhase("idle");
      setError(walletError.message);
      appendLog(`Wallet flow stopped: ${walletError.message}`);
    }
  }

  return (
    <main>
      <section className="topbar">
        <div>
          <span className="eyebrow">x402 seller sandbox</span>
          <h1>Payment-Aware Sandbox</h1>
        </div>
        <div className="statusPill">
          <span className={paid ? "dot paid" : "dot"} />
          {paid ? "Data unlocked" : "Payment required"}
        </div>
      </section>

      <section className="proofStrip">
        <div>
          <span>Proves</span>
          <strong>Machine-payable API access</strong>
        </div>
        <div>
          <span>Discovery</span>
          <strong>/.well-known/x402.json</strong>
        </div>
        <div>
          <span>Unlock</span>
          <strong>402 then X-PAYMENT retry</strong>
        </div>
        <div>
          <span>Now</span>
          <strong>Sandbox USDC settlement</strong>
        </div>
        <div>
          <span>Next</span>
          <strong>Base Sepolia facilitator</strong>
        </div>
      </section>

      <section className="workspace">
        <div className="controlPanel">
          <div className="modeTabs" role="tablist" aria-label="Demo mode">
            {Object.entries(modeCopy).map(([mode, copy]) => (
              <button
                aria-selected={demoMode === mode}
                className={demoMode === mode ? "selected" : ""}
                key={mode}
                onClick={() => setDemoMode(mode)}
                role="tab"
                type="button"
              >
                {copy.title}
              </button>
            ))}
          </div>

          <div className="panelHead">
            {demoMode === "wallet" ? <Wallet size={24} /> : demoMode === "trace" ? <ReceiptText size={24} /> : <Bot size={24} />}
            <div>
              <h2>{modeCopy[demoMode].heading}</h2>
              <p>{discovery ? modeCopy[demoMode].body : "Discovering seller endpoint..."}</p>
            </div>
          </div>

          {demoMode === "agent" && (
            <>
              <button className="primaryButton" onClick={requestPremiumLeadData} disabled={busy}>
                {busy && phase !== "wallet" ? <Loader2 className="spin" size={19} /> : <Play size={19} />}
                Request Premium Lead Data
              </button>

              <label className="toggleRow">
                <input type="checkbox" checked={autonomous} onChange={event => setAutonomous(event.target.checked)} />
                <span>Auto-sign sandbox USDC payment and retry</span>
              </label>

              {phase === "challenged" && (
                <button className="secondaryButton" onClick={() => signAndRetry()}>
                  <KeyRound size={18} />
                  Sign Payment And Unlock
                </button>
              )}
            </>
          )}

          {demoMode === "wallet" && (
            <div className="walletActions">
              <button className="secondaryButton" onClick={connectWallet} disabled={busy}>
                <Wallet size={18} />
                {walletAddress ? shortAddress(walletAddress) : "Connect Wallet"}
              </button>
              <button className="primaryButton" onClick={requestWithBrowserWallet} disabled={busy}>
                {phase === "wallet" ? <Loader2 className="spin" size={18} /> : <KeyRound size={18} />}
                Pay With Browser Wallet
              </button>
            </div>
          )}

          {demoMode === "trace" && (
            <div className="traceSummary">
              <div>
                <span>Discovery</span>
                <strong>{discovery?.links?.self ? "Ready" : "Loading"}</strong>
              </div>
              <div>
                <span>Challenge</span>
                <strong>{requirements?.nonce ? "Issued" : "--"}</strong>
              </div>
              <div>
                <span>Receipt</span>
                <strong>{receipt?.id ? shortValue(receipt.id) : "--"}</strong>
              </div>
            </div>
          )}

          {error && <div className="error">{error}</div>}

          <div className="metrics">
            <div>
              <span>Price</span>
              <strong>{requirements?.amount ?? "0.05"} USDC</strong>
            </div>
            <div>
              <span>Network</span>
              <strong>{requirements?.network ?? "base-sepolia"}</strong>
            </div>
            <div>
              <span>Avg fit</span>
              <strong>{totalFit || "--"}%</strong>
            </div>
          </div>
        </div>

        <div className="flowPanel">
          <Step icon={Radar} title="Discover API" detail="/.well-known/x402.json publishes the paid endpoint" active={phase === "idle"} done={Boolean(discovery)} />
          <Step icon={DatabaseZap} title="Request Protected Data" detail="Seller returns 402 instead of leads" active={phase === "requesting"} done={Boolean(requirements)} />
          <Step icon={CircleDollarSign} title="Pay Automatically" detail="Agent signs the x402 payment payload" active={phase === "signing"} done={Boolean(signature)} />
          <Step icon={ShieldCheck} title="Receive Protected Data" detail="Retry includes X-PAYMENT and unlocks leads" active={phase === "unlocking"} done={paid} />
        </div>
      </section>

      <section className="dataGrid">
        <div className="dataPanel">
          <div className="sectionHead">
            <h2>Premium Lead Data</h2>
            {paid && <CheckCircle2 size={20} />}
          </div>
          <div className="leadList">
            {leads.length ? (
              leads.map(lead => (
                <article className="lead" key={lead.id}>
                  <div>
                    <span>{lead.id}</span>
                    <h3>{lead.company}</h3>
                  </div>
                  <p>{lead.intent}</p>
                  <div className="leadMeta">
                    <strong>{lead.contact}</strong>
                    <span>{lead.budget}</span>
                    <b>{lead.fit}% fit</b>
                  </div>
                </article>
              ))
            ) : (
              <div className="emptyState">Protected data is waiting behind the payment challenge.</div>
            )}
          </div>
        </div>

        <div className="dataPanel">
          <div className="sectionHead">
            <h2>Protocol Trace</h2>
          </div>
          <ReceiptPanel receipt={receipt} />
          <pre>{JSON.stringify({ discovery: discovery?.links, requirements, receipt, signature: signature ? `${signature.slice(0, 18)}...` : "" }, null, 2)}</pre>
          <div className="log">
            {log.map(item => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
