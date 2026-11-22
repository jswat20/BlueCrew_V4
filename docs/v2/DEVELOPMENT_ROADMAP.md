# The Slate V2 SaaS delivery roadmap

Updated: 2026-11-22

Scope: `slate-v2-development`, staging Supabase
`fdjhwxmphdzodxvhrblk`, and `https://the-slate-v2.pages.dev` only.

## Product boundary

Each organization is an independent customer workspace. Baseball and softball
may be separate workspaces or sports configured inside one workspace. Identical
facility or league names never imply shared identity, availability, conflicts,
or access. There is no global facility registry.

The League Scheduling and Umpire Management modules are independently entitled
and must each operate without records owned by the other module. Complete Suite
enables both modules in one workspace. Billing synchronization is deferred.

## Current state

- Competition catalog and facility reservations are accepted, hosted, and
  isolated by `organization_id`.
- The additive SaaS foundation introduces workspace memberships, independent
  membership roles, module entitlements, trusted tenant onboarding, and workspace
  audit records while preserving legacy profile authorization.
- Existing organizations are backfilled as Complete Suite so fall umpire
  operations do not regress.
- Organizational games are not yet module-independent: the legacy `games`
  table requires season, location, and field records. League scheduling must not
  build on that table until a compatible neutral scheduling design is approved.
- Existing umpire RPCs still use the one-profile/one-organization helpers. Their
  membership-aware transition is the next security-critical increment.

## Increment A — SaaS tenant foundation

- Add organization memberships and multiple role grants.
- Add backend module entitlements for League and Umpire modules.
- Backfill legacy profiles and enable both modules for existing workspaces.
- Restrict tenant provisioning to the trusted service role.
- Enforce League entitlement on competition and facility mutations.
- Expose authenticated users' own workspace/module context.
- Document dependency audit and denial-test requirements.

Exit: legacy behavior remains green; accepted League features remain hosted;
unauthorized membership/entitlement mutations fail at the database boundary.

## Increment B — active workspace switching

- Add an explicit, server-validated active-workspace preference.
- Allow one Auth user to have an organization-specific profile in each workspace.
- Resolve profile, role, Crew identity, cache, subscriptions, and repository
  hydration from the active approved membership.
- Clear all tenant state before switching and discard late responses.
- Convert RLS/RPC authorization in bounded groups with same-role cross-tenant
  SELECT/INSERT/UPDATE/DELETE tests.
- Add the hosted workspace switcher only after database switching is authoritative.

Exit: one user holds different roles in two synthetic workspaces and switches
without reauthentication; every cross-tenant attempt fails closed.

## Increment C — module separation and neutral games

- Introduce a neutral workspace game identity with optional League competition
  links and optional Umpire staffing links.
- Permit Umpire-only games without league, team, facility, or tournament rows.
- Permit League-only games without Crew, assignment, claim, or availability rows.
- Keep existing fall game, assignment, and claim identifiers compatible.
- Enforce both module entitlements on their respective mutation commands.

Exit: independent League-only and Umpire-only hosted workflows pass with no
cross-module seed records.

## Increment D — league scheduling

- Create/edit/import organizational games with optional division, team, field,
  and reservation links.
- Make reservation creation/change/release transactional with League game
  scheduling.
- Validate team, field, closure, and blackout conflicts.
- Preserve assisted scheduling and dry-run imports; do not add an optimizer.

Exit: a League-only workspace publishes and exports a field-conflict-safe
schedule without any umpire records.

## Increment E — umpire operations transition

- Move official approval, eligibility, availability, claims, assignments,
  replacements, and declines to membership-aware authorization.
- Support Umpire-only schedules with optional external/source game labels.
- Keep communications in-app until the staging delivery sink is approved.
- Retain the fall umpire application's hosted workflows and identifiers.

Exit: an Umpire-only workspace completes recruitment through assignment without
league, facility, or tournament records.

## Increment F — tournament core

- Add tournament entries, pools, standings, seeded single elimination, results,
  and audited overrides to the League module.
- Reuse neutral games and optional field reservations.
- Add official assignments only when the same workspace has the Umpire module and
  explicitly enables staffing for that game.

Exit: a League-only tournament completes without umpire data; Complete Suite can
optionally staff the same games.

## Increment G — launch hardening

- Complete credentialed acceptance for administrator, assigner, umpire, and
  league-viewer roles across League-only, Umpire-only, and Complete Suite tenants.
- Rehearse restore, rollback, migration, and deployment procedures.
- Complete accessibility, mobile, concurrency, performance, and tenant-isolation
  testing.
- Enable no external email unless a staging sink and explicit acceptance gate pass.

Exit: hosted acceptance, automated regression/security suites, staging artifact,
rollback rehearsal, and named operator approval all pass.

## Definition of done for every increment

1. Database migration and rollback assumptions are verified against staging only.
2. Tenant and entitlement denials are tested at the database boundary.
3. Automated regression and security suites pass without weakened assertions.
4. The staging artifact rejects production configuration.
5. The feature is deployed only to the V2 Cloudflare project.
6. The intended workflow is completed in a real hosted browser.
7. Deployment SHA/ID, tests, risks, and limitations are recorded.
