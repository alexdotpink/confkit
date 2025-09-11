import { describe, it, expect, vi } from 'vitest';

vi.mock('@google-cloud/secret-manager', () => {
  class SecretManagerServiceClient {
    async getProjectId() { return 'p1'; }
    async listSecrets({ parent }: { parent: string }) {
      return [[{ name: `${parent}/secrets/db_password` }, { name: `${parent}/secrets/api_key` }]] as any;
    }
    async accessSecretVersion({ name }: { name: string }) {
      if (name.endsWith('db_password/versions/latest')) return [{ name: `${name.replace('latest','1')}`, payload: { data: Buffer.from('p@ss') } }] as any;
      if (name.endsWith('api_key/versions/latest')) return [{ name: `${name.replace('latest','2')}`, payload: { data: Buffer.from('k-1') } }] as any;
      return [{}] as any;
    }
  }
  return { SecretManagerServiceClient };
});

import { gcpSecretsSource } from '../src/index';

describe('@confkit/gcp — gcpSecretsSource', () => {
  it('lists secrets and accesses latest versions; maps to keys', async () => {
    const src = gcpSecretsSource({ ttlMs: 10, jitter: 0, background: false });
    const out = await src();
    expect(out).toEqual({ DB_PASSWORD: 'p@ss', API_KEY: 'k-1' });
  });
});

