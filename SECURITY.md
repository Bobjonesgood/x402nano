# Security Policy

## Reporting a vulnerability

Use GitHub's private vulnerability reporting feature for this repository when available. Please do not open a public issue for a suspected vulnerability.

Include a clear description, affected component, reproduction steps that do not make a payment, and the potential impact. Allow reasonable time for investigation before public disclosure.

Never publish or attach:

- private keys or seed phrases;
- wallet credentials or buyer signing secrets;
- funded-wallet information;
- API tokens or service credentials;
- complete signed payment payloads;
- personal or confidential information.

If a secret may have been exposed, do not paste it into a report. Identify the type of secret and contact the repository owner through GitHub's private reporting channel.

## Scope

Security reports may cover the API, MCP interface, x402 challenge handling, public manifests, dependency behavior, or documentation that could cause unsafe wallet use. Testing must remain read-only, must not make a payment, and must not disrupt the live service.
