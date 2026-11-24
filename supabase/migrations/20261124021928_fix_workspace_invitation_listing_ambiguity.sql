-- Qualify values returned by the expiration CTE. PL/pgSQL output-column
-- variables otherwise collide with the invitation column names at runtime.
create or replace function public.get_workspace_invitations()
returns table(
  invitation_id uuid,recipient_email text,role_code text,status text,
  issued_at timestamptz,expires_at timestamptz,accepted_at timestamptz,
  revoked_at timestamptz,regeneration_count integer
)
language plpgsql security definer
set search_path=pg_catalog,public
as $$
declare v_organization_id uuid := private.assert_workspace_invitation_administrator();
begin
  with newly_expired as (
    update public.workspace_invitations i set expired_at=now()
    where i.organization_id=v_organization_id and i.accepted_at is null
      and i.revoked_at is null and i.expired_at is null and i.expires_at<=now()
    returning i.id as expired_invitation_id,i.role_code as expired_role_code
  )
  insert into public.workspace_audit_events(organization_id,actor_auth_user_id,action,entity_type,entity_id,metadata)
  select v_organization_id,(select auth.uid()),'workspace.invitation_expired','workspace_invitation',
    expired.expired_invitation_id,jsonb_build_object('role',expired.expired_role_code)
  from newly_expired expired;

  return query select i.id,i.recipient_email,i.role_code,
    case when i.accepted_at is not null then 'accepted'
         when i.revoked_at is not null then 'revoked'
         when i.expired_at is not null or i.expires_at<=now() then 'expired'
         else 'pending' end,
    i.issued_at,i.expires_at,i.accepted_at,i.revoked_at,i.regeneration_count
  from public.workspace_invitations i
  where i.organization_id=v_organization_id
  order by i.issued_at desc,i.id;
end;
$$;

revoke all on function public.get_workspace_invitations() from public,anon,authenticated;
grant execute on function public.get_workspace_invitations() to authenticated;
