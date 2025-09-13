---
"confkit": minor
---

Add first‑class monorepo DX:

- CLI: `confkit ws` commands (check/types) to discover workspaces and run per‑workspace with correct CWD
- Loader: auto‑discover nearest `conf/config.(ts|tsx|mjs|js)` when `--file` is omitted
- Docs: new Monorepo guide and CLI updates

Notes:

- Workspace discovery uses `package.json#workspaces` (array or `workspaces.packages`); falls back to `packages/*` and `apps/*`.
- `ws types` supports `--server`, `--out`, and `--only` filters; `ws check` supports `--strict` and `--fail-fast`.
