## Summary

Describe the focused change and why it is needed.

## Safety and behavior

- [ ] This change keeps x402nano read-only and non-custodial.
- [ ] This change does not alter pricing, seller wallet, network, payment signing, or settlement behavior.
- [ ] No private key, seed phrase, wallet credential, buyer signing secret, funded-wallet information, or API token is included.
- [ ] No real payment was made while preparing or testing this change.

## Validation

- [ ] `npm ci`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] `npm audit --omit=dev`
- [ ] `git diff --check`

List any check that was not applicable and explain why.
