create index staging_email_captures_organization_captured_idx
  on private.staging_email_captures (organization_id,captured_at desc);
