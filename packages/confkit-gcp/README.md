# @confkit/gcp

[![npm](https://img.shields.io/npm/v/%40confkit%2Fgcp)](https://www.npmjs.com/package/@confkit/gcp) [![license](https://img.shields.io/badge/license-MIT-blue)](https://github.com/alexdotpink/confkit/blob/main/LICENSE) ![node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)

GCP Secret Manager source for Confkit.

Install:

```
pnpm add @confkit/gcp
```

Usage:

```ts
import { defineConfig, s } from 'confkit';
import { gcpSecretsSource } from '@confkit/gcp';

export const config = defineConfig({
  sources: [gcpSecretsSource({ projectId: 'my-project', namePrefix: 'myapp_' })],
  schema: { DATABASE_URL: s.string(), STRIPE_SECRET: s.secret(s.string()) },
});
```

Options: `projectId?`, `namePrefix?`, `mapNameToKey?`, `ttlMs?`, `jitter?`, `background?`, `onRotate?`, `maxConcurrency?`

Reference: `packages/confkit-gcp/src/index.ts:3`.

Docs: `docs/providers/gcp.mdx` in this repo.
