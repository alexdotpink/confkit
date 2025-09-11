# confkit

Type‑safe config. Secure secrets. One import.

Confkit is a tiny runtime for defining, validating, and safely exposing configuration and secrets across Node, edge, serverless, Next.js, Vite, and Expo.

- End‑to‑end types from a single source of truth
- Multiple sources (env, files, cloud secret stores) with clear layering
- Runtime validation and deep redaction of secrets
- Explicit client exposure for public values
- Friendly CLI and framework plugins

## Documentation

- Overview: `docs/overview.mdx`
- Quick Start: `docs/quickstart.mdx`
- Schema: `docs/schema.mdx`
- Sources & Layering: `docs/sources.mdx`
- Variable Expansion: `docs/expansion.mdx`
- CLI: `docs/cli.mdx`
- Integrations: `docs/integrations/*`
- Providers: `docs/providers/*`
- Recipes: `docs/recipes.mdx`

## Install

```bash
pnpm add confkit
# optional
pnpm add @confkit/next @confkit/vite @confkit/expo @confkit/aws @confkit/gcp @confkit/azure @confkit/doppler @confkit/1password
```

## 60‑second Quick Start

```ts title="conf/config.ts"
import { defineConfig, s, source } from 'confkit';

export const config = defineConfig({
  sources: [source().env(), source().file('config.json')],
  schema: {
    NODE_ENV: s.enum(['development','test','production']).default('development'),
    PORT: s.port().default(3000),
    DATABASE_URL: s.url(),
    PUBLIC_APP_NAME: s.string().client().default('confkit'),
    STRIPE_SECRET: s.secret(s.string()),
  },
});
```

```ts title="server.ts"
import { config } from './conf/config';
const env = await config.ready();
console.log('Listening on', env.PORT);
```

## Framework Integrations

- Next.js: `docs/integrations/next.mdx`
- Vite: `docs/integrations/vite.mdx`
- Expo: `docs/integrations/expo.mdx`

## CLI

```bash
npx confkit help
npx confkit check --file conf/config.ts --env production
npx confkit print --file conf/config.ts --json
npx confkit dev --file conf/config.ts
npx confkit init
npx confkit explain --key FOO
npx confkit doctor
npx confkit types --out confkit-env.d.ts
```

## Contributing

PRs welcome! Useful entry points:

- Core runtime: `packages/confkit/src/index.ts`
- Loader: `packages/confkit/src/load.ts`
- CLI: `packages/confkit/src/cli/index.ts`
- Next: `packages/confkit-next/src`
- Vite: `packages/confkit-vite/src/index.ts`

## License

MIT
