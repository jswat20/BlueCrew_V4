# The Slate V2 — October 2026 migration reconciliation

Date: 2026-11-17. **Read-only cross-environment comparison.** No migration has been applied.

## Authoritative source found
GitHub draft PR #30, `fix/messaging-multiple-recipients`:
https://github.com/jswat20/BlueCrew_V4/pull/30

Includes:
- `supabase/migrations/202610050001_multi_recipient_direct_messages.sql` defining `send_direct_messages`
- `supabase/migrations/20261005130406_message_deletion.sql` creating `message_deletions`, `delete_message_for_me`, and replacing `get_message_center`
- Additional application code and tests for selected-umpire messages, per-user deletion, and Game Hub Edit.

**Do not merge PR #30 or add these SQL files to an executable migrations folder as-is.** The SQL filename/version IDs differ from those already applied to the environments.

## Live migration registry differences
Staging:
- `202609100001_authoritative_schedule_game_delete`
- `20261005125847_multi_recipient_direct_messages`
- `20261005130554_message_deletion`

Production:
- `20261005130023_multi_recipient_direct_messages`
- Does **not** have `message_deletion` or a `message_deletions` table.

GitHub main has none of those three post-September-9 staging files; a file for the September-10 game deletion migration must be recovered separately. GitHub PR #30 documents that deletion remains staging-only.

## Live function comparison (pg_get_functiondef fingerprints)
- `send_direct_messages(text, uuid[], text)`: present in both environments and identical MD5 `da9b47b339647afed76a5eb1e3d52741`. This is an exact live-definition match between staging and production.
- `delete_message_for_me(uuid, uuid)`: present in staging only, MD5 `2dbff2159bff775e92a2a76f561b13ba`.
- `get_message_center()`: staging MD5 `33c31d147aeb887f375974fabef8dcc0`; production MD5 `4951906a7f9ffaa5908b538a4a3d3b26`.

The source SQL in PR #30 appears to explain the difference. MD5 comparisons of PostgreSQL deparsed definitions are for environment comparison; they do not independently prove original migration-file byte equality.

## Safe course
1. Archive source provenance and compare definitions, grants, RLS and schema before writing migrations.
2. Do not reapply any migration already recorded in either environment.
3. Keep `slate-v2-development` separate from both `main` and the unfinished PR branch.
4. Any proposed reconciliation migration should use a newly minted version ID and be tested only against a disposable environment before staging.
5. Do not touch production until explicit release authorization.

## Current staging controls
- Independent local staging `pg_dump` completed; archive index verified; full restore not yet verified.
- Staging email cron job 1 paused/verified inactive; 18 pending deliveries remain.
- Storage bucket `profile-photos` had zero tracked objects when checked.

## Repository reconciliation completed — 2026-11-22

The three authoritative sources were restored to `slate-v2-development` under
the exact version IDs already present in the staging migration registry:

- `202609100001_authoritative_schedule_game_delete.sql` from PR #29;
- `20261005125847_multi_recipient_direct_messages.sql` from PR #30; and
- `20261005130554_message_deletion.sql` from PR #30.

Before restoration, staging function-definition fingerprints were rechecked as
`7986085a061ee0a449ad2f2b69b9237e`,
`da9b47b339647afed76a5eb1e3d52741`,
`2dbff2159bff775e92a2a76f561b13ba`, and
`33c31d147aeb887f375974fabef8dcc0`, matching the prior audit. The
`message_deletions` column shape was also verified. No migration-history repair
was performed and none of these existing migrations was replayed.

A subsequent linked dry run proposed only the new competition-catalog
migration, demonstrating that local and staging history were reconciled for the
development branch. Production's differently versioned migration remains
untouched and outside this reconciliation.

## September 10 game deletion source recovered
- Original SQL found on `fix-authoritative-hosted-game-delete` at `supabase/migrations/202609100001_authoritative_schedule_game_delete.sql` (GitHub PR #29: https://github.com/jswat20/BlueCrew_V4/pull/29).
- The staging database has `public.delete_schedule_game(p_game_id uuid)` with equivalent substantive function logic; deparsed live definition MD5: `7986085a061ee0a449ad2f2b69b9237e`.
- Production does not have this RPC. Do not deploy it to production or merge PR #29 merely to reconcile staging.
- All three staging-only migration source files have been located across PR #29 and PR #30. Applied migration IDs still differ for the October files, so preserve provenance and plan an environment-specific baseline rather than replaying them.
