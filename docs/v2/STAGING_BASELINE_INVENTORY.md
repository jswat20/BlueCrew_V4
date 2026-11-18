# The Slate V2 — Staging Baseline Inventory

Inventory date: 2026-11-17 (America/New_York)
Status: READ-ONLY inventory, NOT a database dump or restorable backup.

## Environments
- Production Supabase: `dynxjiqrdlhfhrjnhvgn`, Ohio (`us-east-2`). **Never target production for V2 testing.**
- Staging Supabase: `fdjhwxmphdzodxvhrblk`, Oregon (`us-west-2`).
- GitHub baseline: `main` at `3f5c633070f464ddc2b4dc95fe341c96bc335aa4`.
- Development branch: `slate-v2-development` (initially based on `main`).

## Read-only staging inventory
- 26 public tables; all with RLS enabled.
- 86 public functions; 48 RLS policies; 27 user-defined triggers; 102 public indexes.
- 49 applied SQL migrations; GitHub `main` contains only 46 matching prior migrations.
- 4 application profiles and 4 Auth users; 1 crew member; 0 games.
- 1 private Storage bucket: `profile-photos` (Storage **file objects** are not covered by database physical backups).
- Two deployed Edge Functions: `process-communication-emails` and `send-account-password-reset`.
- One **active** pg_cron job: `process-communication-emails-every-minute`, interval `* * * * *`. Its Vault URL targets staging, not production. Do not send test messages until all outbound communication is safely isolated.
- Recent recorded database activity: messages through 2026-09-04, notifications and communication events through 2026-09-09.

## Migration drift: NEEDS RECONCILIATION
Files present in staging migration history but not in the GitHub default branch:
- `202609100001_authoritative_schedule_game_delete`
- `20261005125847_multi_recipient_direct_messages`
- `20261005130554_message_deletion`

Production has one later migration **with a different version ID**:
- `20261005130023_multi_recipient_direct_messages`

Do not apply or renumber these migrations without first comparing the authoritative definitions and the resulting schema across environments. Migration history alone does not contain the original SQL body.

## Backup evidence
- User verified Supabase scheduled physical backups in dashboard screenshot, latest listed `2026-11-17 13:40:29 UTC` with Restore action visible.
- Actual restore has NOT been tested; rolling backups expire.
- **Independent, restorable full database export has NOT yet been taken**.
- Database backups do not restore Storage object contents; separately export private Storage objects using secure tooling if any exist.
- Do not commit row-level user data, database passwords, secrets, or backups with personally identifiable information to this public GitHub repository.

## Release safety gates before any staging modifications
1. Verify availability/permissions for a full independent `pg_dump` of staging, retain it privately, and validate a restore into a disposable PostgreSQL environment.
2. Separately inventory/export Storage objects without exposing them in a public repository.
3. Recover authoritative SQL for the three staging-only migrations and the differently-versioned production messaging migration; compare resulting schema.
4. Check Cloudflare Pages and other external consumers of staging. No direct Cloudflare configuration review has been completed.
5. Disable/neutralize outbound staging email and worker scheduling only after backing up and obtaining explicit approval for the setting change.
6. Ensure V2 CI/builds and staging deploys are explicitly tied to the staging project reference and cannot fall back to production.
7. Use only synthetic identity, league, and scheduling fixtures for V2 tests.

This inventory was created without SQL writes, database changes, production deployments, or billable project creation.
