import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// Import the loader to test
import overlayLoader from '../src/overlay/loader';

function makeCtx(options: any = {}) {
  const calls: any = { emitted: [] as Error[], content: '' };
  const ctx = {
    getOptions: () => options,
    addContextDependency: vi.fn(),
    addDependency: vi.fn(),
    emitError: (e: Error) => calls.emitted.push(e),
    async: () => (err: any, code: string) => { calls.content = code; },
  } as any;
  return { ctx, calls };
}

describe('confkit-next overlay loader', () => {
  const env = { ...process.env };
  beforeEach(() => { Object.assign(process.env, env); });
  afterEach(() => { Object.assign(process.env, env); vi.restoreAllMocks(); });

  it('skips in production when devOnly default', async () => {
    Object.assign(process.env, { NODE_ENV: 'production' });
    const { ctx, calls } = makeCtx();
    await overlayLoader.call(ctx);
    expect(calls.content).toContain('export {}');
    expect(calls.emitted.length).toBe(0);
  });

  it('emits error on validation issues and returns stub', async () => {
    // Stub global eval import('confkit/load')
    const stub = {
      loadConfig: async () => ({
        config: {
          async ready() { throw Object.assign(new Error('bad'), { issues: [{ path: 'A', message: 'oops' }] }); },
        },
      }),
    };
    vi.stubGlobal('eval', ((s: string) => ({ then: (r: any) => r(stub) })) as any);

    Object.assign(process.env, { NODE_ENV: 'development' });
    const { ctx, calls } = makeCtx({ devOnly: true });
    await overlayLoader.call(ctx);
    expect(calls.content).toContain('export {}');
    expect(calls.emitted.length).toBe(1);
    expect(calls.emitted[0].message).toContain('Confkit validation failed');
    expect(calls.emitted[0].message).toContain('- A: oops');
  });
});
