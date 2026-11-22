# The Slate 2.0 — Spring 2027 architecture and delivery plan

Assessment date: 2026-11-22

Target operational launch: 2027-03-01

Scope: `slate-v2-development`, staging Supabase
`fdjhwxmphdzodxvhrblk`, and `https://the-slate-v2.pages.dev` only.

This is an architecture and sequencing proposal. It does not authorize a schema
migration, production change, Cloudflare deployment, email delivery, or major
feature implementation.

## Executive recommendation

Deliver one polished softball operating path by March 1: organization setup,
roles, officials, league structure, facilities, games, field reservations,
official availability and assignments, notifications, audit, and essential
reports. Preserve the working application shell and assignment workflows, but
replace the pilot's one-profile/one-organization authorization assumption with
explicit organization memberships before adding softball data.

Include a deliberately bounded tournament core on the launch critical path:
pool play, standings, seeded single-elimination brackets, recorded results,
field allocation, and official assignments. Tournament games must be canonical
`games`, not a parallel scheduler. Defer advanced bracket formats, public event
sites, payments, roster registration, and automatic optimization so tenancy,
scheduling reliability, and launch quality remain protected.

## Current readiness

### Strengths to preserve

- All current business tables are organization-scoped and all 26 staging public
  tables have RLS enabled.
- Composite organization-aware relationships already prevent several classes of
  cross-organization reference.
- Administrator, assigner, umpire, and league-viewer authorization and UI paths
  exist, with extensive positive and denial coverage.
- Officials already have approval, Crew linkage, eligibility, availability,
  claims, assignments, decline/reopen, communication, and audit workflows.
- Games, locations, fields, seasons, schedules, imports/exports, notifications,
  messaging, reporting, and responsive/accessibility behaviors have reusable
  foundations.
- The staging-only artifact gate rejects production and mixed Supabase targets.
- The current complete Playwright baseline is 1,189 passed, 1 skipped, and zero
  failures.

### Architectural constraints

- `profiles` currently binds one Auth user to one organization and one enum role.
  `current_organization_id()` and `current_account_role()` assume that cardinality.
- The role enum is increasingly expensive to extend and cannot represent one
  person as, for example, a softball assigner and baseball umpire.
- Registration selects the sole active organization. That is intentionally safe
  for a pilot but incompatible with multiple active organizations.
- Divisions are represented largely by game `level` text and league-viewer text
  arrays. Leagues, divisions, and teams are not normalized domain entities.
- Locations and fields are inventory records, not reservable resources. There is
  no availability calendar, maintenance blackout, reservation transaction, or
  database-enforced overlap protection.
- Games have field and team-name text, but no team foreign keys or reservation
  identity. Scheduling cannot atomically coordinate fields and officials.
- There is no tournament, bracket, round, seed, advancement, or result model.
- The static, global JavaScript architecture is well tested but has broad service
  coupling and no explicit active-organization application context.
- Migration history differs between source, staging, and production. No new
  schema work should begin until a disposable restore and reconciled baseline are
  reviewable.
- Edge Function email delivery is disabled in staging, but native Auth mail still
  lacks a safe staging sink.

## Requirement gap analysis

| Requirement | Existing capability | Gap | Readiness |
|---|---|---|---|
| Multiple organizations and sports | Most business rows carry `organization_id`; cross-org denial tests exist | One Auth user cannot safely hold memberships/roles in multiple organizations; no sport catalog or org switch | Partial, foundational redesign required |
| Role model | Admin, assigner, umpire, league-viewer exist | Enum role is single-valued; facility/tournament roles and scoped grants are absent | Partial |
| Official lifecycle | Recruitment, approval, Crew identity, eligibility, availability, claims, assignments, declines, communication exist | Registration assumes one org; eligibility is level text; multi-org official identity and hosted acceptance incomplete | Strong foundation |
| League structure | Seasons and level terminology exist | No normalized league, division, team, membership, standings, or schedule ownership model | Major gap |
| Game management | Mature game, assignment, claim, import/export, review and lifecycle workflows | Team references are text; no reservation identity; lifecycle must support tournament provenance | Strong foundation requiring refactor |
| Facilities | Locations and fields exist | No owners/access grants, hours, blackouts, reservation status, holds, conflict exclusion, or shared-facility controls | Major gap |
| Integrated scheduling | Workbench, Operations Center, availability and assignment conflicts exist | No field availability transaction or schedule generation/validation across teams, fields, and officials | Major gap |
| Tournaments | Ordinary games and assignments can be reused | No tournament, pool, standings, bracket, seed, advancement, or result model | Launch-critical major gap |
| Communications | In-app notifications/messages, event outbox, delivery audit and templates exist | Staging mail isolation incomplete; tenant branding and recipient policy need multi-org review | Partial |
| Audit and reliability | Activities, idempotent RPCs, extensive Playwright suite, staging build gate | Audit taxonomy is inconsistent; no database RLS test suite or migration CI against disposable database | Good base, quality gates required |
| Professional UI | Responsive shell, role navigation, accessible components, WCAG automation | Tenant switcher, softball terminology/branding, facility calendar and coherent error recovery absent | Partial |
| Deployment | Staging-only build verified | Cloudflare dashboard configuration not independently inventoried; development workflow builds but does not run the full suite | Partial |

## Proposed domain and tenancy model

### Identity and authorization

Separate human identity from organization authorization:

- `people`: one row per human/application identity, optionally linked one-to-one
  to `auth.users`; contains only platform-level identity fields.
- `organization_memberships`: one row per person and organization, with status,
  join/approval dates, organization-specific display/contact preferences, and a
  unique `(organization_id, person_id)` constraint.
- `roles`: stable catalog values such as `administrator`, `assigner`, `umpire`,
  `league_viewer`, later `facility_manager` and `tournament_director`.
- `membership_roles`: many-to-many organization-scoped role grants. Each grant
  has grantor, timestamps, optional expiry, and audit provenance.
- `role_scopes`: optional restrictions by division, facility, tournament, or
  operation. MVP uses it for league-viewer division scope; future roles use the
  same mechanism rather than new role-specific tables.
- `official_memberships`: organization-specific officiating state, eligibility,
  certification, active status, preferences, and approval. One person may be an
  official in both associations without exposing either association's private
  notes to the other.

Keep Supabase Auth as authentication only. Authorization comes from current
database membership. Do not authorize from user-editable metadata or rely on
stale JWT role claims.

### Organization and sport

- `organizations`: tenant/legal association, timezone, branding, status and
  defaults. Lake Shore Youth Baseball and Lake Shore Softball Association are
  distinct rows.
- `sports`: controlled catalog (`baseball`, `softball`) with sport-neutral rules
  metadata only.
- `organization_sports`: enables an organization to operate one or more sports
  without duplicating the tenant. It owns terminology and rule-set selection.
- `organization_settings`: typed/configured settings should progressively replace
  unconstrained JSON; JSON remains suitable for presentation-only extensions.

All operational rows carry `organization_id`. Rows tied to a sport also carry
`organization_sport_id`, protected by an organization-qualified foreign key.

### League and schedule structure

- `leagues`: organization-sport competition grouping.
- `seasons`: organization-sport season with dates, scheduling state and timezone.
- `divisions`: league/season division with age/classification, rules, game length,
  default crew configuration and ordering.
- `teams`: organization, season and division ownership; stable identity separate
  from display name.
- `team_memberships` is post-launch unless roster management becomes essential;
  MVP needs teams, not player PII.
- `games`: references organization, season, division, home/away teams, field and
  optional reservation. Keep existing lifecycle and assignment relationships.

Legacy `level`, `home_team`, and `away_team` remain compatibility snapshots during
transition, then become derived display values. No big-bang rewrite is required.

### Facilities and reservations

- `facilities`: the current location concept, owned by an organization.
- `facility_resources`: reservable fields/courts/areas, replacing the narrow
  `fields` concept while retaining field compatibility.
- `facility_access_grants`: explicit cross-tenant visibility/use permission for a
  shared physical resource. Strict isolation is the default; sharing is opt-in,
  auditable, revocable and limited by operation.
- `facility_availability_rules`: recurring hours and seasonal constraints.
- `facility_blackouts`: maintenance, weather, closure and owner blocks.
- `facility_reservations`: requester organization, resource, time range, purpose,
  game/tournament reference, status (`hold`, `confirmed`, `cancelled`, `released`),
  creator and audit fields.

Use `tstzrange` for reservation time and a database exclusion constraint for
active overlap on each resource. Reservation and game creation/update must be one
transactional command so a game cannot claim an unavailable field. Cross-tenant
reservation details must be minimized: an authorized requester may learn that a
slot is unavailable without seeing another tenant's private event details.

### Tournament extension (post-launch)

- `tournaments`, `tournament_divisions`, `tournament_entries`,
  `tournament_brackets`, `tournament_rounds`, `tournament_games`, and
  `tournament_results`.
- Tournament games reference canonical `games`; they do not create a second game
  or assignment engine.
- Bracket advancement is transactional and idempotent. Manual overrides require
  a reason and audit entry.

### Audit and communication

- Retain the communication event/delivery outbox and idempotency keys.
- Standardize append-only `audit_events` with organization, actor membership,
  action, entity type/id, request correlation ID, before/after summaries and
  timestamp. Sensitive values and message bodies do not belong in audit metadata.
- Every cross-tenant access grant, role change, approval, reservation override,
  schedule publication and bracket override is audited.

## Tenant security design

1. Every exposed operational table has RLS and an indexed `organization_id`.
2. Every policy checks an approved `organization_membership` for `(auth.uid(),
   row.organization_id)` plus the required role/scope. `TO authenticated` alone
   never grants business access.
3. The browser supplies an active organization ID only as context. The database
   independently proves membership and scope for every row and RPC.
4. Cross-tenant foreign references are blocked with composite unique keys and
   composite foreign keys containing `organization_id`.
5. UPDATE policies have both `USING` and `WITH CHECK`. Views exposed to clients
   use `security_invoker = true`.
6. Privileged helper functions live in an unexposed `private` schema, set a safe
   `search_path`, validate `auth.uid()`, and have default `PUBLIC` execution
   revoked. Security-definer functions are exceptional, narrow and tested.
7. Storage paths begin with organization and person/membership IDs; Storage RLS
   repeats membership checks and prevents cross-tenant upsert/read.
8. Shared facilities use explicit access grants. A conflict response exposes
   availability, not the other tenant's team, contact, or event details.
9. Tests cover same-role cross-tenant attempts for SELECT, INSERT, UPDATE, DELETE,
   RPC and Storage—not merely hidden UI controls.
10. RLS policy queries use indexed membership keys and statement-stable helper
    calls. Performance plans are captured before rollout to a second tenant.

## MVP boundary for March 1

### Required for launch

- Two distinct organizations with baseball/softball terminology, branding and
  isolated data.
- Multi-organization memberships, role grants, organization switcher, and roles:
  administrator, assigner, umpire, league-viewer.
- Softball administrator bootstrap and safe official recruitment/approval.
- League, season, division and team setup without player roster PII.
- Facility/resource inventory, hours, blackouts, reservations and atomic conflict
  detection.
- Game create/edit/import/publish/cancel with team and field references.
- Official eligibility, availability, claims, direct assignment, replacement and
  decline workflows.
- Integrated validation of team, field and official conflicts. MVP may use
  assisted scheduling and bulk import; it does not require an optimizer.
- Tournament setup, pool play, standings, seeded single-elimination brackets,
  results, field allocation, and official assignments using canonical games.
- In-app notifications and audited communication events. External email is
  enabled only after a staging sink and explicit delivery acceptance gate.
- Operations dashboard, mobile/desktop critical paths, actionable errors, audit
  search, essential schedule/assignment exports and rollback runbook.
- Credentialed hosted acceptance for all four launch roles in both organizations.

### Post-launch

- Advanced tournament formats, public event sites, payments, registrations,
  roster check-in, waitlists, and automatic bracket optimization.
- Facility manager and tournament director roles (the schema must allow them).
- Automatic schedule optimization and what-if planning.
- Player/guardian rosters, payments, registration or public-facing league sites.
- Cross-organization official pooling beyond independent opt-in memberships.
- Advanced standings, analytics, payroll, accounting and integrations.
- Native apps, offline mode and real-time collaborative scheduling.

## Dependency-ordered two-week increments

### Increment 1 — Nov 23 to Dec 6: baseline and architecture runway

- Review and approve this model, MVP boundary and role matrix.
- Reconcile migration source/registry in a disposable restored database; produce
  a non-executable baseline proposal and schema fingerprints.
- Add database migration/RLS test harness design and CI ordering proposal.
- Inventory Cloudflare development project configuration and establish native
  Auth email containment without sending mail.
- Prototype, in tests and design only, compatibility mapping from `profiles` to
  people/memberships/roles and from text levels to divisions.
- Produce softball discovery worksheet: divisions, fields, scheduling rules,
  crew sizes, contacts, blackout dates, import formats and launch reports.

Exit: approved architecture, reconciled disposable baseline, no unexplained
migration drift, environment evidence, signed role matrix and softball source
data ready. No staging schema migration in this increment.

### Increment 2 — Dec 7 to Dec 20: tenancy and organization switching

- Implement reviewed identity, memberships, role grants and organization-sport
  tables through an additive migration.
- Backfill pilot profiles idempotently, retain compatibility reads, and introduce
  explicit active-organization context in repositories/UI.
- Add tenant-switch UI and cross-tenant RLS/RPC/Storage tests.
- Create synthetic baseball and softball tenants in staging only.

Exit: one Auth user can hold different roles in two synthetic organizations;
every tested cross-tenant access fails closed; legacy workflows still pass.

### Increment 3 — Dec 21 to Jan 3: league structure and official onboarding

- Add organization sports, leagues, seasons, divisions and teams.
- Convert eligibility and league-viewer scope to stable division identifiers with
  compatibility mapping for legacy levels.
- Make registration organization-invite or organization-selection based; remove
  the sole-active-organization assumption.
- Deliver softball admin setup and official approval happy path.

Exit: softball administrators can configure a season/divisions/teams and approve
an umpire without seeing baseball data; audit and denial cases pass.

### Increment 4 — Jan 4 to Jan 17: facilities and reservations

- Add facility resources, access grants, hours, blackouts and reservations.
- Implement atomic hold/confirm/release and database overlap protection.
- Refactor location/field UI into a responsive facility calendar and inventory.
- Test daylight-saving, boundary adjacency, concurrent reservation and private
  cross-tenant conflict behavior.

Exit: two concurrent attempts cannot double-book a field; authorized shared use
works without exposing private tenant details.

### Increment 5 — Jan 18 to Jan 31: integrated league scheduling

- Link games to divisions, teams and reservations while preserving legacy
  snapshots and current assignment identity.
- Add schedule validation for team, field, blackout and official conflicts.
- Deliver assisted create/edit/bulk import, publish and rollback with error rows.
- Update Operations Center and Workbench for explicit tenant and season context.

Exit: a softball season schedule can be imported, corrected, reserved, published
and exported; failed rows do not leave partial games or reservations.

### Increment 6 — Feb 1 to Feb 14: tournament core and complete official operations

- Add tournaments, entries, pools, standings rules, bracket rounds/seeds and
  idempotent result advancement. Generate tournament contests as canonical games
  so existing field reservations and official assignments are reused.
- Finish eligibility, availability, claims, direct assignments, replacements,
  declines, reminders and communication in the multi-org model, including
  tournament games.
- Configure a staging mail sink and verify idempotent delivery only after explicit
  operational approval; otherwise launch with in-app communication only.
- Complete league-viewer read-only schedules and scoped Crew directory.
- Run credentialed hosted acceptance for every role and both organizations.

Exit: a synthetic pool-to-single-elimination tournament and the end-to-end
official workflow succeed on mobile and desktop with deterministic standings,
audited results, no duplicate advancement/messages and cross-tenant denial.

### Increment 7 — Feb 15 to Feb 28: launch hardening

- Freeze schema/features; repair only launch blockers.
- Load reviewed softball data using dry-run/import reports and synthetic rehearsal
  before controlled staging acceptance.
- Complete performance, accessibility, recovery, concurrency and security tests.
- Verify Cloudflare staging configuration, backup/restore, rollback, monitoring,
  support ownership and launch checklist.
- Conduct director-led user acceptance and training.

Exit: zero severity-1/2 defects, no unexplained test failures, restore and rollback
rehearsed, named operators trained, and explicit go/no-go approval recorded.

## Acceptance criteria by module

### Tenancy, identity and roles

- A user may have memberships in both organizations and different roles in each.
- Switching organization changes all navigation/data context without re-login.
- Revoked or pending membership loses access immediately at the database boundary.
- Cross-tenant CRUD, RPC, view and Storage tests fail for every launch role.
- Role/scope changes are atomic and audited; no authorization uses editable user
  metadata.

### Organization, league, season, division and team management

- Admin can configure sport-specific organization settings, seasons, divisions
  and teams with unique, stable IDs.
- Softball terminology and rules do not change baseball presentation or data.
- Invalid date ranges, duplicate division/team keys and cross-tenant references
  fail with actionable errors and no partial writes.
- Deactivation preserves historical games and audit records.

### Official management

- Recruitment, verification, approval, eligibility, activation/deactivation and
  organization-specific Crew linkage are auditable and retry-safe.
- One person can officiate for both associations without sharing private notes or
  eligibility implicitly.
- Umpires manage only their own organization-scoped availability and claims.
- Administrators/assigners see only the contact fields required by policy.

### Facilities and reservations

- Admin can manage resources, recurring hours, closures and blackouts.
- Active reservations cannot overlap at the database layer, including concurrent
  requests; adjacent reservations remain valid.
- Game changes atomically update/release reservations or fail without partial
  state.
- Shared facilities require explicit grants; conflict responses reveal no private
  other-tenant event data.

### Games and scheduling

- Games reference stable season, division, teams and resource/reservation IDs.
- Create/edit/import validates team, field, time, blackout and official conflicts.
- Import is dry-runnable, reports row-level errors and is atomic by declared batch
  boundary.
- Publish/cancel/postpone operations are audited and refresh-safe.
- Calendar behavior is correct in `America/New_York`, including DST transitions.

### Assignment operations

- Eligible available officials can claim; managers can approve, assign, replace,
  clear and lock according to role.
- Concurrent claim/assignment attempts produce one winner and a useful loser
  response without partial state.
- Assignment identity survives schedule edits and page refresh; cancelled games
  cannot retain actionable open assignments.

### Communications

- One business event creates one in-app event and at most one delivery per
  recipient/channel/idempotency key.
- Tenant branding, links and recipient selection are organization-scoped.
- Staging tests cannot reach a real recipient; pending historical deliveries are
  preserved until a reviewed disposition plan.
- Provider failure is retryable and observable without exposing message content
  or credentials.

### Audit, reporting and support

- Security- and schedule-significant mutations record actor, tenant, action,
  entity, time and correlation ID.
- Audit is append-only to browser clients and searchable by authorized admins.
- Essential schedule, facility and assignment exports reproduce visible scoped
  data and never include another tenant.
- Operational errors include a correlation ID and recovery guidance.

### Tournament module (post-launch)

- Tournament setup, entries, seeding and bracket generation are deterministic.
- Results advance exactly once; manual overrides require reason and audit.
- Tournament games reuse canonical facility reservations and official assignments.
- Division/tournament directors cannot reach unrelated tenant or league data.

### UI, accessibility and quality

- Critical workflows pass at supported desktop and mobile breakpoints, by
  keyboard, and with automated WCAG A/AA checks.
- Loading, empty, permission, validation, conflict and transient-failure states
  are explicit and preserve user input when safe.
- Complete unit/browser/database/security suites are green before promotion; no
  test is weakened to hide a product defect.

## Code disposition

### Reuse

- Application shell, navigation grouping, shared presentation components,
  accessibility patterns and responsive Crew Card.
- Game, assignment, claim, availability, notification, messaging, communication
  outbox, audit activity, import/export and reporting domain behaviors.
- Supabase client/config generation, repository error handling, staging build
  safety and Playwright fixtures.
- Existing organization-qualified IDs and assignment/game lifecycle contracts.

### Refactor incrementally

- `profiles`, identity helpers and authorization services into person,
  membership, role and active-organization context.
- Repository methods to require explicit organization/season context for query
  performance while continuing to rely on RLS for security.
- `crew_members` into organization-specific official membership while retaining
  compatibility IDs during migration.
- `level` strings and league-viewer arrays into division IDs with display
  snapshots for historical compatibility.
- `locations`/`fields` into facilities/resources/reservations.
- Games to reference teams and reservation identity while preserving current
  assignment/claim IDs and UI behavior.
- Global service state into a small explicit application context. Avoid a
  framework rewrite during the launch window.

### Replace or retire

- Sole-active-organization public provisioning.
- One-profile/one-role authorization helpers and the expanding role enum.
- Browser-local/demo persistence in any hosted path; retain only isolated test
  fixtures.
- Free-text team/division identity as the authoritative source.
- Client-only conflict checks for reservations or multi-row schedule changes.
- Role-specific scope tables as the long-term pattern; migrate league-viewer
  scope to generalized grants after compatibility is proven.

## Risk register

| Risk | Probability / impact | Mitigation and trigger | Owner/gate |
|---|---|---|---|
| Cross-tenant data exposure during membership refactor | Medium / Critical | Additive model, composite FKs, default-deny RLS, same-role adversarial database tests, security review before staging data | Architecture/security gate in Increment 2 |
| Migration registry/source drift | High / Critical | Disposable restore, recover exact source, schema fingerprints, new reconciliation baseline; never replay recorded IDs | Increment 1 exit gate |
| Timeline compression to March 1 | High / High | Freeze tournament formats to pool play plus seeded single elimination; defer optimizer/rosters/public event features; two-week demos | Product owner at every increment |
| Facility model fails shared-field reality | Medium / High | Softball discovery in Increment 1; explicit owner/access grants; no implicit sharing | Director + architecture decision |
| Staging email reaches real recipients | Medium / High | Keep cron and senders disabled, add sink, use reserved synthetic domains, verify provider path before enabling | Communications gate |
| Native Auth signup/recovery bypasses sink | Medium / High | Provider-level containment and explicit negative test; avoid hosted account creation until complete | Increment 1 gate |
| Cloudflare points at wrong branch/project | Low / Critical | Dashboard inventory, exact branch/project variables, production-ref rejection, no custom production domain | Deployment gate |
| Static/global client coupling slows tenant switch | High / Medium | Introduce application context and repository seam; do not framework-rewrite | Increment 2 technical gate |
| Concurrent scheduling double-books resources | Medium / High | Range exclusion plus transactional RPC, concurrency tests, idempotency | Increment 4 exit gate |
| Softball source data arrives late or inconsistent | Medium / High | Discovery worksheet and sample imports in Increment 1; dry-run importer; named data owner | Business readiness gate |
| Dependency vulnerabilities or platform changes | Medium / Medium | Pinned lockfile, scoped upgrades, Node 22+ and TypeScript readiness review, weekly advisories | Quality owner |
| Insufficient credentialed acceptance | Medium / High | Synthetic accounts/sessions in isolated staging, test matrix and director UAT before freeze | Increment 6/7 gate |
| Backup exists but restore is unproven | High / High | Restore into disposable database and rehearse rollback before any tenancy migration | Increment 1 and launch gate |

## Decisions required before Increment 2

1. Approve people + organization memberships + multi-role grants as the identity
   model, including whether a user may hold admin and assigner simultaneously.
2. Confirm whether baseball and softball share any physical fields and who owns
   reservation authority for them.
3. Confirm softball launch divisions, crew sizes, game lengths, eligibility rules,
   blackout rules, import source and required reports.
4. Confirm pool play plus seeded single elimination as the launch tournament
   boundary and assisted scheduling (not automatic optimization) as MVP.
5. Choose launch communication mode: in-app only, or external email after a
   staging sink and delivery gate.
6. Name business owners for softball data, UAT, operations and go/no-go approval.

## First increment proposed for approval

Increment 1 is architecture runway, not feature development. Its deliverables are:

- migration reconciliation report from a disposable restore;
- proposed additive migration sequence and rollback boundaries, not applied;
- tenant role/scope matrix and RLS test matrix;
- Cloudflare staging configuration evidence;
- native Auth email containment design and verification plan;
- softball discovery worksheet with sample schedule/facility inputs;
- compatibility mapping and test plan for identity and divisions;
- updated effort/risk forecast and an Increment 2 go/no-go review.

No new tenant tables, production changes, deployment, billable infrastructure,
real email, or large UI feature belongs in Increment 1.
