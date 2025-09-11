"use strict";
import { loadConfig } from 'confkit/load';
import path from 'node:path';
export async function withConfkit(nextConfig = {}, opts = {}) {
    const { clientEnv } = await loadConfig({ file: opts.file });
    const baseEnv = {};
    const existing = nextConfig.env ?? {};
    for (const k of Object.keys(existing)) {
        const v = existing[k];
        if (typeof v === 'string')
            baseEnv[k] = v;
        else if (v != null)
            baseEnv[k] = JSON.stringify(v);
    }
    const envMerged = { ...baseEnv, ...clientEnv };
    return { ...nextConfig, env: envMerged };
}
export async function envFromConfkit(opts = {}) {
    const { clientEnv } = await loadConfig({ file: opts.file });
    return clientEnv;
}
export async function middlewareEnsureConfkit(opts = {}) {
    try {
        const { config } = await loadConfig({ file: opts.file });
        await config.ready();
        return undefined;
    }
    catch (err) {
        if (opts.devOnly === false) {
            return new Response('Configuration error', { status: 500 });
        }
        const body = JSON.stringify({ error: 'confkit validation error', issues: err.issues ?? [] }, null, 2);
        return new Response(body, { status: 500, headers: { 'content-type': 'application/json' } });
    }
}
export async function ensureConfkitDev(opts = {}) {
    if (process.env.NODE_ENV === 'production')
        return;
    const { config } = await loadConfig({ file: opts.file });
    try {
        await config.ready();
    }
    catch (err) {
        const issues = err.issues ?? [];
        const msg = 'confkit validation failed\n' + issues.map(i => `- ${i.path}: ${i.message}`).join('\n');
        throw new Error(msg);
    }
}
export function withConfkitDevOverlay(nextConfig = {}, opts = {}) {
    const config = { ...nextConfig };
    const origWebpack = nextConfig.webpack;
    config.webpack = function webpack(cfg, ctx) {
        const out = typeof origWebpack === 'function' ? origWebpack(cfg, ctx) : cfg;
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
                    if (!list.includes(runtimeMod))
                        entries[key] = [runtimeMod, ...list];
                }
                return entries;
            };
        }
        return out;
    };
    return config;
}
