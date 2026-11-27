# Increment 7H: Release Governance and Production Readiness

**Status:** operational controls implemented; production remains unchanged

**Assessment date:** November 27, 2026

**Starting commit:** `4c4ad9ce48adc19e127706cdd444a08b08f7a785`

## Recovery point

A fresh private custom-format archive was created from staging project
`fdjhwxmphdzodxvhrblk` using an operator-entered password. The password was
never displayed, logged, sent to an assistant, or written to disk. Existing
archives were preserved.

| Evidence | Result |
| --- | --- |
| Archive | `slate-staging-20261127-165704.dump` (private, outside Git) |
| Source time | 2026-11-27 16:57:40–16:58:49 EST |
| Size | 4,686,230 bytes |
| SHA-256 | `A1E2A68C64D62FD429A8B53F92C699177388507F13E0320940F0028C3985A130` |
| Backup tool | PostgreSQL `pg_dump` 17.10; source server PostgreSQL 17.6 |
| Backup duration | 68.828 seconds |
| Archive index | readable; 2,134 entries; validation took 0.04 seconds |
| Restore target | PostgreSQL 17.10, UTF-8, localhost-only `127.0.0.1:55434` |
| Restore duration | 1.018 seconds |

The restore process returned exit code 1 because an ordinary PostgreSQL server
does not provide Supabase-managed `pg_cron`, `pg_net`, and `supabase_vault`
objects. All 28 errors were reviewed and mapped to those managed extensions,
precreated compatibility schemas/roles, or their platform-owned objects. There
were no unexplained errors involving application tables, Auth or Storage data,
RLS, migrations, functions, triggers, or foreign keys. The local server was
stopped and the port was confirmed closed after validation.

Live staging and the restored database matched on the following sanitized
evidence:

- 6 organizations, 13 memberships, 13 membership roles, and 11 entitlements;
- 7 Auth users and 13 profiles;
- 36 games, 6 assignments, 37 reservations, 1 tournament, and 19 tournament
  results;
- 56 public tables, all 56 with RLS, 148 policies, 204 core functions, 62 core
  triggers, and 189 foreign keys;
- 97 migrations with latest version `20261127213231`;
- one Storage bucket and zero Storage objects;
- 18 pending communication deliveries and zero active communication cron jobs;
- zero unvalidated constraints; and
- matching normalized fingerprints for policies, migrations, functions,
  triggers, and foreign keys.

The fingerprints were respectively
`2051c66e76c49f909fff38488471c4f8`,
`4f6646479c038cb7f0da8a0dab015044`,
`c395b1cd12a4d10a8aae2c45d542e1b3`,
`50d0df1d4005e85149b5f11cd2c044bc`, and
`30cb3c2046cff72f357a63e2fa7af2b8`.

This drill validates the PostgreSQL recovery boundary. It does not reproduce
managed extension services, Auth provider configuration/signing secrets,
Edge Function secrets/runtime, Realtime, Storage object bytes, Cloudflare
settings, or Supabase-managed point-in-time recovery. Those require separate
operator procedures.

## GitHub governance

Read-only inspection found no repository rulesets and no branch protection on
either `main` or `slate-v2-development`. The repository is public; the current
operator has administrative access. No protection was enabled because doing so
would change the accepted direct-push development workflow and therefore
requires explicit authorization.

Recommended controls:

- `main`: require pull requests, one independent approval, dismissal of stale
  approvals, resolution of review conversations, and the production artifact,
  security, migration, and exact-SHA checks defined below; disallow force pushes
  and deletion; restrict direct pushes to the named release operator.
- `slate-v2-development`: require the `staging-artifact` job from **Slate V2
  staging build safety** before merge; disallow force pushes and deletion.
  Requiring pull requests or restricting direct pushes is intentionally pending
  authorization because it changes the current increment workflow.
- Do not treat the legacy **Playwright Tests** workflow as a V2 release check:
  it runs only for `main`/`master` and builds a production artifact.
- Production deployment remains a separate manual action. The V2 development
  branch must never be connected to the production Cloudflare project or given
  production Supabase credentials.

## Redacted production manifest

Production was inspected read-only. No secret value, customer row, email body,
or credential was read or exported.

| Component | Verified state |
| --- | --- |
| Git | GitHub default/release branch `main`; remote head `3f5c633070f464ddc2b4dc95fe341c96bc335aa4` at inspection |
| Supabase | project `dynxjiqrdlhfhrjnhvgn`, healthy, region `us-east-2`, PostgreSQL 17.6 |
| Database | 47 recorded migrations, latest `20261005130023` |
| Edge Functions | `send-account-password-reset` v14 and `process-communication-emails` v14, active; both report `verify_jwt=false` |
| Scheduled jobs | one active minute schedule, `process-communication-emails-every-minute` |
| Storage | one private bucket and two object metadata rows |
| Cloudflare | project `the-slate-production`; domains `app.worktheslate.com`, `worktheslate.com`, and `the-slate-production.pages.dev` |
| Cloudflare source | production branch `main`; current deployment shown as `5e1efe1f`; project settings report no connected Git repository |
| Runtime | compatibility date 2026-08-11; no Pages variables/secrets or bindings configured; Pages Functions fail-open |

The public production artifact returned HTTP 200 and targets only the production
Supabase project. Production Auth Site URL and redirect allowlist, Supabase
managed-backup state, Edge Function secret values, email provider credentials,
and the authorization boundary used by the two `verify_jwt=false` functions
could not be independently verified with the available read-only interfaces.
They are mandatory production preflight items. The Edge Functions must not be
classified as anonymous APIs merely because gateway JWT verification is off;
their internal authentication must be reviewed before launch.

## Authenticated V2 rollback rehearsal

Two accepted artifacts with a real, backward-compatible application difference
were selected:

| Role | Commit | Cloudflare deployment | Difference |
| --- | --- | --- | --- |
| Older | `7fad8e170d55541b96203642d9ab6dd1a7793d5e` | `1ee738aa-c33e-4fc4-9e5f-77da3fa8337c` | initial staging Auth email lifecycle |
| Newer | `8e50b609eb5d082fff781e4c469569f3c7f3f0ef` | `c4fe7388-35fc-4e16-92f7-e1380a22b7e6` | hardened Auth recovery repository, hook, tests, and forward migrations |

The diff contains an application repository change, an Edge Function change,
focused tests, and ten additive Auth-safety migrations. The current staging
database already contains those migrations, and the older client did not depend
on their absence, so no database migration was reversed.

Cloudflare activated the older artifact and then the newer artifact successfully.
The hosted origin returned HTTP 200 and an already-authenticated synthetic
session was restored after refresh on both versions. The identity was presented
with the secure workspace-creation screen and retained its session; no data was
mutated and no email worker ran.

Both dashboard promotions completed without an error or retry. The operator did
not instrument the promotion interval precisely, so this rehearsal does not
establish a rollback-time objective. A future drill must capture timestamps from
the confirmation click through origin convergence and completed smoke tests.

The available synthetic browser identity had no workspace memberships. It could
therefore not truthfully demonstrate switching between two authorized
workspaces, role changes, tenant-isolated module navigation, or representative
module reads during this rehearsal. Those four checks remain a release-approval
blocker and must be repeated with the existing multi-workspace acceptance
identity before production authorization. This limitation does not invalidate
the artifact promotion/rollback mechanism, session restoration, environment
target, or schema-compatibility evidence.

## Manual production release gate

Production release requires a written record containing all of the following:

1. exact 40-character release SHA and immutable artifact/deployment identity;
2. named release operator, independent approver, database operator, incident
   owner, and approved release window;
3. passing full regression, security/authorization, migration preflight, and
   environment-isolation checks for that SHA;
4. staging deployment plus hosted login, refresh, workspace switching, role,
   module, tenant-isolation, and public-tournament acceptance;
5. reviewed forward-only migration plan and application rollback compatibility;
6. current private backup checksum and successful isolated restore evidence;
7. independently reviewed production manifest, including Auth redirects,
   Cloudflare target/domains, Supabase ref, Edge Functions, cron, Storage,
   email provider, and secret-name inventory;
8. explicit owner statement authorizing production; a passing staging check is
   never authorization;
9. post-deployment runtime-target, security-header, authentication, workspace,
   module, public endpoint, cron, and communication smoke evidence; and
10. rollback trigger, last-known-good artifact, database recovery decision, and
    customer-communication owner.

Any mismatch in project reference, domain, branch, artifact SHA, migration head,
Auth redirect, CSP, email boundary, or approval record is a fail-closed stop.
Frontend rollback does not automatically roll back the database.

## Remaining launch blockers

- Authorize and configure GitHub branch/ruleset protection without disrupting
  the accepted development flow.
- Complete the rollback smoke suite with a synthetic identity authorized for at
  least two workspaces.
- Independently verify production Auth URL/redirect configuration, managed
  backup state, email provider separation, and internal authentication for
  `verify_jwt=false` Edge Functions.
- Replace or explicitly accept production Pages Functions fail-open behavior if
  Pages Functions are introduced.
- Rehearse Storage object-byte recovery before customer-uploaded content grows.

No production resource, `main`, production messaging, staging communication
cron, or historical pending delivery was changed by this increment.

## Validation

- full Playwright regression: 1,299 passed, 1 skipped, 0 failed in 7.2 minutes;
- staging-only artifact build and embedded target/CSP verification: passed;
- migration preflight: 97 repository migrations and 97 live staging migrations;
- staging safety recheck: 18 pending deliveries and zero active communication
  cron jobs;
- documentation secret scan and `git diff --check`: passed; and
- security advisor: no new DDL was introduced; the accepted advisor state still
  reports the intentional allowlisted public tournament RPC, authenticated
  `SECURITY DEFINER` APIs, and disabled leaked-password protection for follow-up.

The Supabase advisor references are:

- https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable
- https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

