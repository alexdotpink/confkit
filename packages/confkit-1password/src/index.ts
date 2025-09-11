import { OnePasswordConnect } from '@1password/connect';

export type OnePasswordOptions = {
  /** OP Connect server URL, e.g. http://localhost:8080 */
  url?: string;
  /** OP Connect token; if omitted, read OP_CONNECT_TOKEN from env */
  token?: string;
  /** Vault IDs or names to search (at least one required) */
  vaults: string[];
  /** Filter item titles starting with this prefix */
  titlePrefix?: string;
  /** Map item title (or title/key) to config key */
  mapItemToKey?: (item: { title: string; id: string; vaultId: string }) => string;
  /** If items contain multiple fields, select which field to use; default 'password' or first string field */
  fieldSelector?: (fields: Array<{ label?: string; id?: string; purpose?: string; value?: unknown }>) => string | undefined;
  ttlMs?: number;
  jitter?: number;
  background?: boolean;
  onRotate?: (key: string, value: string, meta: { version?: string }) => void;
};

type Source = () => Promise<Record<string, string>> | Record<string, string>;

function defaultMap(item: { title: string }) {
  return item.title.replace(/[^A-Za-z0-9_]/g, '_').toUpperCase();
}

function pickField(fields: Array<{ label?: string; id?: string; purpose?: string; value?: unknown }>): string | undefined {
  // Prefer purpose=password, then first string value
  const pass = fields.find(f => f.purpose === 'PASSWORD' || f.purpose === 'password' || f.label?.toLowerCase() === 'password');
  if (pass && typeof pass.value === 'string') return pass.value;
  const first = fields.find(f => typeof f.value === 'string');
  return typeof first?.value === 'string' ? first.value : undefined;
}

export function onePasswordSource(opts: OnePasswordOptions): Source {
  const url = opts.url ?? process.env.OP_CONNECT_HOST ?? 'http://localhost:8080';
  const token = opts.token ?? process.env.OP_CONNECT_TOKEN ?? '';
  if (!token) throw new Error('1password: token missing (set OP_CONNECT_TOKEN or pass token)');
  if (!opts.vaults?.length) throw new Error('1password: at least one vault id/name is required');
  const client = OnePasswordConnect({ serverURL: url, token });
  const map = opts.mapItemToKey ?? defaultMap;
  const selectField = opts.fieldSelector ?? pickField;
  let cache: { value: Record<string, string>; expires: number; versions: Record<string, string | undefined> } | undefined;
  let timer: NodeJS.Timeout | undefined;

  async function fetchNow() {
    const values: Record<string, string> = {};
    const versions: Record<string, string | undefined> = {};
    for (const vault of opts.vaults) {
      // Search all items in vault; filter client-side
      const items = await client.listItems(vault);
      for (const item of items) {
        const title = item.title ?? '';
        if (opts.titlePrefix && !title.startsWith(opts.titlePrefix)) continue;
        const full = await client.getItem(vault, item.id!);
        const fieldVal = selectField((full.fields ?? []) as any);
        if (typeof fieldVal !== 'string') continue;
        const key = map({ title: title, id: full.id!, vaultId: (full.vault as any)?.id ?? vault });
        values[key] = fieldVal;
        versions[key] = full.version ? String(full.version) : undefined;
      }
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

export default onePasswordSource;

