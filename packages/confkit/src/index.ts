// Minimal skeleton (MVP leaning; not production ready)
// Tiny, purpose-built runtime for typed config + secrets.

type Issue = { path: string; message: string };
type Result<T> = { ok: true; value: T } | { ok: false; issues: Issue[] };

export interface Node<T> {
  coerce(raw: unknown): Result<T>;
  _meta?: { secret?: boolean; client?: boolean };
  optional(): Node<T | undefined>;
  default(v: T | (() => T)): Node<T>;
  client(): Node<T>;
  refine(predicate: (v: T) => boolean, message: string): Node<T>;
  transform<U>(fn: (v: T) => U): Node<U>;
}

// Internal node kinds for structured redaction
type ObjectNode<S extends Record<string, Node<unknown>>> = Node<{ [K in keyof S]: S[K] extends Node<infer U> ? U : never }> & {
  _kind: 'object';
  _shape: S;
};
type ArrayNode<U> = Node<U[]> & { _kind: 'array'; _inner: Node<U> };
type RecordNode<U> = Node<Record<string, U>> & { _kind: 'record'; _inner: Node<U> };
type UnionNode<Out> = Node<Out> & { _kind: 'union'; _nodes: readonly Node<unknown>[] };
type UrlNode = Node<string> & { origin(): Node<string> };

function makeNode<T>(coerceFn: (raw: unknown) => Result<T>, meta?: Node<T>["_meta"]): Node<T> {
  function copyInternalProps<A, B>(from: Node<A>, to: Node<B>): Node<B> {
    const f = from as unknown as Partial<{ _kind: string; _shape: unknown; _inner: unknown; _nodes: unknown }>;
    const t = to as unknown as Partial<{ _kind: string; _shape: unknown; _inner: unknown; _nodes: unknown }>;
    if (f._kind) t._kind = f._kind;
    if (f._shape) t._shape = f._shape;
    if (f._inner) t._inner = f._inner;
    if (f._nodes) t._nodes = f._nodes;
    return to;
  }
  const node: Node<T> = {
    _meta: meta,
    coerce: (raw: unknown) => coerceFn(raw),
    optional() {
      const wrapped = makeNode<T | undefined>((raw) => {
        if (raw === undefined) return { ok: true, value: undefined } as Result<T | undefined>;
        return coerceFn(raw);
      }, node._meta);
      return copyInternalProps(node, wrapped);
    },
    default(v: T | (() => T)) {
      const wrapped = makeNode<T>((raw) => {
        if (raw === undefined) {
          const val = typeof v === 'function' ? (v as () => T)() : v;
          return { ok: true, value: val } as Result<T>;
        }
        return coerceFn(raw);
      }, node._meta);
      return copyInternalProps(node, wrapped);
    },
    client() {
      const wrapped = makeNode<T>(coerceFn, { ...(node._meta || {}), client: true });
      return copyInternalProps(node, wrapped);
    },
    refine(predicate: (v: T) => boolean, message: string) {
      const wrapped = makeNode<T>((raw) => {
        const r = coerceFn(raw);
        if (!r.ok) return r;
        if (!predicate(r.value)) return { ok: false, issues: [{ path: '', message }] };
        return r;
      }, node._meta);
      return copyInternalProps(node, wrapped);
    },
    transform<U>(fn: (v: T) => U) {
      const wrapped = makeNode<U>((raw) => {
        const r = coerceFn(raw);
        if (!r.ok) return r as unknown as Result<U>;
        return { ok: true, value: fn(r.value) } as Result<U>;
      }, node._meta);
      // transform changes type; internal structure no longer guaranteed
      return wrapped;
    },
  };
  return node;
}

export const s = {
  string(): Node<string> {
    const base = makeNode<string>((x) =>
      typeof x === "string"
        ? { ok: true, value: x }
        : { ok: false, issues: [{ path: "", message: "Expected string" }] }
    );
    (base as any)._kind = 'string';
    return base;
  },
  int(): Node<number> {
    const base = makeNode<number>((x) => {
      const n = typeof x === "number" ? x : Number(x);
      return Number.isInteger(n)
        ? { ok: true, value: n }
        : { ok: false, issues: [{ path: "", message: "Expected int" }] };
    });
    (base as any)._kind = 'int';
    return base;
  },
  number(): Node<number> {
    const base = makeNode<number>((x) => {
      const n = typeof x === 'number' ? x : Number(x);
      return Number.isFinite(n)
        ? { ok: true, value: n }
        : { ok: false, issues: [{ path: '', message: 'Expected number' }] };
    });
    (base as any)._kind = 'number';
    return base;
  },
  float(): Node<number> { return (this as any).number(); },
  boolean(): Node<boolean> {
    const base = makeNode<boolean>((x) => {
      if (typeof x === "boolean") return { ok: true, value: x };
      if (x === "true") return { ok: true, value: true };
      if (x === "false") return { ok: true, value: false };
      return { ok: false, issues: [{ path: "", message: "Expected boolean" }] };
    });
    (base as any)._kind = 'boolean';
    return base;
  },
  enum<const T extends readonly string[]>(vals: T): Node<T[number]> {
    function editDistance(a: string, b: string): number {
      const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
      for (let i = 0; i <= a.length; i++) dp[i][0] = i;
      for (let j = 0; j <= b.length; j++) dp[0][j] = j;
      for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
          const cost = a[i - 1] === b[j - 1] ? 0 : 1;
          const del = dp[i - 1][j] + 1;
          const ins = dp[i][j - 1] + 1;
          const sub = dp[i - 1][j - 1] + cost;
          dp[i][j] = Math.min(del, ins, sub);
        }
      }
      return dp[a.length][b.length];
    }
    const base = makeNode<T[number]>((x) => {
      const sx = String(x);
      if ((vals as readonly string[]).includes(sx)) {
        return { ok: true, value: sx as T[number] };
      }
      const list = vals as readonly string[];
      let best: { v: string; d: number } | undefined;
      for (const v of list) {
        const d = editDistance(sx.toLowerCase(), v.toLowerCase());
        if (!best || d < best.d) best = { v, d };
      }
      const hint = best && best.d <= 2 ? ` (did you mean "${best.v}")` : '';
      return { ok: false, issues: [{ path: "", message: `Expected one of ${list.join(", ")}${hint}` }] };
    });
    (base as any)._kind = 'enum';
    (base as any)._values = vals as readonly string[];
    return base;
  },
  object<S extends Record<string, Node<unknown>>>(shape: S): ObjectNode<S> {
    type Output = { [K in keyof S]: S[K] extends Node<infer U> ? U : never };
    const base = makeNode<Output>((x) => {
      if (typeof x !== "object" || x == null)
        return { ok: false, issues: [{ path: "", message: "Expected object" }] };
      const out = {} as Output;
      const issues: Issue[] = [];
      const xrec = x as Record<string, unknown>;
      for (const k of Object.keys(shape) as Array<keyof S>) {
        const r = shape[k].coerce(xrec[k as string]);
        if (r.ok) {
          (out as Record<string, unknown>)[k as string] = r.value as unknown;
        } else {
          issues.push(
            ...r.issues.map((i) => ({ path: `${String(k)}${i.path ? "." + i.path : ""}`, message: i.message }))
          );
        }
      }
      return issues.length ? { ok: false, issues } : { ok: true, value: out };
    });
    const node = base as unknown as ObjectNode<S>;
    node._kind = 'object';
    node._shape = shape;
    return node;
  },
  url(): UrlNode {
    const base = makeNode<string>((x) => {
      const str = typeof x === "string" ? x : String(x);
      try {
        // Allow relative URLs? For now, require absolute
        // eslint-disable-next-line no-new
        new URL(str);
        return { ok: true, value: str };
      } catch {
        return { ok: false, issues: [{ path: "", message: "Expected URL" }] };
      }
    });
    (base as any)._kind = 'url';
    const urlNode = base as UrlNode;
    urlNode.origin = () => urlNode.transform((v) => new URL(v).origin);
    return urlNode;
  },
  uuid(): Node<string> {
    const re = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const base = makeNode<string>((x) => {
      const s = typeof x === 'string' ? x : String(x);
      return re.test(s)
        ? { ok: true, value: s }
        : { ok: false, issues: [{ path: '', message: 'Expected UUID (RFC 4122)' }] };
    });
    (base as any)._kind = 'uuid';
    return base;
  },
  port(): Node<number> {
    const base = makeNode<number>((x) => {
      const n = typeof x === 'number' ? x : Number(x);
      if (!Number.isInteger(n) || n < 1 || n > 65535) {
        return { ok: false, issues: [{ path: '', message: 'Expected port 1-65535' }] };
      }
      return { ok: true, value: n };
    });
    (base as any)._kind = 'port';
    return base;
  },
  email(): Node<string> {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const base = makeNode<string>((x) => {
      const s = typeof x === 'string' ? x : String(x);
      return re.test(s)
        ? { ok: true, value: s }
        : { ok: false, issues: [{ path: '', message: 'Expected email' }] };
    });
    (base as any)._kind = 'email';
    return base;
  },
  nonempty(): Node<string> {
    const base = makeNode<string>((x) => {
      const s = typeof x === 'string' ? x : String(x);
      return s.length > 0 ? { ok: true, value: s } : { ok: false, issues: [{ path: '', message: 'Expected non-empty string' }] };
    });
    (base as any)._kind = 'nonempty';
    return base;
  },
  regex(re: RegExp, label = 'pattern'): Node<string> {
    const base = makeNode<string>((x) => {
      const s = typeof x === 'string' ? x : String(x);
      return re.test(s) ? { ok: true, value: s } : { ok: false, issues: [{ path: '', message: `Expected ${label}` }] };
    });
    (base as any)._kind = 'regex';
    return base;
  },
  host(): Node<string> {
    // Rough hostname (RFC 1123) check: labels 1-63 chars, alnum/hyphen, no leading/trailing hyphen, total <= 253
    const label = /^(?!-)[A-Za-z0-9-]{1,63}(?<!-)$/;
    const base = makeNode<string>((x) => {
      const s = typeof x === 'string' ? x : String(x);
      if (s.length > 253) return { ok: false, issues: [{ path: '', message: 'Expected hostname (too long)' }] };
      const parts = s.split('.');
      if (!parts.length || parts.some(p => !label.test(p))) return { ok: false, issues: [{ path: '', message: 'Expected hostname' }] };
      return { ok: true, value: s };
    });
    (base as any)._kind = 'host';
    return base;
  },
  ip(): Node<string> {
    const v4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
    const v6 = /^([0-9A-Fa-f]{1,4}:){7}[0-9A-Fa-f]{1,4}$/;
    const base = makeNode<string>((x) => {
      const s = typeof x === 'string' ? x : String(x);
      return (v4.test(s) || v6.test(s)) ? { ok: true, value: s } : { ok: false, issues: [{ path: '', message: 'Expected IP address' }] };
    });
    (base as any)._kind = 'ip';
    return base;
  },
  duration(): Node<number> {
    function parseIsoDuration(input: string): number | undefined {
      // Basic ISO8601: PnW | PnDTnHnMnS (ignore years/months)
      const w = /^P(\d+)W$/i.exec(input);
      if (w) return Number(w[1]) * 7 * 24 * 60 * 60 * 1000;
      const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i.exec(input);
      if (!m) return undefined;
      const days = m[1] ? Number(m[1]) : 0;
      const hours = m[2] ? Number(m[2]) : 0;
      const mins = m[3] ? Number(m[3]) : 0;
      const secs = m[4] ? Number(m[4]) : 0;
      return (((days * 24 + hours) * 60 + mins) * 60 + secs) * 1000;
    }
    function parseHuman(input: string): number | undefined {
      const m = /^\s*(\d+(?:\.\d+)?)\s*(ms|s|m|h|d|w)?\s*$/i.exec(input);
      if (!m) return undefined;
      const n = Number(m[1]);
      const u = (m[2] || 'ms').toLowerCase();
      const mul: Record<string, number> = { ms: 1, s: 1000, m: 60000, h: 3600000, d: 86400000, w: 604800000 };
      return n * (mul[u] ?? 1);
    }
    const base = makeNode<number>((x) => {
      if (typeof x === 'number') return { ok: true, value: x };
      const s = typeof x === 'string' ? x : String(x);
      let ms = parseHuman(s);
      if (ms === undefined) ms = parseIsoDuration(s);
      return typeof ms === 'number' && Number.isFinite(ms)
        ? { ok: true, value: ms }
        : { ok: false, issues: [{ path: '', message: 'Expected duration (e.g. 500ms, 2s, 5m, PT1H)' }] };
    });
    (base as any)._kind = 'duration';
    return base;
  },
  json<T = unknown>(inner?: Node<T>): Node<T extends unknown ? unknown : T> {
    type Out = T extends unknown ? unknown : T;
    const base = makeNode<Out>((x) => {
      let value: unknown = x;
      if (typeof x === 'string') {
        try { value = JSON.parse(x); } catch { return { ok: false, issues: [{ path: '', message: 'Expected JSON' }] } as Result<Out>; }
      }
      if (!inner) return { ok: true, value: value as Out } as Result<Out>;
      const r = (inner as unknown as Node<unknown>).coerce(value);
      return r.ok ? ({ ok: true, value: r.value as Out } as Result<Out>) : (r as unknown as Result<Out>);
    });
    (base as any)._kind = 'json';
    (base as any)._inner = inner;
    return base as any;
  },
  array<U>(inner: Node<U>): ArrayNode<U> {
    const base = makeNode<U[]>((x) => {
      if (!Array.isArray(x)) return { ok: false, issues: [{ path: '', message: 'Expected array' }] };
      const out: U[] = [];
      const issues: Issue[] = [];
      for (let i = 0; i < x.length; i++) {
        const r = inner.coerce(x[i]);
        if (r.ok) out.push(r.value);
        else issues.push(...r.issues.map((it) => ({ path: `[${i}]${it.path ? '.' + it.path : ''}`, message: it.message })));
      }
      return issues.length ? { ok: false, issues } : { ok: true, value: out };
    });
    const node = base as unknown as ArrayNode<U>;
    node._kind = 'array';
    node._inner = inner;
    return node;
  },
  record<U>(inner: Node<U>): RecordNode<U> {
    const base = makeNode<Record<string, U>>((x) => {
      if (typeof x !== 'object' || x == null) return { ok: false, issues: [{ path: '', message: 'Expected object' }] };
      const src = x as Record<string, unknown>;
      const out: Record<string, U> = {};
      const issues: Issue[] = [];
      for (const k of Object.keys(src)) {
        const r = inner.coerce(src[k]);
        if (r.ok) out[k] = r.value;
        else issues.push(...r.issues.map((it) => ({ path: `${k}${it.path ? '.' + it.path : ''}`, message: it.message })));
      }
      return issues.length ? { ok: false, issues } : { ok: true, value: out };
    });
    const node = base as unknown as RecordNode<U>;
    node._kind = 'record';
    node._inner = inner;
    return node;
  },
  union<TNodes extends readonly Node<unknown>[]>(nodes: TNodes): Node<TNodes[number] extends Node<infer U> ? U : never> {
    type Out = TNodes[number] extends Node<infer U> ? U : never;
    const base = makeNode<Out>((x) => {
      const allIssues: Issue[] = [];
      for (const n of nodes) {
        const r = n.coerce(x);
        if (r.ok) return { ok: true, value: r.value as Out } as Result<Out>;
        allIssues.push(...r.issues);
      }
      return { ok: false, issues: allIssues.length ? allIssues : [{ path: '', message: 'No union matched' }] };
    });
    const node = base as unknown as UnionNode<Out>;
    node._kind = 'union';
    node._nodes = nodes;
    return node;
  },
  secret<T>(node: Node<T>): Node<T> {
    return makeNode<T>(node.coerce.bind(node), { ...(node._meta || {}), secret: true });
  },
};

type UnknownRecord = Record<string, unknown>;
export type Source = () => Promise<UnknownRecord> | UnknownRecord;
export type Sources = Array<Source>;

// Built-in sources (env + file parsers). Keep minimal and safe.
const PROV_NAME = Symbol.for('confkit.sourceName');

export function source() {
  return {
    env(opts?: { files?: boolean }): Source {
      const fn: Source = async () => {
        const out: UnknownRecord = {};
        // Copy process.env (strings only)
        for (const [k, v] of Object.entries(process.env)) {
          if (typeof v === "string") out[k] = v;
        }

        const allowFiles =
          opts?.files !== false && (process.env.NODE_ENV !== "production" || process.env.ALLOW_ENV_FILES_IN_PROD === "true");
        if (allowFiles) {
          // Lazy load dotenv to keep core light if not used
          const { parse } = await import("dotenv");
          const fs = await import("node:fs");
          const path = await import("node:path");

          const cwd = process.cwd();
          const candidates = [
            ".env",
            ".env.local",
            process.env.NODE_ENV ? `.env.${process.env.NODE_ENV}` : undefined,
          ].filter(Boolean) as string[];

          for (const rel of candidates) {
            const p = path.resolve(cwd, rel);
            if (fs.existsSync(p) && fs.statSync(p).isFile()) {
              try {
                const buf = fs.readFileSync(p);
                const parsed = parse(buf);
                Object.assign(out, parsed);
              } catch {
                // ignore parse errors for MVP
              }
            }
          }
          // Also respect environment variables already present (don't override)
        }
        return out;
      };
      try { (fn as unknown as Record<PropertyKey, unknown>)[PROV_NAME] = 'env'; } catch {}
      return fn;
    },
    file(pth: string): Source {
      // parse json/yaml/toml by extension; support dotenv files (.env, .env.*)
      const fn: Source = async () => {
        const fs = await import("node:fs");
        const path = await import("node:path");
        const ext = path.extname(pth).toLowerCase();
        const base = path.basename(pth).toLowerCase();
        if (!fs.existsSync(pth) || !fs.statSync(pth).isFile()) return {};
        const data = fs.readFileSync(pth, "utf8");
        try {
          if (ext === ".json") return JSON.parse(data);
          if (ext === ".yaml" || ext === ".yml") {
            const { parse } = await import("yaml");
            return parse(data) ?? {};
          }
          if (ext === ".toml") {
            const toml = await import("toml");
            return toml.parse(data) ?? {};
          }
          // Handle dotenv files: '.env', '.env.*', or files with '.env' extension
          if (base === ".env" || base.startsWith(".env.") || ext === ".env") {
            const { parse } = await import("dotenv");
            try {
              return parse(data) ?? {};
            } catch {
              return {};
            }
          }
        } catch {
          // swallow parse errors for MVP; treat as empty
          return {};
        }
        // Unknown extension → empty
        return {};
      };
      try { (fn as unknown as Record<PropertyKey, unknown>)[PROV_NAME] = `file:${pth}`; } catch {}
      return fn;
    },
    inline(obj: Record<string, unknown>): Source {
      const fn: Source = async () => ({ ...obj });
      try { (fn as unknown as Record<PropertyKey, unknown>)[PROV_NAME] = 'inline'; } catch {}
      return fn;
    },
    only(inner: Source, keys: string[]): Source {
      return async () => {
        const base = await (typeof inner === 'function' ? inner() : inner);
        const out: Record<string, unknown> = {};
        for (const k of keys) if (k in base) out[k] = (base as Record<string, unknown>)[k];
        return out;
      };
    },
    map(inner: Source, fn: (key: string) => string): Source {
      return async () => {
        const base = await (typeof inner === 'function' ? inner() : inner);
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(base)) out[fn(k)] = v;
        return out;
      };
    },
  };
}

// Compose multiple sources with clear layering semantics.
// Example:
//   combine([src1, src2]).fallbackTo(src3)
// Merges src1+src2 (last wins within the group) and only falls back to src3
// for keys that are missing in the combined primary group.
const LAYERS_META = Symbol.for('confkit.sourceLayers');

export function combine(primary: Sources) {
  async function resolveAndMerge(sources: Sources): Promise<Record<string, unknown>> {
    const resolved = await Promise.all(sources.map(async (s) => (typeof s === 'function' ? await s() : s)));
    return Object.assign({}, ...resolved);
  }

  return {
    toSource(): Source {
      const fn: Source = async () => resolveAndMerge(primary);
      try {
        (fn as unknown as Record<PropertyKey, unknown>)[LAYERS_META] = [{ name: 'primary', count: primary.length }];
      } catch {
        // ignore non-critical meta attach errors
      }
      return fn;
    },
    fallbackTo(fallback: Source | Sources): Source {
      const fb = Array.isArray(fallback) ? fallback : [fallback];
      const fn: Source = async () => {
        const [base, over] = await Promise.all([resolveAndMerge(fb), resolveAndMerge(primary)]);
        return Object.assign({}, base, over);
      };
      try {
        (fn as unknown as Record<PropertyKey, unknown>)[LAYERS_META] = [
          { name: 'fallback', count: fb.length },
          { name: 'primary', count: primary.length },
        ];
      } catch {
        // ignore non-critical meta attach errors
      }
      return fn;
    },
  } as const;
}

// Note: secret backends live in provider packages (e.g., @confkit/aws, @confkit/gcp).

type InferNode<T> = T extends Node<infer U> ? U : never;
type InferConfig<TSchema extends Record<string, Node<unknown>>> = {
  [K in keyof TSchema]: InferNode<TSchema[K]>;
};

export type Infer<TSchema extends Record<string, Node<unknown>>> = InferConfig<TSchema>;

export function defineConfig<T extends Record<string, Node<unknown>>>(opts: {
  sources: Sources;
  schema: T;
  expand?: boolean;
  clientPrefixes?: string[];
  clientPrefix?: string;
  mask?: string;
  audit?: { emit: (e: { type: 'secret_read'; key: string; timestamp: number }) => void; sample?: number };
  expandAssign?: 'env' | 'cache' | false;
  requireClientPrefix?: boolean;
  validate?: (env: InferConfig<T>) => Issue[] | void;
  // Policy: additional requirements enforced at runtime
  // - requiredProdKeys: keys that must be present (non-empty) when NODE_ENV=production
  requiredProdKeys?: Array<keyof T>;
}) {
  let cache: InferConfig<T> | undefined;
  let cacheError: unknown | undefined;

  async function resolveSourcesDetailed(): Promise<Array<{ name: string; index: number; value: Record<string, unknown> }>> {
    const out: Array<{ name: string; index: number; value: Record<string, unknown> }> = [];
    for (let i = 0; i < opts.sources.length; i++) {
      const s = opts.sources[i];
      const name = (typeof s === 'function' && (s as unknown as Record<PropertyKey, unknown>)[PROV_NAME]) ? String((s as unknown as Record<PropertyKey, unknown>)[PROV_NAME]) : `source#${i+1}`;
      const value = await (typeof s === 'function' ? s() : s);
      out.push({ name, index: i, value });
    }
    return out;
  }

  async function loadRaw() {
    const detailed = await resolveSourcesDetailed();
    const merged = Object.assign({}, ...detailed.map(d => d.value)) as Record<string, unknown>;
    if (!opts.expand) return merged;
    return await expandVars(merged, opts.expandAssign ?? false);
  }

  function redact(obj: InferConfig<T>, schema: T): Record<keyof T, unknown> {
    const mask = opts.mask ?? '•••';
    const out: Partial<Record<keyof T, unknown>> = {};
    for (const k of Object.keys(schema) as Array<keyof T>) {
      const node = schema[k] as Node<unknown>;
      const val = obj[k as keyof InferConfig<T>];
      out[k] = redactByNode(val, node, mask);
    }
    return out as Record<keyof T, unknown>;
  }

  async function loadValidated() {
    if (cache) return cache;
    if (cacheError) throw cacheError;
    const raw = (await loadRaw()) as Record<string, unknown>;
    const asObj: Partial<InferConfig<T>> = {};
    const issues: Issue[] = [];
    for (const k of Object.keys(opts.schema) as Array<keyof T>) {
      const val = raw[k as string];
      const r = opts.schema[k].coerce(val);
      if (r.ok) {
        (asObj as Record<string, unknown>)[k as string] = r.value as unknown;
      } else {
        issues.push(
          ...r.issues.map((i) => ({ path: String(k) + (i.path ? "." + i.path : ""), message: i.message }))
        );
      }
    }
    if (issues.length) {
      const err = new Error("confkit validation error");
      (err as unknown as { issues?: Issue[] }).issues = issues;
      cacheError = err;
      throw err;
    }
    const validated = asObj as InferConfig<T>;
    // Policy: required keys in production
    if (process.env.NODE_ENV === 'production' && Array.isArray(opts.requiredProdKeys) && opts.requiredProdKeys.length) {
      const missing: Issue[] = [];
      for (const key of opts.requiredProdKeys) {
        const k = String(key) as keyof InferConfig<T>;
        const val = (validated as InferConfig<T>)[k];
        const isEmpty = val === undefined || val === null || (typeof val === 'string' && val.trim() === '');
        if (isEmpty) missing.push({ path: String(key), message: 'required in production' });
      }
      if (missing.length) {
        const err = new Error('confkit validation error');
        (err as unknown as { issues?: Issue[] }).issues = missing;
        cacheError = err;
        throw err;
      }
    }
    if (typeof opts.validate === 'function') {
      const extra = opts.validate(validated);
      if (Array.isArray(extra) && extra.length) {
        const err = new Error('confkit validation error');
        (err as unknown as { issues?: Issue[] }).issues = extra;
        cacheError = err;
        throw err;
      }
    }
    cache = validated;
    return cache;
  }

  const api = {
    async ready(): Promise<InferConfig<T>> {
      return loadValidated();
    },
    /**
     * Read raw values from each configured source with names and indices.
     * Intended for tooling (e.g., CLI diff) to compare specific sources
     * irrespective of merge order/overrides.
     */
    async readSources(): Promise<Array<{ name: string; index: number; value: Record<string, unknown> }>> {
      return resolveSourcesDetailed();
    },
    async reload(): Promise<void> {
      cache = undefined;
      cacheError = undefined;
    },
    async toJSON({ redact: doRedact = false }: { redact?: boolean } = {}): Promise<Record<keyof T, unknown> | InferConfig<T>> {
      const v = await loadValidated();
      return doRedact ? (redact(v, opts.schema) as Record<keyof T, unknown>) : v;
    },
    async get<K extends keyof T>(key: K): Promise<InferNode<T[K]>> {
      const v = await loadValidated();
      const node = opts.schema[key] as Node<unknown>;
      const val = v[key as keyof InferConfig<T>] as unknown as InferNode<T[K]>;
      if (node._meta?.secret && opts.audit) {
        const p = opts.audit.sample ?? 1;
        if (p >= 1 || Math.random() < p) opts.audit.emit({ type: 'secret_read', key: String(key), timestamp: Date.now() });
      }
      return val;
    },
    async pickClient(): Promise<Partial<InferConfig<T>>> {
      const v = await loadValidated();
      const out: Partial<InferConfig<T>> = {};
      const prefixes = opts.clientPrefix ? [opts.clientPrefix] : (opts.clientPrefixes ?? ["PUBLIC_", "NEXT_PUBLIC_", "EXPO_PUBLIC_"]);
      const requirePrefix = (opts.requireClientPrefix !== undefined) ? !!opts.requireClientPrefix : (process.env.NODE_ENV === 'production');
      for (const k of Object.keys(opts.schema) as Array<keyof T>) {
        const key = String(k);
        const node = opts.schema[k];
        const hasPrefix = prefixes.some((p) => key.startsWith(p));
        const allow = node._meta?.client || hasPrefix;
        // Policy: never allow secrets on client (regardless of prefix)
        if (allow && node._meta?.secret) {
          throw new Error(`Key ${key} is marked as secret and cannot be exposed to the client`);
        }
        if (requirePrefix && node._meta?.client && !hasPrefix) {
          throw new Error(`Key ${key} marked .client() but does not match required clientPrefix(s): ${prefixes.join(', ')}`);
        }
        if (allow && (!requirePrefix || hasPrefix)) {
          (out as Record<string, unknown>)[k as string] = v[k as keyof InferConfig<T>] as unknown;
        }
      }
      return out;
    },
    describeSchema(): Record<string, unknown> {
      function describeNode(node: Node<unknown>): any {
        const kind = (node as any)._kind ?? 'unknown';
        if (kind === 'object') {
          const shape = (node as any)._shape as Record<string, Node<unknown>>;
          const out: Record<string, unknown> = {};
          for (const k of Object.keys(shape)) out[k] = describeNode(shape[k]);
          return { kind, shape: out, secret: !!node._meta?.secret, client: !!node._meta?.client };
        }
        if (kind === 'array') return { kind, inner: describeNode((node as any)._inner), secret: !!node._meta?.secret, client: !!node._meta?.client };
        if (kind === 'record') return { kind, inner: describeNode((node as any)._inner), secret: !!node._meta?.secret, client: !!node._meta?.client };
        if (kind === 'union') return { kind, nodes: ((node as any)._nodes as Node<unknown>[]).map(describeNode), secret: !!node._meta?.secret, client: !!node._meta?.client };
        if (kind === 'enum') return { kind, values: (node as any)._values, secret: !!node._meta?.secret, client: !!node._meta?.client };
        if (kind === 'json') return { kind, inner: (node as any)._inner ? describeNode((node as any)._inner) : undefined, secret: !!node._meta?.secret, client: !!node._meta?.client };
        return { kind, secret: !!node._meta?.secret, client: !!node._meta?.client };
      }
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(opts.schema) as Array<keyof T>) out[String(k)] = describeNode(opts.schema[k]);
      return out;
    },
    async lintUnknowns(): Promise<string[]> {
      const raw = (await loadRaw()) as Record<string, unknown>;
      const known = new Set(Object.keys(opts.schema));
      const out: string[] = [];
      for (const k of Object.keys(raw)) if (!known.has(k)) out.push(k);
      return out.sort();
    },
    async explain(key?: string): Promise<Array<{ key: string; from: string; index: number; value: unknown }>> {
      const detailed = await resolveSourcesDetailed();
      const merged: Record<string, unknown> = {};
      const origin: Record<string, { from: string; index: number }> = {};
      for (const d of detailed) {
        for (const [k, v] of Object.entries(d.value)) {
          merged[k] = v;
          origin[k] = { from: d.name, index: d.index };
        }
      }
      const results: Array<{ key: string; from: string; index: number; value: unknown }> = [];
      if (key) {
        if (Object.prototype.hasOwnProperty.call(merged, key)) results.push({ key, from: origin[key]?.from ?? 'unknown', index: origin[key]?.index ?? -1, value: merged[key] });
        return results;
      }
      for (const k of Object.keys(merged).sort()) results.push({ key: k, from: origin[k]?.from ?? 'unknown', index: origin[k]?.index ?? -1, value: merged[k] });
      return results;
    },
  } as const;

  return new Proxy(api as typeof api, {
    get(target, prop) {
      if (prop in target) {
        return (target as Record<PropertyKey, unknown>)[prop];
      }
      // Access typed properties only after ready(); keep MVP explicit.
      throw new Error(`Access \"${String(prop)}\" before await config.ready()`);
    },
  }) as typeof api;
}

// -------- utils: expansion + deep redaction --------

async function expandVars(input: Record<string, unknown>, assignMode: 'env' | 'cache' | false): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = { ...input };
  const resolving = new Set<string>();

  // Optional file cache for assignMode === 'cache'
  let fileCache: Record<string, unknown> = {};
  let cacheDirty = false;
  let cachePath: string | undefined;
  if (assignMode === 'cache') {
    const pathMod = await import('node:path');
    const fsMod = await import('node:fs');
    const dir = pathMod.resolve(process.cwd(), '.confkit');
    cachePath = pathMod.resolve(dir, 'cache.json');
    try {
      if (!fsMod.existsSync(dir)) fsMod.mkdirSync(dir, { recursive: true });
      if (fsMod.existsSync(cachePath)) {
        const data = fsMod.readFileSync(cachePath, 'utf8');
        try {
          const parsed = JSON.parse(data);
          if (parsed && typeof parsed === 'object') fileCache = parsed as Record<string, unknown>;
        } catch {
          // ignore malformed cache; start fresh
          fileCache = {};
        }
      }
    } catch {
      // ignore file system errors; operate without persistence
      cachePath = undefined;
      fileCache = {};
    }
  }

  function hasVar(name: string): boolean {
    if (Object.prototype.hasOwnProperty.call(out, name)) {
      const v = out[name];
      return v !== undefined && v !== null && !(typeof v === 'string' && v === '');
    }
    if (assignMode === 'cache' && Object.prototype.hasOwnProperty.call(fileCache, name)) {
      const v = (fileCache as Record<string, unknown>)[name];
      return v !== undefined && v !== null && !(typeof v === 'string' && v === '');
    }
    const envV = process.env[name];
    return envV !== undefined && envV !== '';
  }

  function getVarRaw(name: string): unknown {
    if (Object.prototype.hasOwnProperty.call(out, name)) return out[name];
    if (assignMode === 'cache' && Object.prototype.hasOwnProperty.call(fileCache, name)) return fileCache[name];
    const v = process.env[name];
    return v === undefined ? undefined : v;
  }

  function asString(val: unknown): string | undefined {
    if (val === undefined || val === null) return undefined;
    if (typeof val === 'string') return val;
    try {
      return JSON.stringify(val);
    } catch {
      return String(val);
    }
  }

  function parseExpr(expr: string): { name: string; mode: 'plain' | 'default' | 'required' | 'assign' | 'alt'; arg: string } {
    let name = expr.trim();
    let mode: 'plain' | 'default' | 'required' | 'assign' | 'alt' = 'plain';
    let arg = '';
    const defIdx = name.indexOf(':-');
    const reqIdx = name.indexOf('?');
    const asnIdx = name.indexOf(':=');
    const altIdx = name.indexOf(':+');
    if (defIdx >= 0 && (reqIdx === -1 || defIdx < reqIdx)) {
      mode = 'default';
      arg = name.slice(defIdx + 2);
      name = name.slice(0, defIdx);
    } else if (asnIdx >= 0 && (reqIdx === -1 || asnIdx < reqIdx)) {
      mode = 'assign';
      arg = name.slice(asnIdx + 2);
      name = name.slice(0, asnIdx);
    } else if (altIdx >= 0 && (reqIdx === -1 || altIdx < reqIdx)) {
      mode = 'alt';
      arg = name.slice(altIdx + 2);
      name = name.slice(0, altIdx);
    } else if (reqIdx >= 0) {
      mode = 'required';
      arg = name.slice(reqIdx + 1);
      name = name.slice(0, reqIdx);
    }
    return { name, mode, arg };
  }

  function tryJsonHelper(arg: string, path: string[]): { used: true; value: unknown } | { used: false; value: string } {
    const trimmed = arg.trim();
    if (!/^json\(/.test(trimmed)) return { used: false, value: arg };
    // Requires a trailing )
    if (!trimmed.endsWith(')')) return { used: false, value: arg };
    const inner = trimmed.slice(5, -1); // between json( and )
    // Expand nested templates inside the JSON text
    const expanded = expandTemplate(inner, [...path, 'json']);
    try {
      const parsed = JSON.parse(expanded);
      return { used: true, value: parsed };
    } catch (e) {
      throw new Error(`confkit: json(...) helper parse error at ${path.join('.')} — ${(e as Error).message}`);
    }
  }

  function assignValue(name: string, assigned: unknown) {
    if (!assignMode) throw new Error(`confkit: expansion assign not enabled for ${name}`);
    if (assignMode === 'env') {
      const s = asString(assigned) ?? '';
      process.env[name] = s;
      out[name] = s; // reflect in output for consistency
    } else {
      out[name] = assigned;
      if (assignMode === 'cache') {
        fileCache[name] = assigned;
        cacheDirty = true;
      }
    }
  }

  function expandTemplate(str: string, path: string[]): string {
    // Protect escaped sequences
    const ESC = '__CONF_ESCAPED_OPEN__';
    let value = str.replace(/\\\$\{/g, ESC).replace(/\$\$\{/g, ESC);
    const re = /\$\{([^}]+)\}/g;
    value = value.replace(re, (_all, rawExpr: string) => {
      const { name, mode, arg } = parseExpr(rawExpr);
      if (resolving.has(name)) throw new Error(`confkit: variable cycle detected at ${name}`);
      resolving.add(name);

      const present = hasVar(name);
      let rep: string | undefined = asString(getVarRaw(name));

      if (!present || rep == null || rep === '') {
        if (mode === 'default') {
          const j = tryJsonHelper(arg, [...path, name]);
          rep = j.used ? asString(j.value) : expandTemplate(j.value, [...path, name]);
        }
        if (mode === 'required') throw new Error(arg || `confkit: required variable ${name} missing`);
        if (mode === 'assign') {
          const j = tryJsonHelper(arg, [...path, name]);
          const assigned = j.used ? j.value : expandTemplate(j.value, [...path, name]);
          assignValue(name, assigned);
          rep = asString(assigned);
        }
        if (rep == null) rep = '';
      } else {
        if (mode === 'alt') {
          const j = tryJsonHelper(arg, [...path, name]);
          rep = j.used ? asString(j.value) : expandTemplate(j.value, [...path, name]);
        }
        // Recursively expand nested patterns in the value
        if (rep != null) rep = expandTemplate(rep, [...path, name]);
      }

      resolving.delete(name);
      return rep ?? '';
    });
    // Restore escaped ${
    return value.replace(new RegExp(ESC, 'g'), '${');
  }

  function expandWhole(str: string, path: string[]): unknown {
    const m = /^\s*\$\{([^}]+)\}\s*$/.exec(str);
    if (!m) return expandTemplate(str, path);
    const rawExpr = m[1];
    const { name, mode, arg } = parseExpr(rawExpr);
    if (resolving.has(name)) throw new Error(`confkit: variable cycle detected at ${name}`);
    resolving.add(name);

    const present = hasVar(name);
    const currentVal = getVarRaw(name);
    let result: unknown = currentVal;
    if (!present || (typeof currentVal === 'string' && currentVal === '')) {
      if (mode === 'default') {
        const j = tryJsonHelper(arg, [...path, name]);
        result = j.used ? j.value : expandTemplate(j.value, [...path, name]);
      } else if (mode === 'required') {
        throw new Error(arg || `confkit: required variable ${name} missing`);
      } else if (mode === 'assign') {
        const j = tryJsonHelper(arg, [...path, name]);
        const assigned = j.used ? j.value : expandTemplate(j.value, [...path, name]);
        assignValue(name, assigned);
        result = assigned;
      } else if (mode === 'alt') {
        // alt with unset var → empty
        result = '';
      } else {
        result = '';
      }
    } else {
      if (mode === 'alt') {
        const j = tryJsonHelper(arg, [...path, name]);
        result = j.used ? j.value : expandTemplate(j.value, [...path, name]);
      } else if (mode !== 'plain') {
        // For other modes when present, just use the present value
        result = currentVal;
      }
    }
    resolving.delete(name);
    return result;
  }

  for (const k of Object.keys(out)) {
    const v = out[k];
    if (typeof v === 'string') out[k] = expandWhole(v, [k]);
  }

  // Persist cache if needed
  if (assignMode === 'cache' && cacheDirty && cachePath) {
    try {
      const fsMod = await import('node:fs');
      fsMod.writeFileSync(cachePath, JSON.stringify(fileCache, null, 2) + '\n', 'utf8');
    } catch {
      // ignore persistence errors
    }
  }

  return out;
}

function redactByNode(value: unknown, node: Node<unknown>, mask: string): unknown {
  if (node._meta?.secret) return mask;
  const kind = (node as Partial<{ _kind: string }>)._kind;
  if (kind === 'object') {
    const objNode = node as ObjectNode<Record<string, Node<unknown>>>;
    const result: Record<string, unknown> = {};
    const valRec = (value as Record<string, unknown>) || {};
    for (const k of Object.keys(objNode._shape)) {
      result[k] = redactByNode(valRec[k], objNode._shape[k], mask);
    }
    return result;
  }
  if (kind === 'array') {
    const arrNode = node as ArrayNode<unknown>;
    if (!Array.isArray(value)) return value;
    return value.map((v) => redactByNode(v, arrNode._inner, mask));
  }
  if (kind === 'record') {
    const recNode = node as RecordNode<unknown>;
    if (typeof value !== 'object' || value == null) return value;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = redactByNode(v, recNode._inner, mask);
    }
    return out;
  }
  if (kind === 'union') {
    const uNode = node as UnionNode<unknown>;
    // Try to find matching branch to redact appropriately
    for (const n of uNode._nodes) {
      const r = n.coerce(value);
      if (r.ok) return redactByNode(value, n, mask);
    }
    return value;
  }
  return value;
}
