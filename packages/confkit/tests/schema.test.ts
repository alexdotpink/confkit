import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { s, defineConfig, source, combine } from '../src/index';

describe('schema nodes (s.*)', () => {
  it('string/int/number/boolean basics', () => {
    expect(s.string().coerce('x')).toEqual({ ok: true, value: 'x' });
    expect(s.string().coerce(1).ok).toBe(false);

    expect(s.int().coerce('42')).toEqual({ ok: true, value: 42 });
    expect(s.int().coerce(3.14).ok).toBe(false);

    expect(s.number().coerce('3.14')).toEqual({ ok: true, value: 3.14 });
    expect(s.number().coerce('nope').ok).toBe(false);

    expect(s.boolean().coerce(true)).toEqual({ ok: true, value: true });
    expect(s.boolean().coerce('false')).toEqual({ ok: true, value: false });
    expect(s.boolean().coerce('1').ok).toBe(false);
  });

  it('enum with suggestion', () => {
    const node = s.enum(['dev', 'prod'] as const);
    expect(node.coerce('prod')).toEqual({ ok: true, value: 'prod' });
    const bad = node.coerce('prd');
    expect(bad.ok).toBe(false);
    // message includes did-you-mean
    expect((bad as any).issues[0].message).toContain('did you mean');
  });

  it('url + origin transform', () => {
    const url = 'https://example.com/path?q=1';
    const node = s.url();
    const r = node.coerce(url);
    expect(r).toEqual({ ok: true, value: url });
    const origin = node.origin();
    const ro = origin.coerce(url);
    expect(ro).toEqual({ ok: true, value: 'https://example.com' });
  });

  it('uuid/port/email/host/ip/duration', () => {
    expect(s.uuid().coerce('123e4567-e89b-12d3-a456-426614174000').ok).toBe(true);
    expect(s.uuid().coerce('not-uuid').ok).toBe(false);

    expect(s.port().coerce(8080)).toEqual({ ok: true, value: 8080 });
    expect(s.port().coerce(70000).ok).toBe(false);

    expect(s.email().coerce('a@b.co').ok).toBe(true);
    expect(s.email().coerce('nope').ok).toBe(false);

    expect(s.host().coerce('example.com').ok).toBe(true);
    expect(s.host().coerce('-bad-').ok).toBe(false);

    expect(s.ip().coerce('127.0.0.1').ok).toBe(true);
    expect(s.ip().coerce('2001:0db8:85a3:0000:0000:8a2e:0370:7334').ok).toBe(true);
    expect(s.ip().coerce('::1').ok).toBe(false);

    expect(s.duration().coerce('2s')).toEqual({ ok: true, value: 2000 });
    expect(s.duration().coerce('P1DT2H')).toEqual({ ok: true, value: (24 + 2) * 3600 * 1000 });
  });

  it('json inner schema', () => {
    const inner = s.object({ a: s.int() });
    const node = s.json(inner);
    const ok = node.coerce('{"a": 1}');
    expect(ok).toEqual({ ok: true, value: { a: 1 } });
    const bad = node.coerce('{"a":"x"}');
    expect(bad.ok).toBe(false);
  });

  it('array/record/union/regex', () => {
    expect(s.array(s.int()).coerce(['1', 2])).toEqual({ ok: true, value: [1, 2] });
    expect(s.record(s.boolean()).coerce({ A: 'true', B: false })).toEqual({ ok: true, value: { A: true, B: false } });

    const node = s.union([s.int(), s.boolean()] as const);
    expect(node.coerce('2')).toEqual({ ok: true, value: 2 });
    expect(node.coerce('false')).toEqual({ ok: true, value: false });
    expect(node.coerce('nope').ok).toBe(false);

    expect(s.regex(/^[a-z]+$/).coerce('abc').ok).toBe(true);
    expect(s.regex(/^[a-z]+$/).coerce('123').ok).toBe(false);
  });

  it('optional/default/refine/transform', () => {
    expect(s.int().optional().coerce(undefined)).toEqual({ ok: true, value: undefined });
    expect(s.int().default(5).coerce(undefined)).toEqual({ ok: true, value: 5 });

    const refined = s.int().refine((v) => v > 0, 'must be > 0');
    expect(refined.coerce(1)).toEqual({ ok: true, value: 1 });
    expect(refined.coerce(0).ok).toBe(false);

    const transformed = s.int().transform((v) => String(v));
    expect(transformed.coerce('7')).toEqual({ ok: true, value: '7' });
  });
});

describe('defineConfig API', () => {
  const envBackup = { ...process.env };
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // make audit sampling deterministic when used
  });
  afterEach(() => {
    Object.assign(process.env, envBackup);
  });

  it('ready/toJSON redaction and get() audit', async () => {
    const audit = { emit: vi.fn(), sample: 1 };
    const cfg = defineConfig({
      sources: [
        source().inline({ FOO: 'bar', SECRET: 'abc123', PUBLIC_URL: 'https://example.com' }),
      ],
      schema: {
        FOO: s.string(),
        SECRET: s.secret(s.string()),
        PUBLIC_URL: s.string().client(),
      },
      audit,
    });

    const api = cfg; // runtime API
    await expect(api.ready()).resolves.toEqual({ FOO: 'bar', SECRET: 'abc123', PUBLIC_URL: 'https://example.com' });

    const raw = await api.toJSON();
    expect(raw).toEqual({ FOO: 'bar', SECRET: 'abc123', PUBLIC_URL: 'https://example.com' });
    const redacted = await api.toJSON({ redact: true });
    expect((redacted as any).SECRET).toBe('•••');

    // get() triggers audit for secrets
    await api.get('SECRET' as any);
    expect(audit.emit).toHaveBeenCalledWith(expect.objectContaining({ type: 'secret_read', key: 'SECRET' }));
  });

  it('pickClient respects prefixes in production', async () => {
    const cfg = defineConfig({
      sources: [source().inline({ PRIVATE_TOKEN: 't', PUBLIC_API: 'ok' })],
      schema: {
        PRIVATE_TOKEN: s.string().client(),
        PUBLIC_API: s.string().client(),
      },
    });
    // Non-prod: allow without prefix
    Object.assign(process.env, { NODE_ENV: 'test' });
    let client = await cfg.pickClient();
    expect(client).toEqual({ PRIVATE_TOKEN: 't', PUBLIC_API: 'ok' });

    // Prod: require prefix (defaults to PUBLIC_/NEXT_PUBLIC_/EXPO_PUBLIC_)
    Object.assign(process.env, { NODE_ENV: 'production' });
    await expect(cfg.pickClient()).rejects.toThrow(/does not match required clientPrefix/);

    // If we drop client() from PRIVATE_TOKEN and keep prefix for other, pickClient should include only prefixed key
    const cfg2 = defineConfig({
      sources: [source().inline({ PRIVATE_TOKEN: 't', PUBLIC_API: 'ok' })],
      schema: {
        PRIVATE_TOKEN: s.string(),
        PUBLIC_API: s.string().client(),
      },
    });
    Object.assign(process.env, { NODE_ENV: 'production' });
    client = await cfg2.pickClient();
    expect(client).toEqual({ PUBLIC_API: 'ok' });
  });

  it('lintUnknowns/explain/describeSchema/reload', async () => {
    const cfg = defineConfig({
      sources: [
        source().inline({ A: '1', B: '2', UNKNOWN: 'x' }),
        source().inline({ A: '3' }),
      ],
      schema: { A: s.int(), B: s.int() },
      expand: false,
    });

    await expect(cfg.ready()).resolves.toEqual({ A: 3, B: 2 });
    expect(await cfg.lintUnknowns?.()).toEqual(['UNKNOWN']);

    const explainedAll = await cfg.explain?.();
    expect(explainedAll && explainedAll.find((e) => e.key === 'A')?.value).toBe('3');

    const explainedOne = await cfg.explain?.('B');
    expect(explainedOne).toEqual([
      expect.objectContaining({ key: 'B', value: '2', index: 0 }),
    ]);

    const d = cfg.describeSchema?.();
    expect(d).toBeTruthy();
    expect(d?.A).toMatchObject({ kind: 'int' });

    // reload invalidates cache
    const before = await cfg.toJSON();
    await cfg.reload?.();
    const after = await cfg.toJSON();
    expect(after).toEqual(before);
  });
});
