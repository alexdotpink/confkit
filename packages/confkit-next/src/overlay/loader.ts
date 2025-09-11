/*
 * @confkit/next overlay loader
 *
 * Emits friendly validation diagnostics into Next.js' dev overlay by
 * validating the confkit config at build time and emitting a webpack error
 * with a compact, readable message when issues are found.
 */

type LoaderOptions = {
  file?: string;
  devOnly?: boolean;
};

export default async function confkitNextOverlayLoader(this: any) {
  const callback = this.async();
  const opts = (this.getOptions ? this.getOptions() : {}) as LoaderOptions;

  // Ensure quick rebuilds when anything under CWD changes (env files, config, etc.)
  try {
    // Narrow watch to project root; avoids missing .env or config file edits
    this.addContextDependency(process.cwd());
    if (opts.file) this.addDependency(opts.file);
  } catch {
    // noop — some environments may not support dependency registration
  }

  try {
    if ((opts.devOnly ?? true) && process.env.NODE_ENV === 'production') {
      return callback(null, 'export {};\n');
    }

    // Load and validate config using the confkit loader (Node-side)
    // Use eval'd dynamic import to avoid bundlers trying to include 'confkit/load'
    const { loadConfig } = await (0, eval)("import('confkit/load')");
    const { config } = await loadConfig({ file: opts.file });
    await config.ready();

    // No issues — provide a tiny stub module
    return callback(null, 'export {};\n');
  } catch (err) {
    // Build a concise, readable diagnostics list for the overlay panel
    const issues = (err as { issues?: Array<{ path: string; message: string }> }).issues ?? [];
    const heading = 'Confkit validation failed';
    const tips = [
      'Fix: adjust conf/config.ts schema or source values.',
      'Docs: docs/schema.mdx · docs/integrations/next.mdx',
    ];
    const message = issues.length
      ? `${heading}\n` + issues.map((i) => `- ${i.path}: ${i.message}`).join('\n') + '\n' + tips.join(' \n')
      : `${heading}: ${(err as Error)?.message ?? String(err)}\n` + tips.join(' \n');

    const e = new Error(message);
    e.name = 'ConfkitError';
    this.emitError(e);

    // Still emit a stub module so bundling can continue and overlay can render
    return callback(null, 'export {};\n');
  }
}
