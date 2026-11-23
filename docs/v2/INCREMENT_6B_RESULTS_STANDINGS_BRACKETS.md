# Increment 6B — Tournament Results, Standings, and Brackets

## Model

- `tournament_game_results` stores sport-neutral results separately from canonical games. Corrections increment `revision`; canonical game and reservation identifiers do not change.
- `tournament_scoring_rules` configures win/tie/loss points, pool-play ties, differential caps, and the published tiebreak sequence.
- `tournament_manual_tiebreaks` records an explicit director decision and reason when computed criteria cannot resolve a tie.
- `tournament_brackets`, `tournament_bracket_rounds`, and `tournament_bracket_games` persist the seeding snapshot, rounds, matchups, advancement links, canonical scheduled games, and champion.

Canceled and postponed games are excluded from standings. Final and forfeited games count; both require integer scores. A pool tie has no winner. An elimination tie requires an explicit advancing winner.

## Deterministic ranking

1. Configured standings points.
2. Win percentage.
3. Head-to-head only for exactly two teams still tied on the first two criteria.
4. Capped scoring differential.
5. Points for.
6. Audited tournament-director priority.

If all applicable criteria remain equal without a director decision, the standings response marks the teams `unresolved_tie`; bracket generation is blocked in the application.

## Bracket integrity

Generation accepts three through eight qualifiers and persists a four- or eight-slot bracket. Repeating the same generation request returns the existing bracket. Regeneration is prohibited after a dependent elimination result becomes final.

Elimination games start as unscheduled bracket placeholders. Scheduling creates one canonical Tournament-domain game and one field reservation transactionally, using the existing availability, closure, and overlap enforcement. Tournament-only workspaces do not require a League season.

Result submission locks the canonical game and bracket game. The winner is written to the correct downstream slot in the same transaction. A correction cannot displace a participant from an already-final downstream game. The championship result sets the persisted champion.

## Authorization

All new records use organization-qualified keys and RLS based on the server-validated active workspace. Read access requires Tournament entitlement. Mutations additionally require administrator permission through `private.require_tournament_admin()`. New RPCs revoke `PUBLIC` and `anon` execution and grant only `authenticated` callers.

## Hosted staging evidence

The synthetic `6A Spring Softball Classic` contains two pools, eight teams, and twelve completed pool games. Pool B includes a permitted tie. An eight-team seeded bracket was generated, all four quarterfinals and two semifinals advanced transactionally, and `12U Acceptance Comets` was recorded as champion. Seven elimination games and seven corresponding reservations were created on the existing synthetic fields.

Staging email delivery remained disabled throughout testing. Production resources were not accessed or modified.
