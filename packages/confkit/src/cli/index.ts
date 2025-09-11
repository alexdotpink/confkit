#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../load.js';

type Flags = Record<string, string | boolean | undefined>;

function parseArgs(argv: string[]): { cmd: string; flags: Flags } {
  const [, , cmd = 'help', ...rest] = argv;
  const flags: Flags = {};
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = rest[i + 1];
    if (next && !next.startsWith('--')) {
      flags[key] = next;
      i++;
    } else {
      flags[key] = true;
    }
  }
  return { cmd, flags };
}

function logJSON(obj: unknown) {
  process.stdout.write(JSON.stringify(obj, null, 2) + '\n');
}

function flatten(obj: Record<string, unknown>, prefix = ''): Array<[string, string]> {
  const rows: Array<[string, string]> = [];
  const isPlainObject = (v: unknown) => typeof v === 'object' && v != null && !Array.isArray(v);
  for (const key of Object.keys(obj).sort()) {
    const val = (obj as Record<string, unknown>)[key];
    const pathKey = prefix ? `${prefix}.${key}` : key;
    if (isPlainObject(val)) {
      rows.push(...flatten(val as Record<string, unknown>, pathKey));
    } else if (Array.isArray(val)) {
      // Expand arrays as comma-separated JSON for readability
      try {
        rows.push([pathKey, JSON.stringify(val)]);
      } catch {
        rows.push([pathKey, String(val)]);
      }
    } else {
      if (typeof val === 'string') rows.push([pathKey, val]);
      else {
        try {
          rows.push([pathKey, JSON.stringify(val)]);
        } catch {
          rows.push([pathKey, String(val)]);
        }
      }
    }
  }
  return rows;
}

function printTable(rows: Array<[string, string]>, headers: [string, string] = ['Key', 'Value']) {
  const all = [headers, ...rows];
  const widths = [
    Math.max(...all.map((r) => r[0].length)),
    Math.max(...all.map((r) => (r[1] ?? '').length)),
  ];
  const [w1, w2] = widths;
  const sep = `+${'-'.repeat(w1 + 2)}+${'-'.repeat(w2 + 2)}+`;
  const line = (a: string, b: string) => `| ${a.padEnd(w1)} | ${b.padEnd(w2)} |`;
  console.log(sep);
  console.log(line(headers[0], headers[1]));
  console.log(sep);
  for (const [k, v] of rows) console.log(line(k, v ?? ''));
  console.log(sep);
}

function colorize() {
  const isTTY = process.stdout.isTTY;
  const on = (code: number) => (s: string) => (isTTY ? `\u001b[${code}m${s}\u001b[0m` : s);
  return {
    green: on(32),
    red: on(31),
    yellow: on(33),
    dim: on(2),
  } as const;
}

async function run() {
  const { cmd, flags } = parseArgs(process.argv);
  const file = typeof flags.file === 'string' ? path.resolve(String(flags.file)) : undefined;
  const env = typeof flags.env === 'string' ? String(flags.env) : undefined;
  if (env) process.env.NODE_ENV = env;

  // Handle help early
  if (cmd === 'help' || flags.help) {
    console.log(`
confkit <command> [--file conf/config.ts] [--env production]

Commands:
  check         Validate and report summary
  print         Print config (redacted by default)
  diff          Compare two envs or two sources
  dev           Watch and diff config changes locally
  init          Scaffold conf/config.ts and .env.example (from schema)
  explain       Show where values come from (use --key to filter)
  doctor        Run basic environment checks
  types         Generate types for 'confkit:client' virtual module
  scan          Scan code for process.env/import.meta.env usage vs schema

Flags:
  --file <path>       Path to config file (default conf/config.ts)
  --env <name>        Set NODE_ENV before loading
  --no-redact         For print: show raw values (DANGEROUS)
  --json              For print: output raw JSON instead of a table
  --from-env <name>   For diff: left env name
  --to-env <name>     For diff: right env name
  --from-source <s>   For diff: left source name (exact/substring)
  --to-source <s>     For diff: right source name (exact/substring)
  --matrix            For diff: print key | A | B | status table
  --strict            For check: fail if unknown keys are present
  --key <name>        For explain: show a single key only
  --out <file>        For types: output file (default confkit-env.d.ts)
  --server            For types: generate server-side env interface instead of client module
  --watch             For types: watch and regenerate on changes
  --dir <path>        For scan: directory to scan (default CWD)
  --allow <keys>      For scan: comma-separated allowed keys to ignore

Dev controls:
  r: reload now
  s: toggle redaction on/off
  c: copy invalid paths to clipboard when validation fails
`);
    return;
  }

  // Special-case init so it works before a config exists.
  if (cmd === 'init') {
    const confDir = path.resolve(process.cwd(), 'conf');
    const confFile = path.join(confDir, 'config.ts');
    const envExample = path.resolve(process.cwd(), '.env.example');
    const workflowDir = path.resolve(process.cwd(), '.github/workflows');
    const workflowFile = path.join(workflowDir, 'confkit.yml');
    if (!fs.existsSync(confDir)) fs.mkdirSync(confDir, { recursive: true });
    if (!fs.existsSync(confFile)) {
      const content = `import { defineConfig, s, source } from 'confkit';

export const config = defineConfig({
  sources: [source().env(), source().file('config.json')],
  schema: {
    NODE_ENV: s.enum(['development','test','production']).default('development'),
    PORT: s.port().default(3000),
    DATABASE_URL: s.string(),
    PUBLIC_APP_NAME: s.string().client().default('confkit'),
    STRIPE_SECRET: s.secret(s.string()),
  },
});
`;
      fs.writeFileSync(confFile, content, 'utf8');
      console.log('✔ Created', path.relative(process.cwd(), confFile));
    } else {
      console.log('• Exists', path.relative(process.cwd(), confFile));
    }

    // Generate .env.example from schema (best-effort). Prefer --file when provided.
    if (!fs.existsSync(envExample)) {
      let desc: Record<string, any> | undefined;
      const targetFile = file ?? confFile;
      try {
        const loaded = await loadConfig({ file: targetFile, computeClientEnv: false });
        if (typeof (loaded.config as any).describeSchema === 'function') {
          desc = (loaded.config as any).describeSchema() as Record<string, any>;
        }
      } catch {
        // Ignore load errors; we'll fall back to a tiny template
      }
      function exampleFor(key: string, node: any): string {
        const kind = node?.kind ?? 'string';
        if (kind === 'enum') return String((node?.values?.[0] ?? ''));
        if (kind === 'port') return '3000';
        if (kind === 'boolean') return 'false';
        if (kind === 'url') return 'http://localhost:3000';
        if (kind === 'email') return 'admin@example.com';
        if (kind === 'json') return '{}';
        if (kind === 'number' || kind === 'int' || kind === 'float') return '0';
        // Secrets: leave blank intentionally
        if (node?.secret) return '';
        // Sensible defaults for known keys
        if (key === 'NODE_ENV') return 'development';
        if (key === 'PUBLIC_APP_NAME') return 'confkit';
        return '';
      }
      const lines: string[] = [];
      lines.push('# Example env — generated from your Confkit schema');
      if (desc && Object.keys(desc).length) {
        const keys = Object.keys(desc).sort();
        for (const k of keys) {
          const node = (desc as Record<string, any>)[k];
          // Only emit top-level scalar-like nodes; for structures, emit a blank placeholder
          const val = exampleFor(k, node);
          if (node?.kind && ['object', 'array', 'record', 'union'].includes(String(node.kind))) {
            lines.push(`# ${k}: ${node.kind} — provide JSON if using env`);
          }
          if (node?.secret) lines.push(`# ${k} is marked secret`);
          lines.push(`${k}=${val}`);
        }
      } else {
        // Fallback minimal template if schema unavailable
        lines.push('NODE_ENV=development');
        lines.push('PORT=3000');
      }
      fs.writeFileSync(envExample, lines.join('\n') + '\n', 'utf8');
      console.log('✔ Created', path.relative(process.cwd(), envExample));
    } else {
      console.log('• Exists', path.relative(process.cwd(), envExample));
    }

    if (!fs.existsSync(workflowDir)) fs.mkdirSync(workflowDir, { recursive: true });
    if (!fs.existsSync(workflowFile)) {
      const content = `name: confkit\n on: [push, pull_request]\n jobs:\n  check:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with: { node-version: '20' }\n      - run: npm ci\n      - run: npx confkit check --env production\n      - run: npx confkit scan --dir .\n`;
      fs.writeFileSync(workflowFile, content, 'utf8');
      console.log('✔ Created', path.relative(process.cwd(), workflowFile));
    } else {
      console.log('• Exists', path.relative(process.cwd(), workflowFile));
    }
    return;
  }

  try {
    const { config } = await loadConfig({ file, computeClientEnv: false });
    if (cmd === 'check' || cmd === 'print') {
      const c = colorize();
      try {
        await config.ready();
      } catch (err) {
        const issues = (err as { issues?: Array<{ path: string; message: string }> }).issues ?? [];
        console.error(c.red('✖ Validation failed'));
        if (issues.length) {
          printTable(
            issues.map((i) => [i.path, i.message]),
            ['Path', 'Message']
          );
        }
        process.exitCode = 1;
        return;
      }
      if (cmd === 'check') {
        const json = (await config.toJSON({ redact: true })) as Record<string, unknown>;
        const rows = flatten(json);
        const topLevel = Object.keys(json).length;
        console.log(c.green(`✔ Validated ${topLevel} keys`));
        if (typeof (config as any).lintUnknowns === 'function') {
          try {
            const unknowns = await (config as any).lintUnknowns();
            if (unknowns.length) {
              console.log(c.yellow(`⚠ Unknown keys (${unknowns.length}):`));
              for (const u of unknowns) console.log('  -', u);
              if (flags['strict']) process.exitCode = 1;
            }
          } catch {}
        }
        printTable(rows);
        return;
      }
      const redact = !flags['no-redact'];
      const json = (await config.toJSON({ redact })) as Record<string, unknown>;
      if (flags['json']) {
        logJSON(json);
      } else {
        const rows = flatten(json);
        printTable(rows);
      }
      return;
    }

    if (cmd === 'diff') {
      const c = colorize();
      // Decide mode: env-based vs source-based
      const fromEnv = typeof flags['from-env'] === 'string' ? String(flags['from-env']) : undefined;
      const toEnv = typeof flags['to-env'] === 'string' ? String(flags['to-env']) : undefined;
      const fromSource = typeof flags['from-source'] === 'string' ? String(flags['from-source']) : undefined;
      const toSource = typeof flags['to-source'] === 'string' ? String(flags['to-source']) : undefined;
      const wantMatrix = !!flags['matrix'];
      const redact = !flags['no-redact'];

      async function snapshotEnv(envName: string) {
        const prevNodeEnv = process.env.NODE_ENV;
        try {
          process.env.NODE_ENV = envName;
          const { config } = await loadConfig({ file, computeClientEnv: false });
          await config.ready();
          const json = (await config.toJSON({ redact })) as Record<string, unknown>;
          return json;
        } finally {
          // Restore only NODE_ENV
          if (prevNodeEnv === undefined) delete process.env.NODE_ENV;
          else process.env.NODE_ENV = prevNodeEnv;
        }
      }
      function mapFlat(obj: Record<string, unknown>) {
        const entries = flatten(obj);
        const m = new Map<string, string>();
        for (const [k, v] of entries) m.set(k, String(v ?? ''));
        return m;
      }
      function table3(rows: Array<[string, string, string, string]>, headers: [string, string, string, string]) {
        const all = [headers, ...rows];
        const w = [0, 0, 0, 0];
        for (const r of all) for (let i = 0; i < 4; i++) w[i] = Math.max(w[i], (r[i] ?? '').length);
        const sep = `+${'-'.repeat(w[0] + 2)}+${'-'.repeat(w[1] + 2)}+${'-'.repeat(w[2] + 2)}+${'-'.repeat(w[3] + 2)}+`;
        const line = (a: string, b: string, d: string, e: string) => `| ${a.padEnd(w[0])} | ${b.padEnd(w[1])} | ${d.padEnd(w[2])} | ${e.padEnd(w[3])} |`;
        console.log(sep);
        console.log(line(...headers));
        console.log(sep);
        for (const r of rows) console.log(line(r[0], r[1], r[2], r[3]));
        console.log(sep);
      }
      function classify(a: Map<string, string>, b: Map<string, string>) {
        const added: Array<{ key: string; to: string }> = [];
        const removed: Array<{ key: string; from: string }> = [];
        const changed: Array<{ key: string; from: string; to: string }> = [];
        const keys = new Set<string>([...a.keys(), ...b.keys()]);
        for (const k of [...keys].sort()) {
          const va = a.get(k);
          const vb = b.get(k);
          if (va === undefined && vb !== undefined) added.push({ key: k, to: vb });
          else if (va !== undefined && vb === undefined) removed.push({ key: k, from: va });
          else if (va !== vb) changed.push({ key: k, from: va ?? '', to: vb ?? '' });
        }
        return { added, removed, changed };
      }

      if (fromEnv && toEnv) {
        let left: Record<string, unknown>;
        let right: Record<string, unknown>;
        try {
          left = await snapshotEnv(fromEnv);
        } catch (err) {
          const issues = (err as { issues?: Array<{ path: string; message: string }> }).issues ?? [];
          console.error(c.red(`✖ Validation failed for env ${fromEnv}`));
          if (issues.length) printTable(issues.map((i) => [i.path, i.message]), ['Path', 'Message']);
          process.exitCode = 1;
          return;
        }
        try {
          right = await snapshotEnv(toEnv);
        } catch (err) {
          const issues = (err as { issues?: Array<{ path: string; message: string }> }).issues ?? [];
          console.error(c.red(`✖ Validation failed for env ${toEnv}`));
          if (issues.length) printTable(issues.map((i) => [i.path, i.message]), ['Path', 'Message']);
          process.exitCode = 1;
          return;
        }
        const a = mapFlat(left);
        const b = mapFlat(right);
        const { added, removed, changed } = classify(a, b);
        console.log(c.yellow(`Diff (env ${fromEnv} -> ${toEnv}) — added:${added.length} removed:${removed.length} changed:${changed.length}`));
        if (flags['json']) {
          logJSON({ fromEnv, toEnv, added, removed, changed });
          return;
        }
        if (wantMatrix) {
          const rows: Array<[string, string, string, string]> = [];
          const keys = new Set<string>([...a.keys(), ...b.keys()]);
          for (const k of [...keys].sort()) {
            const va = a.get(k);
            const vb = b.get(k);
            let status = 'same';
            if (va === undefined && vb !== undefined) status = 'added';
            else if (va !== undefined && vb === undefined) status = 'removed';
            else if (va !== vb) status = 'changed';
            rows.push([k, String(va ?? ''), String(vb ?? ''), status]);
          }
          table3(rows, ['Key', fromEnv, toEnv, 'Status']);
        } else {
          if (added.length) {
            console.log(c.green('Added'));
            printTable(added.map((r) => [r.key, r.to]));
          }
          if (removed.length) {
            console.log(c.red('Removed'));
            printTable(removed.map((r) => [r.key, r.from]));
          }
          if (changed.length) {
            console.log(c.yellow('Changed'));
            printTable(changed.map((r) => [r.key, `${r.from} -> ${r.to}`]), ['Key', `${fromEnv} -> ${toEnv}` as string]);
          }
        }
        return;
      }

      if (fromSource && toSource) {
        if (typeof (config as any).readSources !== 'function') {
          console.log('diff --from-source/--to-source: not supported in this version of confkit');
          return;
        }
        // Use current process.env (including --env if provided earlier) to load sources once
        const sources = await (config as any).readSources();
        function pick(name: string) {
          const lowered = name.toLowerCase();
          const matches = sources.filter((s: any) => String(s.name).toLowerCase().includes(lowered));
          if (matches.length === 0) throw new Error(`No source matched ${name}. Available: ${sources.map((s: any) => s.name).join(', ')}`);
          if (matches.length > 1) throw new Error(`Multiple sources matched ${name}: ${matches.map((s: any) => s.name).join(', ')}`);
          return matches[0];
        }
        let left: { name: string; value: Record<string, unknown> };
        let right: { name: string; value: Record<string, unknown> };
        try {
          const a = pick(fromSource);
          const b = pick(toSource);
          left = { name: a.name, value: a.value };
          right = { name: b.name, value: b.value };
        } catch (e) {
          console.error(c.red(String((e as Error).message)));
          process.exitCode = 1;
          return;
        }

        const a = mapFlat(left.value);
        const b = mapFlat(right.value);
        const { added, removed, changed } = classify(a, b);
        console.log(c.yellow(`Diff (source ${left.name} -> ${right.name}) — added:${added.length} removed:${removed.length} changed:${changed.length}`));
        if (flags['json']) {
          logJSON({ fromSource: left.name, toSource: right.name, added, removed, changed });
          return;
        }
        if (wantMatrix) {
          const rows: Array<[string, string, string, string]> = [];
          const keys = new Set<string>([...a.keys(), ...b.keys()]);
          for (const k of [...keys].sort()) {
            const va = a.get(k);
            const vb = b.get(k);
            let status = 'same';
            if (va === undefined && vb !== undefined) status = 'added';
            else if (va !== undefined && vb === undefined) status = 'removed';
            else if (va !== vb) status = 'changed';
            rows.push([k, String(va ?? ''), String(vb ?? ''), status]);
          }
          table3(rows, ['Key', left.name, right.name, 'Status']);
        } else {
          if (added.length) {
            console.log(c.green('Added'));
            printTable(added.map((r) => [r.key, r.to]));
          }
          if (removed.length) {
            console.log(c.red('Removed'));
            printTable(removed.map((r) => [r.key, r.from]));
          }
          if (changed.length) {
            console.log(c.yellow('Changed'));
            printTable(changed.map((r) => [r.key, `${r.from} -> ${r.to}`]), ['Key', `${left.name} -> ${right.name}` as string]);
          }
        }
        return;
      }

      console.log('diff: specify either --from-env/--to-env or --from-source/--to-source');
      return;
    }

    if (cmd === 'init') {
      const confDir = path.resolve(process.cwd(), 'conf');
      const confFile = path.join(confDir, 'config.ts');
      const envExample = path.resolve(process.cwd(), '.env.example');
      const workflowDir = path.resolve(process.cwd(), '.github/workflows');
      const workflowFile = path.join(workflowDir, 'confkit.yml');
      if (!fs.existsSync(confDir)) fs.mkdirSync(confDir, { recursive: true });
      if (!fs.existsSync(confFile)) {
        const content = `import { defineConfig, s, source } from 'confkit';

export const config = defineConfig({
  sources: [source().env(), source().file('config.json')],
  schema: {
    NODE_ENV: s.enum(['development','test','production']).default('development'),
    PORT: s.port().default(3000),
    DATABASE_URL: s.string(),
    PUBLIC_APP_NAME: s.string().client().default('confkit'),
    STRIPE_SECRET: s.secret(s.string()),
  },
});
`;
        fs.writeFileSync(confFile, content, 'utf8');
        console.log('✔ Created', path.relative(process.cwd(), confFile));
      } else {
        console.log('• Exists', path.relative(process.cwd(), confFile));
      }
      if (!fs.existsSync(envExample)) {
        const content = `# Example env
NODE_ENV=development
PORT=3000
DATABASE_URL=
PUBLIC_APP_NAME=confkit
STRIPE_SECRET=
`;
        fs.writeFileSync(envExample, content, 'utf8');
        console.log('✔ Created', path.relative(process.cwd(), envExample));
      } else {
        console.log('• Exists', path.relative(process.cwd(), envExample));
      }
      if (!fs.existsSync(workflowDir)) fs.mkdirSync(workflowDir, { recursive: true });
      if (!fs.existsSync(workflowFile)) {
        const content = `name: confkit\n on: [push, pull_request]\n jobs:\n  check:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with: { node-version: '20' }\n      - run: npm ci\n      - run: npx confkit check --env production\n      - run: npx confkit scan --dir .\n`;
        fs.writeFileSync(workflowFile, content, 'utf8');
        console.log('✔ Created', path.relative(process.cwd(), workflowFile));
      } else {
        console.log('• Exists', path.relative(process.cwd(), workflowFile));
      }
      return;
    }

    if (cmd === 'explain') {
      if (typeof (config as any).explain !== 'function') {
        console.log('explain: not supported in this version of confkit');
        return;
      }
      const key = typeof flags['key'] === 'string' ? String(flags['key']) : undefined;
      const rowsRaw = await (config as any).explain(key);
      const rows = rowsRaw.map((r: any) => {
        let val = '';
        try { val = typeof r.value === 'string' ? r.value : JSON.stringify(r.value); } catch { val = String(r.value); }
        return [r.key, `${r.from}: ${val}`];
      });
      printTable(rows as Array<[string,string]>, ['Key','From: Value']);
      return;
    }

    if (cmd === 'doctor') {
      const issues: string[] = [];
      const nodeOk = Number(process.versions.node.split('.')[0]) >= 18;
      if (!nodeOk) issues.push(`Node ${process.versions.node} < 18 (confkit recommends >= 18)`);
      const cwd = process.cwd();
      const envFiles = ['.env', '.env.local', process.env.NODE_ENV ? `.env.${process.env.NODE_ENV}` : undefined].filter(Boolean) as string[];
      const present = envFiles.filter((f) => fs.existsSync(path.resolve(cwd, f)));
      if (process.env.NODE_ENV === 'production' && present.length && process.env.ALLOW_ENV_FILES_IN_PROD !== 'true') {
        issues.push(`.env* files present in production (${present.join(', ')}) and ALLOW_ENV_FILES_IN_PROD is not 'true'`);
      }
      // .env.example alignment with schema (best-effort)
      try {
        const examplePath = path.resolve(cwd, '.env.example');
        if (!fs.existsSync(examplePath)) {
          issues.push('.env.example not found — run "npx confkit init" to scaffold');
        } else {
          const { parse } = await import('dotenv');
          const buf = fs.readFileSync(examplePath);
          const parsed = parse(buf);
          const desc = typeof (config as any).describeSchema === 'function' ? (config as any).describeSchema() as Record<string, unknown> : undefined;
          if (desc) {
            const schemaKeys = new Set(Object.keys(desc));
            const exampleKeys = new Set(Object.keys(parsed));
            const missing = [...schemaKeys].filter(k => !exampleKeys.has(k)).sort();
            const extra = [...exampleKeys].filter(k => !schemaKeys.has(k)).sort();
            if (missing.length) issues.push(`.env.example missing keys: ${missing.join(', ')}`);
            if (extra.length) issues.push(`.env.example has unknown keys not in schema: ${extra.join(', ')}`);
          }
        }
      } catch {
        // ignore parse errors
      }
      if (issues.length) {
        console.log('✖ Doctor found issues:');
        for (const i of issues) console.log('  -', i);
        process.exitCode = 1;
      } else {
        console.log('✔ Environment looks good');
      }
      return;
    }

    if (cmd === 'types') {
      const chokidar = await import('chokidar');
      const outFile = typeof flags['out'] === 'string' ? path.resolve(String(flags['out'])) : path.resolve(process.cwd(), flags['server'] ? 'confkit-env-server.d.ts' : 'confkit-env.d.ts');

      async function writeTypes() {
        if (flags['server']) {
          // Server-side type: infer a TS interface from schema description
          const desc = typeof (config as any).describeSchema === 'function' ? (config as any).describeSchema() as Record<string, unknown> : undefined;
          if (!desc) {
            console.log('types --server: not supported in this version of confkit');
            return;
          }
          function tsFromNode(node: any): string {
            const kind = node?.kind;
            if (kind === 'object') {
              const inner = node.shape as Record<string, any>;
              const fields = Object.keys(inner).map(k => `${JSON.stringify(k)}: ${tsFromNode(inner[k])};`).join(' ');
              return `{ ${fields} }`;
            }
            if (kind === 'array') return `${tsFromNode(node.inner)}[]`;
            if (kind === 'record') return `Record<string, ${tsFromNode(node.inner)}>`;
            if (kind === 'union') return (node.nodes as any[]).map(tsFromNode).join(' | ') || 'unknown';
            if (kind === 'enum') return (node.values as string[]).map((v: string) => JSON.stringify(v)).join(' | ') || 'string';
            if (kind === 'json') return node.inner ? tsFromNode(node.inner) : 'any';
            if (kind === 'int' || kind === 'number' || kind === 'float' || kind === 'port' || kind === 'duration') return 'number';
            return 'string';
          }
          const fields = Object.entries(desc).map(([k, v]) => `${JSON.stringify(k)}: ${tsFromNode(v)};`).join('\n  ');
          const lines: string[] = [];
          lines.push('// Generated by confkit types --server');
          lines.push('export interface ConfkitEnv {');
          lines.push('  ' + fields);
          lines.push('}');
          fs.writeFileSync(outFile, lines.join('\n') + '\n', 'utf8');
          console.log('✔ Wrote', path.relative(process.cwd(), outFile));
        } else {
          const { clientEnv } = await (await import('../load.js')).loadConfig({ file });
          const keys = Object.keys(clientEnv).sort();
          const lines: string[] = [];
          lines.push('// Generated by confkit types');
          // Vite/webpack virtual module
          lines.push("declare module 'confkit:client' {");
          lines.push('  const env: {');
          for (const k of keys) lines.push(`    ${k}: string;`);
          lines.push('  };');
          lines.push('  export default env;');
          lines.push('}');
          // Next-friendly real module
          lines.push("declare module '@confkit/next/client' {");
          lines.push('  const env: {');
          for (const k of keys) lines.push(`    ${k}: string;`);
          lines.push('  };');
          lines.push('  export default env;');
          lines.push('}');
          fs.writeFileSync(outFile, lines.join('\n') + '\n', 'utf8');
          console.log('✔ Wrote', path.relative(process.cwd(), outFile));
        }
      }

      await writeTypes();

      if (flags['watch']) {
        const cwd = process.cwd();
        const watchPaths = [
          file ?? path.resolve(cwd, 'conf/config.ts'),
          path.resolve(cwd, '.env'),
          path.resolve(cwd, '.env.local'),
          process.env.NODE_ENV ? path.resolve(cwd, `.env.${process.env.NODE_ENV}`) : undefined,
          path.resolve(cwd, 'config.json'),
          path.resolve(cwd, 'config.yaml'),
          path.resolve(cwd, 'config.yml'),
          path.resolve(cwd, 'config.toml'),
        ].filter(Boolean) as string[];
        console.log('Watching for changes...');
        const watcher = chokidar.watch(watchPaths, { ignoreInitial: true });
        watcher.on('all', async () => { await writeTypes(); });
        await new Promise(() => {});
      }
      return;
    }

    if (cmd === 'scan') {
      // Scan for process.env and import.meta.env usage and compare to schema keys
      const allow = typeof flags['allow'] === 'string' ? String(flags['allow']).split(',').map(s=>s.trim()).filter(Boolean) : [];
      const dir = typeof flags['dir'] === 'string' ? path.resolve(String(flags['dir'])) : process.cwd();

      const desc = typeof (config as any).describeSchema === 'function' ? (config as any).describeSchema() as Record<string, unknown> : undefined;
      const known = new Set<string>(desc ? Object.keys(desc) : []);
      if (!desc) {
        console.log('scan: describeSchema not available; please update confkit');
        return;
      }

      const ignoreDirs = new Set(['node_modules', '.git', 'dist', 'build', '.turbo', '.next', '.output', '.vercel']);
      const exts = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.vue', '.svelte', '.astro']);
      const used = new Set<string>();

      function walk(d: string) {
        const entries = fs.readdirSync(d, { withFileTypes: true });
        for (const e of entries) {
          if (e.isDirectory()) {
            if (ignoreDirs.has(e.name)) continue;
            walk(path.join(d, e.name));
          } else if (e.isFile()) {
            const ext = path.extname(e.name).toLowerCase();
            if (!exts.has(ext)) continue;
            const p = path.join(d, e.name);
            let text = '';
            try { text = fs.readFileSync(p, 'utf8'); } catch { continue; }
            const re1 = /process\.env\s*(?:\[["']([A-Z0-9_]+)["']\]|\.([A-Z0-9_]+))/g;
            const re2 = /import\.meta\.env\s*(?:\[["']([A-Z0-9_]+)["']\]|\.([A-Z0-9_]+))/g;
            let m: RegExpExecArray | null;
            while ((m = re1.exec(text))) {
              const k = (m[1] || m[2] || '').trim();
              if (k) used.add(k);
            }
            while ((m = re2.exec(text))) {
              const k = (m[1] || m[2] || '').trim();
              if (k) used.add(k);
            }
          }
        }
      }

      walk(dir);
      for (const k of allow) used.delete(k);
      const unknown = [...used].filter(k => !known.has(k)).sort();
      const unused = [...known].filter(k => !used.has(k)).sort();

      if (unknown.length === 0 && unused.length === 0) {
        console.log('✔ scan: code usage matches schema');
        return;
      }

      if (unknown.length) {
        console.log('⚠ Unknown keys used in code (not in schema):');
        for (const k of unknown) console.log('  -', k);
      }
      if (unused.length) {
        console.log('ℹ Keys defined in schema but not used in code:');
        for (const k of unused) console.log('  -', k);
      }
      if (unknown.length) process.exitCode = 1;
      return;
    }

    if (cmd === 'dev') {
      const chokidar = await import('chokidar');
      const cwd = process.cwd();
      const extraWatch = typeof flags['watch'] === 'string' ? String(flags['watch']).split(',').map(s=>s.trim()).filter(Boolean) : [];
      const watchPaths = [
        file ?? path.resolve(cwd, 'conf/config.ts'),
        path.resolve(cwd, '.env'),
        path.resolve(cwd, '.env.local'),
        process.env.NODE_ENV ? path.resolve(cwd, `.env.${process.env.NODE_ENV}`) : undefined,
        path.resolve(cwd, 'config.json'),
        path.resolve(cwd, 'config.yaml'),
        path.resolve(cwd, 'config.yml'),
        path.resolve(cwd, 'config.toml'),
        ...extraWatch.map(p => path.resolve(cwd, p)),
      ].filter(Boolean) as string[];
      let prev: Record<string, unknown> | null = null;
      let redactDev = !flags['no-redact'];
      let lastIssues: Array<{ path: string; message: string }> = [];
      async function snapshot() {
        try {
          const { config } = await loadConfig({ file, computeClientEnv: false });
          await config.ready();
          const json = (await config.toJSON({ redact: redactDev })) as Record<string, unknown>;
          lastIssues = [];
          return json;
        } catch (e) {
          const err = e as { issues?: Array<{ path: string; message: string }>; message?: string };
          lastIssues = err.issues ?? [];
          return { __error: err.message || 'validation error' } as Record<string, unknown>;
        }
      }
      function walkDiff(prefix: string, a: unknown, b: unknown, out: string[]) {
        const aj = JSON.stringify(a);
        const bj = JSON.stringify(b);
        if (aj === bj) return;
        if (typeof a !== 'object' || a == null || typeof b !== 'object' || b == null) {
          out.push(`${prefix}: ${aj} -> ${bj}`);
          return;
        }
        const aRec = a as Record<string, unknown>;
        const bRec = b as Record<string, unknown>;
        const keys = new Set([...Object.keys(aRec), ...Object.keys(bRec)]);
        for (const k of [...keys].sort()) {
          walkDiff(prefix ? `${prefix}.${k}` : k, aRec[k], bRec[k], out);
        }
      }
      function diff(a: Record<string, unknown>, b: Record<string, unknown>) {
        const out: string[] = [];
        walkDiff('', a, b, out);
        return out;
      }
      prev = await snapshot();
      console.log(colorize().green('✔ confkit dev started. Watching:'));
      for (const p of watchPaths) console.log('  •', p);
      console.log('Controls: [r]eload, [s]ecret redaction toggle, [c]opy invalid paths');
      const watcher = chokidar.watch(watchPaths, { ignoreInitial: true });
      async function doReload(reason: string) {
        const t0 = Date.now();
        const next = await snapshot();
        const changes = diff(prev || {}, next || {});
        const dt = Date.now() - t0;
        if (changes.length) {
          // Summary: added/removed/changed
          function mapFlat(obj: Record<string, unknown>) {
            const entries = flatten(obj);
            const m = new Map<string, string>();
            for (const [k, v] of entries) m.set(k, String(v ?? ''));
            return m;
          }
          const a = mapFlat(prev || {});
          const b = mapFlat(next || {});
          let added = 0, removed = 0, modified = 0;
          const keys = new Set<string>([...a.keys(), ...b.keys()]);
          for (const k of keys) {
            const va = a.get(k);
            const vb = b.get(k);
            if (va === undefined && vb !== undefined) added++;
            else if (va !== undefined && vb === undefined) removed++;
            else if (va !== vb) modified++;
          }
          console.log(colorize().yellow(`— changes (${reason}, ${dt}ms) — added:${added} removed:${removed} changed:${modified}`));
          for (const c of changes) console.log('  ', c);
          prev = next;
        } else {
          console.log(colorize().dim(`— no changes (${reason}, ${dt}ms) —`));
        }
      }
      watcher.on('all', async () => {
        await doReload('file watch');
      });

      // Interactive controls
      if (process.stdin.isTTY) {
        process.stdin.setRawMode?.(true);
        process.stdin.resume();
        process.stdin.setEncoding('utf8');
        process.stdin.on('data', async (chunk: string) => {
          const s = String(chunk);
          const ch = s[0];
          if (ch === 'r' || ch === 'R') {
            await doReload('manual reload');
          } else if (ch === 's' || ch === 'S') {
            redactDev = !redactDev;
            console.log(`Redaction: ${redactDev ? 'ON' : 'OFF'}`);
            await doReload('redaction toggle');
          } else if (ch === 'c' || ch === 'C') {
            const paths = Array.from(new Set((lastIssues || []).map((i) => i.path))).sort();
            if (!paths.length) {
              console.log('No invalid paths to copy.');
              return;
            }
            const text = paths.join('\n');
            try {
              // Try platform clipboards without adding deps
              const { spawn } = await import('node:child_process');
              const plat = process.platform;
              let cmd: string | undefined;
              let args: string[] = [];
              if (plat === 'darwin') cmd = 'pbcopy';
              else if (plat === 'win32') cmd = 'clip';
              else {
                // linux: prefer xclip, fallback xsel
                cmd = 'xclip';
                args = ['-selection', 'clipboard'];
              }
              const proc = spawn(cmd, args);
              proc.on('error', () => {
                console.log('Clipboard utility not available.');
              });
              proc.stdin.write(text);
              proc.stdin.end();
              console.log(`Copied ${paths.length} path(s) to clipboard.`);
            } catch {
              console.log('Failed to copy to clipboard.');
            }
          } else if (ch === '\u0003') {
            // Ctrl+C
            process.exit(0);
          }
        });
      }
      await new Promise(() => {});
      return;
    }

    console.error(`Unknown command: ${cmd}`);
    process.exitCode = 1;
  } catch (err) {
    console.error('confkit:', (err as Error).message);
    process.exitCode = 1;
  }
}

run();
