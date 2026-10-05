-- Deletion is per participant; authoritative messages and email history stay intact.
create table public.message_deletions (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  message_id uuid references public.messages(id) on delete cascade,
  announcement_id uuid references public.message_announcements(id) on delete cascade,
  check (num_nonnulls(message_id, announcement_id) = 1),
  unique(profile_id, message_id), unique(profile_id, announcement_id)
);
alter table public.message_deletions enable row level security;
revoke all on public.message_deletions from anon, authenticated;
create or replace function public.delete_message_for_me(p_message_id uuid default null, p_announcement_id uuid default null)
returns void language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare v_actor uuid := public.current_profile_id(); v_org uuid := public.current_organization_id(); v_role public.account_role := public.current_account_role();
begin
  if v_actor is null or v_org is null or v_role not in ('administrator','umpire') then raise exception 'messaging_forbidden'; end if;
  if num_nonnulls(p_message_id,p_announcement_id) <> 1 then raise exception 'message_required'; end if;
  if p_message_id is not null then
    if not exists(select 1 from public.messages m join public.message_conversations c on c.id=m.conversation_id and c.organization_id=m.organization_id where m.id=p_message_id and m.organization_id=v_org and (v_role='administrator' or c.umpire_profile_id=v_actor)) then raise exception 'message_unavailable'; end if;
  else
    if not exists(select 1 from public.message_announcements a where a.id=p_announcement_id and a.organization_id=v_org and (v_role='administrator' or exists(select 1 from public.message_announcement_recipients r where r.announcement_id=a.id and r.recipient_profile_id=v_actor))) then raise exception 'message_unavailable'; end if;
  end if;
  insert into public.message_deletions(profile_id,message_id,announcement_id) values(v_actor,p_message_id,p_announcement_id) on conflict do nothing;
end; $$;
revoke all on function public.delete_message_for_me(uuid,uuid) from public,anon;
grant execute on function public.delete_message_for_me(uuid,uuid) to authenticated;

create or replace function public.get_message_center()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_actor uuid := public.current_profile_id();
  v_org uuid := public.current_organization_id();
  v_role public.account_role := public.current_account_role();
begin
  if v_actor is null or v_org is null or v_role not in ('administrator', 'umpire') then
    raise exception using errcode = 'P0001', message = 'messaging_forbidden';
  end if;
  return jsonb_build_object(
    'conversations', coalesce((select jsonb_agg(jsonb_build_object(
      'id', c.id, 'umpireProfileId', c.umpire_profile_id,
      'umpireName', concat_ws(' ', p.first_name, p.last_name), 'subject', c.subject,
      'updatedAt', c.updated_at,
      'unreadCount', (select count(*) from public.messages m join public.message_receipts r on r.message_id = m.id
        where m.conversation_id = c.id and r.recipient_profile_id = v_actor and r.read_at is null and not exists(select 1 from public.message_deletions x where x.profile_id=v_actor and x.message_id=m.id)),
      'messages', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'senderProfileId', m.sender_profile_id,
        'senderName', concat_ws(' ', sp.first_name, sp.last_name), 'senderRole', sp.role,
        'body', m.body, 'announcementId', m.announcement_id, 'createdAt', m.created_at) order by m.created_at, m.id)
        from public.messages m join public.profiles sp on sp.id = m.sender_profile_id and sp.organization_id = m.organization_id
        where m.conversation_id = c.id and m.organization_id = v_org and not exists(select 1 from public.message_deletions x where x.profile_id=v_actor and x.message_id=m.id)), '[]'::jsonb)
    ) order by c.updated_at desc) from public.message_conversations c join public.profiles p
      on p.id = c.umpire_profile_id and p.organization_id = c.organization_id
      where exists(select 1 from public.messages vm where vm.conversation_id=c.id and not exists(select 1 from public.message_deletions x where x.profile_id=v_actor and x.message_id=vm.id)) and c.organization_id = v_org and (v_role = 'administrator' or c.umpire_profile_id = v_actor)), '[]'::jsonb),
    'announcements', coalesce((select jsonb_agg(jsonb_build_object(
      'id', a.id, 'subject', a.subject, 'body', a.body, 'targetType', a.target_type, 'targetValue', a.target_value,
      'createdAt', a.created_at, 'recipientCount', (select count(*) from public.message_announcement_recipients ar where ar.announcement_id = a.id),
      'viewedCount', (select count(*) from public.message_announcement_recipients ar where ar.announcement_id = a.id and ar.read_at is not null),
      'read', exists (select 1 from public.message_announcement_recipients ar where ar.announcement_id = a.id and ar.recipient_profile_id = v_actor and ar.read_at is not null)
    ) order by a.created_at desc) from public.message_announcements a where not exists(select 1 from public.message_deletions x where x.profile_id=v_actor and x.announcement_id=a.id) and a.organization_id = v_org
      and (v_role = 'administrator' or exists (select 1 from public.message_announcement_recipients ar
        where ar.announcement_id = a.id and ar.recipient_profile_id = v_actor))), '[]'::jsonb),
    'recipients', case when v_role = 'administrator' then coalesce((select jsonb_agg(jsonb_build_object(
      'profileId', p.id, 'name', concat_ws(' ', p.first_name, p.last_name), 'eligibleLevels', c.eligible_levels
    ) order by p.last_name, p.first_name) from public.profiles p join public.crew_members c
      on c.organization_id = p.organization_id and c.profile_id = p.id where p.organization_id = v_org
      and p.role = 'umpire' and p.status = 'approved' and c.active), '[]'::jsonb) else '[]'::jsonb end
  );
end;
$$;
