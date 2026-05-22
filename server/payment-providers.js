import crypto from "node:crypto";
import { generateJwt } from "@coinbase/cdp-sdk/auth";
import { verifyMessage } from "viem";

export function createSandboxProvider({ facilitatorSecret, canonicalPayment, walletPaymentMessage }) {
  function sign(requirements, payer) {
    return crypto
      .createHmac("sha256", facilitatorSecret)
      .update(canonicalPayment(requirements, payer))
      .digest("hex");
  }

  return {
    mode: "sandbox",
    settlement: "sandbox-simulated",
    isClientSigningAvailable: true,
    describe() {
      return {
        mode: this.mode,
        settlement: this.settlement,
        signerEndpoint: "/api/payments/sign",
        notes: "Local deterministic signing for development only. Swap to facilitator mode for real settlement."
      };
    },
    async createClientPayment({ requirements, payer }) {
      const signature = sign(requirements, payer);
      const payload = { payer, requirements, signature };

      return {
        payer,
        signature,
        encodedPayment: Buffer.from(JSON.stringify(payload)).toString("base64url")
      };
    },
    async verifyAndSettle({ payment, requirements, payer }) {
      if (payment.signatureType === "browser-wallet") {
        const message = payment.message ?? walletPaymentMessage(requirements, payer);
        const valid = await verifyMessage({
          address: payer,
          message,
          signature: payment.signature
        });

        if (!valid) {
          return { ok: false, reason: "Browser wallet signature failed verification." };
        }

        return {
          ok: true,
          settlement: {
            mode: "browser-wallet-sandbox",
            transaction: `wallet-sandbox:${crypto.randomUUID()}`
          }
        };
      }

      const expected = sign(requirements, payer);
      const signature = payment.signature ?? "";

      if (Buffer.byteLength(signature) !== Buffer.byteLength(expected)) {
        return { ok: false, reason: "Payment signature has an invalid length." };
      }

      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
        return { ok: false, reason: "Payment signature failed sandbox verification." };
      }

      return {
        ok: true,
        settlement: {
          mode: this.settlement,
          transaction: `sandbox:${crypto.randomUUID()}`
        }
      };
    }
  };
}

export function createFacilitatorProvider({ facilitatorUrl, facilitatorApiKey, cdpApiKeyId, cdpApiKeySecret }) {
  const baseUrl = facilitatorUrl?.replace(/\/$/, "");
  const cdpAuthConfigured = Boolean(cdpApiKeyId && cdpApiKeySecret);

  async function authHeaders(path) {
    if (!baseUrl) return {};

    if (cdpAuthConfigured) {
      const facilitator = new URL(`${baseUrl}${path}`);
      const token = await generateJwt({
        apiKeyId: cdpApiKeyId,
        apiKeySecret: cdpApiKeySecret,
        requestMethod: "POST",
        requestHost: facilitator.host,
        requestPath: facilitator.pathname
      });

      return { Authorization: `Bearer ${token}` };
    }

    return facilitatorApiKey ? { Authorization: `Bearer ${facilitatorApiKey}` } : {};
  }

  async function facilitatorPost(path, body) {
    if (!baseUrl) {
      return {
        ok: false,
        reason: "X402_FACILITATOR_URL is required when X402_PAYMENT_MODE=facilitator."
      };
    }

    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeaders(path))
      },
      body: JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        ok: false,
        reason: data.error ?? data.reason ?? `Facilitator ${path} returned ${response.status}.`,
        data
      };
    }

    return { ok: true, data };
  }

  function accepted(data) {
    return data.isValid === true || data.valid === true || data.success === true || data.status === "valid" || data.status === "settled";
  }

  return {
    mode: "facilitator",
    settlement: "facilitator-onchain",
    isClientSigningAvailable: false,
    describe() {
      return {
        mode: this.mode,
        settlement: this.settlement,
        facilitatorUrl: baseUrl ?? null,
        verifyEndpoint: baseUrl ? `${baseUrl}/verify` : null,
        settleEndpoint: baseUrl ? `${baseUrl}/settle` : null,
        authMode: cdpAuthConfigured ? "cdp-jwt" : facilitatorApiKey ? "bearer-token" : "none",
        notes: "Client must provide a real x402 payment payload in X-PAYMENT. The server delegates verification and settlement to the facilitator."
      };
    },
    async createClientPayment() {
      return {
        ok: false,
        statusCode: 501,
        reason: "Sandbox signer is disabled in facilitator mode. Use a wallet or x402 client to create the X-PAYMENT payload."
      };
    },
    async verifyAndSettle({ payment, requirements }) {
      const body = {
        x402Version: payment.x402Version ?? 2,
        paymentPayload: payment,
        paymentRequirements: requirements
      };

      const verification = await facilitatorPost("/verify", body);
      if (!verification.ok) return verification;
      if (!accepted(verification.data)) {
        return {
          ok: false,
          reason: verification.data.reason ?? "Facilitator rejected payment verification.",
          data: verification.data
        };
      }

      const settlement = await facilitatorPost("/settle", body);
      if (!settlement.ok) return settlement;
      if (!accepted(settlement.data)) {
        return {
          ok: false,
          reason: settlement.data.reason ?? "Facilitator rejected payment settlement.",
          data: settlement.data
        };
      }

      return {
        ok: true,
        settlement: {
          mode: this.settlement,
          facilitator: baseUrl,
          verification: verification.data,
          settlement: settlement.data,
          transaction:
            settlement.data.transactionHash ??
            settlement.data.txHash ??
            settlement.data.txId ??
            settlement.data.transaction ??
            null
        }
      };
    }
  };
}
