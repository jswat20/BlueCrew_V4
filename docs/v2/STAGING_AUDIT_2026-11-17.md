# The Slate V2 staging audit — 2026-11-17

Scope: `slate-v2-development`, Supabase staging project
`fdjhwxmphdzodxvhrblk`, and `https://the-slate-v2.pages.dev` only.
Production was not queried, modified, built, or deployed.

## Verified environment boundaries

- Git branch: `slate-v2-development` at `9f98f281d2fe6903be8aeb68c58cc37584189238`.
- Required V2 baseline, migration-reconciliation, and staging-build documents were
  reviewed before any write.
- The staging Auth Site URL is `https://the-slate-v2.pages.dev`.
- The staging Auth redirect allowlist contains
  `https://the-slate-v2.pages.dev/**`.
- The staging email cron remains inactive. The existing 18 pending deliveries
  were not processed or changed.
- No migration was applied. The documented staging migration drift remains a
  release gate.

## Administrator provisioning

The requested email-confirmed staging Auth user had no application profile.
A trusted operator transaction:

1. required one active, verified, non-deleted Auth user;
2. required exactly one active staging organization;
3. rejected an existing unexpected profile or organization email collision;
4. created one approved `administrator` profile;
5. allowed the existing personnel-ID trigger to assign the permanent ID; and
6. inserted one `staging-administrator-provisioned` activity audit entry.

Post-write verification confirmed an approved administrator profile, a
personnel ID, and exactly one audit entry. No notification or communication
delivery was created.

## Build and deployment configuration

- `npm ci` completed. `npm audit` reported one moderate and one high dependency
  vulnerability; no automatic dependency changes were made.
- `npm run build:v2-staging` completed with a real staging publishable key held
  only in process memory.
- The curated artifact verifier passed.
- The build wrapper rejected non-staging targeting by construction and verified
  the generated runtime config and CSP contain the staging project reference and
  not the production reference.
- The live development origin returned HTTP 200 through Cloudflare.
- Its CSP permits only the staging Supabase HTTP and WebSocket origins.
- Its fingerprinted runtime configuration targets staging and does not contain
  the production project reference.
- No Cloudflare deployment was performed during this audit.

The repository CI workflow builds and inspects a staging artifact on
`slate-v2-development`, explicitly tests rejection of production and mixed
targets, and uploads the artifact for inspection only. It does not deploy.

## Automated workflow coverage

The nine reproducible failures were classified and resolved on 2026-11-22:

- Four Workbench/Operations Center failures exposed a genuine application
  defect: calendar-day boundaries were derived with UTC `toISOString()` values.
  Shared local-date helpers now preserve the user's calendar day.
- Two email-boundary tests had an obsolete assumption that a generated runtime
  config must exist in an unbuilt checkout. They now scan generated config only
  when that artifact exists while retaining the delivery-code prohibition.
- Three migration tests asserted exact whitespace/source layout. They now assert
  the same SQL contracts semantically, including ordered values and required
  fields, without coupling to formatting.

A focused regression run passed all 52 related tests. The complete Playwright
run then exercised synthetic administrator, umpire, assigner, and league-viewer
behavior, including navigation, mutation denial, hosted repository, and
authorization contracts:

- 1,189 passed
- 0 failed
- 1 skipped

The hosted development login page also loaded successfully at the correct
origin. The browser had no stored administrator password, so an authenticated
hosted login was not submitted and no credential was inspected or exposed.
True hosted sessions for the other three roles remain pending; the full browser
suite provides synthetic role acceptance but is not a substitute for those
credentialed hosted checks.

## Outbound email isolation follow-up — 2026-11-22

- The staging email cron remains inactive.
- Staging-only disabled stubs were deployed over
  `process-communication-emails` (version 6) and
  `send-account-password-reset` (version 5). Manual worker invocation returns
  `503 staging_email_delivery_disabled`; the password-reset function retains
  its JWT gateway and rejects unauthenticated calls before the stub.
- The repository's production-capable Edge Function sources were not changed.
  Restoring either sender requires an explicit staging redeploy of its reviewed
  source.
- The queue remains unchanged at 18 pending deliveries (42 total records).
- Native Supabase Auth signup/recovery mail is a separate provider path. Hosted
  acceptance must avoid signup and recovery until a staging mail sink or other
  provider-level containment is configured.

## Outstanding gates

- Confirm the Cloudflare Pages project name, Git integration branch, build
  command, output directory, and environment variables in the Cloudflare
  dashboard. The public artifact is correctly isolated, but dashboard-level
  configuration has not been independently enumerated.
- Configure a staging-only sink or equivalent provider-level containment for
  native Supabase Auth signup/recovery mail before creating hosted synthetic
  users. Edge Function delivery paths are disabled.
- Reconcile the known migration registry/source differences before applying any
  new migration.
- Complete credentialed hosted acceptance: administrator login requires a
  user-entered password, and umpire/assigner/league-viewer test sessions or
  credentials are not available.
- Review the two dependency advisories manually; do not run `npm audit fix`
  without a scoped compatibility review.
