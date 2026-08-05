# RLS verification

`rls_verification.sql` is the executable acceptance suite. It seeds two isolated organizations, impersonates anonymous and authenticated identities, verifies constraints and policies, and always rolls back.

`auth_foundation_verification.sql` verifies the trusted bootstrap, verified-email requirement, invitation consumption, idempotent pending-profile provisioning, and transactional administrator approval/crew linkage. It also always rolls back.

Run them only against a new disposable database after applying all migrations. With a PostgreSQL connection string in the process environment:

```powershell
psql $env:BLUECREW_TEST_DATABASE_URL -v ON_ERROR_STOP=1 -f supabase/migrations/202608040001_initial_schema.sql
psql $env:BLUECREW_TEST_DATABASE_URL -v ON_ERROR_STOP=1 -f supabase/migrations/202608040002_rls.sql
psql $env:BLUECREW_TEST_DATABASE_URL -v ON_ERROR_STOP=1 -f supabase/migrations/202608050001_auth_foundation.sql
psql $env:BLUECREW_TEST_DATABASE_URL -v ON_ERROR_STOP=1 -f supabase/tests/rls_verification.sql
psql $env:BLUECREW_TEST_DATABASE_URL -v ON_ERROR_STOP=1 -f supabase/tests/auth_foundation_verification.sql
```

Do not put the connection string in repository files or shell history. A successful test command ends with `ROLLBACK`; any failed assertion stops execution.

## Manual query reference

Run migrations against a disposable local or staging Supabase database. Seed two organizations with these authenticated fixtures through the service role or SQL owner:

| Fixture | Expected profile |
|---|---|
| `admin_a` | approved administrator in organization A |
| `assigner_a` | approved assigner in organization A |
| `umpire_a` | approved umpire linked to crew member A in organization A |
| `umpire_b` | approved umpire linked to crew member B in organization B |

For each fixture, impersonate the authenticated role in a transaction:

```sql
begin;
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '<AUTH_USER_UUID>', true);
-- verification query here
rollback;
```

Use `select id from profiles where auth_user_id = auth.uid();` as a fixture sanity check. Never run these checks against production.

## Organization isolation

As `umpire_a`, each query must return zero rows for organization B:

```sql
select * from games where organization_id = '<ORG_B_UUID>';
select * from crew_members where organization_id = '<ORG_B_UUID>';
select * from notifications where organization_id = '<ORG_B_UUID>';
```

## Assignment protection

As `umpire_a`, this must affect zero rows. An insert must fail RLS:

```sql
update game_assignments set status = 'assigned' where id = '<OPEN_ASSIGNMENT_A_UUID>';
insert into game_assignments (organization_id, game_id, position)
values ('<ORG_A_UUID>', '<GAME_A_UUID>', 'Plate');
```

The umpire may instead create a pending claim for their linked crew member when the assignment is unlocked and `open_for_claim`:

```sql
insert into assignment_claims (organization_id, assignment_id, claimant_crew_member_id)
values ('<ORG_A_UUID>', '<OPEN_ASSIGNMENT_A_UUID>', '<CREW_A_UUID>');
```

Repeating it while pending must fail the partial unique index.

## Self-service profile and availability

As `umpire_a`, the first update must succeed. The second must raise the profile-protection exception:

```sql
update profiles set phone = '5550101234', communication_preferences = '{"assignments":false}'
where auth_user_id = auth.uid();

update profiles set role = 'administrator' where auth_user_id = auth.uid();
```

Own availability must succeed; another crew member's insert/update/delete must fail RLS:

```sql
insert into availability (organization_id, crew_member_id, availability_date, status)
values ('<ORG_A_UUID>', '<CREW_A_UUID>', current_date + 7, 'available');

insert into availability (organization_id, crew_member_id, availability_date, status)
values ('<ORG_A_UUID>', '<OTHER_CREW_A_UUID>', current_date + 7, 'available');
```

## Assigner operations

As `assigner_a`, game, assignment, and claim updates in organization A must succeed; the same operations against organization B must affect zero rows. Profile-role and location-configuration updates must affect zero rows.

```sql
update games set game_time = '19:00' where id = '<GAME_A_UUID>';
update game_assignments set status = 'assigned', assigned_crew_member_id = '<CREW_A_UUID>' where id = '<ASSIGNMENT_A_UUID>';
update assignment_claims set status = 'approved', decision_by_profile_id = public.current_profile_id(), decided_at = now() where id = '<CLAIM_A_UUID>';
update profiles set role = 'administrator' where id = '<UMPIRE_PROFILE_A_UUID>';
update locations set name = 'Unauthorized rename' where id = '<LOCATION_A_UUID>';
```

## Administrator operations

As `admin_a`, profile approval, crew linkage/configuration, seasons, locations, and fields in organization A must succeed. Equivalent operations against organization B must affect zero rows.

## Notification visibility

Seed one notification for each case: recipient `umpire_a`, recipient `umpire_b`, audience `admin`, audience `assigner`, and untargeted audience `umpire`.

- `umpire_a` sees its recipient notification and organization A umpire-audience notification only.
- `umpire_b` sees only its organization B recipient/audience notifications.
- `assigner_a` sees organization A assigner-audience and explicitly addressed notifications only.
- `admin_a` sees organization A admin-audience and explicitly addressed notifications only.

Verify with:

```sql
select id, audience, recipient_profile_id
from notifications
order by created_at;
```

An umpire changing notification title, recipient, or destination must raise the notification-protection exception; changing `read_at` on their own addressed notification must succeed.

## Anonymous registration boundary

With `set local role anon`, all direct selects and writes against application tables must fail or return zero rows. Registration provisioning is deliberately deferred to an authenticated/server-controlled Milestone 2B function.
