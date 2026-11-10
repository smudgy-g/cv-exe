# CV.exe

Paste a job ad, get a tailored, ATS-friendly CV and cover letter (French or English).
SvelteKit on Vercel, Neon Postgres, Neon Auth (email + password), OpenRouter for the AI.

Personal details (name, email, phone, links) are replaced with placeholders before anything is sent to the AI.

## Environment variables

Set in Vercel (Project → Settings → Environment Variables) and, for local development, in `.env` (never committed):

| Variable | What |
|---|---|
| `DATABASE_URL` | Neon connection string (pooled), added by the Vercel ↔ Neon integration |
| `NEON_AUTH_BASE_URL` | Neon Console → Auth |
| `NEON_AUTH_COOKIE_SECRET` | `openssl rand -base64 32` |
| `OPENROUTER_API_KEY` | openrouter.ai → Keys |

## Develop

Uses pnpm (version pinned in `mise.toml` and `packageManager`). Database changes: `pnpm db:migrate`.

```sh
pnpm install
pnpm dev
pnpm check     # types
pnpm test      # unit tests
```
