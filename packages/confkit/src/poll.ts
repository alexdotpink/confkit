export type PollOptions = {
  intervalMs?: number;
  maxIntervalMs?: number;
  backoffFactor?: number;
  signal?: AbortSignal;
  redact?: boolean;
  onChange?: (next: unknown, prev: unknown) => void | Promise<void>;
  webhook?: { url: string; headers?: Record<string, string> };
  etagSupplier?: () => Promise<string | undefined> | string | undefined;
};

export async function pollConfig<T>(
  cfg: { toJSON: (opts?: { redact?: boolean }) => Promise<T> } & Partial<{ reload: () => Promise<void> | void }>,
  opts: PollOptions = {}
) {
  let interval = opts.intervalMs ?? 5_000;
  const maxInterval = opts.maxIntervalMs ?? 60_000;
  const factor = opts.backoffFactor ?? 1.5;
  let prevJson: string | undefined;
  let prevEtag: string | undefined;
  const signal = opts.signal;

  while (!signal?.aborted) {
    const start = Date.now();
    try {
      if (cfg.reload) await cfg.reload();
      const [val, etag] = await Promise.all([
        cfg.toJSON({ redact: !!opts.redact }),
        Promise.resolve(typeof opts.etagSupplier === 'function' ? opts.etagSupplier() : opts.etagSupplier),
      ]);
      const js = JSON.stringify(val);
      const same = js === prevJson && etag === prevEtag;
      if (!same) {
        const old = prevJson ? JSON.parse(prevJson) : undefined;
        prevJson = js;
        prevEtag = etag;
        if (opts.onChange) await opts.onChange(val, old);
        if (opts.webhook?.url) {
          try {
            // Use global fetch available in Node 18+
            await fetch(opts.webhook.url, {
              method: 'POST',
              headers: { 'content-type': 'application/json', ...(opts.webhook.headers ?? {}) },
              body: js,
            });
          } catch {
            // ignore webhook errors
          }
        }
        interval = opts.intervalMs ?? 5_000; // reset on change
      } else {
        interval = Math.min(Math.floor(interval * factor), maxInterval);
      }
    } catch {
      interval = Math.min(Math.floor(interval * factor), maxInterval);
    }
    const elapsed = Date.now() - start;
    const wait = Math.max(0, interval - elapsed);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  }
}
