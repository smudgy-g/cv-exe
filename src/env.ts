import { defineEnvVars } from "@sveltejs/kit/env";

// Server-only secrets, read at runtime from Vercel (or .env.development.local when running locally).
export const variables = defineEnvVars({
  DATABASE_URL: { description: "Neon Postgres connection string (pooled)" },
  NEON_AUTH_BASE_URL: { description: "Neon Auth URL (Neon console → Auth)" },
  OPENROUTER_API_KEY: {
    description: "OpenRouter key used for generation (server only)",
  },
  NEON_AUTH_COOKIE_SECRET: {
    description:
      "Random secret for signing session cookies: openssl rand -base64 32",
    schema: (value) => {
      if (!value || value.length < 32)
        throw new Error(
          "NEON_AUTH_COOKIE_SECRET must be at least 32 characters",
        );

      return value;
    },
  },
});
