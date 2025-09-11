import config from '../conf/config';

export default async function Page() {
  const env = await config.ready();

  return (
    <main>
      <section>
        <h2>Server Environment</h2>
        <p>Values below are typed and validated on the server.</p>
        <ul>
          <li><strong>NODE_ENV</strong>: {env.NODE_ENV}</li>
          <li><strong>PORT</strong>: {env.PORT}</li>
          <li><strong>DATABASE_URL</strong>: {env.DATABASE_URL}</li>
          <li><strong>API_BASE_URL</strong>: {env.API_BASE_URL}</li>
          <li><strong>FEATURES.newCheckout</strong>: {String(env.FEATURES.newCheckout)}</li>
          <li><strong>FEATURES.abTestVariant</strong>: {env.FEATURES.abTestVariant}</li>
          <li><strong>STRIPE_SECRET</strong>: (secret)</li>
        </ul>
      </section>
      <section style={{ marginTop: 24 }}>
        <h2>Debug</h2>
        <p>
          See <code>/api/config</code> for a redacted JSON dump. Edit <code>.env.local</code> or{' '}
          <code>config.yaml</code> and observe hot reload + overlay diagnostics.
        </p>
      </section>
    </main>
  );
}

