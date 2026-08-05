# Supabase foundation

Apply migrations in filename order to a disposable Supabase environment:

1. `202608040001_initial_schema.sql`
2. `202608040002_rls.sql`
3. `202608050001_auth_foundation.sql`
4. `202608050002_shared_availability_rpc.sql`
5. `202608050003_claim_workflow_rpc.sql`

Milestone 4A adds the transactional assignment-claim submission and decision boundary. Other domain persistence conversion and data migration remain out of scope. See `docs/supabase-auth-configuration.md` and the existing Supabase design documents before review.
