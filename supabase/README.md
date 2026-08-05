# Supabase foundation

Apply migrations in filename order to a disposable Supabase environment:

1. `202608040001_initial_schema.sql`
2. `202608040002_rls.sql`
3. `202608050001_auth_foundation.sql`

Milestone 2B adds only the Auth, invitation, bootstrap, approval/linking, generated public configuration, and authoritative authenticated-profile boundary. Domain persistence conversion and data migration remain out of scope. See `docs/supabase-auth-configuration.md` and the existing Supabase design documents before review.
