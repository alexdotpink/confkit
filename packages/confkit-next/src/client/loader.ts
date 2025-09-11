/*
 * @confkit/next client env virtual module loader
 *
 * Generates a JavaScript module for the virtual specifier 'confkit:client'.
 * The emitted code is `export default { ... }` where values are strings.
 */

type LoaderOptions = {
  file?: string;
};

export default async function confkitNextClientLoader(this: any) {
  const callback = this.async();
  const opts = (this.getOptions ? this.getOptions() : {}) as LoaderOptions;

  try {
    this.addContextDependency(process.cwd());
    if (opts.file) this.addDependency(opts.file);
  } catch {
    // ignore if not supported
  }

  try {
    const { loadConfig } = await (0, eval)("import('confkit/load')");
    const { clientEnv } = await loadConfig({ file: opts.file });
    const obj = Object.fromEntries(Object.entries(clientEnv).map(([k, v]) => [k, String(v)]));
    const code = `export default ${JSON.stringify(obj)};`;
    return callback(null, code);
  } catch (err) {
    // Fallback to an empty module to avoid hard failures during dev
    const e = new Error(`confkit:client loader error: ${(err as Error)?.message ?? String(err)}`);
    this.emitError(e);
    return callback(null, 'export default {};\n');
  }
}

