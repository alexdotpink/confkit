import { loadConfig } from 'confkit/load';

export type ConfkitViteOptions = { file?: string };
export type ViteServer = { ws: { send(payload: any): void } ; watcher: { on: (evt:string, cb: (...a:any[])=>void) => void } };
export type VitePlugin = {
  name: string;
  config?: () => Promise<{ define?: Record<string, string> }> | { define?: Record<string, string> };
  configureServer?: (server: ViteServer) => void | Promise<void>;
  resolveId?: (id: string) => string | null;
  load?: (id: string) => Promise<string | undefined> | string | undefined;
};

export function confkitVite(opts: ConfkitViteOptions = {}): VitePlugin {
  return {
    name: 'confkit',
    async config() {
      const { clientEnv } = await loadConfig({ file: opts.file });
      const define: Record<string, string> = {};
      for (const [k, v] of Object.entries(clientEnv)) {
        define[`process.env.${k}`] = JSON.stringify(v);
      }
      return { define };
    },
    resolveId(id) {
      if (id === 'confkit:client') return '\0confkit:client';
      return null;
    },
    async load(id) {
      if (id === '\0confkit:client') {
        const { clientEnv } = await loadConfig({ file: opts.file });
        const obj = Object.fromEntries(Object.entries(clientEnv).map(([k,v]) => [k, String(v)]));
        const code = `export default ${JSON.stringify(obj)};`;
        return code;
      }
      return undefined;
    },
    async configureServer(server) {
      async function validate() {
        try {
          const { config } = await loadConfig({ file: opts.file });
          await config.ready();
          server.ws.send({ type: 'custom', event: 'confkit:ok' });
        } catch (err) {
          const issues = (err as { issues?: Array<{ path: string; message: string }> }).issues ?? [];
          const tips = ['Fix: adjust conf/config.ts schema or source values.', 'Docs: docs/schema.mdx · docs/integrations/vite (via @confkit/vite)'];
          const message = 'confkit validation failed\n' + issues.map(i=>`- ${i.path}: ${i.message}`).join('\n') + '\n' + tips.join(' \n');
          server.ws.send({ type: 'error', err: { message, stack: '' } });
        }
      }
      await validate();
      server.watcher.on('all', () => { validate(); });
    }
  };
}

export default confkitVite;
