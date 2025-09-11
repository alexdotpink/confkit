import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { dopplerSource } from '../src/index';

describe('@confkit/doppler — dopplerSource', () => {
  const realFetch = global.fetch;
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); global.fetch = realFetch as any; vi.restoreAllMocks(); });

  it('fetches secrets via Doppler API and filters by prefix; rotation via ETag', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, headers: new Headers({ etag: 'v1' }), json: async () => ({ A: '1', API_KEY: 'k-1' }) })
      .mockResolvedValueOnce({ ok: true, headers: new Headers({ etag: 'v2' }), json: async () => ({ A: '1', API_KEY: 'k-2' }) });
    global.fetch = mockFetch;

    const src = dopplerSource({ token: 't', keyPrefix: 'API_', ttlMs: 10, jitter: 0, background: false, onRotate: vi.fn() });
    vi.setSystemTime(0);
    const first = await src();
    expect(first).toEqual({ API_KEY: 'k-1' });
    vi.setSystemTime(20);
    const second = await src();
    expect(second.API_KEY).toBe('k-2');
  });
});
