# Increment 5A: League Game Scheduling

## Scope and invariants

League Scheduling now creates and reschedules catalog-backed League games through one database transaction. A game keeps the same `games.id` when its date, time, duration, teams, complex, or field changes. The linked active field reservation is updated in that transaction, so a reservation conflict rolls back the game update and leaves both original records unchanged.

League games do not require an Officials entitlement, game assignment, claim, or staffing record. The scheduling RPC checks only the validated active workspace, League entitlement, administrator role, League catalog, and optional facility availability. Existing Officials workflows and records remain unchanged.

## Data model and authorization

Migration `20261123210832_league_game_scheduling_atomic.sql` adds tenant-qualified League, division, and home/away team references plus a bounded duration to `public.games`. It also ensures that a game can have at most one active reservation.

`save_league_game`:

- derives the organization from the authenticated server-validated workspace context;
- requires the League entitlement and administrator role;
- validates the season, League, division, and teams within that organization;
- accepts a no-field draft or an active field belonging to the selected complex;
- creates or updates the game and reservation atomically; and
- converts concurrent exclusion or uniqueness violations into `league_field_conflict`.

`transition_league_game` cancels, postpones, or deletes a League game and releases its active reservation without consulting Officials data. Both functions use fixed search paths, reject anonymous execution, and write workspace audit events.

## Application workflow

The League game editor loads the active workspace's competition catalog and provides season, League, division, team, duration, complex, and field choices. Complex selection filters the field list directly in the editor; administrators do not need to navigate through Facility Management. A game can be saved without a field, while a scheduled field creates the matching reservation.

Canceling or postponing releases the reservation. Deleting removes the League game and its linked reservation through the backend lifecycle RPC.

## Verification

- Migration history reconciled through `20261123210832`; a post-apply dry run must remain empty.
- Focused League scheduling, location, and viewer-security regression: 16 passed.
- The database advisor reports no new warning for either Increment 5A function. Existing legacy advisor debt remains outside this increment.
- Full regression at the deployment candidate: 1,232 passed, 1 skipped, 0 failed.
- The staging-only artifact build and verification passed against project `fdjhwxmphdzodxvhrblk`; no deployment was performed by the build command.
- Hosted deployment and browser acceptance evidence are recorded at closure.

## Hosted acceptance gates

The increment is complete only after the V2 site demonstrates catalog-backed creation, direct complex/field selection, refresh persistence, stable game identity on reschedule, field release after a successful move, transactional rollback after a conflicting move, cancellation release, an unscheduled draft, and continued Officials independence. Direct database probes must also reject unauthorized and cross-workspace operations.
