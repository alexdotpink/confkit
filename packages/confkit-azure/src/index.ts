import { DefaultAzureCredential, type TokenCredential } from '@azure/identity';
import { SecretClient } from '@azure/keyvault-secrets';

export type AzureSecretsOptions = {
  /** e.g. https://my-vault.vault.azure.net */
  vaultUrl: string;
  credential?: TokenCredential;
  /** Filter secret names by prefix */
  namePrefix?: string;
  /** Map secret name to config key */
  mapNameToKey?: (name: string) => string;
  ttlMs?: number;
  jitter?: number;
  background?: boolean;
  onRotate?: (key: string, value: string, meta: { version?: string }) => void;
  /** Max concurrent getSecret calls */
  maxConcurrency?: number;
};

type Source = () => Promise<Record<string, string>> | Record<string, string>;

function defaultKeyFromName(name: string) {
  return name.replace(/[^A-Za-z0-9_]/g, '_').toUpperCase();
}

export function azureKeyVaultSource(opts: AzureSecretsOptions): Source {
  const cred = opts.credential ?? new DefaultAzureCredential();
  const client = new SecretClient(opts.vaultUrl, cred);
  const mapNameToKey = opts.mapNameToKey ?? defaultKeyFromName;
  let cache: { value: Record<string, string>; expires: number; versions: Record<string, string | undefined> } | undefined;
  let timer: NodeJS.Timeout | undefined;

  async function fetchNow() {
    const values: Record<string, string> = {};
    const versions: Record<string, string | undefined> = {};
    const names: string[] = [];
    for await (const prop of client.listPropertiesOfSecrets().byPage({ maxPageSize: 100 })) {
      for (const p of prop) {
        const name = p.name;
        if (opts.namePrefix && !name.startsWith(opts.namePrefix)) continue;
        names.push(name);
      }
    }
    const maxConc = Math.max(1, Math.min(opts.maxConcurrency ?? 8, 24));
    let i = 0;
    await Promise.all(
      Array.from({ length: maxConc }).map(async () => {
        while (i < names.length) {
          const idx = i++;
          const name = names[idx];
          const key = mapNameToKey(name);
          try {
            const s = await client.getSecret(name);
            const val = s.value ?? '';
            values[key] = val;
            versions[key] = s.properties.version;
          } catch {
            // ignore
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

export default azureKeyVaultSource;

