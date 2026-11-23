-- Increment 4B: server-validated active workspace selection.
-- Backward compatible for every existing single-workspace account. The active
-- context is never writable through the Data API; authenticated callers may
-- only change it through select_active_workspace after membership validation.

alter table public.profiles drop constraint if exists profiles_auth_user_id_key;
alter table public.profiles
  add constraint profiles_organization_auth_user_key unique (organization_id, auth_user_id);

create table public.user_workspace_contexts (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null,
  membership_id uuid not null,
  selected_at timestamptz not null default now(),
  last_validated_at timestamptz not null default now(),
  foreign key (organization_id, membership_id)
    references public.organization_memberships(organization_id, id) on delete cascade
);

create index user_workspace_contexts_membership_idx
  on public.user_workspace_contexts (organization_id, membership_id, auth_user_id);

alter table public.user_workspace_contexts enable row level security;
revoke all on public.user_workspace_contexts from public, anon, authenticated;

create or replace function private.valid_workspace_organization(p_auth_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select c.organization_id
  from public.user_workspace_contexts c
  join public.organization_memberships m
    on m.organization_id = c.organization_id
   and m.id = c.membership_id
   and m.auth_user_id = c.auth_user_id
   and m.status = 'approved'
  join public.organizations o
    on o.id = m.organization_id
   and o.active
  join public.profiles p
    on p.organization_id = m.organization_id
   and p.id = m.profile_id
   and p.auth_user_id = m.auth_user_id
   and p.status = 'approved'
  where c.auth_user_id = p_auth_user_id
    and exists (
      select 1
      from public.organization_membership_roles r
      where r.organization_id = m.organization_id
        and r.membership_id = m.id
        and r.role_code = p.role::text
    )
$$;

create or replace function private.single_valid_workspace_organization(p_auth_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select (array_agg(m.organization_id order by m.organization_id))[1]
  from public.organization_memberships m
  join public.organizations o on o.id = m.organization_id and o.active
  join public.profiles p
    on p.organization_id = m.organization_id
   and p.id = m.profile_id
   and p.auth_user_id = m.auth_user_id
   and p.status = 'approved'
  where m.auth_user_id = p_auth_user_id
    and m.status = 'approved'
    and exists (
      select 1
      from public.organization_membership_roles r
      where r.organization_id = m.organization_id
        and r.membership_id = m.id
        and r.role_code = p.role::text
    )
  having count(*) = 1
$$;

revoke all on function private.valid_workspace_organization(uuid) from public, anon, authenticated;
revoke all on function private.single_valid_workspace_organization(uuid) from public, anon, authenticated;
grant execute on function private.valid_workspace_organization(uuid) to service_role;
grant execute on function private.single_valid_workspace_organization(uuid) to service_role;

create or replace function public.current_organization_id()
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select case
    when (select auth.uid()) is null then null::uuid
    when exists (
      select 1 from public.user_workspace_contexts c
      where c.auth_user_id = (select auth.uid())
    ) then private.valid_workspace_organization((select auth.uid()))
    else private.single_valid_workspace_organization((select auth.uid()))
  end
$$;

create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select p.id
  from public.profiles p
  where p.auth_user_id = (select auth.uid())
    and p.organization_id = public.current_organization_id()
    and p.status = 'approved'
$$;

create or replace function public.current_account_role()
returns public.account_role
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select p.role
  from public.profiles p
  join public.organization_memberships m
    on m.organization_id = p.organization_id
   and m.profile_id = p.id
   and m.auth_user_id = p.auth_user_id
   and m.status = 'approved'
  where p.id = public.current_profile_id()
    and exists (
      select 1 from public.organization_membership_roles r
      where r.organization_id = m.organization_id
        and r.membership_id = m.id
        and r.role_code = p.role::text
    )
$$;

create or replace function public.current_crew_member_id()
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select c.id
  from public.crew_members c
  where c.organization_id = public.current_organization_id()
    and c.profile_id = public.current_profile_id()
$$;

revoke all on function public.current_organization_id() from public, anon;
revoke all on function public.current_profile_id() from public, anon;
revoke all on function public.current_account_role() from public, anon;
revoke all on function public.current_crew_member_id() from public, anon;
grant execute on function public.current_organization_id() to authenticated, service_role;
grant execute on function public.current_profile_id() to authenticated, service_role;
grant execute on function public.current_account_role() to authenticated, service_role;
grant execute on function public.current_crew_member_id() to authenticated, service_role;

drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_self on public.profiles for select to authenticated
  using (
    (id = (select public.current_profile_id()) and organization_id = (select public.current_organization_id()))
    or (auth_user_id = (select auth.uid()) and status = 'pending')
  );

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update to authenticated
  using (
    id = (select public.current_profile_id())
    and organization_id = (select public.current_organization_id())
  )
  with check (
    id = (select public.current_profile_id())
    and organization_id = (select public.current_organization_id())
    and auth_user_id = (select auth.uid())
  );

create or replace function public.get_authorized_workspaces()
returns table (
  organization_id uuid,
  organization_name text,
  organization_slug text,
  organization_timezone text,
  membership_id uuid,
  profile_id uuid,
  membership_status text,
  role_code text,
  enabled_modules text[],
  is_active boolean
)
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select
    o.id,
    o.name,
    o.slug,
    o.timezone,
    m.id,
    p.id,
    m.status,
    p.role::text,
    coalesce((
      select array_agg(e.module_code order by e.module_code)
      from public.organization_module_entitlements e
      where e.organization_id = m.organization_id
        and e.enabled
        and e.effective_at <= now()
        and (e.expires_at is null or e.expires_at > now())
    ), '{}'::text[]),
    m.organization_id = private.valid_workspace_organization((select auth.uid()))
  from public.organization_memberships m
  join public.organizations o on o.id = m.organization_id and o.active
  join public.profiles p
    on p.organization_id = m.organization_id
   and p.id = m.profile_id
   and p.auth_user_id = m.auth_user_id
   and p.status = 'approved'
  where m.auth_user_id = (select auth.uid())
    and m.status = 'approved'
    and exists (
      select 1 from public.organization_membership_roles r
      where r.organization_id = m.organization_id
        and r.membership_id = m.id
        and r.role_code = p.role::text
    )
  order by o.name, o.id
$$;

create or replace function public.get_active_profile()
returns public.profiles
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare v_profile public.profiles%rowtype;
begin
  select p.* into v_profile
  from public.profiles p
  where p.id = public.current_profile_id()
    and p.organization_id = public.current_organization_id();
  if found then return v_profile; end if;

  select p.* into v_profile
  from public.profiles p
  where p.auth_user_id = (select auth.uid())
    and p.status = 'pending'
  order by p.created_at, p.id
  limit 1;
  return v_profile;
end;
$$;

create or replace function public.select_active_workspace(p_organization_id uuid)
returns public.profiles
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_auth_user_id uuid := (select auth.uid());
  v_membership public.organization_memberships%rowtype;
  v_profile public.profiles%rowtype;
begin
  if v_auth_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  select m.* into v_membership
  from public.organization_memberships m
  join public.organizations o on o.id = m.organization_id and o.active
  where m.organization_id = p_organization_id
    and m.auth_user_id = v_auth_user_id
    and m.status = 'approved'
  for update of m;
  if not found then
    raise exception using errcode = '42501', message = 'workspace_membership_required';
  end if;

  select p.* into v_profile
  from public.profiles p
  where p.organization_id = v_membership.organization_id
    and p.id = v_membership.profile_id
    and p.auth_user_id = v_auth_user_id
    and p.status = 'approved';
  if not found then
    raise exception using errcode = '42501', message = 'workspace_profile_required';
  end if;

  if not exists (
    select 1 from public.organization_membership_roles r
    where r.organization_id = v_membership.organization_id
      and r.membership_id = v_membership.id
      and r.role_code = v_profile.role::text
  ) then
    raise exception using errcode = '42501', message = 'workspace_role_required';
  end if;

  insert into public.user_workspace_contexts (
    auth_user_id, organization_id, membership_id, selected_at, last_validated_at
  ) values (
    v_auth_user_id, v_membership.organization_id, v_membership.id, now(), now()
  )
  on conflict (auth_user_id) do update
  set organization_id = excluded.organization_id,
      membership_id = excluded.membership_id,
      selected_at = excluded.selected_at,
      last_validated_at = excluded.last_validated_at;

  insert into public.workspace_audit_events (
    organization_id, actor_auth_user_id, action, entity_type, entity_id, metadata
  ) values (
    v_membership.organization_id,
    v_auth_user_id,
    'workspace.selected',
    'organization_membership',
    v_membership.id,
    jsonb_build_object('profile_id', v_profile.id, 'role', v_profile.role::text)
  );

  return v_profile;
end;
$$;

create or replace function public.clear_active_workspace()
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_auth_user_id uuid := (select auth.uid());
  v_context public.user_workspace_contexts%rowtype;
begin
  if v_auth_user_id is null then return false; end if;
  delete from public.user_workspace_contexts
  where auth_user_id = v_auth_user_id
  returning * into v_context;
  if not found then return false; end if;

  insert into public.workspace_audit_events (
    organization_id, actor_auth_user_id, action, entity_type, entity_id
  ) values (
    v_context.organization_id,
    v_auth_user_id,
    'workspace.cleared',
    'organization_membership',
    v_context.membership_id
  );
  return true;
end;
$$;

create or replace function private.invalidate_workspace_context()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.user_workspace_contexts
    where auth_user_id = old.auth_user_id
      and organization_id = old.organization_id
      and membership_id = old.id;
    return old;
  end if;
  if new.status <> 'approved' or new.profile_id is null then
    delete from public.user_workspace_contexts
    where auth_user_id = old.auth_user_id
      and organization_id = old.organization_id
      and membership_id = old.id;
  end if;
  return new;
end;
$$;

create trigger organization_memberships_invalidate_active_context
after update of status, profile_id or delete on public.organization_memberships
for each row execute function private.invalidate_workspace_context();

revoke all on function public.get_authorized_workspaces() from public, anon, authenticated;
revoke all on function public.get_active_profile() from public, anon, authenticated;
revoke all on function public.select_active_workspace(uuid) from public, anon, authenticated;
revoke all on function public.clear_active_workspace() from public, anon, authenticated;
revoke all on function private.invalidate_workspace_context() from public, anon, authenticated;
grant execute on function public.get_authorized_workspaces() to authenticated;
grant execute on function public.get_active_profile() to authenticated;
grant execute on function public.select_active_workspace(uuid) to authenticated;
grant execute on function public.clear_active_workspace() to authenticated;

create or replace function private.sync_profile_membership()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_membership_id uuid;
  v_status text := case new.status::text when 'approved' then 'approved' when 'rejected' then 'revoked' else 'pending' end;
begin
  insert into public.organization_memberships (
    organization_id, auth_user_id, profile_id, status, approved_at, revoked_at
  ) values (
    new.organization_id,
    new.auth_user_id,
    new.id,
    v_status,
    case when v_status = 'approved' then coalesce(new.approved_at, now()) end,
    case when v_status = 'revoked' then coalesce(new.rejected_at, now()) end
  )
  on conflict (organization_id, auth_user_id) do update
  set profile_id = excluded.profile_id,
      status = excluded.status,
      approved_at = excluded.approved_at,
      revoked_at = excluded.revoked_at,
      updated_at = now()
  returning id into v_membership_id;

  delete from public.organization_membership_roles
  where organization_id = new.organization_id
    and membership_id = v_membership_id
    and role_code in ('administrator','assigner','umpire','league_viewer')
    and role_code <> new.role::text;
  insert into public.organization_membership_roles (organization_id, membership_id, role_code)
  values (new.organization_id, v_membership_id, new.role::text)
  on conflict do nothing;
  return new;
end;
$$;

create trigger profiles_sync_workspace_membership
after insert or update of organization_id, auth_user_id, role, status, approved_at, rejected_at
on public.profiles
for each row execute function private.sync_profile_membership();

revoke all on function private.sync_profile_membership() from public, anon, authenticated;

-- Trusted onboarding now creates the owner's workspace-specific profile as well
-- as the membership. Existing workspaces and identifiers are unchanged.
create or replace function public.provision_saas_workspace(
  p_name text, p_slug text, p_timezone text, p_enabled_modules text[], p_owner_auth_user_id uuid
) returns public.organizations
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_organization public.organizations%rowtype;
  v_membership_id uuid;
  v_profile_id uuid;
  v_source_profile public.profiles%rowtype;
  v_auth_email text;
  v_module text;
begin
  if (select auth.jwt() ->> 'role') is distinct from 'service_role' then
    raise exception using errcode='42501', message='platform_operator_required';
  end if;
  if nullif(btrim(coalesce(p_name,'')),'') is null
     or p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception using errcode='P0001', message='workspace_identity_invalid';
  end if;
  select lower(email) into v_auth_email from auth.users where id = p_owner_auth_user_id;
  if not found then raise exception using errcode='P0001', message='workspace_owner_not_found'; end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name=p_timezone) then
    raise exception using errcode='P0001', message='workspace_timezone_invalid';
  end if;
  if coalesce(cardinality(p_enabled_modules),0)=0
     or cardinality(p_enabled_modules) <> cardinality(array(select distinct value from unnest(p_enabled_modules) value))
     or exists (select 1 from unnest(p_enabled_modules) value where value not in ('league','umpire','tournament','facility')) then
    raise exception using errcode='P0001', message='workspace_modules_invalid';
  end if;

  select * into v_source_profile
  from public.profiles
  where auth_user_id = p_owner_auth_user_id
  order by (status = 'approved') desc, created_at, id
  limit 1;

  insert into public.organizations(name,slug,timezone)
  values(btrim(p_name),p_slug,p_timezone) returning * into v_organization;

  insert into public.profiles(
    organization_id, auth_user_id, role, status, first_name, last_name, email,
    phone, home_phone, address, contact_preference, emergency_contact,
    emergency_contact_phone, communication_preferences, approved_at
  ) values (
    v_organization.id,
    p_owner_auth_user_id,
    'administrator',
    'approved',
    coalesce(nullif(v_source_profile.first_name,''),'Workspace'),
    coalesce(nullif(v_source_profile.last_name,''),'Owner'),
    v_auth_email,
    coalesce(v_source_profile.phone,''),
    coalesce(v_source_profile.home_phone,''),
    coalesce(v_source_profile.address,''),
    coalesce(v_source_profile.contact_preference,'text'),
    coalesce(v_source_profile.emergency_contact,''),
    coalesce(v_source_profile.emergency_contact_phone,''),
    coalesce(v_source_profile.communication_preferences,'{}'::jsonb),
    now()
  ) returning id into v_profile_id;

  -- profiles_sync_workspace_membership creates the membership and role in the
  -- same transaction. Resolve that server-created identifier for auditing.
  select id into strict v_membership_id
  from public.organization_memberships
  where organization_id = v_organization.id
    and auth_user_id = p_owner_auth_user_id
    and profile_id = v_profile_id
    and status = 'approved';
  foreach v_module in array p_enabled_modules loop
    insert into public.organization_module_entitlements(organization_id,module_code,enabled,entitlement_source)
    values(v_organization.id,v_module,true,'platform_operator');
  end loop;
  insert into public.workspace_audit_events(organization_id,actor_auth_user_id,action,entity_type,entity_id,metadata)
  values(v_organization.id,(select auth.uid()),'workspace.provisioned','organization',v_organization.id,
    jsonb_build_object('modules',p_enabled_modules,'owner_auth_user_id',p_owner_auth_user_id,'profile_id',v_profile_id));
  return v_organization;
end;
$$;

revoke all on function public.provision_saas_workspace(text,text,text,text[],uuid) from public, anon, authenticated;
grant execute on function public.provision_saas_workspace(text,text,text,text[],uuid) to service_role;

comment on table public.user_workspace_contexts is
  'Server-owned active workspace selection. Direct browser access is intentionally denied.';
comment on function public.select_active_workspace(uuid) is
  'Selects an active workspace only after validating the caller membership, profile, role, and organization.';
