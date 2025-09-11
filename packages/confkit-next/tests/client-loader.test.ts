import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import clientLoader from '../src/client/loader';

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

describe('confkit-next client loader', () => {
  const env = { ...process.env };
  beforeEach(() => { Object.assign(process.env, env); });
  afterEach(() => { Object.assign(process.env, env); vi.restoreAllMocks(); });

  it('emits export default with client env', async () => {
    const stub = {
      loadConfig: async () => ({
        clientEnv: { A: '1', B: 2 as any },
      }),
    };
    vi.stubGlobal('eval', ((s: string) => ({ then: (r: any) => r(stub) })) as any);

    const { ctx, calls } = makeCtx({ file: 'conf/config.ts' });
    await clientLoader.call(ctx);
    expect(calls.content).toContain('export default');
    expect(calls.content).toContain('"A":"1"');
    expect(calls.content).toContain('"B":"2"');
  });

  it('emits error and empty object on failure', async () => {
    const stub = { loadConfig: async () => { throw new Error('boom'); } };
    vi.stubGlobal('eval', ((s: string) => ({ then: (r: any) => r(stub) })) as any);
    const { ctx, calls } = makeCtx();
    await clientLoader.call(ctx);
    expect(calls.emitted.length).toBe(1);
    expect(calls.content.trim()).toBe('export default {};');
  });
});

