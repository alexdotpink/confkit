# @confkit/vite

[![npm](https://img.shields.io/npm/v/%40confkit%2Fvite)](https://www.npmjs.com/package/@confkit/vite) [![license](https://img.shields.io/badge/license-MIT-blue)](https://github.com/alexdotpink/confkit/blob/main/LICENSE) ![node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)

Vite plugin to inject safe client env and surface Confkit validation in Vite’s overlay.

Install:

```
pnpm add @confkit/vite
```

Usage:

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import confkit from '@confkit/vite';

export default defineConfig({
  plugins: [confkit({ file: './conf/config.ts' })],
});
```

What it does:

- Computes `clientEnv` via `confkit/load` and injects `define['process.env.KEY'] = JSON.stringify(value)`
- Validates on server start and on changes; pushes readable messages to the overlay

API:

- `confkitVite({ file?: string })`

Reference: `packages/confkit-vite/src/index.ts:11`.

Docs: `docs/integrations/vite.mdx` in this repo.
