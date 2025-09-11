import { defineConfig, s, source } from "confkit";

export const config = defineConfig({
  sources: [
    source().env(),
    // Reads config.(json|yaml|yml|toml) if present; ignored otherwise
    source().file("config.json"),
  ],
  schema: {
    NODE_ENV: s.enum(["development", "test", "production"]).default("development"),
    PORT: s.int().default(3000),
    DATABASE_URL: s.string(),
    REDIS_URL: s.string().optional(),
    FEATURES: s.object({
      newCheckout: s.boolean().default(false),
      abTestVariant: s.enum(["A", "B"]).default("A"),
    }).default({ newCheckout: false, abTestVariant: "A" }),
    STRIPE_SECRET: s.secret(s.string()),
    PUBLIC_APP_NAME: s.string().client().default("confkit"),
  },
});

// Example helper: load once at startup
export async function loadConfig() {
  return config.ready();
}

