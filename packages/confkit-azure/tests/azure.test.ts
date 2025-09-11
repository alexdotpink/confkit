import { describe, it, expect, vi } from 'vitest';

vi.mock('@azure/identity', () => ({ DefaultAzureCredential: class {} }));

vi.mock('@azure/keyvault-secrets', () => {
  class SecretClient {
    vaultUrl: string;
    cred: any;
    constructor(vaultUrl: string, cred: any) { this.vaultUrl = vaultUrl; this.cred = cred; }
    listPropertiesOfSecrets() {
      const page = [{ name: 'db-password' }, { name: 'api-key' }];
      return {
        async *byPage() { yield page; }
      } as any;
    }
    async getSecret(name: string) {
      if (name === 'db-password') return { value: 'p@ss', properties: { version: '1' } } as any;
      if (name === 'api-key') return { value: 'k-1', properties: { version: '42' } } as any;
      return { value: '', properties: {} } as any;
    }
  }
  return { SecretClient };
});

import { azureKeyVaultSource } from '../src/index';

describe('@confkit/azure — azureKeyVaultSource', () => {
  it('lists and gets secrets; maps names; supports prefix', async () => {
    const srcAll = azureKeyVaultSource({ vaultUrl: 'https://v', ttlMs: 10, jitter: 0, background: false });
    const outAll = await srcAll();
    expect(outAll).toEqual({ DB_PASSWORD: 'p@ss', API_KEY: 'k-1' });

    const srcPref = azureKeyVaultSource({ vaultUrl: 'https://v', namePrefix: 'api-', ttlMs: 10, jitter: 0, background: false });
    const outPref = await srcPref();
    expect(outPref).toEqual({ API_KEY: 'k-1' });
  });
});

