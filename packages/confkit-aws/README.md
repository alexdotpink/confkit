# @confkit/aws

[![npm](https://img.shields.io/npm/v/%40confkit%2Faws)](https://www.npmjs.com/package/@confkit/aws) [![license](https://img.shields.io/badge/license-MIT-blue)](https://github.com/alexdotpink/confkit/blob/main/LICENSE) ![node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)

AWS Secrets Manager source for Confkit.

Install:

```
pnpm add @confkit/aws
```

Usage:

```ts
import { defineConfig, s } from 'confkit';
import { awsSecretsSource } from '@confkit/aws';

export const config = defineConfig({
  sources: [awsSecretsSource({ namePrefix: '/apps/myapp/' })],
  schema: { DATABASE_URL: s.string(), STRIPE_SECRET: s.secret(s.string()) },
});
```

Options:

- `region?`, `namePrefix?`, `mapNameToKey?`, `ttlMs?`, `jitter?`, `background?`, `onRotate?`, `maxAttempts?`, `retryMode?`, `maxConcurrency?`

Reference: `packages/confkit-aws/src/index.ts:10`.

Docs: `docs/providers/aws.mdx` in this repo.
