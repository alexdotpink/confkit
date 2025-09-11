import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

export type GcpSecretsOptions = {
  /** GCP project ID; falls back to env default if omitted */
  projectId?: string;
  /** Filter secret names starting with this prefix */
  namePrefix?: string;
  /** Map GCP secret name to config key (default: basename upper snake) */
  mapNameToKey?: (name: string) => string;
  /** TTL for caching results */
  ttlMs?: number;
  jitter?: number;
  background?: boolean;
  onRotate?: (key: string, value: string, meta: { version?: string }) => void;
  /** Max concurrent accessSecretVersion calls */
  maxConcurrency?: number;
};

type Source = () => Promise<Record<string, string>> | Record<string, string>;

function defaultKeyFromName(name: string) {
  const i = name.lastIndexOf('/');
  return (i >= 0 ? name.slice(i + 1) : name).replace(/[^A-Za-z0-9_]/g, '_').toUpperCase();
}

export function gcpSecretsSource(opts: GcpSecretsOptions = {}): Source {
  const client = new SecretManagerServiceClient();
  const mapNameToKey = opts.mapNameToKey ?? defaultKeyFromName;
  let cache: { value: Record<string, string>; expires: number; versions: Record<string, string | undefined> } | undefined;
  let timer: NodeJS.Timeout | undefined;

  async function fetchNow() {
    const values: Record<string, string> = {};
    const versions: Record<string, string | undefined> = {};
    const projectId = opts.projectId ?? (await client.getProjectId());
    const parent = `projects/${projectId}`;

    // List secrets, then access latest version for each
    const allNames: string[] = [];
    const [secrets] = await client.listSecrets({ parent });
    for (const s of secrets) {
      const name = s.name ?? '';
      if (!name) continue;
      if (opts.namePrefix && !name.split('/').pop()!.startsWith(opts.namePrefix)) continue;
      allNames.push(name);
    }
    const maxConc = Math.max(1, Math.min(opts.maxConcurrency ?? 8, 24));
    let i = 0;
    await Promise.all(
      Array.from({ length: maxConc }).map(async () => {
        while (i < allNames.length) {
          const idx = i++;
          const name = allNames[idx];
          const key = mapNameToKey(name);
          try {
            const [access] = await client.accessSecretVersion({ name: `${name}/versions/latest` });
            const bytes = access.payload?.data as unknown as Uint8Array | undefined;
            const payload = bytes ? Buffer.from(bytes).toString('utf8') : undefined;
            if (typeof payload === 'string') {
              values[key] = payload;
              versions[key] = access.name?.split('/').pop();
            }
          } catch {
            // ignore individual errors
          }
        }
      })
    );

    return { values, versions };
  }

  async function refresh() {
    const ttl = opts.ttlMs ?? 5 * 60 * 1000;
    const jitter = opts.jitter ?? 0.1;
    const now = Date.now();
    const { values: nextValues, versions: nextVersions } = await fetchNow();
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
    const ms = cache ? Math.max(0, cache.expires - now) : (opts.ttlMs ?? 5 * 60 * 1000);
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

export default gcpSecretsSource;
