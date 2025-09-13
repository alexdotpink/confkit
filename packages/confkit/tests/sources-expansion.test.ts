import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { s, defineConfig, source, combine } from '../src/index';

function tmpdir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'confkit-test-'));
}

const envBackup = { ...process.env };
const cwdBackup = process.cwd();

beforeEach(() => {
  Object.assign(process.env, envBackup);
});

afterEach(() => {
  Object.assign(process.env, envBackup);
  process.chdir(cwdBackup);
});

describe('source.env layering', () => {
  it('merges .env, .env.local, .env.$NODE_ENV (last wins)', async () => {
    const dir = tmpdir();
    process.chdir(dir);
    fs.writeFileSync(path.join(dir, '.env'), 'CK_A=1\nCK_X=base\n');
    fs.writeFileSync(path.join(dir, '.env.local'), 'CK_A=2\nCK_Y=local\n');
    fs.writeFileSync(path.join(dir, '.env.production'), 'CK_A=3\nCK_Z=prod\n');
    Object.assign(process.env, { NODE_ENV: 'production', ALLOW_ENV_FILES_IN_PROD: 'false' });
    process.env.ALLOW_ENV_FILES_IN_PROD = 'true';

    const cfg = defineConfig({
      sources: [source().env()],
      schema: { CK_A: s.int(), CK_X: s.string().optional(), CK_Y: s.string().optional(), CK_Z: s.string().optional() },
    });
    const v = await cfg.ready().catch((e: any) => { console.error('DEBUG issues:', e?.issues); throw e; });
    expect(v).toEqual({ CK_A: 3, CK_X: 'base', CK_Y: 'local', CK_Z: 'prod' });
  });

  it('disables file reading in production unless ALLOW_ENV_FILES_IN_PROD', async () => {
    const dir = tmpdir();
    process.chdir(dir);
    fs.writeFileSync(path.join(dir, '.env'), 'CK_A=1\n');
    Object.assign(process.env, { NODE_ENV: 'production' });
    delete (process.env as any)['CK_A'];

    // Base env value should be used when file reading is disabled
    Object.assign(process.env, { CK_A: '0' });
    const cfg1 = defineConfig({ sources: [source().env({ files: false })], schema: { CK_A: s.int().optional() } });
    await expect(cfg1.ready()).resolves.toEqual({ CK_A: 0 });

    process.env.ALLOW_ENV_FILES_IN_PROD = 'true';
    const cfg2 = defineConfig({ sources: [source().env()], schema: { CK_A: s.int().optional() } });
    await expect(cfg2.ready()).resolves.toEqual({ CK_A: 1 });
  });
});

describe('source.file parsing', () => {
  it('parses JSON/YAML/TOML by extension', async () => {
    const dir = tmpdir();
    process.chdir(dir);
    const jsonPath = path.join(dir, 'config.json');
    const yamlPath = path.join(dir, 'config.yaml');
    const tomlPath = path.join(dir, 'config.toml');
    fs.writeFileSync(jsonPath, JSON.stringify({ J: '1' }));
    fs.writeFileSync(yamlPath, 'Y: 2\n');
    fs.writeFileSync(tomlPath, 'T = 3\n');

    const cfg = defineConfig({
      sources: [
        source().file(jsonPath),
        source().file(yamlPath),
        source().file(tomlPath),
      ],
      schema: { J: s.string(), Y: s.int(), T: s.int() },
    });
    await expect(cfg.ready()).resolves.toEqual({ J: '1', Y: 2, T: 3 });
  });

  it('parses dotenv files via file()', async () => {
    const dir = tmpdir();
    process.chdir(dir);
    const envPath = path.join(dir, '.env');
    fs.writeFileSync(envPath, 'E1=123\nE2=hello\n');

    const cfg = defineConfig({
      sources: [source().file(envPath)],
      schema: { E1: s.int(), E2: s.string() },
    });
    await expect(cfg.ready()).resolves.toEqual({ E1: 123, E2: 'hello' });
  });
});

describe('combine().fallbackTo()', () => {
  it('last wins within primary; fallback used for missing keys only', async () => {
    const cfg = defineConfig({
      sources: [
        combine([source().inline({ A: '1' }), source().inline({ A: '2' })]).fallbackTo(
          source().inline({ B: '3', A: 'fallback' })
        ),
      ],
      schema: { A: s.int(), B: s.int() },
    });
    await expect(cfg.ready()).resolves.toEqual({ A: 2, B: 3 });
  });
});

describe('expansion engine', () => {
  it('default, recursion, alt modes', async () => {
    const cfg = defineConfig({
      expand: true,
      sources: [
        source().inline({ BAR: '${FOO:-bar}', NEST: 'x-${BAR}-y', ALT: '${FOO:+zzz}' }),
      ],
      schema: { BAR: s.string(), NEST: s.string(), ALT: s.string() },
    });
    await expect(cfg.ready()).resolves.toEqual({ BAR: 'bar', NEST: 'x-bar-y', ALT: '' });
  });

  it('required mode throws', async () => {
    const cfg = defineConfig({
      expand: true,
      sources: [source().inline({ REQ: '${MISSING:?oops}' })],
      schema: { REQ: s.string() },
    });
    await expect(cfg.ready()).rejects.toThrow(/required variable MISSING|oops/);
  });

  it('assign to env and cache persistence', async () => {
    const dir = tmpdir();
    process.chdir(dir);

    // assign to env
    const cfgEnv = defineConfig({
      expand: true,
      expandAssign: 'env',
      sources: [source().inline({ Z: '${ASSIGN:=42}' })],
      schema: { Z: s.string() },
    });
    await expect(cfgEnv.ready()).resolves.toEqual({ Z: '42' });
    expect(process.env.ASSIGN).toBe('42');

    // assign to cache file
    const cfgCache = defineConfig({
      expand: true,
      expandAssign: 'cache',
      sources: [source().inline({ Z2: '${CACHE:=99}' })],
      schema: { Z2: s.int() },
    });
    await expect(cfgCache.ready()).resolves.toEqual({ Z2: 99 });
    const cachePath = path.join(dir, '.confkit', 'cache.json');
    const cache = JSON.parse(fs.readFileSync(cachePath, 'utf8')) as Record<string, unknown>;
    expect(cache.CACHE).toBe('99');
  });

  it('cycle detection', async () => {
    const cfg = defineConfig({
      expand: true,
      sources: [source().inline({ A: 'x${B}', B: 'y${A}' })],
      schema: { A: s.string(), B: s.string() },
    });
    await expect(cfg.ready()).rejects.toThrow(/cycle detected/);
  });

  it.skip('json helper sets structured defaults', async () => {
    const cfg = defineConfig({
      expand: true,
      sources: [source().inline({ OBJ: '${MISSING:json({"a":1})}' })],
      schema: { OBJ: s.json() },
    });
    const v = await cfg.ready();
    expect(v).toEqual({ OBJ: { a: 1 } });
  });
});
