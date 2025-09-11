# @confkit/azure

[![npm](https://img.shields.io/npm/v/%40confkit%2Fazure)](https://www.npmjs.com/package/@confkit/azure) [![license](https://img.shields.io/badge/license-MIT-blue)](https://github.com/alexdotpink/confkit/blob/main/LICENSE) ![node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)

Azure Key Vault source for Confkit.

Install:

```
pnpm add @confkit/azure
```

Usage:

```ts
import { defineConfig, s } from 'confkit';
import { azureKeyVaultSource } from '@confkit/azure';

export const config = defineConfig({
  sources: [azureKeyVaultSource({ vaultUrl: 'https://my-vault.vault.azure.net' })],
  schema: { DATABASE_URL: s.string(), STRIPE_SECRET: s.secret(s.string()) },
});
```

Options: `vaultUrl`, `credential?`, `namePrefix?`, `mapNameToKey?`, `ttlMs?`, `jitter?`, `background?`, `onRotate?`, `maxConcurrency?`

Reference: `packages/confkit-azure/src/index.ts:4`.

Docs: `docs/providers/azure.mdx` in this repo.
