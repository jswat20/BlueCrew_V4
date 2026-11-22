-- Explicit browser-role revocation is required because this staging project
-- auto-grants Data API privileges on new public functions.
revoke all on function public.get_workspace_context() from public, anon, authenticated;
grant execute on function public.get_workspace_context() to authenticated;

revoke all on function public.provision_saas_workspace(text, text, text, text[], uuid)
  from public, anon, authenticated;
grant execute on function public.provision_saas_workspace(text, text, text, text[], uuid)
  to service_role;

create index organization_memberships_profile_idx
  on public.organization_memberships (organization_id, profile_id)
  where profile_id is not null;
create index organization_memberships_inviter_idx
  on public.organization_memberships (invited_by_auth_user_id)
  where invited_by_auth_user_id is not null;
create index organization_membership_roles_grantor_idx
  on public.organization_membership_roles (organization_id, granted_by_membership_id)
  where granted_by_membership_id is not null;
create index workspace_audit_events_actor_idx
  on public.workspace_audit_events (actor_auth_user_id)
  where actor_auth_user_id is not null;
