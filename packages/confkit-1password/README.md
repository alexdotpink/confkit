# @confkit/1password

[![npm](https://img.shields.io/npm/v/%40confkit%2F1password)](https://www.npmjs.com/package/@confkit/1password) [![license](https://img.shields.io/badge/license-MIT-blue)](https://github.com/alexdotpink/confkit/blob/main/LICENSE) ![node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)

1Password Connect source for Confkit.

Install:

```
pnpm add @confkit/1password
```

Usage:

```ts
import { defineConfig, s } from 'confkit';
import { onePasswordSource } from '@confkit/1password';

export const config = defineConfig({
  sources: [onePasswordSource({ vaults: ['my-vault'] })],
  schema: { STRIPE_SECRET: s.secret(s.string()) },
});
```

Options: `url?`, `token?`, `vaults`, `titlePrefix?`, `mapItemToKey?`, `fieldSelector?`, `ttlMs?`, `jitter?`, `background?`, `onRotate?`

Reference: `packages/confkit-1password/src/index.ts:3`.

Docs: `docs/providers/1password.mdx` in this repo.
