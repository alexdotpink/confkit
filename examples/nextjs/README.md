# Next.js + Confkit Example

A complete, working Next.js (App Router) example using Confkit.

What this shows

- Typed config schema with multiple sources (env + file)
- Safe client env injection via `@confkit/next`
- Dev overlay diagnostics for validation errors
- Middleware validation in development
- Server Components and Route Handlers reading config
- Redacted server config output for debugging

Quick start

- pnpm: pnpm i && pnpm dev
- npm: npm i && npm run dev
- bun: bun i && bun dev

Open http://localhost:3000 — try editing `.env.local` or `conf/config.ts` and watch validation overlay report issues in dev.

Notes

- Do not run middleware on the Edge runtime; Confkit uses Node APIs. Route handlers and middleware in this example explicitly run on Node.
- Only keys marked `.client()` or matching the default prefixes (`PUBLIC_`, `NEXT_PUBLIC_`, `EXPO_PUBLIC_`) are injected into the client bundle.
- To simulate a validation error, set `DATABASE_URL=` to an invalid URL in `.env.local`, save, and observe the overlay + JSON errors.
