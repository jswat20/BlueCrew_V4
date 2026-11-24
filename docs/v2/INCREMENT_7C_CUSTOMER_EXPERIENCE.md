# Increment 7C — Customer Experience and Launch Readiness

## Milestone 1: module-aware setup guide

This milestone adds a first-time setup guide to the administrator dashboard
without duplicating any configuration workflow or changing the database. The
guide reads the active server-validated workspace and displays tasks only for
its enabled League, Officials, Tournament, and Facility modules.

Progress is derived from the workspace's authoritative competition catalog,
seasons, facilities, availability, reservations, tournament catalog, officials
roster, canonical games, and assignments. A browser cannot mark a task
complete. The only local preference is whether the guide is hidden, stored in a
map keyed by organization ID. Workspace changes clear all in-memory setup
snapshots along with the existing scheduling and facility state.

Each step opens an established workflow: competition and facility setup,
League schedule generation, Officials game entry, the Crew roster, Tournament
management, or reservations. Returning to the dashboard reloads authoritative
progress so a completed operation is reflected without a self-reported state.

### Accessibility and responsive behavior

- The guide exposes a named progressbar with its current numeric value.
- Task status is conveyed by text and structure, not color alone.
- Every action is a native button with a task-specific accessible name and a
  minimum 44-pixel touch target.
- The layout collapses to one column at phone widths and contains its content
  at 360 pixels without horizontal page overflow.
- Progress animation is disabled when reduced motion is requested.
- Partial-load failures produce an announced, actionable state and never claim
  that unverified work is complete.

### Verification before deployment

- Focused setup-guide browser suite: 5 passed, including tablet readability.
- Complete regression: 1,277 passed and one intentionally skipped in 6.7
  minutes.
- Staging-only curated artifact: built and verified against project
  `fdjhwxmphdzodxvhrblk` and its exact staging URL.
- No schema migration, production resource, billing service, or email-delivery
  change is included in this milestone.

## Milestone 2: secure session-restoration experience

The hosted startup screen now communicates meaningful, accessible progress
while retaining the existing fail-closed authorization boundary. It begins by
checking the saved session, advances to workspace authorization after a short
delay, and explains longer application-data hydration without displaying a
login form or any prior-workspace content.

The three stages are presented as `Secure session`, `Workspace access`, and
`Application data`. The status uses a polite live region, the loading shell is
marked busy, reduced-motion preferences disable spinner animation, and the
layout collapses cleanly on phones. All timers are cleared as soon as session
restoration resolves or fails, so a completed page cannot receive stale status
updates.

Focused authentication, accessibility, and workspace-switching verification
passes 21 tests, including a deliberately delayed hosted session that proves
the neutral boundary remains visible and tenant data remains absent throughout
authorization. The complete regression passes 1,278 tests with one intentional
skip in 6.8 minutes.

## Launch-readiness assessment

| Area | Current position | Launch action |
| --- | --- | --- |
| Deployment isolation | V2 has a fail-closed staging build and separate hosted site. | Preserve exact-ref checks; document and rehearse an authorized production release and rollback before launch. |
| Database recovery | Forward migrations and reconciliation are documented; this milestone has no migration. | Establish scheduled backups, record recovery objectives, and complete a staging restore rehearsal. |
| Migration safety | Linked-history preflight and additive migrations are established. | Require dry run, rollback notes, and database authorization tests for every remaining schema change. |
| Monitoring | Application feedback exists, but centralized production error alerting is not yet accepted. | Select a non-billable or authorized monitoring path, define severity/ownership, and test one alert. |
| Authentication | Session restoration and server-owned active-workspace context are regression covered. | Repeat persistent-browser acceptance across supported browsers and define account recovery support. |
| Invitations | Secure, expiring recipient-bound invitations are hosted and accepted. | Connect an approved transactional delivery path only after email safety and sender-domain review. |
| Email | Staging processing remains disabled and historical pending deliveries are preserved. | Build an explicit staging sink/allowlist, decide pending-row disposition, and rehearse production templates without real recipients. |
| Domain/configuration | Runtime artifacts are content-addressed and staging-qualified. | Validate production domain, redirects, CSP, Supabase Auth URLs, DNS, and environment variables in a release checklist. |
| Entitlements | All four modules are backend-enforced and independently operable. | Add subscription administration and lifecycle rules before billing; billing itself remains deferred. |
| Privacy/security | RLS, RPC authorization, tenant tests, and the public Tournament allowlist are established. | Complete a final advisor review, privacy/retention policy, and customer data export/deletion procedure. |
| Performance | Representative browser regression is broad; production load targets are not defined. | Set scheduling/import concurrency targets and test schedule publication, tournament scoring, and large rosters. |
| Support/recovery | Administrator workflows exist, but a customer support runbook is incomplete. | Document identity recovery, membership correction, entitlement correction, audit review, and escalation ownership. |

### Ranked launch blockers

1. **Critical — recovery readiness:** no accepted backup/restore rehearsal or
   measured recovery objective is documented for customer tenant data.
2. **Critical — production email readiness:** invitation and transactional
   delivery needs an approved sender, isolation/allowlist controls, operational
   monitoring, and a deliberate decision for the preserved staging backlog.
3. **High — production release rehearsal:** the final domain, environment,
   Auth redirects, release approval, rollback, and smoke-test procedure must be
   exercised without touching production prematurely.
4. **High — operational monitoring:** errors and authorization failures need
   defined alerting, ownership, and an incident response path.
5. **High — complete first-time hosted acceptance:** the guide must be deployed
   and demonstrated in representative synthetic League-, Officials-,
   Tournament-, and Facility-enabled workspaces, including workspace switching.
6. **Medium — representative load evidence:** scheduling publication,
   concurrent reservations, tournament operations, and large roster response
   targets need measured evidence.
7. **Medium — remaining usability audit:** key dialogs, validation recovery,
   keyboard focus, tablet layouts, and session-restoration perception require a
   structured hosted pass beyond this first milestone.

## Next milestones

1. Complete hosted acceptance for this setup-guide slice and correct any
   staging-only usability defects.
2. Audit and improve validation, loading, success/failure feedback, and focus
   management across one end-to-end workflow in each module.
3. Execute the release-operations rehearsals: restore, deployment rollback,
   monitoring, email isolation, and support recovery.

