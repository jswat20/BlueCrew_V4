# Increment 5B: League Schedule Generator

## Architecture

Schedule generation creates persistent proposal records, not canonical games. `league_schedule_proposals` stores the tenant-qualified configuration and summary; `league_schedule_proposal_games` stores scheduled and explicitly unscheduled matchups. Both tables use active-workspace RLS and explicit Data API grants.

The initial deterministic generator supports single round robin and target-games-per-team formats. It uses selected teams, permitted weekdays, playing windows, field availability, closures, active reservations, blackout dates, duration, and buffer time. Facility-local wall times are converted with the facility's IANA timezone before comparing timestamped closures and reservations. It prevents a team or field from receiving overlapping proposed games and reports matchups for which no slot remains.

This increment deliberately excludes umpire availability, assignments, claims, tournament records, and advanced optimization.

## Editing and publication

Administrators can preview proposals, adjust a proposed game, regenerate into a new proposal, reopen saved proposals after navigating away, and deliberately publish. Existing published games are never modified by generation or regeneration.

Publication is atomic for every scheduled row in the proposal. `publish_league_schedule_proposal` locks the proposal, calls the accepted Increment 5A `save_league_game` boundary for each scheduled row, and commits only if every game and reservation remains valid. A concurrent field or team-time conflict rolls back the whole publication. A workspace-scoped transaction advisory lock serializes League team-conflict checks, while the existing reservation exclusion constraint remains the authority for field conflicts. Unscheduled proposal rows remain unmodified and are not published.

After success the proposal is marked published and stores each canonical game ID. Retrying publication returns those IDs with `idempotent: true`; it does not create duplicates. Canonical game IDs remain stable under subsequent Increment 5A rescheduling.

## Security

- Organization context comes from the server-validated active workspace.
- League entitlement and administrator role are checked inside every mutation RPC.
- Teams, divisions, seasons, leagues, facilities, and fields are qualified by organization.
- Anonymous execution is revoked and fixed function search paths are used.
- Proposal creation and publication write workspace audit events.

## Verification boundary

Migration smoke testing executes proposal creation, atomic publication, idempotent retry, late field-conflict rollback, and overlapping-team rollback inside rollback transactions before hosted acceptance. Closure also requires full regression, staging artifact verification, direct disabled-module and cross-workspace rejection probes, and hosted proposal generation/edit/publication using synthetic League data.
