# The Slate 2.0 — Increment 7D backup and recovery validation

Assessment date: 2026-11-23; closed 2026-11-27 (America/New_York)

Branch: `slate-v2-development`

Assessed commit: `60e9c6bd7f30d2c4dceae2a5bdd3dabf65967611`

Staging project: `fdjhwxmphdzodxvhrblk`
Status: **COMPLETE — current independent backup restored and validated**

Production Supabase, production Cloudflare, and `main` were not queried or
modified. No hosted restore was started and no paid infrastructure was created.

## Executive result

The recovery procedure was exercised with the existing independent archive from
2026-11-17. The archive checksum and table of contents are valid, and its
application, Auth, and Storage database records were restored into a disposable,
localhost-only PostgreSQL 17.10 instance. After using UTF-8 and creating the
standard non-login Supabase API roles, the remaining restore errors were limited
to locally unavailable managed extensions (`pg_cron`, `pg_net`, and
`supabase_vault`) and their internal objects.

That first rehearsal did not complete Increment 7D because the archive contained
49 application migrations while staging contained 84. On 2026-11-27 an
authorized operator entered the staging database password directly into a local
secure prompt. A new current archive was created, restored, and compared with a
fresh read-only staging snapshot. The closure evidence is recorded below.

## Phase 1 — current recovery inventory

The following values came from aggregate, read-only staging queries. No row-level
identity, credential, message, or customer data was exported into the repository.

| Component | Current staging evidence |
| --- | ---: |
| PostgreSQL server | 17.6 |
| Non-system schemas | 12 |
| Tables in `public`, `auth`, `storage`, migrations, and cron | 96 |
| Functions in `public`, `auth`, and `storage` | 170 |
| User-defined triggers in those schemas | 62 |
| RLS policies in those schemas | 148 |
| Foreign keys in those schemas | 184 |
| Applied application migrations | 84 |
| Auth users / application profiles | 5 / 12 |
| Organizations / memberships / membership roles | 6 / 12 / 12 |
| Module entitlements | 11 |
| Games / assignments / field reservations | 36 / 6 / 37 |
| Tournaments / tournament results | 1 / 19 |
| Storage buckets / database object rows | 1 / 0 |
| Pending communication deliveries / active cron jobs | 18 / 0 |

Enabled extensions are `btree_gist`, `pg_cron`, `pg_net`,
`pg_stat_statements`, `pgcrypto`, `plpgsql`, `supabase_vault`, and `uuid-ossp`.
The migration registry and the repository each contain the same 84 versioned
files at this commit.

### Managed services and external dependencies

- Two staging Edge Functions remain deployed as disabled delivery stubs:
  `process-communication-emails` version 6 and
  `send-account-password-reset` version 5. Edge Function source, secrets, and
  deployment state are not reconstructed by a PostgreSQL archive.
- The communication cron remains inactive. All 18 pending deliveries remain
  untouched.
- Storage has one private bucket and zero tracked objects. A database archive
  preserves bucket and object metadata, but not Storage object bytes.
- Native Auth provider settings, redirect URLs, SMTP configuration, JWT/API
  secrets, and existing sessions are managed configuration. The Auth database
  tables are dumpable, but users must reauthenticate after recovery if signing
  secrets change.
- The V2 artifact is built with `npm run build:v2-staging`. Its generated CSP
  and runtime configuration are required to point only to staging.
- `https://the-slate-v2.pages.dev/` returned HTTP 200 through Cloudflare and a
  CSP containing only the staging Supabase HTTP and WebSocket origins.
- Cloudflare project settings, environment variables, and deployment history
  require a separate private export or operator checklist. They are not present
  in a PostgreSQL archive.

## Recovery coverage matrix

| Asset | PostgreSQL archive | Separate recovery requirement |
| --- | --- | --- |
| Public schema, data, RLS, functions, triggers, grants | Yes | Install required extensions and compatible roles first |
| Auth users, identities, sessions, schema data | Database records yes | Auth service settings, JWT secrets, providers, redirect URLs; force reauthentication when secrets differ |
| Storage bucket/object metadata | Yes | Export and restore object bytes separately |
| Migration registry | Yes | Keep exact migration source in Git and reconcile before replay |
| Edge Functions | No | Versioned source/deployment manifest plus reviewed secrets |
| Cron definitions | Only if extension is present | Keep disabled until communications are deliberately reactivated |
| Vault contents | Platform-managed and unsuitable for portable recovery | Recreate secrets through an approved operator; never store them in Git or reports |
| Cloudflare Pages artifact/configuration | No | Retain deployment ID, artifact, environment-variable inventory, and rollback procedure |
| DNS/custom domains | No | Provider inventory and separately authorized change procedure |

## Phase 2 — backup evidence and blocker

### Existing independent archive

- Private file: `slate-staging-20261117-214804.dump` (kept outside Git)
- Size: 3,895,348 bytes
- Format: PostgreSQL custom archive, gzip compression
- Archive entries: 907
- Source PostgreSQL: 17.6
- `pg_dump`: 17.10
- SHA-256:
  `13062ED5FECCE7AE0964A060A797403369EF7650DF906AA1F278AB462015098D`
- `pg_restore --list` integrity duration: 0.061 seconds

The checksum matches the previously recorded value. Existing zero-byte failed
attempts and the valid archive were preserved.

### Prior fresh-backup blocker — resolved 2026-11-27

The current environment has PostgreSQL 17.10 client tools but no staging
database password or password file. Supabase's supported logical export requires
the database connection string/password. The dashboard's current physical
backup is restorable only through a hosted operation. Therefore:

1. no current independent archive was created;
2. no backup duration can be measured for a current archive; and
3. the 2026-11-17 archive must not be described as the current recovery point.

The operator subsequently supplied the password through the non-logged local
prompt. It was held only in the backup process memory, cleared after `pg_dump`,
and never written to a command, environment file, report, chat, or repository.
No password reset or credential change was performed.

## Phase 3 — isolated restore evidence

The restore target was a new PostgreSQL 17.10 cluster under a private local
recovery directory. It listened only on `127.0.0.1:55432`; no Edge Functions,
workers, external application, or production service was connected.

| Attempt | Result | Duration |
| --- | --- | ---: |
| 1 | Stopped immediately: `pg_cron` unavailable | 0.085 s |
| 2 | Continued with default Windows encoding; 68 errors exposed encoding, roles, and managed-extension dependencies | 2.626 s |
| 3 | UTF-8 database plus non-login compatibility roles; application/Auth/Storage content restored, with 11 managed-extension/internal-object errors | 0.576 s |

Attempt 3 restored and validated:

| Restored item | Count |
| --- | ---: |
| Non-system schemas | 9 |
| Tables in application/Auth/Storage/migrations | 64 |
| Functions in application/Auth/Storage | 114 |
| User-defined triggers | 38 |
| RLS policies | 54 |
| Foreign keys | 85 |
| Unvalidated constraints | 0 |
| Public tables with RLS | 26 of 26 |
| Auth users / profiles / organizations | 4 / 4 / 1 |
| Games / assignments | 0 / 0 |
| Storage buckets / objects | 1 / 0 |
| Applied application migrations | 49 |

This matches the November 17 baseline inventory. The current multi-workspace,
facility, league scheduling, and tournament tables did not yet exist in that
archive. Consequently, current tenant, membership, game, reservation,
tournament, and assignment counts cannot be compared against this stale archive.
That comparison must be repeated against the fresh archive required for closure.

### Managed-component limitations observed

- Portable PostgreSQL did not include `pg_cron`, `pg_net`, or
  `supabase_vault`; their extension objects and internal rows were not restored.
- Plain PostgreSQL validates database structures and records, but it is not a
  complete local Supabase service stack. Auth API behavior, token issuance,
  Storage API access, Realtime, Edge Functions, and platform-managed secrets
  require separate service-level rehearsal.
- The restore logs are private local evidence and are not committed because they
  contain object names and operational detail from the archive.

The disposable PostgreSQL process was stopped after validation. Automated
recursive cleanup was blocked by the execution safety boundary, so the private
restore files remain offline under the recovery directory and require an
authorized operator to remove them when the evidence-retention need ends.

## Repository and artifact validation

- Full Playwright regression: **1,281 passed, 1 intentional skip, 0 failed**
  (1,282 total; 6.8 minutes).
- `npm run build:v2-staging`: passed with an active staging publishable key
  obtained through the authorized project boundary.
- Artifact verification confirmed the staging project reference and rejected
  the ambient non-staging configuration before the safe build was run.
- No deployment was performed.

## Current backup and restore closure — 2026-11-27

### Current independent archive

- Private directory:
  `C:\Users\JSWAT\Documents\SlateV2-Backups\increment-7d-20261124-000239`
- Archive file: `slate-staging-20261124-000239.dump`
- Archive header timestamp: 2026-11-27 15:04:13 America/New_York
- Source: staging session pooler for `fdjhwxmphdzodxvhrblk`
- Size: 4,632,137 bytes
- Format: PostgreSQL custom archive, gzip compression
- Archive entries: 2,061
- Source PostgreSQL: 17.6
- `pg_dump`: 17.10
- Backup duration: 68.619 seconds
- Archive listing duration: 0.426 seconds
- SHA-256:
  `F35DB3912173ECB88C6B6CD430EEEDCCCD8534E318A79A4400C7D557F1F16BCE`

The private archive and archive listing were preserved outside Git. The
November 17 archive was not overwritten.

### Isolated current restore

The archive was restored into a newly initialized UTF-8 PostgreSQL 17.10
database bound only to `127.0.0.1:55433`. The final restore took 1.052 seconds.
Compatibility roles were non-login roles and no platform credentials or API
keys were copied into the target.

`pg_cron`, `pg_net`, and `supabase_vault` were not installed locally. Therefore
cron jobs, HTTP workers, Vault-backed calls, Edge Functions, SMTP, and
application workers could not execute. The final restore log contains 25 errors,
all attributable to those unavailable managed extensions and their internal
tables/functions. There were no unexplained application, Auth, Storage, RLS,
grant, migration, constraint, or data errors.

### Live-to-restore comparison

| Item | Live | Restored | Result |
| --- | ---: | ---: | --- |
| Schemas | 12 | 12 | Match; empty compatibility schemas represent missing managed extensions |
| Tables in application/Auth/Storage/migrations/cron | 96 | 94 | Expected gap: two `pg_cron` tables |
| Public tables / public tables with RLS | 56 / 56 | 56 / 56 | Match |
| Functions in application/Auth/Storage | 170 | 170 | Match |
| User-defined triggers | 62 | 62 | Match |
| RLS policies | 148 | 148 | Match |
| Foreign keys / unvalidated constraints | 184 / 0 | 184 / 0 | Match |
| Auth users / profiles | 5 / 12 | 5 / 12 | Match |
| Organizations / memberships / membership roles | 6 / 12 / 12 | 6 / 12 / 12 | Match |
| Module entitlements | 11 | 11 | Match |
| Games / assignments / claims | 36 / 6 / 0 | 36 / 6 / 0 | Match |
| Reservations | 37 | 37 | Match |
| Tournaments / results | 1 / 19 | 1 / 19 | Match |
| Pending deliveries | 18 | 18 | Match; no delivery executed |
| Storage buckets / object rows | 1 / 0 | 1 / 0 | Match |
| Migrations / latest version | 84 / `20261124021928` | 84 / `20261124021928` | Match |

Deterministic MD5 fingerprints matched exactly for application/Auth/Storage
function definitions, trigger definitions, RLS policies, foreign keys, and the
ordered migration-version list. Explicit table-grant counts and fingerprints
also matched for `anon`, `authenticated`, and `service_role`. Object-owner and
platform-internal role grants are not portable under `--no-owner` and remain a
managed-platform recovery responsibility.

### Remaining managed-service gaps

- Standalone PostgreSQL cannot validate Supabase Auth API behavior, JWT signing,
  provider configuration, redirect URLs, or session continuity.
- Storage object bytes require a separate export. There were zero current object
  rows, so no byte payload existed for this rehearsal.
- Edge Function deployments/secrets, SMTP, Realtime configuration, Vault
  secrets, and Cloudflare settings are outside the archive.
- The 1.052-second database import does not demonstrate the proposed four-hour
  end-to-end RTO because managed service and application reactivation were not
  rehearsed.
- The private restored database must be securely removed after its evidence
  retention need ends.

## Phase 4 — proposed recovery objectives

These are initial policy targets, not demonstrated guarantees:

- **RPO target:** 24 hours initially. Daily managed backups plus a daily or at
  least weekly independent logical export are required before this is credible.
- **RTO target:** four hours for database and application restoration. This is
  **not yet proven**. The measured sub-second database import covered a small,
  stale archive and excluded managed services and object transfer.
- **Retention:** managed retention according to the subscribed plan; independent
  encrypted copies for 30 daily, 12 weekly, and 12 monthly recovery points,
  subject to a documented privacy/deletion policy.
- **Verification:** checksum and archive listing for every independent backup;
  aggregate count comparison weekly.
- **Restore rehearsal:** monthly until launch, then quarterly, plus after material
  schema/Auth/Storage changes.
- **Operators:** one trained operator executes; a second authorized person
  verifies the exact environment and approves any production restore or
  communication reactivation.
- **Customer communication:** acknowledge a confirmed customer-impacting
  incident promptly, state the affected services and known data window without
  speculation, provide periodic updates, and issue a closure report with actual
  RPO/RTO and corrective actions.

## Closure checklist

- [x] Create a current timestamped independent backup.
- [x] Record its tool versions, duration, size, checksum, and successful listing.
- [x] Restore that current archive to a newly initialized isolated target.
- [x] Compare all current tenant/module aggregate counts.
- [x] Validate current RLS, grants, functions, triggers, foreign keys, and all 84
  migration versions.
- [x] Verify that Storage currently contains zero object rows; establish object
  byte export before customer uploads begin.
- [ ] Privately record Cloudflare configuration and a deployable rollback
  artifact/deployment ID.
- [ ] Run a service-level Auth/Storage recovery exercise or document an approved
  managed-platform restoration procedure.
- [ ] Measure an end-to-end recovery before claiming the proposed four-hour RTO.

