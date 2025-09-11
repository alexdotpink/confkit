import Link from "next/link";
import CodeBlock from "@/components/CodeBlock";
import { Metadata } from "next";

export default function HomePage() {
  return (
    <main className="relative isolate flex flex-1 flex-col">
      {/* Hero */}
      <div className="relative mx-auto my-10 w-full max-w-7xl overflow-hidden rounded-3xl bg-neutral-950 text-white ring-1 ring-white/10">
        {/* Background */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-[-20%] h-[52rem] w-[90rem] -translate-x-1/2 rounded-full bg-gradient-to-br from-fuchsia-500/25 via-violet-500/20 to-cyan-500/25 blur-3xl" />
          <div className="absolute right-[-15%] bottom-[-25%] h-[28rem] w-[28rem] rounded-full bg-gradient-to-tr from-cyan-500/25 to-transparent blur-2xl" />
          <div className="absolute inset-0 opacity-[0.08] [background:radial-gradient(circle_at_center,white_1px,transparent_1px)] [background-size:20px_20px]" />
          <div className="absolute inset-0 [mask-image:radial-gradient(60%_80%_at_50%_20%,black,transparent)] bg-gradient-to-b from-white/15 to-transparent" />
        </div>

        <section className="mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-10 px-6 pb-12 pt-16 sm:pt-24 lg:grid-cols-2">
          {/* Copy */}
          <div className="text-center lg:text-left">
            <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80 shadow-sm backdrop-blur lg:mx-0">
              <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-emerald-400"></span>
              <span>Type‑safe config. Secure secrets. One import.</span>
            </div>

            <h1 className="mx-auto max-w-3xl bg-gradient-to-br from-white to-white/70 bg-clip-text text-5xl font-black leading-tight tracking-tight text-transparent sm:text-6xl lg:max-w-none">
              Configuration that keeps up with your code
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-balance text-base leading-relaxed text-white/70 sm:text-lg lg:mx-0">
              Define a single schema, layer sources, and ship strong types and
              validated values everywhere — server, edge, and client.
            </p>

            <div className="mt-7 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
              <Link
                href="/docs/overview"
                className="group inline-flex items-center gap-2 rounded-md bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/10 transition hover:translate-y-[-1px] hover:shadow-md"
              >
                Get Started
                <svg
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  className="opacity-70 transition group-hover:translate-x-0.5"
                  aria-hidden
                >
                  <path
                    fill="currentColor"
                    d="M13.293 5.293a1 1 0 0 1 1.414 0l5.999 5.999a1 1 0 0 1 0 1.414l-5.999 5.999a1 1 0 1 1-1.414-1.414L17.586 13H4a1 1 0 1 1 0-2h13.586l-4.293-4.293a1 1 0 0 1 0-1.414Z"
                  />
                </svg>
              </Link>
              <a
                href="https://github.com/alexdotpink/confkit"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-md bg-transparent px-4 py-2.5 text-sm font-semibold text-white/80 ring-1 ring-white/15 backdrop-blur transition hover:text-white"
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden
                  width="16"
                  height="16"
                  className="opacity-80"
                >
                  <path
                    fill="currentColor"
                    d="M12 .5A11.5 11.5 0 0 0 .5 12.3c0 5.23 3.41 9.66 8.15 11.23.6.13.82-.26.82-.58 0-.29-.01-1.06-.02-2.08-3.32.74-4.02-1.64-4.02-1.64-.55-1.43-1.35-1.81-1.35-1.81-1.1-.78.08-.76.08-.76 1.22.09 1.86 1.28 1.86 1.28 1.08 1.88 2.82 1.34 3.5 1.02.11-.79.42-1.34.77-1.65-2.65-.31-5.44-1.37-5.44-6.09 0-1.35.47-2.45 1.25-3.31-.13-.31-.54-1.56.12-3.25 0 0 1.02-.33 3.34 1.26.97-.27 2.01-.41 3.05-.41 1.04 0 2.08.14 3.05.41 2.31-1.6 3.33-1.26 3.33-1.26.66 1.69.25 2.94.12 3.25.78.86 1.25 1.96 1.25 3.31 0 4.73-2.8 5.77-5.47 6.08.43.38.82 1.12.82 2.26 0 1.64-.02 2.97-.02 3.37 0 .32.21.71.83.58A11.51 11.51 0 0 0 23.5 12.3 11.5 11.5 0 0 0 12 .5z"
                  />
                </svg>
                Star on GitHub
              </a>
            </div>

            <div className="mt-8 flex items-center justify-center gap-6 text-xs text-white/60 lg:justify-start">
              <span className="opacity-70">Server</span>
              <span className="opacity-30">•</span>
              <span className="opacity-70">Edge</span>
              <span className="opacity-30">•</span>
              <span className="opacity-70">Client</span>
            </div>
          </div>

          {/* Code showcase */}
          <div className="relative">
            <div className="relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] shadow-2xl ring-1 ring-white/10">
              <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/40 to-transparent" />
              <div className="flex items-center justify-between px-4 py-2 text-xs text-white/50">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-red-400/80" />
                  <span className="h-2 w-2 rounded-full bg-amber-400/80" />
                  <span className="h-2 w-2 rounded-full bg-emerald-400/80" />
                </div>
                <span>conf/config.ts</span>
              </div>
              <div className="relative">
                <div className="pointer-events-none absolute -inset-x-20 -bottom-16 top-0 -z-10 rounded-[2rem] bg-gradient-to-br from-fuchsia-500/20 via-violet-500/10 to-cyan-500/20 blur-2xl" />
                <CodeBlock
                  className="overflow-x-auto p-5 pl-1 text-left text-[13px] leading-relaxed [counter-reset:line]"
                  lang="ts"
                  code={`import { defineConfig, s, source } from 'confkit';

export const config = defineConfig({
  sources: [
    source().env(),                 // process.env + .env* (in dev)
    source().file('config.yaml'),   // json/yaml/toml by extension
  ],
  schema: {
    NODE_ENV: s.enum(['development','test','production']).default('development'),
    PORT: s.port().default(3000),
    DATABASE_URL: s.url(),
    PUBLIC_APP_NAME: s.string().client().default('confkit'),
    STRIPE_SECRET: s.secret(s.string()),
  },
});`}
                />
              </div>
              <div className="border-t border-white/10 bg-gradient-to-r from-transparent via-white/5 to-transparent px-4 py-3 text-xs text-white/60">
                End‑to‑end types from a single schema • Deep redaction of
                secrets
              </div>
            </div>
            {/* CLI card */}
            <div className="mt-4 overflow-hidden rounded-lg border border-white/10 bg-black/40 text-[12px] text-white/80 shadow-xl ring-1 ring-white/10">
              <div className="bg-white/5 px-3 py-2 text-white/60">Terminal</div>
              <div className="px-3 py-3 font-mono">
                <div>
                  <span className="text-emerald-400">$</span> npx confkit init
                </div>
                <div>
                  <span className="text-emerald-400">$</span> confkit check
                </div>
                <div className="text-white/50">
                  ✔ Schema validated • 0 issues
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Integrations strip */}
        <div className="mx-auto mb-8 mt-2 flex max-w-7xl flex-wrap items-center justify-center gap-3 px-6 text-xs text-white/60 lg:justify-between">
          <div className="hidden w-px flex-1 border-t border-white/10 sm:block" />
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="opacity-70">Works great with</span>
            {[
              ["Next.js", "M128 24l104 60v88l-104 60L24 172V84z"],
              ["Vite", "M128 32l80 64-80 128L48 96l80-64z"],
              ["Expo", "M48 48h160v160H48z"],
              ["AWS", "M24 128h208"],
              ["GCP", "M128 24l104 104-104 104L24 128z"],
              ["Azure", "M32 192h192"],
            ].map(([name, d]) => (
              <span
                key={name as string}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1"
              >
                {name as string}
              </span>
            ))}
          </div>
          <div className="hidden w-px flex-1 border-t border-white/10 sm:block" />
        </div>
      </div>

      {/* Features Grid + Steps */}
      <section className="mx-auto w-full max-w-7xl px-6 pb-12">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Feature cards */}
          {[
            {
              title: "Type‑safe by design",
              desc: "Define once, get types everywhere. No drift, no guessing.",
              icon: (
                <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
                  <path
                    fill="currentColor"
                    d="M4 5h16v2H4zM4 11h10v2H4zM4 17h16v2H4z"
                  />
                </svg>
              ),
            },
            {
              title: "Layered sources",
              desc: "Env, files, and cloud secrets with predictable precedence.",
              icon: (
                <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
                  <path
                    fill="currentColor"
                    d="M12 2l8 4-8 4-8-4 8-4zm0 7l8 4-8 4-8-4 8-4zm0 7l8 4-8 4-8-4 8-4z"
                  />
                </svg>
              ),
            },
            {
              title: "Secure secrets",
              desc: "Runtime validation and deep redaction out of the box.",
              icon: (
                <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
                  <path
                    fill="currentColor"
                    d="M12 2a6 6 0 00-6 6v2H5a1 1 0 00-1 1v8a3 3 0 003 3h10a3 3 0 003-3v-8a1 1 0 00-1-1h-1V8a6 6 0 00-6-6zm-4 8V8a4 4 0 118 0v2H8z"
                  />
                </svg>
              ),
            },
            {
              title: "First‑class DX",
              desc: "Tiny API, friendly CLI, and fast feedback loops.",
              icon: (
                <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
                  <path
                    fill="currentColor"
                    d="M4 4h16v4H4zM4 10h10v10H4zM16 10h4v10h-4z"
                  />
                </svg>
              ),
            },
            {
              title: "Client‑safe exports",
              desc: "Mark public values; secrets stay server‑only by default.",
              icon: (
                <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
                  <path
                    fill="currentColor"
                    d="M12 3l7 4v10l-7 4-7-4V7l7-4zm0 5L7 10.5V16l5 2.8 5-2.8v-5.5L12 8z"
                  />
                </svg>
              ),
            },
            {
              title: "Integrations built‑in",
              desc: "Next, Vite, Expo + cloud providers with zero fuss.",
              icon: (
                <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
                  <path
                    fill="currentColor"
                    d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 5h4v4h-4V7zm-6 6h4v4H7v-4zm6 0h4v4h-4v-4z"
                  />
                </svg>
              ),
            },
          ].map((f) => (
            <div
              key={f.title}
              className="group relative overflow-hidden rounded-xl border border-neutral-200/10 bg-neutral-900/60 p-5 shadow-xl ring-1 ring-white/10 transition hover:bg-neutral-900/80"
            >
              <div className="absolute right-0 top-0 h-px w-1/2 bg-gradient-to-l from-white/40 to-transparent" />
              <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-md bg-white/10 text-white">
                {f.icon}
              </div>
              <h3 className="mb-1 text-sm font-semibold text-white/90">
                {f.title}
              </h3>
              <p className="text-sm leading-relaxed text-white/60">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto w-full max-w-7xl px-6 pb-20">
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-fuchsia-500/10 via-violet-500/10 to-cyan-500/10 p-8 text-center text-white ring-1 ring-white/10">
          <div className="pointer-events-none absolute -inset-10 -z-10 rounded-[2rem] bg-gradient-to-br from-fuchsia-500/20 via-violet-500/10 to-cyan-500/20 blur-3xl" />
          <h3 className="mx-auto max-w-3xl bg-gradient-to-br from-white to-white/70 bg-clip-text text-2xl font-extrabold leading-tight text-transparent sm:text-3xl">
            Ship configuration you can trust in minutes
          </h3>
          <p className="mx-auto mt-2 max-w-xl text-sm text-white/70">
            Follow the quickstart to add ConfKit to your project and get
            validated values with end‑to‑end types.
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <Link
              href="/docs/quickstart"
              className="group inline-flex items-center gap-2 rounded-md bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/10 transition hover:translate-y-[-1px] hover:shadow-md"
            >
              Start the Quickstart
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                className="opacity-70 transition group-hover:translate-x-0.5"
                aria-hidden
              >
                <path
                  fill="currentColor"
                  d="M13.293 5.293a1 1 0 0 1 1.414 0l5.999 5.999a1 1 0 0 1 0 1.414l-5.999 5.999a1 1 0 1 1-1.414-1.414L17.586 13H4a1 1 0 1 1 0-2h13.586l-4.293-4.293a1 1 0 0 1 0-1.414Z"
                />
              </svg>
            </Link>
            <Link
              href="/docs/overview"
              className="inline-flex items-center gap-2 rounded-md bg-white/10 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-white/15 backdrop-blur transition hover:bg-white/15"
            >
              Explore the Docs
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

export async function generateMetadata(): Promise<Metadata> {
  const title = "ConfKit";
  const description = "Type‑safe config. Secure secrets.";

  // Build absolute URL for the dynamic OG endpoint
  const base = process.env.NEXT_PUBLIC_SITE_URL
    ? process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";

  const ogUrl = `${base}/og?title=${encodeURIComponent(title)}&description=${encodeURIComponent(
    description
  )}`;

  return {
    title,
    description,
    openGraph: {
      images: [ogUrl],
      title,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogUrl],
    },
  };
}
