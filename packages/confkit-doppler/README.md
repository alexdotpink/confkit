# @confkit/doppler

[![npm](https://img.shields.io/npm/v/%40confkit%2Fdoppler)](https://www.npmjs.com/package/@confkit/doppler) [![license](https://img.shields.io/badge/license-MIT-blue)](https://github.com/alexdotpink/confkit/blob/main/LICENSE) ![node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)

Doppler source for Confkit.

Install:

```
pnpm add @confkit/doppler
```

Usage:

```ts
import { defineConfig, s } from 'confkit';
import { dopplerSource } from '@confkit/doppler';

export const config = defineConfig({
  sources: [dopplerSource({ token: process.env.DOPPLER_TOKEN!, project: 'myproj', config: 'prod' })],
  schema: { DATABASE_URL: s.string(), STRIPE_SECRET: s.secret(s.string()) },
});
```

Options: `token`, `project?`, `config?`, `keyPrefix?`, `mapNameToKey?`, `ttlMs?`, `jitter?`, `background?`, `onRotate?`

Reference: `packages/confkit-doppler/src/index.ts:1`.

Docs: `docs/providers/doppler.mdx` in this repo.
