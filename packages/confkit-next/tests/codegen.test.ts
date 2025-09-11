import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { generateClientTypes } from '../src/codegen';

function tmpFile(name: string) {
  return path.join(os.tmpdir(), `confkit-${Date.now()}-${Math.random().toString(16).slice(2)}-${name}`);
}

describe('confkit-next codegen', () => {
  const env = { ...process.env };
  beforeEach(() => { Object.assign(process.env, env); });
  afterEach(() => { Object.assign(process.env, env); vi.restoreAllMocks(); });

  it('writes d.ts with client keys from confkit/load', async () => {
    const stub = {
      loadConfig: async () => ({ clientEnv: { NEXT_PUBLIC_FOO: 'x', PUBLIC_BAR: 'y' } }),
    };
    vi.stubGlobal('eval', ((s: string) => ({ then: (r: any) => r(stub) })) as any);

    const out = tmpFile('env.d.ts');
    await generateClientTypes({ outFile: out });
    const txt = fs.readFileSync(out, 'utf8');
    expect(txt).toContain('declare module "confkit:client"');
    expect(txt).toContain('declare module "@confkit/next/client"');
    expect(txt).toContain('"NEXT_PUBLIC_FOO": string;');
    expect(txt).toContain('"PUBLIC_BAR": string;');
  });

  it('respects CONFKIT_TYPES_DISABLE', async () => {
    const out = tmpFile('disabled.d.ts');
    process.env.CONFKIT_TYPES_DISABLE = '1';
    await generateClientTypes({ outFile: out });
    expect(fs.existsSync(out)).toBe(false);
  });

  it('withConfkit calls generateClientTypes with provided outFile', async () => {
    const out = tmpFile('withConfkit.d.ts');
    const stub = { loadConfig: async () => ({ clientEnv: { NEXT_PUBLIC_X: '1' } }) };
    vi.stubGlobal('eval', ((s: string) => ({ then: (r: any) => r(stub) })) as any);
    const genSpy = vi.fn().mockResolvedValue(undefined);
    vi.doMock('../src/codegen', () => ({ generateClientTypes: genSpy }), { virtual: true });
    const { withConfkit } = await import('../src/index');
    const cfg = await withConfkit({}, { typesOutFile: out });
    expect(typeof cfg).toBe('object');
    expect(genSpy).toHaveBeenCalled();
    const arg = genSpy.mock.calls.at(-1)?.[0];
    expect(arg.outFile).toBe(out);
  });
});
