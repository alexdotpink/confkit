import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { pollConfig } from '../src/poll';

describe('pollConfig', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('detects changes, backs off, and aborts', async () => {
    let state = { a: 1 } as any;
    const cfg = {
      async toJSON() { return state; },
      async reload() {},
    };
    const onChange = vi.fn();
    const ac = new AbortController();

    const p = pollConfig(cfg as any, { intervalMs: 100, backoffFactor: 2, maxIntervalMs: 1000, signal: ac.signal, onChange });

    // Tick first iteration immediately
    await vi.advanceTimersByTimeAsync(0);
    // First onChange (initial snapshot)
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith({ a: 1 }, undefined);

    // Next tick with same data → backoff to 200
    await vi.advanceTimersByTimeAsync(100);
    expect(onChange).toHaveBeenCalledTimes(1);

    // Change before the next iteration
    state = { a: 2 };
    await vi.advanceTimersByTimeAsync(100); // advance half of 200
    await vi.advanceTimersByTimeAsync(100); // the rest
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith({ a: 2 }, { a: 1 });

    // Abort and drain timers
    ac.abort();
    await vi.advanceTimersToNextTimerAsync();
    await p; // should resolve
  });

  it('webhook posts on change and respects etagSupplier', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock;

    let state = { v: 1 } as any;
    let etag = 'v1';
    const cfg = { async toJSON() { return state; } };
    const ac = new AbortController();
    const p = pollConfig(cfg as any, {
      intervalMs: 50,
      signal: ac.signal,
      webhook: { url: 'http://localhost/hook' },
      etagSupplier: () => etag,
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenLastCalledWith('http://localhost/hook', expect.objectContaining({ method: 'POST' }));

    // No change in state or etag → no webhook call
    await vi.advanceTimersByTimeAsync(50);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Etag changes even with same JSON → triggers change (interval backs off to 75ms)
    etag = 'v2';
    await vi.advanceTimersByTimeAsync(75);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    ac.abort();
    await vi.advanceTimersToNextTimerAsync();
    await p;
  });

  it('passes redact option to toJSON and does not webhook on stable etag', async () => {
    const toJSON = vi.fn().mockResolvedValue({ s: 'x' });
    const cfg = { async toJSON(opts?: any) { return toJSON(opts); } } as any;
    const fetchMock = vi.fn();
    global.fetch = fetchMock;
    const ac = new AbortController();
    const p = pollConfig(cfg, { intervalMs: 50, signal: ac.signal, redact: true, webhook: { url: 'http://hook' }, etagSupplier: () => 'same' });
    await vi.advanceTimersByTimeAsync(0);
    expect(toJSON).toHaveBeenCalledWith({ redact: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(50);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    ac.abort();
    await vi.advanceTimersToNextTimerAsync();
    await p;
  });
});
