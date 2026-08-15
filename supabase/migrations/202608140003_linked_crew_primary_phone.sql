-- A linked umpire's profile is the single source of truth for primary/cell phone.
-- Unlinked roster records retain crew_members.phone until an identity is linked.
create or replace function public.update_crew_member(
  p_crew_member_id uuid,
  p_first_name text,
  p_last_name text,
  p_contact_email text,
  p_primary_phone text,
  p_active boolean,
  p_eligible_levels text[],
  p_preferences jsonb,
  p_notes text
)
returns public.crew_members
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  actor_org uuid := public.current_organization_id();
  target public.crew_members%rowtype;
begin
  if not public.is_administrator() then
    raise exception 'administrator_required';
  end if;

  select * into target
  from public.crew_members
  where id = p_crew_member_id and organization_id = actor_org
  for update;

  if not found then
    raise exception 'crew_member_not_found';
  end if;

  if target.profile_id is not null then
    update public.profiles
       set phone = btrim(coalesce(p_primary_phone, ''))
     where id = target.profile_id and organization_id = actor_org;
    if not found then raise exception 'linked_profile_not_found'; end if;
  else
    target.phone := btrim(coalesce(p_primary_phone, ''));
  end if;

  update public.crew_members
     set first_name = btrim(coalesce(p_first_name, '')),
         last_name = btrim(coalesce(p_last_name, '')),
         email = btrim(coalesce(p_contact_email, '')),
         phone = case when target.profile_id is null then target.phone else phone end,
         active = coalesce(p_active, true),
         eligible_levels = coalesce(p_eligible_levels, array[]::text[]),
         preferences = coalesce(p_preferences, '{}'::jsonb),
         notes = btrim(coalesce(p_notes, ''))
   where id = target.id
   returning * into target;

  return target;
end;
$$;

revoke all on function public.update_crew_member(uuid,text,text,text,text,boolean,text[],jsonb,text) from public, anon;
grant execute on function public.update_crew_member(uuid,text,text,text,text,boolean,text[],jsonb,text) to authenticated;
