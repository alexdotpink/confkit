import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { defineConfig, s, source } from '../src/index';

describe('policy: no secrets on client', () => {
  const envBackup = { ...process.env };
  beforeEach(() => { Object.assign(process.env, envBackup); });
  afterEach(() => { Object.assign(process.env, envBackup); });

  it('throws if a secret is marked client()', async () => {
    const cfg = defineConfig({
      sources: [source().inline({ SECRET: 's' })],
      schema: { SECRET: s.secret(s.string()).client() },
    });
    await expect(cfg.pickClient()).rejects.toThrow(/cannot be exposed to the client/);
  });

  it('throws if a secret has a public prefix', async () => {
    const cfg = defineConfig({
      sources: [source().inline({ PUBLIC_SECRET: 's' })],
      schema: { PUBLIC_SECRET: s.secret(s.string()) },
    });
    await expect(cfg.pickClient()).rejects.toThrow(/cannot be exposed to the client/);
  });
});

describe('policy: required keys in production', () => {
  const envBackup = { ...process.env };
  beforeEach(() => { Object.assign(process.env, envBackup); });
  afterEach(() => { Object.assign(process.env, envBackup); });

  it('accepts missing in non-production', async () => {
    Object.assign(process.env, { NODE_ENV: 'development' });
    const cfg = defineConfig({
      sources: [source().inline({})],
      schema: { MUST: s.string().optional() },
      requiredProdKeys: ['MUST'],
    });
    await expect(cfg.ready()).resolves.toEqual({ MUST: undefined });
  });

  it('fails when missing in production and passes when present', async () => {
    // Missing should fail
    Object.assign(process.env, { NODE_ENV: 'production' });
    const cfgMissing = defineConfig({
      sources: [source().inline({})],
      schema: { MUST: s.string().optional() },
      requiredProdKeys: ['MUST'],
    });
    await expect(cfgMissing.ready()).rejects.toMatchObject({ issues: [{ path: 'MUST' }] });

    // Present should pass
    Object.assign(process.env, { NODE_ENV: 'production' });
    const cfgPresent = defineConfig({
      sources: [source().inline({ MUST: 'ok' })],
      schema: { MUST: s.string().optional() },
      requiredProdKeys: ['MUST'],
    });
    await expect(cfgPresent.ready()).resolves.toEqual({ MUST: 'ok' });
  });
});

