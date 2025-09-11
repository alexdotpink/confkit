import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { defineConfig, s, source } from '../src/index';

function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'confkit-extra-')); }

describe('defineConfig edge cases', () => {
  it('validate hook adds issues and rejects', async () => {
    const cfg = defineConfig({
      sources: [source().inline({ A: '0' })],
      schema: { A: s.int() },
      validate(env) {
        if (env.A === 0) return [{ path: 'A', message: 'zero not allowed' }];
      },
    });
    await expect(cfg.ready()).rejects.toMatchObject({ issues: [{ path: 'A', message: 'zero not allowed' }] });
  });

  it('pickClient allows non-prefixed when requireClientPrefix=false in production', async () => {
    const cfg = defineConfig({
      sources: [source().inline({ SECRET: 's', PUBLIC_VAL: 'x' })],
      schema: { SECRET: s.string().client(), PUBLIC_VAL: s.string().client() },
      requireClientPrefix: false,
    });
    (process.env as any).NODE_ENV = 'production';
    const client = await cfg.pickClient();
    expect(client).toEqual({ SECRET: 's', PUBLIC_VAL: 'x' });
  });
});

describe('sources edge cases', () => {
  it('source.file unknown extension returns empty', async () => {
    const dir = tmp();
    const p = path.join(dir, 'config.txt');
    fs.writeFileSync(p, 'A=1');
    const cfg = defineConfig({ sources: [source().file(p)], schema: { A: s.int().optional() } });
    await expect(cfg.ready()).resolves.toEqual({ A: undefined });
  });
});

describe('expansion edge cases', () => {
  it('alt mode returns alternate when var present', async () => {
    const cfg = defineConfig({
      expand: true,
      sources: [source().inline({ FOO: '1', ALT: '${FOO:+bar}', ALT2: '${MISSING:+bar}' })],
      schema: { ALT: s.string(), ALT2: s.string() },
    });
    await expect(cfg.ready()).resolves.toEqual({ ALT: 'bar', ALT2: '' });
  });
});

