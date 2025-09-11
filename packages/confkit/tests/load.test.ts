import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadConfig } from '../src/load';
import { pathToFileURL } from 'node:url';

function tmpdir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'confkit-load-'));
}

const cwdBackup = process.cwd();
const envBackup = { ...process.env };

beforeEach(() => {
  Object.assign(process.env, envBackup);
});

afterEach(() => {
  process.chdir(cwdBackup);
  Object.assign(process.env, envBackup);
});

describe('loadConfig', () => {
  it('loads ESM config (no TS) and returns config + clientEnv', async () => {
    const dir = tmpdir();
    const confDir = path.join(dir, 'conf');
    fs.mkdirSync(confDir, { recursive: true });
    const file = path.join(confDir, 'config.mjs');
    const localConfkit = pathToFileURL(path.resolve(__dirname, '../dist/index.js')).href;
    const src = `
      import { defineConfig, s, source } from '${localConfkit}';
      export const config = defineConfig({
        sources: [source().inline({ SECRET: 'abc', PUBLIC_VAL: 'v' })],
        schema: { SECRET: s.secret(s.string()), PUBLIC_VAL: s.string().client() },
      });
    `;
    fs.writeFileSync(file, src, 'utf8');
    process.chdir(dir);
    Object.assign(process.env, { NODE_ENV: 'production' });

    const loaded = await loadConfig({ file });
    await expect(loaded.config.ready()).resolves.toEqual({ SECRET: 'abc', PUBLIC_VAL: 'v' });
    expect(loaded.clientEnv).toEqual({ PUBLIC_VAL: 'v' });
  });

  it('stringifies non-string client values; computeClientEnv=false skips generation', async () => {
    const dir = tmpdir();
    const confDir = path.join(dir, 'conf');
    fs.mkdirSync(confDir, { recursive: true });
    const file = path.join(confDir, 'config.mjs');
    const localConfkit = pathToFileURL(path.resolve(__dirname, '../dist/index.js')).href;
    const src = `
      import { defineConfig, s, source } from '${localConfkit}';
      export const config = defineConfig({
        sources: [source().inline({ PUBLIC_OBJ: {a:1} })],
        schema: { PUBLIC_OBJ: s.json().client() },
      });
    `;
    fs.writeFileSync(file, src, 'utf8');
    process.chdir(dir);
    const loaded = await loadConfig({ file });
    expect(loaded.clientEnv).toEqual({ PUBLIC_OBJ: '{"a":1}' });

    const loaded2 = await loadConfig({ file, computeClientEnv: false });
    expect(loaded2.clientEnv).toEqual({});
  });

  it('throws if exported config is missing', async () => {
    const dir = tmpdir();
    const confDir = path.join(dir, 'conf');
    fs.mkdirSync(confDir, { recursive: true });
    const file = path.join(confDir, 'config.mjs');
    fs.writeFileSync(file, 'export default {}', 'utf8');
    await expect(loadConfig({ file })).rejects.toThrow(/expected exported 'config'/);
  });
});
