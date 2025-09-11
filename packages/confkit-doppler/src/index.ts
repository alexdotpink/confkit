export type DopplerOptions = {
  /** Doppler Service Token, or API token */
  token: string;
  /** For Service Token, doppler offers a single config scope. For API token, specify project+config. */
  project?: string;
  config?: string;
  /** Optional prefix to include only keys starting with this */
  keyPrefix?: string;
  /** Map Doppler secret name to config key */
  mapNameToKey?: (name: string) => string;
  ttlMs?: number;
  jitter?: number;
  background?: boolean;
  onRotate?: (key: string, value: string, meta: { version?: string }) => void;
};

type Source = () => Promise<Record<string, string>> | Record<string, string>;

function defaultMap(name: string) {
  return name;
}

async function fetchDoppler(opts: DopplerOptions): Promise<{ values: Record<string, string>; versions: Record<string, string | undefined> }> {
  const headers: Record<string, string> = {
    authorization: `Bearer ${opts.token}`,
  };
  const params: string[] = ['format=json', 'include_dynamic_secrets=true'];
  let url = 'https://api.doppler.com/v3/configs/config/secrets/download';
  if (opts.project && opts.config) {
    url += `?${params.concat([`project=${encodeURIComponent(opts.project)}`, `config=${encodeURIComponent(opts.config)}`]).join('&')}`;
  } else {
    url += `?${params.join('&')}`;
  }
  const resp = await fetch(url, { headers });
  if (!resp.ok) throw new Error(`doppler: ${resp.status}`);
  const etag = resp.headers.get('etag') || undefined;
  const json = (await resp.json()) as Record<string, string>;
  const values: Record<string, string> = {};
  const versions: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(json)) {
    if (opts.keyPrefix && !k.startsWith(opts.keyPrefix)) continue;
    const key = (opts.mapNameToKey ?? defaultMap)(k);
    values[key] = v;
    versions[key] = etag; // Doppler download endpoint doesn't include per-key version; use ETag as coarse version
  }
  return { values, versions };
}

export function dopplerSource(opts: DopplerOptions): Source {
  let cache: { value: Record<string, string>; expires: number; versions: Record<string, string | undefined> } | undefined;
  let timer: NodeJS.Timeout | undefined;

  async function refresh() {
    const ttl = opts.ttlMs ?? 60_000; // Doppler can rotate fast; default 1 minute
    const jitter = opts.jitter ?? 0.1;
    const now = Date.now();
    const { values: nextValues, versions: nextVersions } = await fetchDoppler(opts);
    if (cache) {
      const keys = new Set([...Object.keys(cache.value), ...Object.keys(nextValues)]);
      for (const k of keys) {
        const prevV = cache.value[k];
        const curV = nextValues[k];
        const prevVer = cache.versions[k];
        const curVer = nextVersions[k];
        if ((prevV !== curV || prevVer !== curVer) && curV !== undefined && opts.onRotate) {
          opts.onRotate(k, curV, { version: curVer });
        }
      }
    }
    const expires = now + Math.floor(ttl * (1 - jitter + Math.random() * jitter * 2));
    cache = { value: nextValues, expires, versions: nextVersions };
  }

  function schedule() {
    if (!opts.background) return;
    const now = Date.now();
    const ms = cache ? Math.max(0, cache.expires - now) : (opts.ttlMs ?? 60_000);
    if (timer) clearTimeout(timer);
    timer = setTimeout(async () => { try { await refresh(); } finally { schedule(); } }, ms);
  }

  return async () => {
    const now = Date.now();
    if (!cache || now >= cache.expires) {
      await refresh();
      schedule();
    }
    return cache!.value;
  };
}

export default dopplerSource;

