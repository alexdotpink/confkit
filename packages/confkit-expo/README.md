# @confkit/expo

[![npm](https://img.shields.io/npm/v/%40confkit%2Fexpo)](https://www.npmjs.com/package/@confkit/expo) [![license](https://img.shields.io/badge/license-MIT-blue)](https://github.com/alexdotpink/confkit/blob/main/LICENSE) ![node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)

Expo helpers for Confkit.

Install:

```
pnpm add @confkit/expo
```

Usage (app.config.ts):

```ts
import withConfkitExpo from '@confkit/expo';

export default await withConfkitExpo({}, { file: './conf/config.ts' });
```

Or just compute `extra`:

```ts
import { extraFromConfkit } from '@confkit/expo';

export default (async () => ({ expo: { extra: await extraFromConfkit({ file: './conf/config.ts' }) } }))();
```

- `withConfkitExpo(config, { file?, namespace? })` — merges client env into `expo.extra` (optionally under a namespace)
- `extraFromConfkit({ file?, namespace? })` — returns a plain object suitable for `expo.extra`

Reference: `packages/confkit-expo/src/index.ts`.
