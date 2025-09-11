import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync, type SpawnSyncOptions } from 'node:child_process';

function tmpdir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'confkit-cli-'));
}

function makeConfig(dir: string, schema: string, sources: string) {
  const confDir = path.join(dir, 'conf');
  fs.mkdirSync(confDir, { recursive: true });
  const file = path.join(confDir, 'config.mjs');
  const localConfkit = pathToFileURL(path.resolve(__dirname, '../dist/index.js')).href;
  const src = `
    import { defineConfig, s, source } from '${localConfkit}';
    export const config = defineConfig({
      sources: [${sources}],
      schema: ${schema}
    });
  `;
  fs.writeFileSync(file, src, 'utf8');
  return file;
}

const CLI = path.resolve(__dirname, '../dist/cli/index.cjs');

function runCli(args: string[], opts: (SpawnSyncOptions & { cwd: string })) {
  const baseEnv = { ...process.env, CI: '1', FORCE_COLOR: '0', NODE_NO_WARNINGS: '1' } as NodeJS.ProcessEnv;
  return spawnSync('node', [CLI, ...args], {
    encoding: 'utf8',
    timeout: typeof opts.timeout === 'number' ? opts.timeout : 15000,
    stdio: 'pipe',
    env: { ...baseEnv, ...(opts.env as any) },
    cwd: opts.cwd,
  });
}

describe.sequential('CLI basic commands', () => {
  it('check passes and print shows JSON', () => {
    const dir = tmpdir();
    const file = makeConfig(
      dir,
      '{ FOO: s.string(), SECRET: s.secret(s.string()) }',
      `source().inline({ FOO: 'ok', SECRET: 'abc' })`
    );
    const opts = { cwd: dir, encoding: 'utf8' as const, env: { ...process.env, ALLOW_ENV_FILES_IN_PROD: 'true' } };

    const check = runCli(['check', '--file', file], opts);
    expect(check.status).toBe(0);
    expect(check.stdout).toContain('✔ Validated');

    const print = runCli(['print', '--file', file, '--json'], opts);
    expect(print.status).toBe(0);
    const obj = JSON.parse(String(print.stdout || '{}')) as Record<string, unknown>;
    expect(obj).toEqual({ FOO: 'ok', SECRET: '•••' });
  });

  it('check fails on validation error', () => {
    const dir = tmpdir();
    const file = makeConfig(
      dir,
      '{ NUM: s.int() }',
      `source().inline({ NUM: 'not-an-int' })`
    );
    const opts = { cwd: dir, encoding: 'utf8' as const };
    const res = runCli(['check', '--file', file], opts);
    expect(res.status).toBe(1);
    expect(res.stderr || res.stdout).toContain('✖ Validation failed');
  });

  it('diff: env to env (matrix/json)', () => {
    const dir = tmpdir();
    const file = makeConfig(
      dir,
      '{ CK_VAL: s.string() }',
      `source().env()`
    );
    // Create env files to differ by NODE_ENV
    fs.writeFileSync(path.join(dir, '.env.development'), 'CK_VAL=dev\n');
    fs.writeFileSync(path.join(dir, '.env.production'), 'CK_VAL=prod\n');
    const opts = { cwd: dir, encoding: 'utf8' as const };

    const json = runCli(['diff', '--file', file, '--from-env', 'development', '--to-env', 'production', '--json'], opts);
    expect(json.status).toBe(0);
    // Ensure JSON is parseable regardless of header prefix
    const raw1 = String(json.stdout || '');
    const start1 = raw1.indexOf('{');
    JSON.parse(start1 >= 0 ? raw1.slice(start1) : '{}');

    const matrix = runCli(['diff', '--file', file, '--from-env', 'development', '--to-env', 'production', '--matrix'], opts);
    expect(matrix.status).toBe(0);
    expect(matrix.stdout).toContain('Diff (env development -> production)');
    expect(matrix.stdout).toContain('CK_VAL');
    expect(matrix.stdout).toContain('| development | production |');
  });

  it('diff: source to source (file sources)', () => {
    const dir = tmpdir();
    const left = path.join(dir, 'left.json');
    const right = path.join(dir, 'right.json');
    fs.writeFileSync(left, JSON.stringify({ A: '1', X: 'x' }));
    fs.writeFileSync(right, JSON.stringify({ A: '2', Y: 'y' }));
    const file = makeConfig(
      dir,
      '{ A: s.string(), X: s.string().optional(), Y: s.string().optional() }',
      `source().file('${left.replace(/\\/g, '\\\\')}'), source().file('${right.replace(/\\/g, '\\\\')}')`
    );
    const opts = { cwd: dir, encoding: 'utf8' as const };
    const json2 = runCli(['diff', '--file', file, '--from-source', path.basename(left), '--to-source', path.basename(right), '--json'], opts);
    expect(json2.status).toBe(0);
    const raw2 = String(json2.stdout || '');
    const start2 = raw2.indexOf('{');
    const payload2 = JSON.parse(start2 >= 0 ? raw2.slice(start2) : '{}') as { added: any[]; removed: any[]; changed: Array<{ key: string; from: string; to: string }> };
    expect(payload2.removed.find((r: any) => r.key === 'X')).toBeTruthy();
    expect(payload2.added.find((a: any) => a.key === 'Y')).toBeTruthy();
    expect(payload2.changed.find((c: any) => c.key === 'A')).toEqual({ key: 'A', from: '1', to: '2' });
  });

  it('scan: detects unknown and respects --allow', () => {
    const dir = tmpdir();
    const srcDir = path.join(dir, 'src');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(path.join(srcDir, 'index.ts'), `
      console.log(process.env.FOO); // used
      console.log(import.meta.env.BAR); // unknown (unless allowed)
    `);
    const file = makeConfig(dir, '{ FOO: s.string() }', `source().inline({ FOO: 'x' })`);
    const opts = { cwd: dir, encoding: 'utf8' as const };
    const res1 = runCli(['scan', '--file', file, '--dir', srcDir], opts);
    expect(res1.status).toBe(1);
    expect((res1.stdout || res1.stderr)).toContain('Unknown keys');
    const res2 = runCli(['scan', '--file', file, '--dir', srcDir, '--allow', 'BAR'], opts);
    expect(res2.status).toBe(0);
    expect(res2.stdout).toContain('✔ scan: code usage matches schema');
  });

  it('explain: prints source attribution for keys', () => {
    const dir = tmpdir();
    const file = makeConfig(
      dir,
      '{ A: s.string(), B: s.string() }',
      `source().inline({ A: '1' }), source().inline({ B: '2' })`
    );
    const opts = { cwd: dir, encoding: 'utf8' as const };
    const res = runCli(['explain', '--file', file], opts);
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('A');
    expect(res.stdout).toContain('inline: 1');
    expect(res.stdout).toContain('B');
    expect(res.stdout).toContain('inline: 2');
  });

  it('types: generates client module d.ts and server interface', () => {
    const dir = tmpdir();
    const file = makeConfig(
      dir,
      '{ PUBLIC_K: s.string().client(), SECRET: s.secret(s.string()) }',
      `source().inline({ PUBLIC_K: 'v', SECRET: 's' })`
    );
    const clientOut = path.join(dir, 'client-env.d.ts');
    const serverOut = path.join(dir, 'server-env.d.ts');
    const opts = { cwd: dir, encoding: 'utf8' as const };
    const res1 = runCli(['types', '--file', file, '--out', clientOut], opts);
    expect(res1.status).toBe(0);
    const d1 = fs.readFileSync(clientOut, 'utf8');
    expect(d1).toContain("declare module 'confkit:client'");
    expect(d1).toContain('PUBLIC_K: string;');

    const res2 = runCli(['types', '--file', file, '--out', serverOut, '--server'], opts);
    expect(res2.status).toBe(0);
    const d2 = fs.readFileSync(serverOut, 'utf8');
    expect(d2).toContain('export interface ConfkitEnv');
    expect(d2).toContain('"PUBLIC_K": string;');
  });

  it('init and doctor: scaffolds files and reports environment health', () => {
    const dir = tmpdir();
    const file = makeConfig(
      dir,
      '{ A: s.string() }',
      `source().inline({ A: '1' })`
    );
    const opts = { cwd: dir, encoding: 'utf8' as const, env: { ...process.env, NODE_ENV: 'development' as const } };
    const res = runCli(['init', '--file', file], { ...opts, timeout: 30000 });
    expect(res.status).toBe(0);
    expect(fs.existsSync(path.join(dir, 'conf/config.ts'))).toBe(true);
    expect(fs.existsSync(path.join(dir, '.env.example'))).toBe(true);
    expect(fs.existsSync(path.join(dir, '.github/workflows/confkit.yml'))).toBe(true);

    // Align .env.example with the schema of our --file config to avoid doctor warnings
    fs.writeFileSync(path.join(dir, '.env.example'), 'A=\n', 'utf8');

    const doctor = runCli(['doctor', '--file', file], { ...opts, timeout: 30000 });
    expect(doctor.status).toBe(0);
    expect((doctor.stdout || doctor.stderr)).toContain('Environment');
  });
});
