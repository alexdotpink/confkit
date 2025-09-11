import { describe, it, expect, vi } from 'vitest';

vi.mock('confkit/load', () => ({
  loadConfig: async () => ({ config: { async ready() {} }, clientEnv: { PUBLIC_K: 'v' } }),
}));

import { confkitVite } from '../src/index';

describe('@confkit/vite — confkitVite plugin', () => {
  it('config() maps clientEnv to define process.env.*', async () => {
    const p = confkitVite();
    const cfg = await p.config?.();
    expect(cfg?.define?.['process.env.PUBLIC_K']).toBe(JSON.stringify('v'));
  });

  it('resolveId/load handle virtual confkit:client module', async () => {
    const p = confkitVite();
    const id = p.resolveId?.('confkit:client');
    expect(id).toBe('\0confkit:client');
    const code = await p.load?.('\0confkit:client');
    expect(code).toContain('export default');
    const obj = Function(code + ';return default_ || (typeof module!=="undefined"?module.exports:undefined);')();
    // Fallback parse: eval module string
    expect(code).toContain('PUBLIC_K');
  });

  it('configureServer validates and emits ok, then error on failure', async () => {
    const sends: any[] = [];
    const handlers: Record<string, Function> = {};
    const server = {
      ws: { send: (payload: any) => sends.push(payload) },
      watcher: { on: (evt: string, cb: any) => { handlers[evt] = cb; } },
    } as any;
    const p = confkitVite();
    await p.configureServer?.(server);
    expect(sends.find(s => s.event === 'confkit:ok')).toBeTruthy();

    // Now mock load to throw with issues
    vi.doMock('confkit/load', () => ({
      loadConfig: async () => { throw Object.assign(new Error('bad'), { issues: [{ path: 'A', message: 'oops' }] }); },
    }));
    await handlers['all']?.();
    expect(sends.find(s => s.type === 'error')).toBeTruthy();
  });
});

