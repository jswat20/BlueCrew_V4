# Increment 7H: Release Governance and Production Readiness

**Status:** final governance acceptance complete; production remains unchanged

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
  approvals, approval of the latest push, and resolution of review
  conversations; require the `test` job from **Playwright Tests**, a production
  artifact/environment check, security authorization tests, migration
  compatibility, and exact-SHA release-candidate verification; disallow force
  pushes and deletion; restrict bypass to a named emergency release operator.
- `slate-v2-development`: disallow force pushes and deletion. Retain the current
  direct-push workflow until a separate authorization changes it. The
  `staging-artifact` job from **Slate V2 staging build safety** remains the
  required staging evidence, but making it a branch gate would alter the
  accepted workflow and was not done here.
- The repository is public. GitHub's current documentation states that protected
  branches and repository rulesets are available for public repositories on
  GitHub Free, so these repository-level controls are enforceable under the
  current plan. No organization- or enterprise-only control is required for the
  minimum ruleset. See [Managing protected
  branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches)
  and [Managing repository
  rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/managing-rulesets-for-a-repository).
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

The public production artifact returned HTTP 200, targets only the production
Supabase project, and supplied the expected HSTS, CSP, frame denial,
permissions, referrer, and content-type security headers.

### Production configuration classification

| Item | Classification | Read-only finding |
| --- | --- | --- |
| Auth Site URL | Verified | `https://app.worktheslate.com` |
| Auth redirect allowlist | Requires remediation | Both the exact application URL and `https://app.worktheslate.com/**` are present. Supabase recommends exact production paths; narrow or formally accept the wildcard before launch. See [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls). |
| Managed backups | Verified | Daily physical backups were present for November 20–27, 2026; latest observed backup was November 27 at 05:35:36 UTC. Storage object bytes are outside database backups and remain a separate recovery procedure. See [Database backups](https://supabase.com/docs/guides/platform/backups). |
| Auth SMTP | Verified | Custom SMTP is enabled with the expected Slate sender identity and a Resend SMTP endpoint; the stored password remained hidden. |
| Auth/application email credential separation | Unverified | Both paths use Resend, while secret values and account ownership were deliberately not read. Verify separate credentials/accounts and shutdown controls before launch. See [Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp). |
| `send-account-password-reset` internal authentication | Verified with remediation | The function requires a bearer token, validates it with Supabase Auth, requires an approved administrator, and scopes the target to the actor's organization. Its wildcard CORS response and legacy single-profile organization derivation require hardening review. |
| `process-communication-emails` internal authentication | Verified | The function rejects a missing or incorrect worker bearer secret before using service-role access and uses provider idempotency keys. Secret rotation and the production cron caller/owner remain unverified without reading secrets. |
| Cloudflare production source and domains | Verified | Project `the-slate-production`, production branch `main`, active TLS domains `app.worktheslate.com` and `worktheslate.com`, no Git repository connection, and no Pages variables, secrets, or bindings. |
| Cloudflare headers/runtime | Verified with conditional remediation | Security headers and the production-only Supabase target were verified. Pages Functions are configured fail-open; this is inert while no Pages Functions exist, but must be changed or explicitly accepted before introducing them. |

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

Cloudflare activated the older artifact and then restored the newer artifact
successfully. Both deployments returned HTTP 200, retained the authenticated
session after refresh, and targeted staging Supabase only. No database migration
was modified or reversed.

The accepted multi-workspace identity demonstrated both sides of the tenant
boundary on each artifact:

- **Increment 4B Alpha:** `administrator`; Facilities, League, and Tournament
  entitlements; administrator navigation and its own League schedule data.
- **Increment 4B Beta:** `league_viewer`; Officials entitlement only; viewer
  navigation with no administrator, League, Tournament, or Facility controls;
  no Alpha schedule records appeared.

The active Beta workspace persisted after refresh. Switching to Alpha replaced
the previous workspace UI during access revalidation, and switching back did not
expose Alpha data. Representative read-only Schedule and Dashboard views loaded
under the correct role and module set.

Measured timings:

| Measurement | Result |
| --- | --- |
| Older activation confirmation to staging-artifact convergence | 45.394 seconds |
| Newer restore confirmation (`2026-11-27T23:01:05.356Z`) to authenticated Beta smoke completion | 18.346 seconds |

The first measurement excludes the later operator login handoff and therefore
is not an authenticated rollback RTO. The second measurement includes artifact
convergence, refresh, session restoration, workspace restoration, and a visible
authorized Schedule view. These are rehearsal measurements, not a production
RTO commitment.

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
- Narrow or explicitly accept the wildcard production Auth redirect.
- Verify production Auth SMTP and application email credentials/accounts are
  independently controllable without reading or publishing secret values.
- Review the password-reset function's wildcard CORS and legacy single-profile
  organization derivation; document worker-secret rotation and cron ownership.
- Replace or explicitly accept production Pages Functions fail-open behavior if
  Pages Functions are introduced.
- Rehearse Storage object-byte recovery before customer-uploaded content grows.
- Obtain separate explicit production launch authorization; this closure is not
  production approval.

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

