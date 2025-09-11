# @confkit/next

[![npm](https://img.shields.io/npm/v/%40confkit%2Fnext)](https://www.npmjs.com/package/@confkit/next) [![license](https://img.shields.io/badge/license-MIT-blue)](https://github.com/alexdotpink/confkit/blob/main/LICENSE) ![node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)

Next.js helpers and dev overlay integration for Confkit.

Install:

```
pnpm add @confkit/next
```

Inject client env

```js
// next.config.mjs
import { withConfkit } from '@confkit/next';
export default await withConfkit({});
```

Or with the core loader:

```js
import { loadConfig } from 'confkit/load';
const { clientEnv } = await loadConfig({ file: './conf/config.ts' });
export default { env: clientEnv };
```

Helpers

- `withConfkit(nextConfig, { file? })` – merges `env` with `clientEnv` and enables `import 'confkit:client'`
- `withConfkitDevOverlay(nextConfig, { file? })` – injects loader + runtime to surface validation in Next dev overlay
- `envFromConfkit({ file? })` – returns `clientEnv`
- `middlewareEnsureConfkit({ file?, devOnly? })` – Next middleware that validates config and returns JSON errors in dev
- `ensureConfkitDev({ file? })` – throws an annotated error if validation fails in dev

Client env module

Preferred for Next.js (works with Turbopack and Webpack):

```ts
import env from '@confkit/next/client';
console.log(env.NEXT_PUBLIC_APP_NAME);
```

You can also import the Vite‑style alias (Webpack builds only):

```ts
import env from 'confkit:client';
```

Dev overlay diagnostics (optional)

Show validation errors in the Next overlay (Webpack dev) by applying the overlay loader to a small stub module and injecting it into the client entry during development.

```js
// next.config.mjs
import path from 'node:path';

/** @type {import('next').NextConfig} */
const config = {
  webpack: (cfg, { dev }) => {
    if (dev) {
      cfg.module.rules.push({
        test: new RegExp(path.sep + '@confkit' + path.sep + 'next' + path.sep + 'dist' + path.sep + 'overlay' + path.sep + 'runtime\\.js$'),
        use: [{ loader: '@confkit/next/overlay/loader', options: { file: path.resolve(process.cwd(), 'conf/config.ts') } }],
      });
      const origEntry = cfg.entry;
      cfg.entry = async () => {
        const entries = await origEntry();
        const key = Object.keys(entries).find((k) => k === 'main-app' || k === 'pages/_app' || k === 'app');
        if (key) {
          const runtimeMod = '@confkit/next/overlay';
          const list = Array.isArray(entries[key]) ? entries[key] : [entries[key]];
          if (!list.includes(runtimeMod)) entries[key] = [runtimeMod, ...list];
        }
        return entries;
      };
    }
    return cfg;
  },
};

export default config;
```

Reference:

- Helpers: `packages/confkit-next/src/index.ts:5`
- Overlay loader: `packages/confkit-next/src/overlay/loader.ts:14`

Docs: `docs/integrations/next.mdx` in this repo.
