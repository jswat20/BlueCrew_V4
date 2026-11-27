-- Cover the audit foreign key used when reviewing one-time Auth action claims.
create index staging_auth_email_captures_claimed_by_idx
  on private.staging_auth_email_captures(claimed_by_auth_user_id)
  where claimed_by_auth_user_id is not null;
