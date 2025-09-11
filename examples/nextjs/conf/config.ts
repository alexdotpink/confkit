import { defineConfig, s, source } from 'confkit';

// Example schema for a typical Next.js app
export const config = defineConfig({
  // Layer sources: env vars (from process.env and .env files) take precedence
  sources: [
    source().env(),
    source().file('config.yaml'),
  ],
  schema: {
    // Environment and server settings
    NODE_ENV: s.enum(['development', 'test', 'production']).default('development'),
    PORT: s.port().default(3000),

    // Database + API
    DATABASE_URL: s.url(),
    API_BASE_URL: s.url().default('http://localhost:3000/api'),

    // Feature flags and nested objects
    FEATURES: s
      .object({
        newCheckout: s.boolean().default(false),
        abTestVariant: s.enum(['A', 'B']).default('A'),
      })
      .default({ newCheckout: false, abTestVariant: 'A' }),

    // Secrets (audit can be added in defineConfig options)
    STRIPE_SECRET: s.secret(s.nonempty()).optional(),

    // Client-exposed env (either via .client() or well-known prefixes)
    NEXT_PUBLIC_APP_NAME: s.string().client().default('Confkit Next Example'),
    NEXT_PUBLIC_FEATURE_FLAG: s.boolean().client().default(false),
  },
});

export default config;

