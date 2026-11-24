-- Increment 7B milestone 1: narrow, authenticated self-service workspace creation.
-- Billing is intentionally out of scope. The limits below are an abuse guard,
-- not a subscription quota.

create or replace function public.create_customer_workspace(
  p_name text,
  p_slug text,
  p_timezone text,
  p_enabled_modules text[]
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_auth_user_id uuid := (select auth.uid());
  v_auth_user auth.users%rowtype;
  v_source_profile public.profiles%rowtype;
  v_organization public.organizations%rowtype;
  v_profile_id uuid;
  v_membership_id uuid;
  v_module text;
begin
  if v_auth_user_id is null then
    raise exception using errcode='42501', message='authentication_required';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_auth_user_id::text, 0));
  select * into v_auth_user from auth.users where id=v_auth_user_id;
  if not found or v_auth_user.email_confirmed_at is null then
    raise exception using errcode='42501', message='verified_email_required';
  end if;
  if nullif(btrim(coalesce(p_name,'')),'') is null
     or length(btrim(p_name)) > 120
     or p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
     or length(p_slug) > 80 then
    raise exception using errcode='P0001', message='workspace_identity_invalid';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name=p_timezone) then
    raise exception using errcode='P0001', message='workspace_timezone_invalid';
  end if;
  if coalesce(cardinality(p_enabled_modules),0)=0
     or cardinality(p_enabled_modules) <> cardinality(array(select distinct value from unnest(p_enabled_modules) value))
     or exists (select 1 from unnest(p_enabled_modules) value where value not in ('league','umpire','tournament','facility')) then
    raise exception using errcode='P0001', message='workspace_modules_invalid';
  end if;
  if (select count(*) from public.workspace_audit_events
      where actor_auth_user_id=v_auth_user_id and action='workspace.self_service_created') >= 5 then
    raise exception using errcode='42501', message='workspace_creation_limit_reached';
  end if;
  if (select count(*) from public.workspace_audit_events
      where actor_auth_user_id=v_auth_user_id and action='workspace.self_service_created'
        and created_at > now() - interval '1 hour') >= 2 then
    raise exception using errcode='42501', message='workspace_creation_rate_limited';
  end if;

  select * into v_source_profile
  from public.profiles
  where auth_user_id=v_auth_user_id
  order by (status='approved') desc, created_at, id
  limit 1;

  insert into public.organizations(name,slug,timezone)
  values(btrim(p_name),p_slug,p_timezone)
  returning * into v_organization;

  insert into public.profiles(
    organization_id,auth_user_id,role,status,first_name,last_name,email,
    phone,home_phone,address,contact_preference,emergency_contact,
    emergency_contact_phone,communication_preferences,approved_at
  ) values (
    v_organization.id,v_auth_user_id,'administrator','approved',
    coalesce(nullif(v_source_profile.first_name,''),nullif(v_auth_user.raw_user_meta_data->>'first_name',''),'Workspace'),
    coalesce(nullif(v_source_profile.last_name,''),nullif(v_auth_user.raw_user_meta_data->>'last_name',''),'Owner'),
    lower(v_auth_user.email),coalesce(v_source_profile.phone,''),coalesce(v_source_profile.home_phone,''),
    coalesce(v_source_profile.address,''),coalesce(v_source_profile.contact_preference,'text'),
    coalesce(v_source_profile.emergency_contact,''),coalesce(v_source_profile.emergency_contact_phone,''),
    coalesce(v_source_profile.communication_preferences,'{}'::jsonb),now()
  ) returning id into v_profile_id;

  select id into strict v_membership_id
  from public.organization_memberships
  where organization_id=v_organization.id and auth_user_id=v_auth_user_id
    and profile_id=v_profile_id and status='approved';

  foreach v_module in array p_enabled_modules loop
    insert into public.organization_module_entitlements(organization_id,module_code,enabled,entitlement_source)
    values(v_organization.id,v_module,true,'subscription');
  end loop;

  insert into public.user_workspace_contexts(auth_user_id,organization_id,membership_id,selected_at,last_validated_at)
  values(v_auth_user_id,v_organization.id,v_membership_id,now(),now())
  on conflict (auth_user_id) do update
    set organization_id=excluded.organization_id,membership_id=excluded.membership_id,
        selected_at=excluded.selected_at,last_validated_at=excluded.last_validated_at;

  insert into public.workspace_audit_events(organization_id,actor_auth_user_id,action,entity_type,entity_id,metadata)
  values(v_organization.id,v_auth_user_id,'workspace.self_service_created','organization',v_organization.id,
    jsonb_build_object('modules',p_enabled_modules,'profile_id',v_profile_id,'membership_id',v_membership_id));

  return jsonb_build_object('organization_id',v_organization.id,'name',v_organization.name,
    'slug',v_organization.slug,'profile_id',v_profile_id,'membership_id',v_membership_id,
    'enabled_modules',p_enabled_modules);
exception
  when unique_violation then
    raise exception using errcode='23505', message='workspace_slug_unavailable';
end;
$$;

create or replace function public.enable_workspace_module(p_module_code text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_organization_id uuid := public.current_organization_id();
  v_auth_user_id uuid := (select auth.uid());
begin
  if v_auth_user_id is null or v_organization_id is null then
    raise exception using errcode='42501', message='workspace_context_required';
  end if;
  if p_module_code not in ('league','umpire','tournament','facility') then
    raise exception using errcode='P0001', message='workspace_module_invalid';
  end if;
  if not private.has_membership_role(v_organization_id,array['administrator']) then
    raise exception using errcode='42501', message='workspace_administrator_required';
  end if;
  insert into public.organization_module_entitlements(organization_id,module_code,enabled,entitlement_source)
  values(v_organization_id,p_module_code,true,'subscription')
  on conflict (organization_id,module_code) do update
    set enabled=true,entitlement_source='subscription',expires_at=null,updated_at=now();
  insert into public.workspace_audit_events(organization_id,actor_auth_user_id,action,entity_type,entity_id,metadata)
  values(v_organization_id,v_auth_user_id,'workspace.module_enabled','organization',v_organization_id,
    jsonb_build_object('module',p_module_code));
  return jsonb_build_object('organization_id',v_organization_id,'module_code',p_module_code,'enabled',true);
end;
$$;

revoke all on function public.create_customer_workspace(text,text,text,text[]) from public,anon,authenticated;
revoke all on function public.enable_workspace_module(text) from public,anon,authenticated;
grant execute on function public.create_customer_workspace(text,text,text,text[]) to authenticated;
grant execute on function public.enable_workspace_module(text) to authenticated;

comment on function public.create_customer_workspace(text,text,text,text[]) is
  'Verified-user self-service onboarding with atomic owner membership, entitlements, active context, audit, and abuse limits.';
comment on function public.enable_workspace_module(text) is
  'Enables one module only for an administrator in the server-validated active workspace.';
