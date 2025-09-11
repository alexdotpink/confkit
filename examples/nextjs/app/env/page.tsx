'use client';

export default function ClientEnvPage() {
  return (
    <main>
      <h2>Client Environment</h2>
      <p>
        These values are statically injected into the bundle via Next’s <code>env</code> config. Only keys marked
        <code>.client()</code> or matching <code>NEXT_PUBLIC_</code>/<code>PUBLIC_</code> are included.
      </p>
      <ul>
        <li>
          <strong>NEXT_PUBLIC_APP_NAME</strong>: {process.env.NEXT_PUBLIC_APP_NAME}
        </li>
        <li>
          <strong>NEXT_PUBLIC_FEATURE_FLAG</strong>: {String(process.env.NEXT_PUBLIC_FEATURE_FLAG)}
        </li>
      </ul>
      <p style={{ marginTop: 16 }}>
        Try changing <code>.env.local</code> and refreshing.
      </p>
    </main>
  );
}

