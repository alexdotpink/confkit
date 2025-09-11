import path from 'node:path';
import { NextConfig } from 'next';

export type WithConfkitOptions = {
  file?: string;
};

async function loadClientEnv(file?: string) {
  const { loadConfig } = await (0, eval)("import('confkit/load')");
  const { clientEnv } = await loadConfig({ file });
  return clientEnv as Record<string, string>;
}

export async function withConfkit(nextConfig: NextConfig = {}, opts: WithConfkitOptions = {}): Promise<NextConfig> {
  const clientEnv = await loadClientEnv(opts.file);
  const baseEnv: Record<string, string> = {};
  const existing = nextConfig.env ?? {};
  for (const k of Object.keys(existing)) {
    const v = (existing as Record<string, unknown>)[k];
    if (typeof v === 'string') baseEnv[k] = v;
    else if (v != null) baseEnv[k] = JSON.stringify(v);
  }
  const envMerged: Record<string, string> = { ...baseEnv, ...clientEnv };
  const withEnv = { ...nextConfig, env: envMerged } as NextConfig;
  return attachConfkitClientVirtual(withEnv, { file: opts.file });
}

export async function envFromConfkit(opts: WithConfkitOptions = {}) {
  return loadClientEnv(opts.file);
}

export async function middlewareEnsureConfkit(opts: { file?: string; devOnly?: boolean } = {}) {
  // Next middleware runs on the Edge runtime (no Node APIs). Avoid doing anything there.
  if (typeof (globalThis as any).EdgeRuntime === 'string') {
    return undefined as unknown as Response | undefined;
  }
  try {
    const { loadConfig } = await (0, eval)("import('confkit/load')");
    const { config } = await loadConfig({ file: opts.file });
    await config.ready();
    return undefined as unknown as Response | undefined;
  } catch (err) {
    if (opts.devOnly === false) {
      return new Response('Configuration error', { status: 500 });
    }
    const body = JSON.stringify({ error: 'confkit validation error', issues: (err as { issues?: unknown }).issues ?? [] }, null, 2);
    return new Response(body, { status: 500, headers: { 'content-type': 'application/json' } });
  }
}

export async function ensureConfkitDev(opts: { file?: string } = {}) {
  if (process.env.NODE_ENV === 'production') return;
  const { loadConfig } = await (0, eval)("import('confkit/load')");
  const { config } = await loadConfig({ file: opts.file });
  try { await config.ready(); } catch (err) {
    const issues = (err as { issues?: Array<{ path: string; message: string }> }).issues ?? [];
    const msg = 'confkit validation failed\n' + issues.map(i=>`- ${i.path}: ${i.message}`).join('\n');
    throw new Error(msg);
  }
}

export function withConfkitDevOverlay(nextConfig: NextConfig = {}, opts: { file?: string } = {}): NextConfig {
  const config: NextConfig = { ...nextConfig };
  const origWebpack = (nextConfig as any).webpack;
  (config as any).webpack = function webpack(cfg: any, ctx: { dev: boolean }) {
    const out = typeof origWebpack === 'function' ? origWebpack(cfg, ctx) : cfg;
    // Always attach the virtual client env module so `import 'confkit:client'` works
    attachWebpackBitsForVirtual(out, { file: opts.file });
    if (ctx?.dev) {
      out.module = out.module || { rules: [] };
      out.module.rules = out.module.rules || [];
      out.module.rules.push({
        test: new RegExp(path.sep + '@confkit' + path.sep + 'next' + path.sep + 'dist' + path.sep + 'overlay' + path.sep + 'runtime\\.js$'),
        use: [{ loader: '@confkit/next/overlay/loader', options: { file: opts.file ? path.resolve(process.cwd(), opts.file) : undefined } }],
      });
      const origEntry = out.entry;
      out.entry = async () => {
        const entries = await (typeof origEntry === 'function' ? origEntry() : origEntry);
        const key = Object.keys(entries).find((k) => k === 'main-app' || k === 'pages/_app' || k === 'app');
        if (key) {
          const runtimeMod = '@confkit/next/overlay';
          const list = Array.isArray(entries[key]) ? entries[key] : [entries[key]];
          if (!list.includes(runtimeMod)) entries[key] = [runtimeMod, ...list];
        }
        return entries;
      };
    }
    return out;
  };
  return config;
}

function basicClientEnv(prefixes = ['PUBLIC_', 'NEXT_PUBLIC_', 'EXPO_PUBLIC_']): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (typeof v === 'string' && prefixes.some((p) => k.startsWith(p))) out[k] = v;
  }
  return out;
}

export function defineNextConfig(opts: { file?: string; overlay?: boolean; ensure?: boolean } = {}): NextConfig | Promise<NextConfig> {
  const file = opts.file;
  const enableOverlay = opts.overlay === true; // default off for fast dev
  const base: NextConfig = {};
  const overlayWrapped = enableOverlay ? withConfkitDevOverlay(base, { file }) : attachConfkitClientVirtual(base, { file });

  const isProd = process.env.NODE_ENV === 'production' || process.env.NEXT_PHASE === 'phase-production-build';
  if (isProd) {
    return withConfkit(overlayWrapped, { file });
  }
  if (opts.ensure) {
    return withConfkit(overlayWrapped, { file });
  }
  const fastEnv = basicClientEnv();
  const merged = { ...overlayWrapped, env: { ...(overlayWrapped.env || {}), ...fastEnv } } as NextConfig;
  return merged;
}

// --- internal helpers ---

function attachWebpackBitsForVirtual(out: any, opts: { file?: string } = {}) {
  out.resolve = out.resolve || {};
  out.resolve.alias = Object.assign({}, out.resolve.alias || {}, {
    // Resolve the virtual specifier to our stub runtime module
    'confkit:client$': '@confkit/next/client',
  });
  out.module = out.module || { rules: [] };
  out.module.rules = out.module.rules || [];
  out.module.rules.push({
    test: new RegExp(path.sep + '@confkit' + path.sep + 'next' + path.sep + 'dist' + path.sep + 'client' + path.sep + 'runtime\\.js$'),
    use: [{ loader: '@confkit/next/client/loader', options: { file: opts.file ? path.resolve(process.cwd(), opts.file) : undefined } }],
  });
}

function attachConfkitClientVirtual(nextConfig: NextConfig, opts: { file?: string } = {}): NextConfig {
  const config: NextConfig = { ...nextConfig };
  const origWebpack = (nextConfig as any).webpack;
  (config as any).webpack = function webpack(cfg: any, ctx: { dev: boolean }) {
    const out = typeof origWebpack === 'function' ? origWebpack(cfg, ctx) : cfg;
    attachWebpackBitsForVirtual(out, opts);
    return out;
  };
  return config;
}
