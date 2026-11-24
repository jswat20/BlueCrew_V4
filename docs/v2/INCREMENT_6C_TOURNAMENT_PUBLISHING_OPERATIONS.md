# Increment 6C — Tournament Publishing and Game-Day Operations

## Architecture

`tournament_publications` is organization-qualified and private under RLS. A tournament is private until an administrator calls `set_tournament_publication`. The persistent UUID share token is opaque and is not a tenant selector. Unpublishing immediately makes the token resolve to no document.

`get_public_tournament` is the only anonymous tournament boundary. It is a read-only, fixed-search-path `SECURITY DEFINER` function that resolves a published share token and constructs an allowlisted JSON document. Anonymous callers receive tournament presentation data, divisions, team names, schedules, results, computed public standings, brackets, and champion. The response does not select team contacts, notes, profiles, memberships, workspace audit events, or organization administration data. Anonymous roles have no table access and cannot invoke publication or mutation functions.

## Game-day operations

The authenticated Tournament workspace now presents today's games, games in progress, postponed/cancelled games, quick mobile score entry, publication controls, and links to setup, scoring rules, standings, and brackets. Schedules can be printed in the browser or exported as CSV. The same public page is responsive and print-friendly.

`reschedule_tournament_game` locks and updates the existing canonical Tournament game and its active reservation in one transaction. The game ID and bracket reference never change. Field availability, closures, and the exclusion constraint remain authoritative. A conflict aborts the transaction and preserves the original game and reservation. Final and forfeited games are locked against rescheduling. Postponement and cancellation release the reservation and are audited.

## Automatic byes

`advance_tournament_byes` advances the sole participant in every empty first-round pairing, fills the appropriate downstream bracket slot, and writes an audit event. The update predicate makes retrying idempotent. A bye does not create a canonical game or field reservation.

## Verification

- Focused Increment 6B/6C contract tests: 13 passed.
- Complete Playwright regression: 1,257 passed, 1 skipped.
- Staging artifact: built and verified against `fdjhwxmphdzodxvhrblk`; production reference absent.
- Database probe: anonymous public-snapshot execution allowed; anonymous publication-table reads and publication mutation denied.
- Email isolation: 18 pending deliveries preserved; zero active email cron jobs.
- Migration history reconciled to staging versions `20261124000537` and `20261124001314` without reapplying accepted migrations.
- Hosted acceptance found and corrected a missing public standings-points field; follow-up migration `20261124001837` calculates points from the division scoring rule. The public page also provides division/team filters and removes authenticated-shell chrome.

The anonymous `SECURITY DEFINER` advisor count increases by one intentionally for the narrowly scoped public snapshot function. The function has a fixed search path, a single opaque-token argument, no dynamic SQL, no mutations, explicit allowlisting, and no underlying anonymous table grants. Existing legacy advisor findings remain outside this increment.

## Remaining limitations

- Public filtering is client-presentational in this increment; the safe snapshot remains bounded to one published tournament.
- Print output uses browser printing rather than generated PDFs.
- CSV export covers the schedule; standings and bracket are optimized for print.
- Lifecycle supports scheduled, in-progress result entry, final, forfeited, postponed, and cancelled states; double elimination and consolation formats remain deferred.
