# The Slate V2 — staging-only build

Branch: `slate-v2-development`. Database: `fdjhwxmphdzodxvhrblk` (staging).

## Why separate build command?
Existing `build:production` is shared machinery and validates consistency between URL and project ID, but does not prevent a build from targeting the live production project. This V2 wrapper rejects any project other than the known staging ID **before** running the existing artifact builder.

## Usage (only in a trusted environment)
Set these environment variables securely in a staging-only CI/Cloudflare configuration, **not** in committed files:
- `SUPABASE_PROJECT_REF=fdjhwxmphdzodxvhrblk`
- `SUPABASE_URL=https://fdjhwxmphdzodxvhrblk.supabase.co`
- `SUPABASE_PUBLISHABLE_KEY` = staging's browser-safe publishable key

Then run:

```sh
npm ci
npm run build:v2-staging
```

The script invokes the existing curated artifact builder and verifier, then inspects the fingerprinted browser runtime config and generated CSP to verify that only the staging Supabase project ID appears. It **does not deploy** or modify any database.

## Outstanding safety gates
- This initial branch change has NOT yet been built/tested in CI. Complete a clean dependency install and smoke test against staging before any preview deployment.
- Set up a **separate Cloudflare Pages preview project/domain**. Do not attach the production custom domain or overwrite the production Pages project.
- Ensure staging-only build environment variables/secrets are configured explicitly. Never reuse production GitHub Actions variables or Cloudflare production settings.
- The staging pg_cron communication worker is paused, but Edge Functions remain invocable; email safety is not yet fully validated.
- Reconcile migration state before applying migrations; do not blindly apply source files recovered from PRs #29/#30.
- Use synthetic test accounts and fixtures only.
- Existing `main`/production workflow is unchanged.
