# GitHub Codespaces Setup

This devcontainer is the source-of-truth development environment for the repo.
It uses Node.js 22, installs npm dependencies from `package-lock.json`, installs
the Chromium Playwright browser, and forwards the app on port 5000.

## Open the Codespace

1. Push this branch to GitHub.
2. In GitHub, open the repo and choose **Code > Codespaces > Create codespace on main**.
3. Wait for `postCreateCommand` to finish:

   ```bash
   npm ci && npx playwright install --with-deps chromium
   ```

4. Start the app:

   ```bash
   npm run dev
   ```

5. Open the forwarded `German Master` port.

When `DATABASE_URL` is unset, `npm run dev` uses the repo's in-memory dev
database mock through `USE_DEV_DB_MOCK=1`, so the Codespace can boot without a
database secret or Docker Compose service.

## Checks

Run the same checks expected by the repo instructions:

```bash
npm test
npm run test:e2e
npm run check
```

## Codespaces Secrets

Do not commit a `.env` file. Add any needed local `.env` values as repository or
user Codespaces secrets in GitHub, then rebuild the Codespace.

Common secrets for live-service workflows:

- `DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `GROQ_API_KEY`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `ADMIN_API_TOKEN`
- `MICROSOFT_CLIENT_ID`
- `MICROSOFT_CLIENT_SECRET`

Additional local-only keys found in the restored `.env` may be needed for
specialized workflows, but should still be stored only as Codespaces secrets:

- `SUPABASE_SERVICE_ROLE_KEY`
- `ENRICHMENT_SUPABASE_BUCKET`
- `ENRICHMENT_SUPABASE_PATH_PREFIX`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `NEXT_PUBLIC_APP_URL`
- `ENABLE_ADJECTIVES_BETA`
- `ENABLE_NOUNS_BETA`

For live Postgres migration or seeding work, set `DATABASE_URL` and then run:

```bash
npm run db:push
npm run seed
```
