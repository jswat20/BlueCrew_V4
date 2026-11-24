-- Increment 7A: remove inherited execution grants from privileged code while
-- preserving the explicitly public, read-only tournament snapshot endpoint.

alter function public.is_administrator() set search_path = pg_catalog, public;
alter function public.is_assigner_or_administrator() set search_path = pg_catalog, public;
alter function public.is_approved_account() set search_path = pg_catalog, public;
alter function public.set_updated_at() set search_path = pg_catalog, public;

-- PostgreSQL grants EXECUTE to PUBLIC on newly-created functions unless it is
-- explicitly revoked. Remove that inherited capability from every public
-- SECURITY DEFINER routine. Existing role-specific grants remain intact.
do $block$
declare
  routine record;
begin
  for routine in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
  loop
    execute format('revoke execute on function %s from public', routine.signature);
  end loop;
end;
$block$;

-- Anonymous callers have no legitimate mutation, identity, scheduling, or
-- trigger-function entry point. The one exception is the allowlisted,
-- read-only public tournament document.
do $block$
declare
  routine record;
begin
  for routine in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and p.oid <> 'public.get_public_tournament(uuid)'::regprocedure
  loop
    execute format('revoke execute on function %s from anon', routine.signature);
  end loop;
end;
$block$;

revoke all on table public.field_availability_rules from anon;
revoke all on table public.field_closures from anon;
revoke all on table public.field_reservations from anon;
revoke all on table public.league_viewer_scopes from anon;

-- Trigger functions and internal composition helpers are invoked by their
-- owning tables or by vetted SECURITY DEFINER operations. They are not direct
-- authenticated APIs.
revoke execute on function public.assign_permanent_personnel_id() from authenticated;
revoke execute on function public.enforce_profile_photo_path() from authenticated;
revoke execute on function public.protect_notification_update() from authenticated;
revoke execute on function public.protect_profile_update() from authenticated;
revoke execute on function public.protect_requested_account_role() from authenticated;
revoke execute on function public.rls_auto_enable() from authenticated;
revoke execute on function public.sync_official_history_projection(uuid) from authenticated;
revoke execute on function public.validate_crew_profile_link() from authenticated;
revoke execute on function public.validate_field_reservation() from authenticated;
revoke execute on function public.create_notification(uuid, text, public.notification_audience, uuid, text, text, text) from authenticated;
revoke execute on function public.notify_organization_administrators(uuid, text, text, text, text) from authenticated;

-- These tables are intentionally RPC/trigger-owned. Explicit deny policies
-- document that direct authenticated access is forbidden while allowing their
-- vetted SECURITY DEFINER owners to operate.
drop policy if exists message_deletions_no_direct_access on public.message_deletions;
create policy message_deletions_no_direct_access
on public.message_deletions for all to authenticated
using (false) with check (false);

drop policy if exists personnel_id_counters_no_direct_access on public.personnel_id_counters;
create policy personnel_id_counters_no_direct_access
on public.personnel_id_counters for all to authenticated
using (false) with check (false);

drop policy if exists user_workspace_contexts_no_direct_access on public.user_workspace_contexts;
create policy user_workspace_contexts_no_direct_access
on public.user_workspace_contexts for all to authenticated
using (false) with check (false);

grant execute on function public.get_public_tournament(uuid) to anon, authenticated;
