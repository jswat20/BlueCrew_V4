-- Invited League Viewers receive an explicit organization-local scope. This is
-- intentionally created by the trusted acceptance transition, never by a
-- browser-supplied organization or profile identifier.

create or replace function private.complete_invited_league_viewer_scope()
returns trigger
language plpgsql security definer
set search_path=pg_catalog,public
as $$
declare v_profile_id uuid;
begin
  if old.accepted_at is null and new.accepted_at is not null and new.role_code='league_viewer' then
    select id into strict v_profile_id from public.profiles
    where organization_id=new.organization_id and auth_user_id=new.accepted_by_auth_user_id
      and role='league_viewer' and status='approved';
    insert into public.league_viewer_scopes(profile_id,organization_id,all_divisions,division_levels)
    values(v_profile_id,new.organization_id,true,'{}'::text[])
    on conflict(profile_id) do update set organization_id=excluded.organization_id,
      all_divisions=true,division_levels='{}'::text[],updated_at=now();
  end if;
  return new;
end;
$$;

create trigger workspace_invitation_complete_league_viewer_scope
after update of accepted_at on public.workspace_invitations
for each row execute function private.complete_invited_league_viewer_scope();

revoke all on function private.complete_invited_league_viewer_scope() from public,anon,authenticated;
