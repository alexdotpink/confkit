# confkit

[![npm](https://img.shields.io/npm/v/confkit)](https://www.npmjs.com/package/confkit) [![license](https://img.shields.io/badge/license-MIT-blue)](https://github.com/alexdotpink/confkit/blob/main/LICENSE) ![node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)

Type‑safe config. Secure secrets. One import.

Confkit provides a tiny runtime for defining, validating, and safely exposing configuration across Node, edge, serverless, Next.js, Vite, and Expo.

## Quick Start

```ts title="conf/config.ts"
import { defineConfig, s, source } from "confkit";

export const config = defineConfig({
  sources: [source().env(), source().file("config.json")],
  schema: {
    NODE_ENV: s.enum(["development", "test", "production"]).default("development"),
    PORT: s.port().default(3000),
    DATABASE_URL: s.url(),
    PUBLIC_APP_NAME: s.string().client().default("confkit"),
    STRIPE_SECRET: s.secret(s.string()),
  },
  // Policy: enforce critical keys in production
  requiredProdKeys: ['DATABASE_URL', 'STRIPE_SECRET'],
});

// use it
const env = await config.ready();
console.log('PORT', env.PORT);
```

## CLI

```bash
confkit help
confkit check --file conf/config.ts --env production
confkit print --file conf/config.ts --no-redact
confkit dev --file conf/config.ts
confkit init
confkit explain --key FOO
confkit doctor
confkit types --out confkit-env.d.ts
confkit ws check            # run check across all workspaces
confkit ws types            # generate types in each workspace
```

## Docs

- Overview, schema, sources, expansion: see the `/docs` directory in this repo.
- Next.js, Vite, Expo integrations, and provider guides are under `/docs/integrations/*` and `/docs/providers/*`.

## Monorepo Support

- Zero‑config workspace discovery using `package.json#workspaces` (fallback to `packages/*` and `apps/*`).
- Per‑workspace CWD handling so `.env*` and relative files are resolved inside each package.
- New commands:
  - `confkit ws check` — validate every workspace that has `conf/config.(ts|js)`
  - `confkit ws types` — generate types per workspace (client or `--server`)
- Flags: `--root <path>` (override root), `--only <substring>` (filter by name), `--fail-fast`, `--server`, `--out <file>`.

Tip: Running `confkit` without `--file` searches upward for the nearest `conf/config.(ts|tsx|mjs|js)` so you can run it from subfolders.

## Notes

- `.env*` files are ignored when `NODE_ENV=production` unless `ALLOW_ENV_FILES_IN_PROD=true`.
- `toJSON({ redact: true })` masks values marked with `s.secret(...)`.
- `.client()` marks keys safe to expose; `loadConfig()` computes `clientEnv` strings for bundlers.
 - Secrets are never allowed on the client. If a secret is marked `.client()` or uses a public prefix (e.g., `PUBLIC_`), Confkit throws.
 - Use `requiredProdKeys` to require specific keys when `NODE_ENV=production`.

## Reference

- Runtime API: `packages/confkit/src/index.ts`
- Loader: `packages/confkit/src/load.ts`
- CLI: `packages/confkit/src/cli/index.ts`
