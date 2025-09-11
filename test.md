# Confkit Monorepo — Testing Plan

## Goals
- High confidence in core config runtime (`confkit`) with thorough unit and integration coverage.
- Validate cross-package behaviors: dynamic config loading (`load.ts`), polling (`poll.ts`), CLI flows, and Next.js overlay.
- Mock external providers (AWS, 1Password, Azure, GCP, Doppler) to validate adapters without network.
- Fast, ergonomic local dev: a single command to run all tests across workspaces with watch and coverage.

## Tooling
- Runner: Vitest (Node environment), V8 coverage.
- Monorepo integration: Turbo tasks with per-package `test` scripts and a root `test` aggregator.
- Mocking: Vitest built-ins (`vi`) for timers, modules, and globals.
- Fixtures: Temporary files/directories via `tmpdir` utilities.

## Test Levels & Scope

### 1) Unit (packages/confkit)
- Schema nodes (`s.*`): string, int, number/float, boolean, enum (with did-you-mean), url (and `origin()`), uuid, port, email, nonempty, regex, host, ip, duration (human + ISO-8601), json (with/without inner), arrayOf, recordOf, union, secret, optional, default, refine, transform.
- Redaction: deep redaction respects `s.secret(...)` across object/array/record/union shapes.
- defineConfig API:
  - `ready()` success/fail (aggregated issues with dotted paths)
  - `toJSON({redact})` correctness and masking
  - `get()` secret audit sampling (`audit.emit` called)
  - `pickClient()` behavior with `client()`, `clientPrefix(es)`, `requireClientPrefix` defaulting to prod-only enforcement
  - `describeSchema()` structural metadata
  - `lintUnknowns()` sorts and detects extra keys
  - `explain(key?)` origin attribution (source name + index)
  - cache semantics (single load, `reload()` invalidates)

### 2) Integration: Sources & Expansion (packages/confkit)
- `source.env({files})` layering (`.env`, `.env.local`, `.env.$NODE_ENV`), honoring `ALLOW_ENV_FILES_IN_PROD`.
- `source.file(path)`: JSON/YAML/TOML parsing, invalid file returns empty, parse errors swallowed.
- `source.inline()` basic.
- `combine([...]).fallbackTo(...)` precedence and metadata marker.
- Expansion engine:
  - Simple interpolation `${FOO}`; nested recursion; cycle detection error
  - Modes: default `${FOO:-bar}`, required `${FOO:?msg}`, assign to env `${FOO:=bar}` (assignMode `env`), assign to cache `${FOO:=bar}` (assignMode `cache` persists `.confkit/cache.json`), alt `${FOO:+bar}`
  - JSON helper `${FOO:json(…)}; exact whole-value vs template context
  - Interaction with numeric/boolean/string values; empty string handling

### 3) Integration: `load.ts`
- TS config file (ESM) bundled via esbuild to temp, with local workspace `confkit` rewrite, returns `{config, clientEnv}`.
- `clientEnv` stringification for non-strings.
- Error path when exported `config` missing.

### 4) Unit: `poll.ts`
- Emits `onChange` for first snapshot and subsequent differences; stable when identical.
- Backoff behavior increases up to `maxIntervalMs`, resets on change.
- Respects `signal.abort()` to stop loop.
- `webhook` POST called on change (mock `fetch`).
- `etagSupplier` short-circuits change detection when identical.

### 5) CLI (packages/confkit)
- Build once and execute `dist/cli/index.cjs` via child process within temp fixtures.
- `help` output contains key commands.
- `check` for valid/invalid schemas; unknown keys warning and `--strict` exit code.
- `print` redacted vs `--no-redact`; `--json` outputs valid JSON.
- `diff` env→env and source→source matrix and JSON modes; error handling for invalid env/source.
- `init` scaffolds expected files; idempotent behavior.
- `scan` detects unknown/unused keys with `--allow` list; exit code on unknown.
- `dev` is interactive; covered by smoke test verifying startup summary and watch paths (non-blocking run with early exit).

### 6) Next.js Overlay (packages/confkit-next)
- Loader returns stub in production (`devOnly` default true) and when valid.
- On validation error, calls `emitError` with compact diagnostics and still returns stub.
- Registers context/dependency when supported.

### 7) Providers (packages/confkit-aws, -1password, -azure, -gcp, -doppler)
- Each adapter mocked at SDK boundary to simulate listing/fetching secrets, missing tokens/regions, rotation detection, TTL/jitter scheduling, concurrency controls, and error swallowing per-item.
- Verify returned key mapping, cache behavior, and `onRotate` callback semantics.

## Coverage Targets
- `confkit` core: ≥ 95%
- Integrations (`load.ts`, `poll.ts`, CLI, overlay): ≥ 85%
- Providers: ≥ 80% with mocks
- Overall monorepo: ≥ 85%

## Execution Model
- Root scripts:
  - `bun run test` → `turbo run test`
  - `bun run test:watch` → `turbo run test:watch`
  - `bun run coverage` → `turbo run coverage`
- Per-package: `vitest` configs, Node env, TS test files under `tests/**`.

## Phased Implementation Checklist
- [x] Tooling: add Vitest, workspace config, Turbo tasks
- [x] Core unit tests: schema nodes, redaction, defineConfig API
- [x] Integration: sources and expansion modes
- [x] Integration: load.ts
- [x] Unit: poll.ts
- [x] CLI: check/print/diff/scan flows
- [x] Next overlay: error/success paths
- [x] Providers: AWS
- [ ] Providers: 1Password
- [ ] Providers: Azure
- [ ] Providers: GCP
- [ ] Providers: Doppler
- [ ] Coverage thresholds and CI hook

## Progress Log
- 1) Tooling wired: vitest, workspace config, turbo test scripts.
- 2) Added core tests under `packages/confkit/tests` covering schema nodes, redaction, defineConfig API.
- 3) Added integration tests for env/file sources, combine/fallback, expansion modes (assign/env/cache; cycles; alt), with one JSON helper test deferred.
- 4) Added `load.ts` tests using ESM configs (no TS) to avoid esbuild in unit env.
- 5) Added `poll.ts` tests with fake timers (change detection, backoff, webhook, etags, abort).
- 6) Added CLI smoke tests for `check` and `print --json` using built CLI against temp configs.
- 7) Extended CLI tests to cover `diff` (env→env and source→source) and `scan` with allowlist.
- 8) Added `@confkit/next` overlay loader tests (prod skip, dev error emission + stub).
- 9) Implemented `@confkit/aws` tests with SDK mocks (list, fallback get, TTL/rotation).

## Next Steps
- Add provider adapter tests with SDK mocks for 1Password, Azure, GCP, Doppler.
- Add coverage thresholds and CI hook (turbo task + optional GitHub Action).
- Revisit deferred JSON helper structured default test with a minimal reproduction fix or adjusted assertion.

## Notes & Risks
- File IO in tests uses tmp dirs; ensure cleanup and isolation per test.
- CLI `dev` mode is interactive; smoke-testing only to avoid long-running watchers.
- Provider SDK APIs vary by version; mock at module boundary and validate behavior, not specific shapes.
