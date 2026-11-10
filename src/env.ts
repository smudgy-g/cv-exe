import { defineEnvVars } from '@sveltejs/kit/env';

// Server-only secrets, read at runtime from Vercel (or .env.development.local when running locally).
export const variables = defineEnvVars({
	DATABASE_URL: { description: 'Neon Postgres connection string (pooled)' },
	NEON_AUTH_BASE_URL: { description: 'Neon Auth URL (Neon console → Auth)' },
	NEON_AUTH_COOKIE_SECRET: {
		description: 'Random secret for signing session cookies: openssl rand -base64 32',
		schema: (v) => {
			if (!v || v.length < 32) throw new Error('NEON_AUTH_COOKIE_SECRET must be at least 32 characters');
			return v;
		}
	}
});
