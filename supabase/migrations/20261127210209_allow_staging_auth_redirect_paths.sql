-- Supabase may retain same-origin callback material in redirect_to; validate
-- the exact HTTPS origin while allowing only paths, query strings, or fragments
-- beneath the V2 staging host.
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
  if v_site_url<>'https://the-slate-v2.pages.dev' then
    raise exception using errcode='42501',message='staging_auth_site_url_not_allowed';
  end if;
  if v_redirect !~ '^https://the-slate-v2[.]pages[.]dev([/?#].*)?$' then
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
