-- SECURITY DEFINER changes current_user to the function owner; caller
-- authorization therefore belongs to the exact EXECUTE grant and to the
-- SECURITY INVOKER hook's explicit supabase_auth_admin check.
create or replace function private.encrypt_staging_auth_token(p_token_hash text)
returns bytea
language plpgsql
security definer
set search_path=pg_catalog,extensions,private
as $$
declare
  v_key text;
begin
  if coalesce(p_token_hash,'')='' then
    raise exception using errcode='22023',message='staging_auth_token_missing';
  end if;
  select encryption_key into strict v_key
  from private.staging_auth_email_capture_keys
  where singleton;
  return extensions.pgp_sym_encrypt(
    p_token_hash,v_key,'cipher-algo=aes256,compress-algo=0'
  );
end;
$$;

revoke all on function private.encrypt_staging_auth_token(text)
  from public,anon,authenticated,service_role;
grant execute on function private.encrypt_staging_auth_token(text)
  to supabase_auth_admin;
