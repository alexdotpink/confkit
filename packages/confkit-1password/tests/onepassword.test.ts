import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@1password/connect', () => {
  return {
    OnePasswordConnect: ({ serverURL, token }: any) => {
      return {
        async listItems(vault: string) {
          return [
            { id: 'id1', title: 'DB Password' },
            { id: 'id2', title: 'API Key' },
          ];
        },
        async getItem(vault: string, id: string) {
          const phase = (globalThis as any).__opPhase || 1;
          if (id === 'id1') return { id, title: 'DB Password', vault: { id: vault }, version: '1', fields: [{ purpose: 'password', value: 'p@ss' }] };
          if (id === 'id2') return { id, title: 'API Key', vault: { id: vault }, version: phase === 1 ? '42' : '43', fields: [{ label: 'token', value: phase === 1 ? 'k-1' : 'k-2' }] };
          return { id, title: 'Unknown', vault: { id: vault }, fields: [] };
        },
      };
    },
  };
});

import { onePasswordSource } from '../src/index';

describe('@confkit/1password — onePasswordSource', () => {
  const env = { ...process.env };
  beforeEach(() => { Object.assign(process.env, env); vi.useFakeTimers(); });
  afterEach(() => { Object.assign(process.env, env); vi.useRealTimers(); vi.restoreAllMocks(); });

  it('requires token and vaults', () => {
    expect(() => onePasswordSource({ token: '', vaults: [] as any })).toThrow(/token missing/);
    expect(() => onePasswordSource({ token: 't', vaults: [] })).toThrow(/at least one vault/);
  });

  it('fetches items and maps fields; detects rotation', async () => {
    const src = onePasswordSource({ token: 't', vaults: ['v1'], ttlMs: 10, jitter: 0, background: false, onRotate: vi.fn() });
    (globalThis as any).__opPhase = 1;
    vi.setSystemTime(0);
    const first = await src();
    expect(first).toEqual({ DB_PASSWORD: 'p@ss', API_KEY: 'k-1' });

    // Switch phase and advance time to force refresh
    (globalThis as any).__opPhase = 2;
    vi.setSystemTime(20);
    const second = await src();
    expect(second.API_KEY).toBe('k-2');
  });
});
