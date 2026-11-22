-- RLS does not protect TRUNCATE. Remove every Data API default grant and return
-- only the SELECT privilege required by the membership-aware browser reads.
revoke all on public.organization_memberships,
  public.organization_membership_roles,
  public.organization_module_entitlements,
  public.workspace_audit_events from public, anon, authenticated;

grant select on public.organization_memberships,
  public.organization_membership_roles,
  public.organization_module_entitlements,
  public.workspace_audit_events to authenticated;
