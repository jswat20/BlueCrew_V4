# Increment 4C: Independent Game Ownership

## Decision

`public.games` remains the shared scheduling record, but every row now has one immutable owning domain: `league`, `officials`, or `tournament`. The organization remains the tenant boundary. Domain ownership does not grant cross-workspace access.

Existing games are backfilled to `officials` by the column default. Their IDs, assignments, claims, reports, and communication references are unchanged.

## Compatibility audit

- `game_assignments`, claims, completion, staffing, imports, reminders, and legacy communications continue to use existing game IDs.
- Officials imports continue to require the legacy active season and directory-backed complex/field because that import contract is unchanged.
- New domain games use `create_domain_game` and may omit season and facility records. A sport, date, time, and timezone remain required.
- League and Tournament games may be connected to field reservations. Officials games cannot be linked to reservations.
- Assignments may only reference Officials-domain games.
- Facility-only workspaces cannot create games because no facility game domain exists.

## Authorization

The database derives the tenant from `current_organization_id()`, validates the corresponding module entitlement, and rejects cross-workspace writes. Game domain is immutable. Officials games require an assigner or administrator; League and Tournament games require an administrator. RLS still scopes reads to the active approved workspace.

The trigger is intentionally independent of the browser. Direct table mutations, RPC calls, and concurrent requests encounter the same entitlement and tenant checks.

## Increment boundary

This increment establishes secure ownership and a hosted creation path. It does not add league generators, tournament pools/brackets, or automatic reservation creation. Those user workflows should be built next on these explicit domain boundaries.
