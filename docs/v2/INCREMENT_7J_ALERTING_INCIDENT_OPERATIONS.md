# Increment 7J: Alerting and Incident Operations

**Status:** accepted on hosted V2; real delivery and named ownership remain production activation gates

**Environment:** staging Supabase `fdjhwxmphdzodxvhrblk` and V2 Cloudflare only

## Alert delivery design

The lowest-complexity no-cost design uses two independent signals:

1. A scheduled GitHub Actions probe checks `https://the-slate-v2.pages.dev/`
   twice hourly. It requires three consecutive HTTP/content failures before the
   workflow fails. The probe has read-only repository permission, carries no
   Supabase credential, and does not send an external notification.
2. Tenant-scoped operational events are evaluated into internal
   `operational_incidents`. Administrators can review, acknowledge, and recover
   incidents in Operations Health. External delivery is structurally disabled
   (`delivery_state = disabled`) until a destination and operator are approved.

No customer content, email address, token, URL parameter, request body, or
secret is stored in an alert. Alert summaries are generated from allowlisted
module and operation identifiers. Correlation IDs connect incidents to the
existing privacy-safe event records.

## Incident state and suppression

An active fingerprint is `module:operation:error_code`, scoped by workspace.
A partial unique index permits only one open or acknowledged incident for that
fingerprint. Re-evaluation updates its last-seen time, severity, and source
event count instead of creating a duplicate. A recovered incident is immutable
history; a later recurrence creates a new incident.

States are:

- `open`: detected and awaiting an operator.
- `acknowledged`: an authenticated workspace administrator accepted ownership.
- `recovered`: an administrator confirmed recovery after validation.

Expected business-rule rejections are ineligible for incident generation.
Only `operational_failure` and `security_signal` events are evaluated. A single
failure creates a warning/error incident; critical security signals and five
matching failures in 15 minutes escalate to critical.

## Retention

`private.run_operational_retention()` deletes only:

- operational events whose explicit 30-day expiry has passed; and
- recovered incidents whose recovery is more than 30 days old.

The function has no reference to communications, networking, games, tenants,
or customer records. Browser roles cannot execute it. Before scheduling, a
rollback-only staging transaction inserted expired synthetic monitoring rows,
ran the function, asserted both rows were deleted, and rolled back. No test row
persisted. The dedicated `slate-operational-retention` pg_cron job runs daily at
03:17 UTC. The disabled communication cron remains disabled and the 18 pending
deliveries remain untouched.

## Incident ownership template

Actual people have not accepted these roles. Production activation requires
named primary and backup operators for each role:

| Role | Responsibility |
| --- | --- |
| Incident commander | Declares severity, coordinates response, approves recovery and closure. |
| Platform operator | Cloudflare artifact, application runtime, GitHub checks, and rollback. |
| Database/recovery operator | Supabase health, migrations, backup/restore, data-integrity validation. |
| Security escalation | Tenant-isolation evidence, access containment, evidence preservation. |
| Customer communications | Approved status messages, update cadence, and closure notice. |

SEV-1 acknowledgement target is 15 minutes, SEV-2 is 30 minutes, SEV-3 is four
business hours, and SEV-4 enters routine triage. These are targets, not a tested
on-call commitment.

## Activation checklist

Production alert delivery remains disabled until all of the following are
explicitly approved and tested:

- named owners and an escalation roster;
- a monitored destination and backup route;
- a provider with recipient allowlisting, rate limits, and delivery auditing;
- a credential stored outside browser artifacts and isolated by environment;
- test, acknowledgement, duplicate suppression, and recovery notifications;
- a monitor-the-monitor signal for stale probes and evaluator failures;
- production retention ownership and incident-record access review.

The independent GitHub probe detects application availability but does not yet
create a database incident or contact an operator. GitHub workflow failure is
the interim internal signal. Supabase platform and Edge Function health remain
available through managed logs/advisors; automated cross-system correlation is
a post-approval operational improvement.

## Staging evidence

- Migrations: `20261128014005_operational_incident_alerting.sql` and
  `20261128014137_schedule_operational_retention.sql`, plus
  `20261128015005_index_operational_incident_actors.sql` to cover both optional
  lifecycle-actor foreign keys and
  `20261128015158_harden_operational_incident_dedup.sql` to serialize concurrent
  evaluation and prevent a recovered source correlation from reopening.
- Preflight showed exactly those two migrations; they were applied separately
  so the rollback-only retention rehearsal occurred before scheduling.
- Anonymous alert evaluation was rejected with PostgreSQL `42501`.
- Database verification found four authenticated administrator RPC grants, one
  tenant-scoped incident policy, no unsafe retention grants, one active
  monitoring-retention job, zero active communication jobs, and 18 pending
  delivery rows.
- Focused 7I/7J tests: 11 passed.
- Staging artifact build and verification passed against only the staging
  Supabase project.

- Complete regression: 1,309 passed, 1 intentionally skipped, 0 failed in 7.1
  minutes.

## Hosted acceptance

- Application candidate `9888cdf93a2b49da9088eefcc0f05fc41a67bdc7`
  converged at `https://the-slate-v2.pages.dev`; GitHub staging artifact run
  `46095126514` passed and the served monitoring asset exposed the new controls.
- A Facility-only administrator created one controlled operational failure. It
  appeared as warning-level operational failure with allowlisted context only.
- Alert evaluation created one open internal alert with external delivery
  disabled. A second evaluation retained exactly one row, proving active
  duplicate suppression.
- The administrator acknowledged and recovered the incident. Refresh and
  workspace round-trip preserved the recovered state.
- Hosted testing exposed and corrected a lifecycle edge case: re-evaluating a
  recovered source could reopen it. The hardening migration now serializes
  evaluation and returns the existing recovered incident for the same source
  correlation. Hosted repetition retained one recovered row.
- Switching to the Beta workspace immediately replaced the prior UI with its
  League Viewer / Officials-only navigation. Operations Health and incident
  management were unavailable there; switching back and refreshing restored
  the Facility workspace and its isolated incident.
- The prior real field conflict remained `expected_rejection / info` and did
  not create an incident. Anonymous evaluator invocation was denied with
  PostgreSQL `42501`.
- Final database verification retained 18 pending deliveries, zero active
  communication jobs, one active monitoring-retention job, and no forbidden
  diagnostic context keys.

The GitHub scheduled probe is committed but GitHub executes schedules only from
the default branch. Because this increment was prohibited from changing
`main`, recurrence is an explicit release-approval step. No external alert
destination was activated.
