# Contributing to x402nano

Thank you for helping improve x402nano.

## Before opening a change

1. Open a focused issue or describe the problem clearly in the pull request.
2. Keep changes small and avoid combining documentation, dependency, and behavior changes.
3. Do not change payment pricing, seller addresses, supported networks, wallet behavior, or production deployment settings without explicit owner approval.
4. Never use a funded wallet or make a payment while running tests.

## Local checks

From the repository root:

```powershell
npm.cmd ci
npm.cmd test
npm.cmd run build
npm.cmd audit --omit=dev
git diff --check
```

Tests and examples must not receive private keys, seed phrases, buyer signing secrets, funded-wallet credentials, or production API tokens.

## Pull requests

Explain what changed, why it changed, the security or payment impact, and the checks you ran. Keep x402nano read-only and non-custodial. Changes that could sign, send, retry, or settle a payment require separate owner approval and must not be mixed into an ordinary contribution.
