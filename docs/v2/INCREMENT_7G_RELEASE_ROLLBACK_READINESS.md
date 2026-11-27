# Increment 7G: Release and Rollback Readiness

**Status:** accepted for the isolated V2 staging environment on November 27, 2026

**Candidate rehearsed:** `211eedc3b35d11a335c7c862bccbe63a813a1209`

**Release-readiness implementation:** `6c7094d9451b338c0877eeff3ff14fde76bd7946`

**Hosted V2 deployment:** `ff380d94-668b-40a9-a850-96223a3cb8cb`

## Verified environment inventory

| Boundary | Staging / development | Existing production (read-only) |
| --- | --- | --- |
| Git branch | `slate-v2-development` at the selected candidate | `main` at `3f5c633070f464ddc2b4dc95fe341c96bc335aa4` |
| Branch protection | Not enabled (risk) | Not enabled (launch blocker) |
| Supabase | `fdjhwxmphdzodxvhrblk` | `dynxjiqrdlhfhrjnhvgn` |
| Cloudflare | `the-slate-v2`, `the-slate-v2.pages.dev` | public runtime at `app.worktheslate.com`; no settings changed |
| Build | `npm run build:v2-staging`, output `dist` | Existing artifact only; not deployed or changed |
| Database migrations | 97, latest `20261127213231_fix_staging_auth_crypto_caller_check` | 49, latest `20261005130023_multi_recipient_direct_messages` |

The V2 Cloudflare project is connected to `jswat20/BlueCrew_V4`, deploys only
from `slate-v2-development`, has no custom domain or deploy hook, and uses the
exact staging Supabase URL/ref plus a browser-safe publishable key. The deployed
artifact CSP permits only the staging HTTPS/WSS endpoint. HSTS, frame denial,
referrer policy, and restrictive browser permissions are present. The service
worker uses content-fingerprinted assets and a release-scoped cache.

The public production artifact was inspected without authentication or change.
It targets only the production Supabase project and has a different runtime
configuration and service-worker release. Secret values were not read or
recorded. Production Auth settings, Cloudflare build settings, Edge Function
secrets, and cron remain a mandatory operator preflight because this rehearsal
did not open or alter their administrative configuration.

The implementation commit's GitHub staging-artifact run `46073249277` and
Cloudflare Pages check both completed successfully. The hosted origin returned
HTTP 200 after convergence and its runtime configuration excluded the
production Supabase identifier.

Staging currently has four Edge Functions. The application communication queue
still contains exactly 18 pending deliveries and no active communication-email
cron job. No delivery worker was invoked.

## Fail-closed candidate gate

The manual `Slate V2 release candidate validation` workflow accepts a full Git
SHA, checks out that exact commit, and then:

1. proves the SHA, development branch, clean working tree, staging project ref,
   staging URL, and browser-safe key;
2. runs the complete Playwright regression;
3. builds and inspects the staging artifact;
4. proves that production and mixed Supabase configuration are rejected; and
5. retains the inspected artifact for 14 days.

The workflow performs no deployment and has no production credential. The
existing V2 staging workflow continues to deploy automatically through the
isolated Cloudflare project when the development branch is pushed. A passing
staging build is therefore evidence, not production authorization.

## Release runbook

### Preflight

- Name the exact 40-character candidate SHA and release owner.
- Require a passing manual candidate-validation run for that SHA.
- Review the candidate diff, migration list/order, downgrade compatibility,
  destructive SQL, Edge Functions, cron, Auth redirects, CSP, service worker,
  email controls, and secrets inventory.
- Verify a current independent backup whose migration count includes every
  migration planned for release; record checksum and restore evidence.
- Verify staging hosted acceptance for login, refresh, logout, workspace
  switching, and representative League, Officials, Tournament, and Facility
  access.
- Confirm staging still has 18 pending deliveries and zero active email cron.
- Record exact production Git branch, Supabase project, Cloudflare project,
  domains, Auth Site URL/allowlist, and approved release window.
- Obtain explicit production authorization from the designated owner. A passed
  workflow or staging rehearsal is never implicit approval.

### Deployment

1. Freeze the candidate; do not rebuild from a moving branch.
2. Apply forward-compatible database migrations centrally and one environment
   at a time. Never automatically reverse database migrations during an
   application rollback.
3. Deploy the exact inspected application artifact to the explicitly verified
   production project only after authorization.
4. Record commit, artifact identity, migration head, deployment ID, operator,
   approver, start/end time, and configuration fingerprints (never secret
   values).
5. Run smoke tests: runtime target, security headers, login/session restoration,
   workspace isolation, one read in every enabled module, public tournament
   allowlist, and email/cron state.

### Rollback triggers and response

Rollback the application for wrong-environment configuration, authentication
failure, cross-tenant exposure, severe navigation/startup regression, or broad
module outage. Disable affected entry points and communications first if data
or messaging safety is uncertain. Select the last accepted deployment whose
schema compatibility was reviewed, confirm its target, roll back the frontend,
and repeat the smoke suite. Escalate tenant exposure, credential leakage,
unauthorized email, or destructive data changes as an incident. Use the
database recovery runbook for corruption; do not infer that a frontend rollback
restores database state.

## Staging rollback rehearsal

The Cloudflare dashboard was used only on `the-slate-v2`:

1. Current deployment `6b263fa1-3f3b-427c-a880-690d252dd9fe`
   (`211eedc`) was identified.
2. Prior accepted deployment `c4fe7388-35fc-4e16-92f7-e1380a22b7e6`
   (`8e50b609`) was selected and made active.
3. Cloudflare reported successful convergence in approximately 3 seconds.
4. The accepted candidate was then restored; Cloudflare again reported success
   in approximately 3 seconds.
5. The V2 origin returned HTTP 200 and retained the exact staging Supabase
   runtime target and staging-only CSP. No migration was reversed.

Because `211eedc` contains documentation only and follows application commit
`8e50b609`, this rehearsal intentionally proved artifact selection and recovery
without introducing a schema-compatibility delta. Future rehearsals must choose
artifacts that bracket a real compatible application change.

## Recovery and remaining risks

The latest independently restored archive remains readable and checksummed, but
its snapshot contained 84 migrations while staging now contains 97. It is valid
recovery evidence, not a current release-point backup. A fresh backup and
isolated restore at migration 97 or later is required before any production
release.

Other open launch risks:

- both GitHub branches lack protection and required-review enforcement;
- Cloudflare staging auto-deploys every development-branch push before the
  separate GitHub validation can act as a hard gate;
- production administrative configuration has not yet been captured in a
  redacted, independently reviewed manifest;
- Pages Functions fail-open behavior must be revisited if a `functions/`
  directory is introduced;
- production email provider, Auth email, cron, and secret separation require a
  final operator review before activation;
- database rollback remains forward-fix or restore driven and has not been
  rehearsed for the 13 migrations after the current archive.

## Responsibility

The release operator collects evidence and executes approved steps. A separate
owner authorizes production. The database operator owns migration and recovery
decisions. The incident lead decides rollback versus shutdown and customer
communications. No role may infer production authorization from repository
access alone.

## References

- Supabase database migration guidance: https://supabase.com/docs/guides/deployment/database-migrations
- Supabase deployment maturity guidance: https://supabase.com/docs/guides/deployment/maturity-model
- Recovery procedure: `docs/v2/RECOVERY_RUNBOOK.md`
- Backup rehearsal: `docs/v2/INCREMENT_7D_BACKUP_RECOVERY_VALIDATION.md`
