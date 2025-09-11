import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the AWS SDK client
vi.mock('@aws-sdk/client-secrets-manager', () => {
  class SecretsManagerClient {
    cfg: any;
    constructor(cfg: any) { this.cfg = cfg; }
    async send(cmd: any) {
      const type = cmd?.__type;
      if (type === 'ListSecretsCommand') {
        return { SecretList: [
          { Name: '/apps/app/DB_PASSWORD', ARN: 'arn:a' },
          { Name: '/apps/app/API_KEY', ARN: 'arn:b' },
        ] } as any;
      }
      if (type === 'BatchGetSecretValueCommand') {
        // Induce fallback by throwing to exercise GetSecretValue path in one test
        throw new Error('Batch not supported');
      }
      if (type === 'GetSecretValueCommand') {
        const id = String(cmd.input.SecretId);
        const phase = (globalThis as any).__awsPhase || 1;
        if (id === 'arn:a' || id.includes('DB_PASSWORD')) return { Name: '/apps/app/DB_PASSWORD', SecretString: 'p@ss' } as any;
        if (id === 'arn:b' || id.includes('API_KEY')) return { Name: '/apps/app/API_KEY', SecretString: phase === 1 ? 'k-1' : 'k-2', VersionId: phase === 1 ? 'v1' : 'v2' } as any;
        return {} as any;
      }
      return {} as any;
    }
  }
  class ListSecretsCommand { __type = 'ListSecretsCommand'; constructor(public input?: any) {} }
  class BatchGetSecretValueCommand { __type = 'BatchGetSecretValueCommand'; constructor(public input?: any) {} }
  class GetSecretValueCommand { __type = 'GetSecretValueCommand'; constructor(public input?: any) {} }
  return { SecretsManagerClient, ListSecretsCommand, BatchGetSecretValueCommand, GetSecretValueCommand };
});

import { awsSecretsSource } from '../src/index';

describe('@confkit/aws — awsSecretsSource', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it('fetches secrets and maps names to keys (fallback path)', async () => {
    const src = awsSecretsSource({ namePrefix: '/apps/app/', ttlMs: 1000, jitter: 0, background: false });
    const out = await src();
    expect(out).toEqual({ DB_PASSWORD: 'p@ss', API_KEY: 'k-1' });
  });

  it('detects rotation with onRotate after TTL expiry', async () => {
    const onRotate = vi.fn();
    const src = awsSecretsSource({ namePrefix: '/apps/app/', ttlMs: 10, jitter: 0, background: false, onRotate });
    (globalThis as any).__awsPhase = 1;
    vi.setSystemTime(0);
    const first = await src();
    expect(first.API_KEY).toBe('k-1');

    // Force TTL expiry and switch phase
    await src();
    (globalThis as any).__awsPhase = 2;
    vi.setSystemTime(20);
    const second = await src();
    expect(second.API_KEY).toBe('k-2');
    expect(onRotate).toHaveBeenCalledWith('API_KEY', 'k-2', expect.objectContaining({ version: 'v2' }));
  });
});
