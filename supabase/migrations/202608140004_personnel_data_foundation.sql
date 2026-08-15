-- Durable personnel data: DOB registration enforcement, official service history,
-- permanent organization/role personnel identifiers, and birthday event support.

alter table public.profiles
  add column if not exists personnel_id text,
  add column if not exists personnel_id_issued_at timestamptz;

create unique index if not exists profiles_organization_personnel_id_key
  on public.profiles (organization_id, personnel_id)
  where personnel_id is not null;

create table public.personnel_id_counters (
  organization_id uuid not null references public.organizations(id) on delete restrict,
  role_prefix text not null check (role_prefix in ('UMP', 'ADM', 'ASN')),
  next_value bigint not null default 1 check (next_value > 0),
  primary key (organization_id, role_prefix)
);

alter table public.personnel_id_counters enable row level security;
revoke all on public.personnel_id_counters from public, anon, authenticated;

create or replace function public.personnel_role_prefix(p_role public.account_role)
returns text language sql immutable parallel safe
set search_path = pg_catalog
as $$
  select case p_role when 'administrator' then 'ADM' when 'assigner' then 'ASN' else 'UMP' end
$$;

create or replace function public.assign_permanent_personnel_id()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  assigned_number bigint;
  assigned_prefix text;
begin
  if new.status <> 'approved' or new.personnel_id is not null then return new; end if;
  assigned_prefix := public.personnel_role_prefix(new.role);
  insert into public.personnel_id_counters (organization_id, role_prefix, next_value)
  values (new.organization_id, assigned_prefix, 2)
  on conflict (organization_id, role_prefix) do update
    set next_value = public.personnel_id_counters.next_value + 1
  returning next_value - 1 into assigned_number;
  new.personnel_id := assigned_prefix || '-' || lpad(assigned_number::text, 3, '0');
  new.personnel_id_issued_at := coalesce(new.personnel_id_issued_at, now());
  return new;
end;
$$;

drop trigger if exists profiles_assign_permanent_personnel_id on public.profiles;
create trigger profiles_assign_permanent_personnel_id
before insert or update of status, role on public.profiles
for each row execute function public.assign_permanent_personnel_id();

create or replace function public.protect_permanent_personnel_id()
returns trigger language plpgsql set search_path = pg_catalog
as $$
begin
  if old.personnel_id is not null and (
    new.personnel_id is distinct from old.personnel_id
    or new.personnel_id_issued_at is distinct from old.personnel_id_issued_at
  ) then raise exception 'personnel_id_is_permanent'; end if;
  return new;
end;
$$;
create trigger profiles_protect_permanent_personnel_id
before update on public.profiles
for each row execute function public.protect_permanent_personnel_id();

-- Stable deterministic backfill: creation time, then UUID. The trigger uses the
-- same concurrency-safe counter as future approvals.
do $$
declare target record;
begin
  for target in
    select id from public.profiles
    where status = 'approved' and personnel_id is null
    order by organization_id, role, created_at, id
  loop
    update public.profiles set status = status where id = target.id;
  end loop;
end;
$$;

create table public.official_service_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  profile_id uuid not null,
  service_year smallint not null check (service_year between 1900 and 2200),
  season_id uuid,
  season_label text not null default 'Unspecified' check (btrim(season_label) <> ''),
  service_role public.account_role not null default 'umpire',
  level text not null default '',
  notes text not null default '',
  active boolean not null default true,
  recorded_by_profile_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, profile_id, service_year, season_label),
  foreign key (organization_id, profile_id) references public.profiles(organization_id, id) on delete restrict,
  foreign key (organization_id, season_id) references public.seasons(organization_id, id) on delete restrict,
  foreign key (organization_id, recorded_by_profile_id) references public.profiles(organization_id, id) on delete restrict
);

create trigger official_service_history_set_updated_at
before update on public.official_service_history
for each row execute function public.set_updated_at();

create index official_service_history_profile_year_idx
  on public.official_service_history (organization_id, profile_id, service_year desc)
  where active = true;

alter table public.official_service_history enable row level security;
create policy official_service_history_select_self_or_admin
  on public.official_service_history for select to authenticated
  using (
    organization_id = public.current_organization_id()
    and (profile_id = public.current_profile_id() or public.is_administrator())
  );
revoke all on public.official_service_history from anon;
grant select on public.official_service_history to authenticated;

create or replace function public.official_years_of_service(p_profile_id uuid)
returns integer
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  select count(distinct service_year)::integer
  from public.official_service_history
  where profile_id = p_profile_id and active = true
$$;
grant execute on function public.official_years_of_service(uuid) to authenticated;

create or replace function public.sync_official_history_projection(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  update public.profiles profile
  set official_history = coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', history.id,
      'year', history.service_year,
      'season', history.season_label,
      'role', history.service_role,
      'level', history.level,
      'label', concat_ws(' - ', history.season_label, nullif(history.level, '')),
      'note', history.notes
    ) order by history.service_year desc, history.season_label, history.id)
    from public.official_service_history history
    where history.profile_id = p_profile_id and history.active = true
  ), '[]'::jsonb),
  years_of_service_override = null
  where profile.id = p_profile_id;
end;
$$;

create or replace function public.replace_official_service_history(
  p_profile_id uuid,
  p_entries jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor_id uuid := public.current_profile_id();
  actor_org uuid := public.current_organization_id();
  entry jsonb;
  entry_year integer;
  entry_season text;
begin
  if not public.is_administrator() then raise exception 'administrator_required'; end if;
  if jsonb_typeof(coalesce(p_entries, '[]'::jsonb)) <> 'array' then raise exception 'service_history_array_required'; end if;
  if not exists (select 1 from public.profiles where id = p_profile_id and organization_id = actor_org) then
    raise exception 'profile_not_found';
  end if;
  if exists (
    select 1 from jsonb_array_elements(coalesce(p_entries, '[]'::jsonb)) item
    group by (item->>'year')::integer, lower(btrim(coalesce(item->>'season', 'Unspecified')))
    having count(*) > 1
  ) then raise exception 'duplicate_service_history_entry'; end if;

  update public.official_service_history set active = false, recorded_by_profile_id = actor_id
  where organization_id = actor_org and profile_id = p_profile_id and active = true;

  for entry in select value from jsonb_array_elements(coalesce(p_entries, '[]'::jsonb)) loop
    entry_year := (entry->>'year')::integer;
    entry_season := btrim(coalesce(nullif(entry->>'season', ''), 'Unspecified'));
    if entry_year < 1900 or entry_year > extract(year from current_date)::integer + 1 then
      raise exception 'invalid_service_year';
    end if;
    insert into public.official_service_history (
      organization_id, profile_id, service_year, season_label, service_role, level,
      notes, active, recorded_by_profile_id
    ) values (
      actor_org, p_profile_id, entry_year, entry_season,
      coalesce(nullif(entry->>'role', '')::public.account_role, 'umpire'),
      btrim(coalesce(entry->>'level', '')), btrim(coalesce(entry->>'note', '')), true, actor_id
    )
    on conflict (organization_id, profile_id, service_year, season_label) do update
      set service_role = excluded.service_role, level = excluded.level, notes = excluded.notes,
          active = true, recorded_by_profile_id = excluded.recorded_by_profile_id;
  end loop;
  perform public.sync_official_history_projection(p_profile_id);
end;
$$;

create or replace function public.is_birthday_on(p_birthdate date, p_on_date date)
returns boolean
language sql immutable parallel safe
set search_path = pg_catalog
as $$
  select case
    when p_birthdate is null or p_on_date is null then false
    when extract(month from p_birthdate) = 2 and extract(day from p_birthdate) = 29
      and not ((extract(year from p_on_date)::integer % 4 = 0 and extract(year from p_on_date)::integer % 100 <> 0)
        or extract(year from p_on_date)::integer % 400 = 0)
      then extract(month from p_on_date) = 2 and extract(day from p_on_date) = 28
    else extract(month from p_birthdate) = extract(month from p_on_date)
      and extract(day from p_birthdate) = extract(day from p_on_date)
  end
$$;

create or replace function public.enqueue_due_birthday_communications(p_on_date date default current_date)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare target public.profiles%rowtype; queued integer := 0;
begin
  for target in select * from public.profiles
    where status = 'approved' and birthdate is not null and public.is_birthday_on(birthdate, p_on_date)
  loop
    perform public.enqueue_communication_event(
      p_organization_id => target.organization_id,
      p_type => 'birthday', p_category => 'account', p_recipient_profile_id => target.id,
      p_business_idempotency_key => concat('birthday:', target.id, ':', extract(year from p_on_date)::integer),
      p_subject_entity_type => 'profile', p_subject_entity_id => target.id,
      p_occurred_at => p_on_date::timestamptz,
      p_metadata => jsonb_build_object('firstName', target.first_name),
      p_channels => array['email']::public.communication_channel[]
    );
    queued := queued + 1;
  end loop;
  return queued;
end;
$$;

revoke all on function public.personnel_role_prefix(public.account_role) from public, anon;
revoke all on function public.replace_official_service_history(uuid,jsonb) from public, anon;
revoke all on function public.enqueue_due_birthday_communications(date) from public, anon, authenticated;
grant execute on function public.replace_official_service_history(uuid,jsonb) to authenticated;
grant execute on function public.enqueue_due_birthday_communications(date) to service_role;
grant execute on function public.is_birthday_on(date,date) to authenticated, service_role;

create or replace function public.update_crew_member_with_personnel(
  p_crew_member_id uuid,
  p_first_name text,
  p_last_name text,
  p_contact_email text,
  p_primary_phone text,
  p_active boolean,
  p_eligible_levels text[],
  p_preferences jsonb,
  p_notes text,
  p_birthdate date,
  p_service_history jsonb
)
returns public.crew_members
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor_org uuid := public.current_organization_id();
  target public.crew_members%rowtype;
begin
  if not public.is_administrator() then raise exception 'administrator_required'; end if;
  select * into target from public.crew_members
  where id = p_crew_member_id and organization_id = actor_org for update;
  if not found then raise exception 'crew_member_not_found'; end if;
  if target.profile_id is null and (p_birthdate is not null or coalesce(p_service_history, '[]'::jsonb) <> '[]'::jsonb) then
    raise exception 'official_profile_link_required';
  end if;
  if p_birthdate is not null and p_birthdate > current_date then raise exception 'invalid_date_of_birth'; end if;
  if target.profile_id is not null then
    update public.profiles set phone = btrim(coalesce(p_primary_phone, '')), birthdate = p_birthdate
    where id = target.profile_id and organization_id = actor_org;
    if not found then raise exception 'linked_profile_not_found'; end if;
    perform public.replace_official_service_history(target.profile_id, coalesce(p_service_history, '[]'::jsonb));
  else
    target.phone := btrim(coalesce(p_primary_phone, ''));
  end if;
  update public.crew_members set
    first_name = btrim(coalesce(p_first_name, '')),
    last_name = btrim(coalesce(p_last_name, '')),
    email = btrim(coalesce(p_contact_email, '')),
    phone = case when target.profile_id is null then target.phone else phone end,
    active = coalesce(p_active, true),
    eligible_levels = coalesce(p_eligible_levels, array[]::text[]),
    preferences = coalesce(p_preferences, '{}'::jsonb),
    notes = btrim(coalesce(p_notes, ''))
  where id = target.id returning * into target;
  return target;
end;
$$;

revoke all on function public.update_crew_member_with_personnel(uuid,text,text,text,text,boolean,text[],jsonb,text,date,jsonb) from public, anon;
grant execute on function public.update_crew_member_with_personnel(uuid,text,text,text,text,boolean,text[],jsonb,text,date,jsonb) to authenticated;

drop function public.provision_public_pending_umpire(text,text,text);
create function public.provision_public_pending_umpire(
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_birthdate date
)
returns public.profiles
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  authenticated_user auth.users%rowtype;
  existing_profile public.profiles%rowtype;
  created_profile public.profiles%rowtype;
  eligible_organization_id uuid;
  eligible_organization_count integer;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if p_birthdate is null then raise exception 'date_of_birth_required'; end if;
  if p_birthdate > current_date then raise exception 'invalid_date_of_birth'; end if;
  if p_birthdate > (current_date - interval '13 years')::date then raise exception 'minimum_age_13_required'; end if;
  select * into authenticated_user from auth.users where id = auth.uid();
  if not found or authenticated_user.email is null then raise exception 'authenticated_user_not_found'; end if;
  if authenticated_user.email_confirmed_at is null then raise exception 'email_verification_required'; end if;
  select * into existing_profile from public.profiles where auth_user_id = auth.uid();
  if found then
    if existing_profile.role = 'umpire' and existing_profile.status = 'pending' then return existing_profile; end if;
    raise exception 'authenticated_user_profile_conflict';
  end if;
  if btrim(coalesce(p_first_name, '')) = '' or btrim(coalesce(p_last_name, '')) = '' then raise exception 'first_and_last_name_required'; end if;
  select count(*) into eligible_organization_count from public.organizations where active = true;
  if eligible_organization_count <> 1 then raise exception 'public_registration_organization_not_configured'; end if;
  select id into eligible_organization_id from public.organizations where active = true;
  insert into public.profiles (organization_id, auth_user_id, role, status, first_name, last_name, email, phone, birthdate)
  values (eligible_organization_id, auth.uid(), 'umpire', 'pending', btrim(p_first_name), btrim(p_last_name),
    lower(btrim(authenticated_user.email)), btrim(coalesce(p_phone, '')), p_birthdate)
  returning * into created_profile;
  insert into public.activities (organization_id, actor_profile_id, type, action, subject, message, metadata)
  values (created_profile.organization_id, created_profile.id, 'account', 'account_registered',
    concat_ws(' ', created_profile.first_name, created_profile.last_name),
    'Authenticated public umpire registration submitted for approval.', jsonb_build_object('registrationWorkflow', 'public-umpire'));
  perform public.notify_organization_administrators(created_profile.organization_id, 'registration-submitted',
    'Registration Awaiting Approval', concat(concat_ws(' ', created_profile.first_name, created_profile.last_name),
    ' has registered and is awaiting approval.'), 'accounts');
  return created_profile;
end;
$$;

revoke all on function public.provision_public_pending_umpire(text,text,text,date) from public, anon;
grant execute on function public.provision_public_pending_umpire(text,text,text,date) to authenticated;

drop function public.list_manageable_accounts();
create function public.list_manageable_accounts()
returns table (
  id uuid, auth_user_id uuid, organization_id uuid, role public.account_role,
  status public.account_status, first_name text, last_name text, email text,
  login_email text, contact_email text, phone text, birthdate date,
  personnel_id text, communication_preferences jsonb, approved_at timestamptz,
  rejected_at timestamptz, created_at timestamptz, crew_member_id uuid,
  identity_status text
)
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare actor_org uuid := public.current_organization_id();
begin
  if not public.is_administrator() then raise exception 'administrator_required'; end if;
  return query select p.id, p.auth_user_id, p.organization_id, p.role, p.status,
    p.first_name, p.last_name, lower(u.email), lower(u.email), c.email, p.phone,
    p.birthdate, p.personnel_id, p.communication_preferences, p.approved_at,
    p.rejected_at, p.created_at, c.id,
    case when u.id is null then 'conflict'
      when lower(p.email) is distinct from lower(u.email) then 'conflict'
      when p.role = 'umpire' and c.id is null then 'unlinked'
      when p.role = 'umpire' and (c.organization_id <> actor_org or not c.active) then 'conflict'
      when p.role = 'umpire' then 'linked' else 'not_applicable' end
  from public.profiles p
  left join auth.users u on u.id = p.auth_user_id
  left join public.crew_members c on c.profile_id = p.id and c.organization_id = actor_org
  where p.organization_id = actor_org
  order by p.status, p.last_name, p.first_name, p.id;
end;
$$;
revoke all on function public.list_manageable_accounts() from public, anon;
grant execute on function public.list_manageable_accounts() to authenticated;

-- Preserve existing null DOB accounts and restrict all official personnel fields.
create or replace function public.protect_profile_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' or public.is_administrator() then return new; end if;
  if old.auth_user_id <> auth.uid() then raise exception 'Profiles may only be updated by their owner or an administrator'; end if;
  if new.id is distinct from old.id or new.organization_id is distinct from old.organization_id
    or new.auth_user_id is distinct from old.auth_user_id or new.legacy_account_id is distinct from old.legacy_account_id
    or new.role is distinct from old.role or new.status is distinct from old.status
    or new.first_name is distinct from old.first_name or new.last_name is distinct from old.last_name
    or new.birthdate is distinct from old.birthdate or new.crew_code is distinct from old.crew_code
    or new.crew_code_issued_at is distinct from old.crew_code_issued_at
    or new.personnel_id is distinct from old.personnel_id or new.personnel_id_issued_at is distinct from old.personnel_id_issued_at
    or new.official_history is distinct from old.official_history or new.years_of_service_override is distinct from old.years_of_service_override
    or new.admin_notes is distinct from old.admin_notes or new.approved_at is distinct from old.approved_at
    or new.rejected_at is distinct from old.rejected_at or new.created_at is distinct from old.created_at then
    raise exception 'One or more profile fields are administrator-managed';
  end if;
  return new;
end;
$$;
