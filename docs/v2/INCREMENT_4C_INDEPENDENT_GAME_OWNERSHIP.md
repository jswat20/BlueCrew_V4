# Increment 4C: Independent Game Ownership

## Decision

`public.games` remains the shared scheduling record, but every row now has one immutable owning domain: `league`, `officials`, or `tournament`. The organization remains the tenant boundary. Domain ownership does not grant cross-workspace access.

Existing games are backfilled to `officials` by the column default. Their IDs, assignments, claims, reports, and communication references are unchanged.

## Compatibility audit

- `game_assignments`, claims, completion, staffing, imports, reminders, and legacy communications continue to use existing game IDs.
- Officials entry and import require no League season, division, team, reservation, complex, or field. A descriptive matchup or participant name is required; directory mapping and free-form location text are optional.
- New domain games use `create_domain_game` and may omit season and facility records. A sport, date, time, and timezone remain required.
- League and Tournament games may be connected to field reservations. Officials games cannot be linked to reservations.
- Assignments may only reference Officials-domain games.
- Facility-only workspaces cannot create games because no facility game domain exists.

## Authorization

The database derives the tenant from `current_organization_id()`, validates the corresponding module entitlement, and rejects cross-workspace writes. Game domain is immutable. Officials games require an assigner or administrator; League and Tournament games require an administrator. RLS still scopes reads to the active approved workspace.

The trigger is intentionally independent of the browser. Direct table mutations, RPC calls, and concurrent requests encounter the same entitlement and tenant checks.

## Increment boundary

This increment establishes secure ownership and a hosted creation path. It does not add league generators, tournament pools/brackets, or automatic reservation creation. Those user workflows should be built next on these explicit domain boundaries.

## Closure implementation

- `import_schedule_games(jsonb)` derives its tenant from the server-validated active workspace, requires assigner/administrator access and the Umpire entitlement, and creates Officials-domain games with nullable season and facility references.
- Manual Officials entry accepts sport, date/time, matchup or participant names, optional mapped or free-form location, requested staffing positions, and notes.
- Imported external IDs are unique by organization and owning game domain, so independent modules can use the same source identifier without sharing a record.
- Settings controls follow the active workspace: League season/catalog controls render only with the League entitlement, while reservation controls render only for League, Tournament, or Facility workspaces. Officials-only workspaces retain the shared facility directory without receiving reservation controls.
- Persistent staging workspaces were provisioned through `provision_saas_workspace`: League-only (existing), Officials-only, Tournament-only, and Facility-only. Each new workspace has exactly one enabled module and one approved synthetic acceptance membership.
- Direct staging authorization probes confirmed that a Facility-only workspace cannot create an Officials game and that an active workspace cannot write another tenant's records.
- Staging outbound email remained isolated: the delivery cron was inactive and all 18 pending deliveries were preserved after migration and authorization testing.

## Verification status

- Full regression at closure candidate: 1,226 passed, 1 skipped, 0 failed.
- Focused Officials editor/import regression after the domain-qualified identifier migration: 22 passed, 0 failed.
- Migration dry-run after application: remote database up to date, with no pending migrations.
- Hosted browser acceptance, deployed commit, and Cloudflare deployment evidence are recorded in the delivery report after the staging deployment converges.

Known pre-existing advisor debt remains outside this narrowly scoped closure: legacy anonymous grants on older SECURITY DEFINER functions, four mutable function search paths, and performance recommendations. The new import RPC revokes `public` and `anon` execution and grants only `authenticated` execution.
