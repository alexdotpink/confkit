# Project Blueprint — **confkit** (aka “typed-config/secrets for TS”)

> Tagline: **“Type-safe config. Secure secrets. One import.”**

## 0) Goals & non-goals

**Goals**

- End-to-end types from a single source of truth.
- Works everywhere (Node, Bun, edge, serverless, Expo).
- Merge from multiple sources: `process.env`, `.env*`, JSON/TOML/YAML, `.env.vault`, cloud secret stores (AWS/GCP/Azure), local `.secrets/`.
- Runtime validation without heavy deps; tiny core.
- Safe client exposure (explicit allowlist + redaction).
- DX that feels like `tRPC`/`better-auth`.

**Non-goals**

- Not a general schema library.
- Not a full secrets backend (we integrate with them).

---

## 1) Core API (DX first)

### 1.1 Define your schema

```ts
// conf/config.ts
import { defineConfig, s, source } from "confkit";

export const config = defineConfig({
  // Where to read from (ordered merge)
  sources: [
    source.env(), // process.env + .env* (dev only)
    source.file("config.json"), // JSON/TOML/YAML auto-detected
    source.secrets.aws({ prefix: "/myapp" }), // AWS Secrets Manager (prod)
  ],

  // Typed schema (built-in primitives + refinements)
  schema: {
    NODE_ENV: s
      .enum(["development", "test", "production"] as const)
      .default("development"),

    PORT: s.int().min(1024).max(65535).default(3000),

    DATABASE_URL: s.url(), // required by default
    REDIS_URL: s.string().optional(),

    // Feature flags: typed & versioned
    FEATURES: s.object({
      newCheckout: s.boolean().default(false),
      abTestVariant: s.enum(["A", "B"]).default("A"),
    }),

    // Secrets are tracked & redacted in logs
    STRIPE_SECRET: s.secret(s.string()),
    PUBLIC_APP_NAME: s.string().client(), // whitelisted to client
  },

  // Environment-aware overrides (optional)
  environments: {
    production: { PORT: 8080 },
  },

  // Validation & transform hooks
  hooks: {
    beforeValidate: (raw) => raw,
    afterValidate: (cfg) => cfg,
  },
});
```

### 1.2 Use it in code

```ts
import { config } from "./conf/config";

config.PORT; // number (typed)
config.DATABASE_URL; // URL string
config.FEATURES.newCheckout; // boolean

// Client exposure (server → client)
export const publicRuntime = config.pickClient(); // { PUBLIC_APP_NAME: string }

// Redacted logging
console.log(config.toJSON({ redact: true }));
```

### 1.3 Next.js / Expo integration

**Next.js (server & client)**

```ts
// next.config.mjs
import { loadConfig } from "confkit/load";
const { clientEnv } = await loadConfig({ file: "./conf/config.ts" });

export default {
  env: clientEnv, // inject only allowed client keys (PUBLIC_*)
};
```

**Expo**

```ts
// app.config.ts
import { loadConfig } from "confkit/load";
const { clientEnv } = await loadConfig();

export default {
  expo: { extra: clientEnv },
};
```

---

## 2) Schema language (tiny, focused)

**Primitives**

- `s.string()`, `s.int()`, `s.float()`, `s.boolean()`, `s.enum([...])`, `s.url()`, `s.email()`, `s.port()`
- `s.object({...})`, `s.array(T)`, `s.record(T)`, `s.union([A, B])`
- `.default(v)`, `.optional()`, `.nullable()`, `.transform(fn)`, `.refine(predicate, message)`
- `s.secret(inner)` marks values as secrets (affects logging/redaction/telemetry)
- `.client()` marks a key as safe for client exposure (or enforce prefix rule like `PUBLIC_`)

**Type inference**

- Full TS inference (no generics at callsite).
- Narrowed enums & literals flow into app types.

**Why not Zod?**

- Smaller runtime, purpose-built helpers (url/port/secret/client).
- Zero dependency core (only `whatwg-url` polyfill where needed).
- Edge-safe (no Node built-ins by default).

---

## 3) Sources & layering

**Built-in sources**

- `source.env({ files?: boolean })` → `process.env` + `.env`, `.env.local`, `.env.production` (only load files in non-prod by default)
- `source.file("config.(json|yaml|yml|toml)")` → automatic parser
- `source.packageJson({ key: "confkit" })`
- `source.inline(obj)` → programmatic overrides
- `source.secrets.*`:
  - `aws({ prefix })`, `gcp({ project, prefix })`, `azure({ vault })`
  - `doppler({ project, config })`, `1password({ vault, item })`
  - `r2/s3` read (for simple keyfiles)

- Resolution: **left→right override** (last source wins). Environment overlays apply after sources.

**Expansion & casting**

- `${VAR}` expansion (opt-in), with cycle detection.
- String → typed coercion (e.g., `"true"` → `boolean`, `"1234"` → `int`).

---

## 4) Safety & prod defaults

- **Fail-fast** on missing required values in prod.
- **Deny .env file loading in prod** (unless `ALLOW_ENV_FILES_IN_PROD=true`).
- **Explicit client allowlist**: `.client()` (or prefix rule) required.
- **Redaction**: `toJSON({ redact: true })` masks `s.secret` values; `mask: "•••"` configurable.
- **Audit** (optional): emit structured events when secrets are read (for compliance).

---

## 5) CLI (zero-friction)

```bash
# Initialize
npx confkit init            # creates conf/config.ts with a template

# Check (CI-friendly)
npx confkit check           # loads sources, validates schema, prints summary

# Print (for debugging; secrets redacted by default)
npx confkit print --env production

# Generate client env (Next/Expo)
npx confkit generate --client > .confkit/client.json
```

Output example (redacted):

```
✔ Loaded 3 sources (env, file:config.yaml, aws:/myapp)
✔ Validated 12 keys (0 missing, 0 invalid)
◼ STRIPE_SECRET=••••••••••••••••••••
  PUBLIC_APP_NAME="confkit"
```

---

## 6) Implementation plan (MVP → v1)

### MVP (1–2 weeks)

- `defineConfig`, `s.*` primitives: `string/int/boolean/enum/object/url`
- Sources: `env()` + `file()` (json/yaml/toml)
- Validation, defaults, `.optional()`, `.client()`, `s.secret()`
- Redaction + `toJSON()`
- Next.js & Node examples
- CLI: `check`, `print`
- 100% ESM, tree-shakable, edge-compatible; <10kb gz core

### v1

- Cloud secret providers (AWS first), expansion `${VAR}`
- `.transform()`, `.refine()`, `.union()`, `.array()`, `.record()`
- Type-narrowed enums/literals goodness
- Expo integration, Bun example
- Watch mode for local dev (`confkit dev`)
- Docs site + logo + cookbook

### v1.x (sponsorable features)

- Audit/telemetry plugin (opt-in)
- Remote config polling with ETag backoff
- Secret rotation helpers (`onRotate(key, fn)`)
- `confkit/next` plugin to inject to `publicRuntimeConfig`
- `confkit/adapters/prisma`, `drizzle`, `eventing`

---

## 7) Example: ergonomic DX in real apps

**Next.js (App Router)**

```ts
// app/api/checkout/route.ts
import { config } from "@/conf/config";
import Stripe from "stripe";

export async function POST() {
  const stripe = new Stripe(config.STRIPE_SECRET, { apiVersion: "2024-06-20" });
  // ...
}
```

**Edge runtime**

```ts
// edge/handler.ts
import { config } from "../conf/config";

export default async function handler(req: Request) {
  if (config.FEATURES.newCheckout) {
    /* ... */
  }
  return new Response("ok");
}
```

**Client (safe keys only)**

```ts
import { publicRuntime } from "@/conf/config";
document.title = publicRuntime.PUBLIC_APP_NAME;
```

---

## 8) Internal architecture (keep it tiny)

- **Core**: AST-like schema nodes with `coerce()`, `validate()`, `infer<T>()`.
- **Parser**: source adapters returning a flat `Record<string,string>`.
- **Resolver**: layered merge → coercion → validation → final typed object.
- **Secrets**: tag via symbol metadata `kSecret` for redaction/telemetry.
- **Client picking**: compile a new object from keys tagged `.client()` (or `PUBLIC_`).

File layout:

```
packages/
  confkit/
    src/
      index.ts
      schema/
        base.ts primitives.ts object.ts union.ts
      sources/
        env.ts file.ts aws.ts ...
      core/
        resolve.ts validate.ts redact.ts types.ts
      cli/
        index.ts commands/*.ts
    tests/
    package.json
  confkit-next/
  confkit-expo/
examples/
  nextjs/
  node/
  bun/
```

---

## 9) Testing strategy

- Unit tests for every primitive & edge cases (coercion/limits).
- E2E fixtures that simulate env layering.
- Contract tests per source (AWS mocked).
- Type tests with `tsd` to enforce inference.

---

## 10) Security posture

- Never write secrets to disk or logs (unless `--unsafe`).
- In prod, refuse `.env*` unless explicitly allowed.
- Document “**twelve-factor safe**” patterns; provide CI `confkit check`.

---

## 11) Branding & launch

**Names**: confkit
**Visual**: tbd
**Launch kit**:

- README with 60-second “wow” example.
- Recipes: Next.js, Expo, Fastify, Remix, Cloudflare Workers.
- Bench vs dotenv + zod (size, speed).
- Tweet thread + HN + Product Hunt.
- GitHub Sponsors tiers (logo in README, “confkit Verified” badge for sponsors using the adapter).

---

## 12) Tiny core implementation (starter)

> Drop this in `packages/confkit/src/index.ts` to kickstart.

```ts
// Minimal skeleton (not production ready; for bootstrap)
type Issue = { path: string; message: string };
type Result<T> = { ok: true; value: T } | { ok: false; issues: Issue[] };

interface Node<T> {
  coerce(raw: unknown): Result<T>;
  _meta?: { secret?: boolean; client?: boolean };
}

export const s = {
  string(): Node<string> {
    return {
      coerce: (x) =>
        typeof x === "string"
          ? { ok: true, value: x }
          : { ok: false, issues: [{ path: "", message: "Expected string" }] },
    };
  },
  int() {
    return {
      coerce: (x) => {
        const n = typeof x === "number" ? x : Number(x);
        return Number.isInteger(n)
          ? { ok: true, value: n }
          : { ok: false, issues: [{ path: "", message: "Expected int" }] };
      },
    } as Node<number>;
  },
  boolean() {
    return {
      coerce: (x) => {
        if (typeof x === "boolean") return { ok: true, value: x };
        if (x === "true") return { ok: true, value: true };
        if (x === "false") return { ok: true, value: false };
        return {
          ok: false,
          issues: [{ path: "", message: "Expected boolean" }],
        };
      },
    } as Node<boolean>;
  },
  enum<const T extends readonly string[]>(vals: T) {
    return {
      coerce: (x) =>
        vals.includes(String(x) as any)
          ? { ok: true, value: String(x) as T[number] }
          : {
              ok: false,
              issues: [
                { path: "", message: `Expected one of ${vals.join(", ")}` },
              ],
            },
    } as Node<T[number]>;
  },
  object<S extends Record<string, Node<any>>>(shape: S) {
    return {
      coerce: (x) => {
        if (typeof x !== "object" || !x)
          return {
            ok: false,
            issues: [{ path: "", message: "Expected object" }],
          };
        const out: any = {};
        const issues: Issue[] = [];
        for (const k in shape) {
          const r = shape[k].coerce((x as any)[k]);
          if (r.ok) out[k] = r.value;
          else
            issues.push(
              ...r.issues.map((i) => ({
                path: `${k}${i.path ? "." + i.path : ""}`,
                message: i.message,
              }))
            );
        }
        return issues.length ? { ok: false, issues } : { ok: true, value: out };
      },
    } as Node<{ [K in keyof S]: S[K] extends Node<infer U> ? U : never }>;
  },
  secret<T>(node: Node<T>) {
    node._meta = { ...(node._meta || {}), secret: true };
    return node;
  },
};
type Sources = Array<() => Promise<Record<string, string>>>;

export function source() {
  return {
    env(): () => Promise<Record<string, string>> {
      return async () => ({ ...process.env }) as any;
    },
    file(_path: string): () => Promise<Record<string, string>> {
      // stub: parse json/yaml/toml by extension
      return async () => ({});
    },
  };
}

export function defineConfig<T extends Record<string, Node<any>>>(opts: {
  sources: Sources;
  schema: T;
}) {
  async function loadRaw() {
    const layers = await Promise.all(opts.sources.map((s) => s()));
    return Object.assign({}, ...layers);
  }
  function redact(obj: any, schema: any) {
    const out: any = {};
    for (const k in schema) {
      const n = schema[k] as Node<any>;
      if (n._meta?.secret) out[k] = "•••";
      else out[k] = obj[k];
    }
    return out;
  }
  async function load() {
    const raw = await loadRaw();
    const asObj: any = {};
    const issues: Issue[] = [];
    for (const k in opts.schema) {
      const val = raw[k];
      const r = opts.schema[k].coerce(val);
      if (r.ok) asObj[k] = r.value;
      else
        issues.push(...r.issues.map((i) => ({ path: k, message: i.message })));
    }
    if (issues.length) {
      const err = new Error("confkit validation error");
      (err as any).issues = issues;
      throw err;
    }
    return asObj as { [K in keyof T]: T[K] extends Node<infer U> ? U : never };
  }
  const api = {
    async ready() {
      return load();
    },
    async toJSON({ redact: doRedact = false } = {}) {
      const v = await load();
      return doRedact ? redact(v, opts.schema) : v;
    },
    pickClient() {
      /* implement when .client() exists */ return {};
    },
  };
  return new Proxy(api as any, {
    get(target, prop) {
      if (prop in target) return (target as any)[prop];
      // lazy getter for direct property access
      throw new Error(
        `Access "${String(prop)}" before await config.ready() in MVP.`
      );
    },
  });
}
```

This skeleton is just to get you moving; we’ll replace stubs (file parsing, `.client()`, better errors) as we iterate.

---

## 13) Monetization & sponsorship path

- **OSS Core** (MIT): schema, sources, CLI.
- **Adapters Pack** (sponsorware): managed providers (AWS/GCP/Azure/1Password/Doppler), audit plugin, remote polling.
- **confkit Cloud (optional later)**: tiny dashboard to manage client allowlist, rotate secrets, push configs → **\$5–\$29/mo** tier; company sponsors get logo + adapters access.

---

If you want, I can spin up:

1. a **repo scaffold** (pnpm workspaces, `packages/confkit`, examples),
2. a **first-pass schema/runtime** with tests,
3. **Next.js + Expo examples**, and
4. a crisp **README** ready for GitHub.

Which piece do you want me to deliver first?
