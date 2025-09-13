# confkit

## 0.2.0

### Minor Changes

- 38d6bb6: feat: support dotenv files in `source().file()`
  - `source().file()` now parses dotenv files: `.env`, `.env.local`, `.env.*`, and files ending in `.env`.
  - Docs updated to mention dotenv support for `file()`.
  - Note: unlike `source().env()`, explicitly pointing `file('.env')` loads in production as well.

## 0.1.0

### Minor Changes

- a2f3e7d: Add first‑class monorepo DX:
  - CLI: `confkit ws` commands (check/types) to discover workspaces and run per‑workspace with correct CWD
  - Loader: auto‑discover nearest `conf/config.(ts|tsx|mjs|js)` when `--file` is omitted
  - Docs: new Monorepo guide and CLI updates

  Notes:
  - Workspace discovery uses `package.json#workspaces` (array or `workspaces.packages`); falls back to `packages/*` and `apps/*`.
  - `ws types` supports `--server`, `--out`, and `--only` filters; `ws check` supports `--strict` and `--fail-fast`.

## 0.0.2

### Patch Changes

- 45e4164: typed client env and improved example env generation
