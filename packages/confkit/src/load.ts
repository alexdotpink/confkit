import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import crypto from 'node:crypto';
import fs from 'node:fs';

type Loaded = {
  // The runtime config API returned by defineConfig
  config: Record<PropertyKey, unknown> & {
    ready(): Promise<unknown>;
    toJSON(opts?: { redact?: boolean }): Promise<unknown>;
    pickClient(): Promise<Record<string, unknown>>;
    lintUnknowns?: () => Promise<string[]>;
    explain?: (key?: string) => Promise<Array<{ key: string; from: string; index: number; value: unknown }>>;
    describeSchema?: () => Record<string, unknown>;
  };
  clientEnv: Record<string, string>;
};

export async function loadConfig(opts: { file?: string; computeClientEnv?: boolean } = {}): Promise<Loaded> {
  let file = opts.file ?? path.resolve(process.cwd(), 'conf/config.ts');
  // If no file provided and default doesn't exist, search upwards for conf/config.(ts|tsx|mjs|js)
  if (!opts.file) {
    const exists = fs.existsSync(file);
    if (!exists) {
      const candidates = ['conf/config.ts', 'conf/config.tsx', 'conf/config.mjs', 'conf/config.js'];
      let dir = process.cwd();
      for (let i = 0; i < 8; i++) {
        for (const rel of candidates) {
          const p = path.resolve(dir, rel);
          if (fs.existsSync(p) && fs.statSync(p).isFile()) { file = p; break; }
        }
        if (fs.existsSync(file)) break;
        const up = path.dirname(dir);
        if (up === dir) break;
        dir = up;
      }
    }
  }
  const ext = path.extname(file).toLowerCase();
  let modUrl: string;

  if (ext === '.ts' || ext === '.tsx') {
    const esbuild = await import('esbuild');
    // Build a temporary ESM file to import.
    const hash = crypto.createHash('sha1').update(file + ':' + Date.now().toString()).digest('hex').slice(0, 8);
    const outFile = path.join(os.tmpdir(), `.confkit-${hash}.mjs`);
    // Prefer local workspace build of confkit when present
    function findLocalConfkitDist(): string | undefined {
      // 1) Monorepo layout: <root>/packages/confkit/dist/index.js (walk up from CWD)
      let dir = process.cwd();
      for (let i = 0; i < 6; i++) {
        const p = path.resolve(dir, 'packages/confkit/dist/index.js');
        if (fs.existsSync(p)) return p;
        const up = path.dirname(dir);
        if (up === dir) break;
        dir = up;
      }
      // 2) Node resolution: <some>/node_modules/confkit/dist/index.js (walk up from CWD)
      dir = process.cwd();
      for (let i = 0; i < 6; i++) {
        const p = path.resolve(dir, 'node_modules/confkit/dist/index.js');
        if (fs.existsSync(p)) return p;
        const up = path.dirname(dir);
        if (up === dir) break;
        dir = up;
      }
      return undefined;
    }
    const localConfkitDist = findLocalConfkitDist();
    await esbuild.build({
      entryPoints: [file],
      outfile: outFile,
      platform: 'node',
      format: 'esm',
      // Bundle to support multi-file configs without requiring ts-node.
      // Keep core packages external so we can optionally rewrite to local dist.
      bundle: true,
      external: ['confkit', '@confkit/*'],
      sourcemap: false,
      target: 'es2020',
      logLevel: 'silent',
    });
    // If in monorepo, rewrite bare specifier 'confkit' to absolute file URL
    if (localConfkitDist && fs.existsSync(localConfkitDist)) {
      const js = fs.readFileSync(outFile, 'utf8');
      const url = pathToFileURL(localConfkitDist).href;
      const patched = js
        .replace(/from\s+"confkit"/g, `from "${url}"`)
        .replace(/from\s+'confkit'/g, `from '${url}'`);
      fs.writeFileSync(outFile, patched, 'utf8');
    }
    modUrl = pathToFileURL(outFile).href;
  } else {
    modUrl = pathToFileURL(file).href;
  }

  const mod = await import(modUrl);
  const cfg = (mod.config ?? mod.default) as Loaded['config'] | undefined;
  if (!cfg || typeof cfg.ready !== 'function') {
    throw new Error(`confkit/load: expected exported 'config' from ${file}`);
  }

  // Create clientEnv: only include .client() values, coerce to string
  let clientEnv: Record<string, string> = {};
  if (opts.computeClientEnv !== false) {
    const client = await cfg.pickClient();
    for (const k of Object.keys(client)) {
      const v = (client as Record<string, unknown>)[k];
      if (v == null) continue;
      clientEnv[k] = typeof v === 'string' ? v : JSON.stringify(v);
    }
  }

  return { config: cfg, clientEnv };
}

export default loadConfig;
