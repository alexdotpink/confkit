import {
  SecretsManagerClient,
  ListSecretsCommand,
  BatchGetSecretValueCommand,
  GetSecretValueCommand,
  type SecretListEntry,
  type ListSecretsCommandOutput,
} from '@aws-sdk/client-secrets-manager';

export type AwsSecretsOptions = {
  region?: string;
  /** Filter by secret name prefix (path-like), e.g. "/apps/myapp/" */
  namePrefix?: string;
  /** Map fully qualified secret name to config key (default: basename after last '/') */
  mapNameToKey?: (name: string) => string;
  /** Cache TTL in ms before refresh; default 5 minutes */
  ttlMs?: number;
  /** Jitter ratio (0.1 = ±10%) for refresh scheduling; default 0.1 */
  jitter?: number;
  /** Background refresh using TTL schedule */
  background?: boolean;
  /** Called when a specific key rotates to a new version */
  onRotate?: (key: string, value: string, meta: { version?: string }) => void;
  /** Max attempts for SDK retries (SIGv4 retry/backoff); default 3 */
  maxAttempts?: number;
  /** Retry mode for SDK */
  retryMode?: 'standard' | 'adaptive';
  /** Concurrency for per-secret Get when Batch not available; default 5 */
  maxConcurrency?: number;
};

type Source = () => Promise<Record<string, string>> | Record<string, string>;

function defaultKeyFromName(name: string) {
  const i = name.lastIndexOf('/');
  return (i >= 0 ? name.slice(i + 1) : name).replace(/[^A-Za-z0-9_]/g, '_').toUpperCase();
}

function decodeSecretStringOrBinary(v: { SecretString?: string; SecretBinary?: Uint8Array | string } | undefined): string | undefined {
  if (!v) return undefined;
  if (typeof v.SecretString === 'string') return v.SecretString;
  if (v.SecretBinary instanceof Uint8Array) {
    try { return Buffer.from(v.SecretBinary).toString('utf8'); } catch { return undefined; }
  }
  if (typeof v.SecretBinary === 'string') {
    try { return Buffer.from(v.SecretBinary, 'base64').toString('utf8'); } catch { return undefined; }
  }
  return undefined;
}

async function listAllSecrets(client: SecretsManagerClient, namePrefix?: string): Promise<SecretListEntry[]> {
  const out: SecretListEntry[] = [];
  let nextToken: string | undefined = undefined;
  do {
    const resp: ListSecretsCommandOutput = await client.send(new ListSecretsCommand({ NextToken: nextToken, MaxResults: 100 }));
    const page = (resp.SecretList ?? []).filter((s: SecretListEntry) => {
      if (!namePrefix) return true;
      const n = s.Name ?? '';
      return n.startsWith(namePrefix);
    });
    out.push(...page);
    nextToken = resp.NextToken;
  } while (nextToken);
  return out;
}

export function awsSecretsSource(opts: AwsSecretsOptions = {}): Source {
  const client = new SecretsManagerClient({
    region: opts.region,
    maxAttempts: opts.maxAttempts ?? 3,
    retryMode: opts.retryMode ?? 'adaptive',
  });

  const mapNameToKey = opts.mapNameToKey ?? defaultKeyFromName;
  let cache: { value: Record<string, string>; expires: number; versions: Record<string, string | undefined> } | undefined;
  let timer: NodeJS.Timeout | undefined;

  async function fetchNow(): Promise<{ values: Record<string, string>; versions: Record<string, string | undefined> }> {
    // 1) List matching secrets
    const all = await listAllSecrets(client, opts.namePrefix);
    if (all.length === 0) return { values: {}, versions: {} };

    // 2) Try batch get first (supported in newer SDKs), fallback to individual gets
    const ids = all.map(s => s.ARN ?? s.Name!).filter(Boolean) as string[];
    const values: Record<string, string> = {};
    const versions: Record<string, string | undefined> = {};

    async function tryBatch(idsSlice: string[]) {
      try {
        const resp = await client.send(new BatchGetSecretValueCommand({ SecretIdList: idsSlice } as any));
        // Types for BatchGetSecretValueCommandOutput may differ across versions; access defensively
        const entries: Array<any> = (resp as any).SecretValues ?? (resp as any).Results ?? [];
        for (const e of entries) {
          const name: string = e?.Name ?? e?.SecretId ?? '';
          const key = mapNameToKey(name);
          const val = decodeSecretStringOrBinary(e);
          if (typeof val === 'string') {
            values[key] = val;
            versions[key] = e?.VersionId;
          }
        }
        const errs: Array<any> = (resp as any).Errors ?? [];
        return errs?.length ? errs : [];
      } catch (err: any) {
        // Batch not supported or failed; signal fallback by throwing
        throw err;
      }
    }

    let usedBatch = false;
    try {
      // Batch in chunks of 10 (service limit)
      const chunk = 10;
      for (let i = 0; i < ids.length; i += chunk) {
        const slice = ids.slice(i, i + chunk);
        await tryBatch(slice);
      }
      usedBatch = true;
    } catch {
      usedBatch = false;
    }

    if (!usedBatch) {
      // Fallback: individual GetSecretValue with limited concurrency
      const maxConc = Math.max(1, Math.min(opts.maxConcurrency ?? 5, 20));
      let i = 0;
      await Promise.all(
        Array.from({ length: maxConc }).map(async () => {
          while (i < ids.length) {
            const idx = i++;
            const id = ids[idx];
            try {
              const r = await client.send(new GetSecretValueCommand({ SecretId: id }));
              const name = r.Name ?? id;
              const key = mapNameToKey(name);
              const val = decodeSecretStringOrBinary(r);
              if (typeof val === 'string') {
                values[key] = val;
                versions[key] = r.VersionId;
              }
            } catch {
              // ignore per-secret errors to avoid blocking others
            }
          }
        })
      );
    }

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

export default awsSecretsSource;
