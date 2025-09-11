import { describe, it, expect, vi } from 'vitest';

vi.mock('confkit/load', () => ({
  loadConfig: async () => ({ config: { async ready() {} }, clientEnv: { PUBLIC_K: 'v' } }),
}));

import { extraFromConfkit, withConfkitExpo } from '../src/index';

describe('@confkit/expo', () => {
  it('extraFromConfkit returns clientEnv or namespaced object', async () => {
    const extra = await extraFromConfkit();
    expect(extra).toEqual({ PUBLIC_K: 'v' });
    const ns = await extraFromConfkit({ namespace: 'conf' });
    expect(ns).toEqual({ conf: { PUBLIC_K: 'v' } });
  });

  it('withConfkitExpo merges into appConfig.expo.extra with optional namespace', async () => {
    const config = await withConfkitExpo({ expo: { extra: { existing: 1 } } }, { namespace: 'conf' });
    expect(config.expo?.extra?.existing).toBe(1);
    expect(config.expo?.extra?.conf).toEqual({ PUBLIC_K: 'v' });
    const config2 = await withConfkitExpo({}, {});
    expect(config2.expo?.extra?.PUBLIC_K).toBe('v');
  });
});

