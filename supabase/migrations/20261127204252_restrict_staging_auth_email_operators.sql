-- Auth action capture is more sensitive than the ordinary application-email
-- sink. Require an explicitly provisioned operator in addition to workspace
-- administrator authorization.
create table private.staging_auth_email_operators (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  authorized_at timestamptz not null default clock_timestamp(),
  authorized_by text not null default current_user
);

revoke all on table private.staging_auth_email_operators from public,anon,authenticated;

create or replace function private.assert_staging_auth_email_operator()
returns uuid
language plpgsql stable security definer
set search_path=pg_catalog,public,private
as $$
declare v_auth_user_id uuid:=auth.uid();
begin
  perform private.assert_staging_email_administrator();
  if v_auth_user_id is null or not exists (
    select 1 from private.staging_auth_email_operators o
    where o.auth_user_id=v_auth_user_id
  ) then
    raise exception using errcode='42501',message='staging_auth_operator_forbidden';
  end if;
  return v_auth_user_id;
end;
$$;

create or replace function public.authorize_staging_auth_email_operator()
returns uuid
language sql stable security definer
set search_path=pg_catalog,public,private
as $$ select private.assert_staging_auth_email_operator() $$;

create or replace function public.get_staging_auth_email_capture_status()
returns table(recipient_email text,action_type text,created_at timestamptz,expires_at timestamptz,claimed boolean)
language plpgsql security definer
set search_path=pg_catalog,public,private
as $$
begin
  perform private.assert_staging_auth_email_operator();
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
  if p_claimed_by_auth_user_id is null or not exists (
    select 1 from private.staging_auth_email_operators o
    where o.auth_user_id=p_claimed_by_auth_user_id
  ) then
    raise exception using errcode='42501',message='staging_auth_operator_forbidden';
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

revoke all on function private.assert_staging_auth_email_operator() from public,anon,authenticated;
revoke all on function public.authorize_staging_auth_email_operator() from public,anon,authenticated;
revoke all on function public.get_staging_auth_email_capture_status() from public,anon,authenticated;
revoke all on function public.claim_staging_auth_email_action(text,text,uuid) from public,anon,authenticated;
grant execute on function public.authorize_staging_auth_email_operator() to authenticated;
grant execute on function public.get_staging_auth_email_capture_status() to authenticated;
grant execute on function public.claim_staging_auth_email_action(text,text,uuid) to service_role;
