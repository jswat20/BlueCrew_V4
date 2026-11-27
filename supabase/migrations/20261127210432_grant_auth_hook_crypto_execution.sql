-- The SECURITY INVOKER hook needs only this exact pgcrypto call; keep all
-- capture tables and decryption unavailable to the Auth service role.
grant usage on schema extensions to supabase_auth_admin;
grant execute on function extensions.pgp_sym_encrypt(text,text,text) to supabase_auth_admin;
