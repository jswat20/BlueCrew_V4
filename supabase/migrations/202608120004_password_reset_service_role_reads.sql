-- Phase 8.3: permit the trusted password-reset worker to resolve the
-- authoritative administrator, profile, and crew linkage records.

grant select on table public.profiles to service_role;
grant select on table public.crew_members to service_role;
