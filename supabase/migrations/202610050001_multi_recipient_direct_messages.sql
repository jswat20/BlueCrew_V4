-- Each selected umpire keeps a private thread and the existing receipt/email path.
-- A single transaction prevents partial sends when any recipient is ineligible.
create or replace function public.send_direct_messages(
  p_body text,
  p_umpire_profile_ids uuid[],
  p_subject text default ''
)
returns uuid[]
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_recipient uuid;
  v_messages uuid[] := array[]::uuid[];
begin
  if public.current_profile_id() is null
    or public.current_organization_id() is null
    or public.current_account_role() is distinct from 'administrator'::public.account_role then
    raise exception using errcode = 'P0001', message = 'messaging_forbidden';
  end if;
  if coalesce(cardinality(p_umpire_profile_ids), 0) = 0
    or array_position(p_umpire_profile_ids, null) is not null then
    raise exception using errcode = 'P0001', message = 'messaging_recipients_required';
  end if;
  for v_recipient in select distinct unnest(p_umpire_profile_ids) order by 1 loop
    v_messages := array_append(v_messages, public.send_direct_message(p_body, v_recipient, p_subject, null));
  end loop;
  return v_messages;
end;
$$;
revoke all on function public.send_direct_messages(text, uuid[], text) from public, anon;
grant execute on function public.send_direct_messages(text, uuid[], text) to authenticated;
