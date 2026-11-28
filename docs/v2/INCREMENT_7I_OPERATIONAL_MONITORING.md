# Increment 7I: Operational Monitoring and Incident Response

**Status:** accepted on hosted V2; production alert delivery and ownership remain open launch gates

**Environment:** V2 staging only (`fdjhwxmphdzodxvhrblk`)

## Monitoring boundary

The Slate records tenant-scoped operational signals in `operational_events`.
Signals contain a generated correlation identifier, module, operation,
classification, severity, stable error code, optional HTTP status, retryability,
and a small server-allowlisted context object. The server discards every other
context field. Passwords, tokens, invitation links, URLs, email addresses,
message bodies, request bodies, and customer-entered values are never accepted
as diagnostic context.

Monitoring writes are best-effort. A diagnostic failure is reduced to a safe
console warning and cannot fail a customer operation. Records expire after 30
days. Cleanup is service-role-only and intentionally has no staging cron in this
increment.

Only an administrator in the server-validated active workspace may read events
or email-delivery health. Browser roles have no direct insert, update, or delete
grant. The recording RPC derives the organization and actor from authenticated
workspace context; it does not accept an organization identifier from the
browser.

## Coverage

| Area | Signal |
| --- | --- |
| Hosted availability | Cloudflare HTTP status and the existing staging artifact gate; browser runtime errors use `platform` signals. External uptime polling remains a gap. |
| Auth/session restoration | Session reads, restoration, account hydration, listener hydration, and workspace switches. Failed unauthenticated login attempts remain in Supabase Auth logs because no tenant context exists yet. |
| Database/RPC | Stable PostgREST/RPC codes and HTTP status, never raw payloads. |
| Authorization | `security_signal` is reserved for suspicious access attempts; database authorization tests remain authoritative. |
| League | Proposal generation, editing, and publication. |
| Officials | Game import and assignment persistence. |
| Tournament | Tournament mutations, scoring, standings, and bracket workflows. |
| Facility | Directory loading, resources, availability, closures, reservations, and cancellation. |
| Email | Per-workspace pending, processing, failed, and retrying delivery counts plus worker/Edge Function logs. |
| Edge Functions | Supabase function logs and safe correlation codes; no provider body or secret logging. |

Expected scheduling conflicts and validation rejections use
`expected_rejection` with informational severity. They do not affect outage
thresholds. Infrastructure, RPC, unexpected persistence, and hydration failures
use `operational_failure`. Cross-tenant or suspicious authorization activity
uses `security_signal`.

## Initial thresholds

- **Critical:** any critical security signal, five operational failures in 15
  minutes, or ten failed email deliveries.
- **Warning:** any operational failure, three authentication failures in 15
  minutes, or any failed email delivery.
- **Healthy:** no threshold breach. Expected business rejections are reported
  separately.
- Cloudflare HTTP 5xx lasting five minutes or three consecutive probes should be
  Severity 1; this requires an authorized external alert delivery path before
  it can be automated.

The administrator Operations Health page shows these thresholds, email queue
depth, recent events, safe context, and correlation IDs. “Run safe diagnostic”
creates a warning-level controlled failure without throwing an application
error or invoking communications.

## Severity and response ownership

| Severity | Examples | Acknowledge | Owner | Escalation |
| --- | --- | --- | --- | --- |
| SEV-1 | outage, confirmed tenant-isolation breach, widespread authentication failure, corrupt publication | 15 minutes | incident commander | security owner and platform owner immediately; customer communication owner within 30 minutes |
| SEV-2 | module workflow unavailable, sustained database/Edge Function failures, email backlog growing | 30 minutes | platform operator | module owner and database operator |
| SEV-3 | isolated retryable failure or degraded non-critical workflow | 4 business hours | module owner | platform operator if threshold repeats |
| SEV-4 | expected rejection, usability issue, informational diagnostic | next triage | product/module owner | none unless trend changes |

Named people and an actual notification route have not been authorized. Until
they are, the release operator is responsible for manually reviewing Cloudflare,
Supabase, GitHub, and Operations Health during an approved release window. This
increment must not be described as complete production alerting.

## Incident runbook

1. **Open and classify.** Record UTC time, affected workspace/module, symptoms,
   safe correlation IDs, release SHA, and severity. Do not copy tokens, request
   bodies, email contents, or customer data into the incident record.
2. **Contain.** For tenant-isolation evidence, stop mutations and public access
   to the affected path, preserve logs, and escalate as SEV-1. For email, keep
   the worker/cron disabled before investigating backlog state.
3. **Check environment.** Verify the exact Cloudflare project/domain, Supabase
   ref, release SHA, migration head, Auth redirects, and email boundary before
   making any change.
4. **Diagnose.** Correlate Operations Health with Supabase Auth/Postgres/Edge
   Function logs, Cloudflare deployment/HTTP evidence, and GitHub checks. Treat
   customer validation conflicts as expected unless an invariant was violated.
5. **Recover.** Use the accepted frontend rollback for application-only defects.
   Do not reverse database migrations automatically. Use the recovery runbook
   for corruption or deletion.
6. **Validate.** Recheck authentication, workspace switching, the affected
   module, cross-tenant rejection, public tournament access, email isolation,
   migration count, and staging/production target identity.
7. **Communicate.** The incident commander approves status updates. State impact,
   scope, mitigation, and next update time without exposing workspace data.
8. **Close.** Record root cause, detection gap, corrective owner/due date, and
   whether thresholds or runbooks require revision.

### Scenario actions

- **Application outage:** verify Cloudflare status and artifact; compare the
  accepted previous deployment; roll back only after checking migration
  compatibility.
- **Authentication failure:** inspect Auth health and redirect settings; do not
  reset credentials or weaken confirmation requirements as a diagnostic step.
- **Tenant isolation:** SEV-1; preserve evidence, disable the affected operation,
  verify RLS/RPC context, and notify the security owner before restoration.
- **Scheduling corruption:** stop publication/rescheduling for the affected
  module; compare canonical game and reservation IDs; restore from backup only
  under the recovery runbook.
- **Email failure:** disable worker invocation, preserve queue rows, distinguish
  provider acceptance from delivery, and never replay the backlog wholesale.
- **Incorrect deployment:** verify target/ref/SHA, activate the accepted prior
  artifact if schema-compatible, smoke test, and restore the candidate only
  after correction.

## Remaining gaps

- No authorized real alert delivery channel or on-call roster.
- No independent uptime probe outside Cloudflare.
- Supabase managed-log retention and export ownership require an operating
  decision.
- Automated 30-day cleanup is intentionally deferred until a safe scheduler is
  authorized.
- Authentication failures without an authenticated tenant context remain only
  in managed Auth logs.
- Edge Function log correlation should be extended when the next function is
  changed; existing production functions remain untouched.

## Staging verification evidence

- Migration `20261128004437_operational_monitoring_foundation.sql` was applied
  through the linked CLI after a dry run showed it was the only pending file.
- Post-migration checks found the event table, one tenant-scoped RLS policy,
  three authenticated monitoring RPCs, no anonymous execution grant, and no
  active communication cron.
- Anonymous invocation of `record_operational_event` returned database error
  `42501` (`permission denied for function`).
- The staging communication queue remained at 18 pending deliveries.
- Focused monitoring and module regression: 55 passed.
- Runtime-config, artifact fingerprint, and monitoring gate: 11 passed.
- Complete regression after rebuilding the staging-only artifact: 1,304
  passed, 1 intentionally skipped, 0 failed in 6.9 minutes.
- The staging artifact verifier confirmed the browser runtime and CSP target
  only `fdjhwxmphdzodxvhrblk`; no deployment was performed by the build step.

## Hosted acceptance evidence

- Application candidate `0313e1de93d7cff4b657155a3c4083685e51c6f8`
  deployed to `https://the-slate-v2.pages.dev`; GitHub staging artifact run
  `46091767696` passed.
- Hosted administrator login, refresh, session restoration, and switching among
  six authorized workspaces passed. The Beta workspace restored after refresh
  with its `league_viewer` role, Officials-only navigation, and no administrator
  monitoring link.
- Representative hosted reads passed for League schedules, Officials games and
  assignments, Tournament games/reservations, and Facility resources and
  reservations. Each switch replaced the prior workspace UI before publishing
  the next workspace data.
- The hosted `Run safe diagnostic` control recorded a warning-level controlled
  event with a generated correlation ID and only allowlisted context.
- Hosted conflict acceptance found and corrected one defect: the raw Postgres
  `P0001 / reservation_conflict` error was initially counted as an operational
  failure. Commits `4753e4e29f4c95f35b9d5cc5603b082d7ee48e23`
  and `f6e8c85f1c6fa34fa04cff55a04b182250822a1b` narrowed the classifier to
  known business messages without treating every `P0001` as expected.
- Final hosted repetition rejected the overlapping reservation with the
  actionable message and recorded the newest event as `expected_rejection /
  info`; GitHub staging artifact run `46093918192` passed for the final commit.
- Final exact-code regression: 1,304 passed, 1 intentionally skipped, 0 failed
  in 6.8 minutes. Final focused Facility/monitoring contract: 10 passed.
- Live Cloudflare evidence returned HTTP 200, ETag
  `W/"05974818f2ea5e2063bec3ed70438171"`, and confirmed the final classifier
  in the served asset. The Cloudflare deployment ID could not be read because
  no read-only API token is configured; no token was created for this task.
- Final database verification: 98 migrations, 18 historical pending deliveries,
  zero active communication cron jobs, one final expected-conflict row, and
  zero operational rows containing forbidden diagnostic-context keys.

Two earlier controlled conflict probes remain visibly classified as operational
failures and will expire under the 30-day retention rule. They were not deleted,
preserving the audit trail of the acceptance defect and its correction.
