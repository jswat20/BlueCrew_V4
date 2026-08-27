-- Add the reusable read-only organization leadership role in its own migration.
-- PostgreSQL requires a newly-added enum value to be committed before later use.
alter type public.account_role add value if not exists 'league_viewer';
