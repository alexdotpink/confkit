// Client env module for Next.js.
//
// In Webpack builds, a custom loader may replace this file with a static
// object for optimal treeshaking. In Turbopack or when the loader isn't
// active, fall back to constructing a runtime object from process.env.
//
// Only include well-known safe client prefixes to avoid accidental leakage
// if users add additional keys to next.config.env.

const SAFE_PREFIXES = ['PUBLIC_', 'NEXT_PUBLIC_', 'EXPO_PUBLIC_'];

function buildEnvFromProcess(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const anyEnv: Record<string, unknown> = (typeof process !== 'undefined' && (process as any).env) || {};
    for (const k of Object.keys(anyEnv)) {
      if (SAFE_PREFIXES.some((p) => k.startsWith(p))) {
        const v = anyEnv[k];
        if (typeof v === 'string') out[k] = v;
        else if (v != null) out[k] = String(v);
      }
    }
  } catch {
    // Ignore if process/env is not available (very rare in Next client)
  }
  return out;
}

const env: Record<string, string> = buildEnvFromProcess();
export default env;
