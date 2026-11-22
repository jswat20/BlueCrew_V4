# Increment 1 — tenant-safe competition catalog

Implementation date: 2026-11-22

Scope: `slate-v2-development` and Supabase staging project
`fdjhwxmphdzodxvhrblk` only. Production and `main` remain out of scope.

## Outcome

The first additive Spring 2027 vertical slice establishes organization-scoped
sport programs, leagues, season divisions, and teams without changing existing
games, assignments, claims, officials, or registration behavior.

Administrators can use Settings to:

1. add Baseball or Softball as an organization program and create its league;
2. create a division in an existing season; and
3. create teams inside that division.

The client reads only rows admitted by RLS. Transactional RPCs derive the
organization from the authenticated profile and reject non-administrators.

## Schema boundary

Migration: `20261122195507_competition_catalog_foundation.sql`

New tables:

- `sports` — controlled global Baseball/Softball catalog;
- `organization_sports` — an organization's sport program;
- `leagues` — organization sport competition grouping;
- `divisions` — season-specific league division; and
- `teams` — season/division team identity.

Every operational table has `organization_id`, RLS, authenticated-only grants,
indexed tenant access paths, and composite organization-qualified foreign keys.
The public anonymous role has no access. Mutation policies are split by action to
avoid overlapping SELECT policies.

New security-invoker RPCs:

- `create_competition_program`;
- `create_competition_division`; and
- `create_competition_team`.

The schema intentionally does not link `games` yet. Existing text `level`,
`home_team`, and `away_team` values remain authoritative until the next additive
compatibility migration introduces nullable stable IDs and tested backfill rules.

## Verification and rollback boundary

Before any staging application, the exact migration was executed inside an
explicit transaction followed by `ROLLBACK`; PostgreSQL accepted the complete
DDL, policies, grants, indexes, triggers, seed catalog and functions, and no
objects or rows remained from the rehearsal.

On 2026-11-22, the three missing staging migration sources were recovered from
PRs 29 and 30 and restored under the exact version IDs already recorded in
staging (`202609100001`, `20261005125847`, and `20261005130554`). Live function
fingerprints and the message-deletion table shape were compared before the
files were restored. The migration history table was not repaired and no
existing migration was replayed.

The linked CLI dry run then proposed only this competition-catalog migration.
It was applied to staging project `fdjhwxmphdzodxvhrblk`, recorded in migration
history, and verified with two seeded sports, zero organization catalog rows,
RLS enabled on all five tables, and 17 policies. A follow-up migration added the
single foreign-key index identified by the post-DDL performance advisor.

The migration is additive. Before organization-specific rows exist, rollback is
the reverse-order removal of the three RPCs and the five new tables. After real
league data exists, rollback requires an export and dependency review and must
not be treated as a simple drop.

No production rollback applies because production was not targeted.

The staging-only artifact build also passed its target and production-reference
checks. It used a nonfunctional browser-key placeholder for artifact validation,
created only local `dist` output, and did not deploy at that verification point.

## Test coverage

Final verification on 2026-11-22: `1192 passed`, `1 skipped` in the complete
1,193-test Playwright regression suite. The staging-only artifact build and
verification also passed; no deployment was performed.

- Complete administrator program → division → team workflow.
- Cross-organization fixtures remain invisible.
- Direct mutation by an umpire is rejected even outside the hidden admin UI.
- A live staging database impersonation of a non-administrator was rejected by
  `create_competition_program` with
  `competition_catalog_administrator_required`; no catalog row was created.
- Migration contract verifies RLS, composite tenant foreign keys, invoker rights,
  anonymous revocation, and fail-closed administrator checks.
- Existing season Settings, responsive layout, Crew/Profile behavior, and
  automated WCAG A/AA checks remain covered.

## Known risks and inherited debt

- Current identity still allows one Auth user to own only one organization
  profile. Separate associations are isolated, but a single person cannot yet
  switch between memberships safely.
- Existing league-viewer scope and official eligibility still use text levels;
  they are not yet division-ID grants.
- Staging has pre-existing security advisor warnings for legacy public
  security-definer execution, mutable search paths, and two RLS-without-policy
  tables. This increment does not add security-definer functions and does not
  conceal that inherited debt.
- Migration provenance drift documented in `MIGRATION_RECONCILIATION.md` remains
  a release gate even though this migration has a new non-conflicting version.
- External email remains disabled; this increment creates no notification or
  communication delivery.

## Next increment

The next dependency-ordered increment is multi-organization identity and active
tenant context:

1. introduce people, organization memberships, and scoped role grants
   additively;
2. backfill current profiles without changing existing IDs;
3. replace sole-organization helper assumptions behind a compatibility layer;
4. add an organization switcher and explicit repository context;
5. convert league-viewer division scope to stable division IDs; and
6. add database-level same-role cross-tenant CRUD/RPC/Storage rejection tests.

After that boundary is proven, games can receive nullable `division_id`,
`home_team_id`, `away_team_id`, and reservation identity while remaining the
canonical entity used by league and tournament scheduling.
