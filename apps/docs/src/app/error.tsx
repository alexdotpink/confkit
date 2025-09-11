"use client";

import Link from 'next/link';

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="relative isolate flex flex-1 flex-col">
      <div className="relative mx-auto my-10 w-full max-w-7xl overflow-hidden rounded-3xl bg-neutral-950 text-white ring-1 ring-white/10">
        {/* Ambient background */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-[-15%] h-[38rem] w-[70rem] -translate-x-1/2 rounded-full bg-gradient-to-br from-fuchsia-500/30 via-violet-500/25 to-cyan-500/30 blur-3xl" />
          <div className="absolute right-[-15%] bottom-[-20%] h-[26rem] w-[26rem] rounded-full bg-gradient-to-tr from-cyan-500/25 to-transparent blur-2xl" />
          <div className="absolute inset-0 opacity-[0.08] [background:radial-gradient(circle_at_center,white_1px,transparent_1px)] [background-size:20px_20px]" />
          <div className="absolute inset-0 [mask-image:radial-gradient(60%_80%_at_50%_20%,black,transparent)] bg-gradient-to-b from-white/15 to-transparent" />
        </div>

        <section className="mx-auto flex w-full max-w-3xl flex-col items-center px-6 py-20 text-center sm:py-28">
          <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80 backdrop-blur">
            <span className="inline-flex h-2 w-2 rounded-full bg-rose-400" />
            <span>Unexpected Error</span>
          </span>
          <h1 className="max-w-2xl bg-gradient-to-br from-white to-white/70 bg-clip-text text-4xl font-black leading-tight text-transparent sm:text-5xl">
            Something went wrong
          </h1>
          <p className="mt-4 max-w-xl text-balance text-white/70">
            We hit a snag processing your request. You can retry or head back to the homepage.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => reset()}
              className="rounded-md bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/10 transition hover:translate-y-[-1px] hover:shadow-md"
            >
              Try Again
            </button>
            <Link href="/" className="rounded-md bg-white/10 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-white/15 backdrop-blur transition hover:bg-white/15">
              Go Home
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
