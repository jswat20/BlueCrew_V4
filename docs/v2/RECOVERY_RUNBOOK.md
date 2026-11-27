# The Slate 2.0 — recovery runbook

This runbook covers The Slate's shared application with independently isolated
customer workspaces. It contains no credentials, database contents, or private
customer records.

## Non-negotiable controls

1. Identify the incident, exact project reference, Git commit, and Cloudflare
   project before acting. Staging is `fdjhwxmphdzodxvhrblk`; production requires
   separate explicit authorization.
2. Assign an incident lead and a second verifier. Record UTC and local timestamps.
3. Stop application writes only when necessary. Disable schedulers and outbound
   communications before restoring data.
4. Preserve the affected database and logs. Restore to a new isolated target
   first; never test a backup by overwriting the only live copy.
5. Keep archives encrypted and access controlled outside Git. Never place
   passwords in commands, logs, tickets, screenshots, or reports.
6. Do not reactivate email or other external integrations until data and tenant
   isolation are validated and a second operator approves.

## Backup procedure

The latest verified staging recovery point is documented in
`docs/v2/INCREMENT_7H_RELEASE_GOVERNANCE.md`. It contains all 97 staging
migrations present on November 27, 2026 and was restored to a localhost-only
PostgreSQL 17.10 instance. A release operator must still create a newer recovery
point whenever the candidate introduces migrations after that snapshot.

Use the current Supabase-supported CLI process and a securely supplied staging
connection string. Generate timestamped role, schema, and data files in a new
private directory; never overwrite prior recovery points.

```text
supabase db dump --remote="[SECURE_CONNECTION_STRING]" -f roles.sql --role-only
supabase db dump --remote="[SECURE_CONNECTION_STRING]" -f schema.sql
supabase db dump --remote="[SECURE_CONNECTION_STRING]" -f data.sql --use-copy --data-only
```

If a custom PostgreSQL archive is also created for same-major-version recovery,
use supported `pg_dump` options, record all warnings, and retain the portable
Supabase CLI exports as the cross-version recovery source. Raw `pg_dump` includes
platform internals that can fail on ordinary PostgreSQL.

For every file:

1. record tool and source server versions;
2. record start/end time and duration;
3. calculate SHA-256;
4. validate readability (`pg_restore --list` for custom archives or a parser and
   test restore for SQL files);
5. record encrypted storage location and retention class in the private recovery
   register; and
6. separately export Storage object bytes and a manifest when objects exist.

## Isolated restore procedure

1. Create a new disposable PostgreSQL/Supabase environment with no route to
   production services. Bind a plain PostgreSQL drill to localhost only.
2. Match the source PostgreSQL major version when possible and use UTF-8.
3. Disable cron, workers, webhooks, Edge Functions, and SMTP. Do not copy
   production/staging API keys into the drill.
4. Install only the required, reviewed extensions. Create compatibility roles as
   non-login roles; never copy role passwords.
5. Restore roles, schema, and data using the current Supabase documented order.
   Set `ON_ERROR_STOP`, retain the full log, and repeat from a fresh database
   after correcting any error.
6. Treat unavailable managed extensions as coverage gaps, not as successful
   objects. Use a self-hosted Supabase stack when service-level behavior is under
   test.
7. Compare sanitized aggregates from source and restore: organizations,
   memberships, membership roles, entitlements, profiles, games, assignments,
   reservations, tournaments, results, pending deliveries, migrations, buckets,
   and objects.
8. Verify all constraints are validated; run orphan checks; compare RLS policies,
   function signatures, triggers, grants, and migration versions.
9. Exercise representative read and denied cross-workspace access with synthetic
   identities. Never use copied passwords; reset synthetic credentials locally.
10. Stop the drill, preserve sanitized evidence, and securely remove the restored
    private data when its evidence-retention purpose ends.

An ordinary PostgreSQL restore may report errors for Supabase-managed
`pg_cron`, `pg_net`, and `supabase_vault` objects. Classify every error; accept
only documented managed-service gaps after proving that application, Auth,
Storage metadata, RLS, functions, triggers, foreign keys, and migration
fingerprints match. Never convert an unexplained restore error into a warning.

## Failed migration

1. Stop subsequent migration/deployment jobs and record the exact failing
   version, commit, target project, and transaction state.
2. Determine whether PostgreSQL rolled back the transaction. Do not infer success
   from a migration filename alone.
3. Compare the live schema and migration registry read-only with the source SQL.
4. If no live write committed, fix forward in a new migration and rehearse it
   against a restored copy.
5. If a write partially committed, take a new backup before repair. Prefer a
   reviewed compensating migration; do not edit an applied migration or blindly
   delete migration-history rows.
6. Deploy only the repaired staging artifact, run migration/security/regression
   checks, and obtain explicit production authorization separately.

## Accidental deletion or corruption

1. Stop the responsible job or user path and isolate credentials if misuse is
   suspected.
2. Record the earliest known bad time, affected workspace/module, and relevant
   audit events. Preserve logs.
3. Take a current backup of the damaged state for investigation.
4. Choose the newest recovery point before corruption. Quantify the expected data
   loss window against the RPO.
5. Restore to isolation and validate tenant-qualified records and relationships.
6. Prefer scoped, reviewed data repair when it is safer than full rollback. Never
   copy records across organizations without explicit owner verification.
7. Revalidate audit trails, RLS, module entitlements, and counts before reopening.

## Database and Supabase recovery

1. Restore the database to a new target or use Supabase managed restoration only
   with incident approval. Never overwrite an active environment for a rehearsal.
2. Recreate platform configuration separately: Auth URLs/providers, JWT/API
   secrets, Edge Functions, function secrets, cron state, Realtime settings, and
   Storage configuration.
3. Rotate credentials after suspected compromise. Existing sessions must be
   invalidated when signing secrets or trust boundaries change.
4. Keep all outbound delivery paths disabled. Confirm the communication queue and
   scheduled jobs before and after recovery.
5. Validate workspace isolation and disabled-module rejection at the database
   layer before connecting the hosted application.

## Auth recovery

- Database backups include Auth database records, not provider configuration or
  reusable service secrets.
- Restore `auth` data only with compatible Auth schema/service versions.
- Configure allowed URLs, email provider/sink, OAuth providers, and signing
  secrets through the platform/operator boundary.
- Require reauthentication after secret rotation or recovery to a new project.
- Test signup, login, refresh, logout, invitation acceptance, revocation, and
  multi-workspace switching with synthetic identities before reopening.

## Storage recovery

- Restore database metadata and object bytes as separate coordinated steps.
- Compare a private manifest containing bucket, object key, size, and checksum;
  do not commit the manifest when keys identify customers.
- Restore private-bucket policies before serving objects. Verify cross-workspace
  denial and signed-URL expiration.
- A zero-row `storage.objects` table removes the current byte-copy burden but does
  not remove the need for a future object backup process.

## Application configuration and Cloudflare rollback

1. Identify a previously accepted V2 deployment and its exact Git SHA. Retain the
   deployment ID privately.
2. Verify build command, output directory, branch, environment-variable names,
   and project reference. Never copy production values into V2.
3. Build with `npm run build:v2-staging` and run artifact verification.
4. Roll back by promoting/redeploying the accepted V2 artifact in the isolated
   Cloudflare project. Do not change the production Pages project or domain.
5. Verify HTTP 200, CSP/connect origins, runtime project reference, login/session
   restoration, workspace switching, and representative module reads.
6. If database and application versions differ, keep the application in
   maintenance mode until compatibility is proven; do not replay migrations
   merely to match a frontend.
7. Rehearse with two artifacts that bracket a real backward-compatible client
   change. Authenticate with a synthetic identity that belongs to at least two
   workspaces, refresh the session, switch workspaces, and verify role/module
   visibility and tenant isolation before calling the rehearsal complete.

## Safe communication reactivation

1. Confirm restored data, workspace isolation, and communication recipient
   selection using aggregate and synthetic checks.
2. Confirm historical pending deliveries have not been unintentionally released.
3. Configure a staging-only mail sink first and test all manual, Edge Function,
   Auth, webhook, and scheduled paths.
4. Obtain second-operator approval, then enable one delivery path at a time.
5. Monitor delivery/audit counts and immediately disable the path on anomaly.
6. Production reactivation requires separate incident authorization and customer
   communication review.

## Recovery validation checklist

- [ ] Exact target project/environment verified by two people.
- [ ] Backup timestamp, versions, duration, checksum, and integrity recorded.
- [ ] Restore completed from a clean target with no unexplained errors.
- [ ] Schema, RLS, grants, functions, triggers, constraints, and migrations match.
- [ ] Tenant/module aggregate counts match and orphan checks pass.
- [ ] Auth and Storage service-level limitations resolved or explicitly accepted.
- [ ] Edge Functions, cron, SMTP, webhooks, and queues remain disabled.
- [ ] V2 artifact targets only the recovered non-production backend.
- [ ] Synthetic login, switching, module workflows, and denial tests pass.
- [ ] Actual recovery duration and data-loss window recorded.
- [ ] Incident/customer updates approved and sent when applicable.
- [ ] Communication reactivation separately approved.

