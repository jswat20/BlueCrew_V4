-- Increment 7F: staging-only Supabase Auth email capture.
-- The hook replaces SMTP, rejects routable recipients and stores only an
-- encrypted token hash for a short-lived, one-time operator handoff. It never
-- stores a message body, action URL, OTP, password, or provider credential.

create table private.staging_auth_email_capture_keys (
  singleton boolean primary key default true check (singleton),
  encryption_key text not null,
  created_at timestamptz not null default clock_timestamp()
);

insert into private.staging_auth_email_capture_keys(singleton,encryption_key)
values (true,encode(extensions.gen_random_bytes(32),'hex'))
on conflict(singleton) do nothing;

create table private.staging_auth_email_captures (
  id uuid primary key default extensions.gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  recipient_email text not null check (lower(recipient_email) like '%@slate.invalid'),
  action_type text not null check (action_type in (
    'signup','recovery','invite','magiclink','reauthentication',
    'password_changed_notification','email_changed_notification',
    'identity_linked_notification','identity_unlinked_notification',
    'mfa_factor_enrolled_notification','mfa_factor_unenrolled_notification'
  )),
  encrypted_token_hash bytea,
  redirect_to text not null,
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null default (clock_timestamp()+interval '15 minutes'),
  claimed_at timestamptz,
  claimed_by_auth_user_id uuid references auth.users(id) on delete set null,
  check (
    (action_type in ('signup','recovery','invite','magiclink','reauthentication') and encrypted_token_hash is not null)
    or (action_type like '%_notification' and encrypted_token_hash is null)
  )
);

create index staging_auth_email_captures_pending_idx
  on private.staging_auth_email_captures(recipient_email,action_type,created_at desc)
  where claimed_at is null;

revoke all on table private.staging_auth_email_capture_keys from public,anon,authenticated;
revoke all on table private.staging_auth_email_captures from public,anon,authenticated;
grant usage on schema private to supabase_auth_admin;
grant select on table private.staging_auth_email_capture_keys to supabase_auth_admin;
grant insert on table private.staging_auth_email_captures to supabase_auth_admin;

create or replace function private.staging_auth_send_email_hook(event jsonb)
returns jsonb
language plpgsql
set search_path=pg_catalog,extensions,private
as $$
declare
  v_email text:=lower(btrim(event->'user'->>'email'));
  v_user_id uuid;
  v_action text:=event->'email_data'->>'email_action_type';
  v_token_hash text:=event->'email_data'->>'token_hash';
  v_site_url text:=rtrim(coalesce(event->'email_data'->>'site_url',''),'/');
  v_redirect text:=rtrim(coalesce(nullif(event->'email_data'->>'redirect_to',''),event->'email_data'->>'site_url',''),'/');
  v_key text;
begin
  if current_user<>'supabase_auth_admin' then
    raise exception using errcode='42501',message='staging_auth_hook_forbidden';
  end if;
  if v_email is null or v_email not like '%@slate.invalid' then
    raise exception using errcode='42501',message='staging_auth_recipient_not_allowed';
  end if;
  if v_site_url<>'https://the-slate-v2.pages.dev' or v_redirect<>'https://the-slate-v2.pages.dev' then
    raise exception using errcode='42501',message='staging_auth_redirect_not_allowed';
  end if;
  if v_action='email_change' then
    raise exception using errcode='0A000',message='staging_auth_email_change_disabled';
  end if;
  if v_action not in (
    'signup','recovery','invite','magiclink','reauthentication',
    'password_changed_notification','email_changed_notification',
    'identity_linked_notification','identity_unlinked_notification',
    'mfa_factor_enrolled_notification','mfa_factor_unenrolled_notification'
  ) then
    raise exception using errcode='0A000',message='staging_auth_action_not_supported';
  end if;
  v_user_id:=(event->'user'->>'id')::uuid;
  if v_action not like '%_notification' and coalesce(v_token_hash,'')='' then
    raise exception using errcode='22023',message='staging_auth_token_missing';
  end if;
  select encryption_key into strict v_key
  from private.staging_auth_email_capture_keys where singleton;

  insert into private.staging_auth_email_captures(
    auth_user_id,recipient_email,action_type,encrypted_token_hash,redirect_to
  ) values (
    v_user_id,v_email,v_action,
    case when v_token_hash='' or v_token_hash is null then null
      else extensions.pgp_sym_encrypt(v_token_hash,v_key,'cipher-algo=aes256,compress-algo=0') end,
    v_redirect
  );
  return '{}'::jsonb;
end;
$$;

revoke all on function private.staging_auth_send_email_hook(jsonb) from public,anon,authenticated;
grant execute on function private.staging_auth_send_email_hook(jsonb) to supabase_auth_admin;

create or replace function public.authorize_staging_auth_email_operator()
returns uuid
language sql stable security definer
set search_path=pg_catalog,public,private
as $$ select private.assert_staging_email_administrator() $$;

create or replace function public.get_staging_auth_email_capture_status()
returns table(recipient_email text,action_type text,created_at timestamptz,expires_at timestamptz,claimed boolean)
language plpgsql security definer
set search_path=pg_catalog,public,private
as $$
begin
  perform private.assert_staging_email_administrator();
  return query
  select c.recipient_email,c.action_type,c.created_at,c.expires_at,c.claimed_at is not null
  from private.staging_auth_email_captures c
  where c.created_at>clock_timestamp()-interval '24 hours'
  order by c.created_at desc limit 50;
end;
$$;

create or replace function public.claim_staging_auth_email_action(
  p_recipient_email text,p_action_type text,p_claimed_by_auth_user_id uuid
) returns table(capture_id uuid,token_hash text,redirect_to text)
language plpgsql security definer
set search_path=pg_catalog,extensions,public,private
as $$
declare
  v_capture private.staging_auth_email_captures%rowtype;
  v_key text;
begin
  if coalesce((select auth.jwt()->>'role'),'')<>'service_role' then
    raise exception using errcode='42501',message='staging_auth_capture_forbidden';
  end if;
  if p_claimed_by_auth_user_id is null then
    raise exception using errcode='22023',message='staging_auth_operator_missing';
  end if;
  select * into v_capture
  from private.staging_auth_email_captures
  where recipient_email=lower(btrim(p_recipient_email))
    and action_type=p_action_type and claimed_at is null and expires_at>clock_timestamp()
  order by created_at desc for update skip locked limit 1;
  if not found then
    raise exception using errcode='P0001',message='staging_auth_action_unavailable';
  end if;
  select encryption_key into strict v_key
  from private.staging_auth_email_capture_keys where singleton;
  update private.staging_auth_email_captures
    set claimed_at=clock_timestamp(),claimed_by_auth_user_id=p_claimed_by_auth_user_id
  where id=v_capture.id;
  return query select v_capture.id,
    extensions.pgp_sym_decrypt(v_capture.encrypted_token_hash,v_key),
    v_capture.redirect_to;
end;
$$;

revoke all on function public.authorize_staging_auth_email_operator() from public,anon,authenticated;
revoke all on function public.get_staging_auth_email_capture_status() from public,anon,authenticated;
revoke all on function public.claim_staging_auth_email_action(text,text,uuid) from public,anon,authenticated;
grant execute on function public.authorize_staging_auth_email_operator() to authenticated;
grant execute on function public.get_staging_auth_email_capture_status() to authenticated;
grant execute on function public.claim_staging_auth_email_action(text,text,uuid) to service_role;

comment on function private.staging_auth_send_email_hook(jsonb) is
  'Staging-only Auth email hook. Never sends mail or stores message bodies, OTPs, action URLs, or plaintext token hashes.';
