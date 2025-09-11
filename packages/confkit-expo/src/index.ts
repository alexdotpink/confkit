import { loadConfig } from 'confkit/load';

export type ExpoConfig = Record<string, any> & { expo?: { extra?: Record<string, any> } };

export async function extraFromConfkit(opts: { file?: string; namespace?: string } = {}) {
  const { clientEnv } = await loadConfig({ file: opts.file });
  if (!opts.namespace) return clientEnv;
  return { [opts.namespace]: clientEnv } as Record<string, any>;
}

export async function withConfkitExpo(appConfig: ExpoConfig = {}, opts: { file?: string; namespace?: string } = {}) {
  const { clientEnv } = await loadConfig({ file: opts.file });
  const base = appConfig.expo?.extra ?? {};
  const extra = opts.namespace ? { ...base, [opts.namespace]: clientEnv } : { ...base, ...clientEnv };
  return { ...appConfig, expo: { ...appConfig.expo, extra } } as ExpoConfig;
}

export default withConfkitExpo;

