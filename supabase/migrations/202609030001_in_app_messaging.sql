-- The Slate V1 in-app messaging: private administrator/umpire threads and
-- recipient-snapshotted announcements. Browser mutations are RPC-only.

create table public.message_conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  umpire_profile_id uuid not null,
  created_by_profile_id uuid not null,
  subject text not null default '' check (length(subject) <= 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, umpire_profile_id),
  unique (organization_id, id),
  foreign key (organization_id, umpire_profile_id) references public.profiles(organization_id, id) on delete cascade,
  foreign key (organization_id, created_by_profile_id) references public.profiles(organization_id, id) on delete restrict
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  conversation_id uuid not null,
  sender_profile_id uuid not null,
  body text not null check (btrim(body) <> '' and length(body) <= 5000),
  announcement_id uuid,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, conversation_id) references public.message_conversations(organization_id, id) on delete cascade,
  foreign key (organization_id, sender_profile_id) references public.profiles(organization_id, id) on delete restrict
);

create table public.message_receipts (
  message_id uuid not null,
  organization_id uuid not null,
  recipient_profile_id uuid not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (message_id, recipient_profile_id),
  foreign key (organization_id, message_id) references public.messages(organization_id, id) on delete cascade,
  foreign key (organization_id, recipient_profile_id) references public.profiles(organization_id, id) on delete cascade
);

create table public.message_announcements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sender_profile_id uuid not null,
  target_type text not null check (target_type in ('all_umpires', 'eligible_level')),
  target_value text,
  subject text not null check (btrim(subject) <> '' and length(subject) <= 160),
  body text not null check (btrim(body) <> '' and length(body) <= 5000),
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, sender_profile_id) references public.profiles(organization_id, id) on delete restrict,
  check ((target_type = 'all_umpires' and target_value is null) or (target_type = 'eligible_level' and btrim(coalesce(target_value, '')) <> ''))
);

alter table public.messages
  add constraint messages_announcement_fk
  foreign key (organization_id, announcement_id)
  references public.message_announcements(organization_id, id) on delete restrict;

create table public.message_announcement_recipients (
  announcement_id uuid not null,
  organization_id uuid not null,
  recipient_profile_id uuid not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (announcement_id, recipient_profile_id),
  foreign key (organization_id, announcement_id) references public.message_announcements(organization_id, id) on delete cascade,
  foreign key (organization_id, recipient_profile_id) references public.profiles(organization_id, id) on delete cascade
);

create index message_conversations_umpire_idx on public.message_conversations (organization_id, umpire_profile_id, updated_at desc);
create index messages_conversation_idx on public.messages (organization_id, conversation_id, created_at, id);
create index message_receipts_unread_idx on public.message_receipts (organization_id, recipient_profile_id, created_at desc) where read_at is null;
create index message_announcements_created_idx on public.message_announcements (organization_id, created_at desc);
create index message_announcement_recipients_unread_idx on public.message_announcement_recipients (organization_id, recipient_profile_id, created_at desc) where read_at is null;

create trigger message_conversations_set_updated_at before update on public.message_conversations
for each row execute function public.set_updated_at();

alter table public.message_conversations enable row level security;
alter table public.messages enable row level security;
alter table public.message_receipts enable row level security;
alter table public.message_announcements enable row level security;
alter table public.message_announcement_recipients enable row level security;

create policy message_conversations_select_authorized on public.message_conversations
for select to authenticated using (
  organization_id = public.current_organization_id()
  and (public.is_administrator() or umpire_profile_id = public.current_profile_id())
);

create policy messages_select_authorized on public.messages
for select to authenticated using (
  organization_id = public.current_organization_id()
  and exists (
    select 1 from public.message_conversations c
    where c.id = conversation_id and c.organization_id = messages.organization_id
      and (public.is_administrator() or c.umpire_profile_id = public.current_profile_id())
  )
);

create policy message_receipts_select_authorized on public.message_receipts
for select to authenticated using (
  organization_id = public.current_organization_id()
  and (recipient_profile_id = public.current_profile_id() or public.is_administrator())
);

create policy message_announcements_select_authorized on public.message_announcements
for select to authenticated using (
  organization_id = public.current_organization_id()
  and (public.is_administrator() or exists (
    select 1 from public.message_announcement_recipients r
    where r.announcement_id = id and r.organization_id = message_announcements.organization_id
      and r.recipient_profile_id = public.current_profile_id()
  ))
);

create policy message_announcement_recipients_select_authorized on public.message_announcement_recipients
for select to authenticated using (
  organization_id = public.current_organization_id()
  and (recipient_profile_id = public.current_profile_id() or public.is_administrator())
);

revoke all on public.message_conversations, public.messages, public.message_receipts,
  public.message_announcements, public.message_announcement_recipients from anon, authenticated;
grant select on public.message_conversations, public.messages, public.message_receipts,
  public.message_announcements, public.message_announcement_recipients to authenticated;

create or replace function public.send_direct_message(
  p_body text,
  p_umpire_profile_id uuid default null,
  p_subject text default '',
  p_announcement_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_actor uuid := public.current_profile_id();
  v_org uuid := public.current_organization_id();
  v_role public.account_role := public.current_account_role();
  v_umpire uuid;
  v_conversation uuid;
  v_message uuid;
begin
  if v_actor is null or v_org is null or v_role not in ('administrator', 'umpire') then
    raise exception using errcode = 'P0001', message = 'messaging_forbidden';
  end if;
  if btrim(coalesce(p_body, '')) = '' or length(p_body) > 5000 then
    raise exception using errcode = 'P0001', message = 'message_body_invalid';
  end if;

  v_umpire := case when v_role = 'umpire' then v_actor else p_umpire_profile_id end;
  if not exists (
    select 1 from public.profiles p join public.crew_members c
      on c.organization_id = p.organization_id and c.profile_id = p.id
    where p.id = v_umpire and p.organization_id = v_org and p.role = 'umpire'
      and p.status = 'approved' and c.active
  ) then
    raise exception using errcode = 'P0001', message = 'messaging_umpire_not_eligible';
  end if;

  if p_announcement_id is not null and not exists (
    select 1 from public.message_announcement_recipients r
    where r.announcement_id = p_announcement_id and r.organization_id = v_org
      and r.recipient_profile_id = v_umpire
  ) then
    raise exception using errcode = 'P0001', message = 'announcement_reply_forbidden';
  end if;

  insert into public.message_conversations (organization_id, umpire_profile_id, created_by_profile_id, subject)
  values (v_org, v_umpire, v_actor, left(btrim(coalesce(p_subject, '')), 160))
  on conflict (organization_id, umpire_profile_id) do update
    set subject = case when btrim(excluded.subject) <> '' then excluded.subject else message_conversations.subject end,
        updated_at = now()
  returning id into v_conversation;

  insert into public.messages (organization_id, conversation_id, sender_profile_id, body, announcement_id)
  values (v_org, v_conversation, v_actor, btrim(p_body), p_announcement_id)
  returning id into v_message;

  if v_role = 'administrator' then
    insert into public.message_receipts (message_id, organization_id, recipient_profile_id)
    values (v_message, v_org, v_umpire);
  else
    insert into public.message_receipts (message_id, organization_id, recipient_profile_id)
    select v_message, v_org, p.id from public.profiles p
    where p.organization_id = v_org and p.role = 'administrator' and p.status = 'approved';
  end if;

  update public.message_conversations set updated_at = now() where id = v_conversation and organization_id = v_org;
  return v_message;
end;
$$;

create or replace function public.send_message_announcement(
  p_target_type text,
  p_target_value text,
  p_subject text,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_actor uuid := public.current_profile_id();
  v_org uuid := public.current_organization_id();
  v_announcement uuid;
  v_count integer;
begin
  if v_actor is null or v_org is null or not public.is_administrator() then
    raise exception using errcode = 'P0001', message = 'announcement_forbidden';
  end if;
  if p_target_type not in ('all_umpires', 'eligible_level')
    or (p_target_type = 'eligible_level' and btrim(coalesce(p_target_value, '')) = '') then
    raise exception using errcode = 'P0001', message = 'announcement_target_invalid';
  end if;
  if btrim(coalesce(p_subject, '')) = '' or length(p_subject) > 160
    or btrim(coalesce(p_body, '')) = '' or length(p_body) > 5000 then
    raise exception using errcode = 'P0001', message = 'announcement_content_invalid';
  end if;

  insert into public.message_announcements (organization_id, sender_profile_id, target_type, target_value, subject, body)
  values (v_org, v_actor, p_target_type, case when p_target_type = 'eligible_level' then btrim(p_target_value) end,
    btrim(p_subject), btrim(p_body)) returning id into v_announcement;

  insert into public.message_announcement_recipients (announcement_id, organization_id, recipient_profile_id)
  select v_announcement, v_org, p.id
  from public.profiles p join public.crew_members c
    on c.organization_id = p.organization_id and c.profile_id = p.id
  where p.organization_id = v_org and p.role = 'umpire' and p.status = 'approved' and c.active
    and (p_target_type = 'all_umpires' or exists (
      select 1 from unnest(c.eligible_levels) level
      where lower(btrim(level)) = lower(btrim(p_target_value))
    ));
  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception using errcode = 'P0001', message = 'announcement_has_no_recipients';
  end if;
  return v_announcement;
end;
$$;

create or replace function public.mark_message_center_read(
  p_conversation_id uuid default null,
  p_announcement_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_actor uuid := public.current_profile_id();
  v_org uuid := public.current_organization_id();
begin
  if v_actor is null or v_org is null or public.current_account_role() not in ('administrator', 'umpire') then
    raise exception using errcode = 'P0001', message = 'messaging_forbidden';
  end if;
  if p_conversation_id is not null then
    if not exists (select 1 from public.message_conversations c where c.id = p_conversation_id
      and c.organization_id = v_org and (public.is_administrator() or c.umpire_profile_id = v_actor)) then
      raise exception using errcode = 'P0001', message = 'conversation_forbidden';
    end if;
    update public.message_receipts r set read_at = coalesce(r.read_at, now())
    from public.messages m where m.id = r.message_id and m.organization_id = v_org
      and m.conversation_id = p_conversation_id and r.recipient_profile_id = v_actor
      and r.read_at is null;
  end if;
  if p_announcement_id is not null then
    update public.message_announcement_recipients set read_at = coalesce(read_at, now())
    where announcement_id = p_announcement_id and organization_id = v_org
      and recipient_profile_id = v_actor and read_at is null;
  end if;
end;
$$;

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
        where m.conversation_id = c.id and r.recipient_profile_id = v_actor and r.read_at is null),
      'messages', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'senderProfileId', m.sender_profile_id,
        'senderName', concat_ws(' ', sp.first_name, sp.last_name), 'senderRole', sp.role,
        'body', m.body, 'announcementId', m.announcement_id, 'createdAt', m.created_at) order by m.created_at, m.id)
        from public.messages m join public.profiles sp on sp.id = m.sender_profile_id and sp.organization_id = m.organization_id
        where m.conversation_id = c.id and m.organization_id = v_org), '[]'::jsonb)
    ) order by c.updated_at desc) from public.message_conversations c join public.profiles p
      on p.id = c.umpire_profile_id and p.organization_id = c.organization_id
      where c.organization_id = v_org and (v_role = 'administrator' or c.umpire_profile_id = v_actor)), '[]'::jsonb),
    'announcements', coalesce((select jsonb_agg(jsonb_build_object(
      'id', a.id, 'subject', a.subject, 'body', a.body, 'targetType', a.target_type, 'targetValue', a.target_value,
      'createdAt', a.created_at, 'recipientCount', (select count(*) from public.message_announcement_recipients ar where ar.announcement_id = a.id),
      'viewedCount', (select count(*) from public.message_announcement_recipients ar where ar.announcement_id = a.id and ar.read_at is not null),
      'read', exists (select 1 from public.message_announcement_recipients ar where ar.announcement_id = a.id and ar.recipient_profile_id = v_actor and ar.read_at is not null)
    ) order by a.created_at desc) from public.message_announcements a where a.organization_id = v_org
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

revoke all on function public.send_direct_message(text, uuid, text, uuid) from public, anon;
revoke all on function public.send_message_announcement(text, text, text, text) from public, anon;
revoke all on function public.mark_message_center_read(uuid, uuid) from public, anon;
revoke all on function public.get_message_center() from public, anon;
grant execute on function public.send_direct_message(text, uuid, text, uuid) to authenticated;
grant execute on function public.send_message_announcement(text, text, text, text) to authenticated;
grant execute on function public.mark_message_center_read(uuid, uuid) to authenticated;
grant execute on function public.get_message_center() to authenticated;

-- Realtime still honors each subscriber's SELECT policy.
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.message_receipts;
alter publication supabase_realtime add table public.message_announcements;
alter publication supabase_realtime add table public.message_announcement_recipients;
