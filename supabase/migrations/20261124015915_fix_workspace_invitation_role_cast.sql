create or replace function public.accept_workspace_invitation(p_token text)
returns jsonb
language plpgsql security definer
set search_path=pg_catalog,extensions,public,auth
as $$
declare
  v_actor uuid := (select auth.uid());
  v_user auth.users%rowtype;
  v_invitation public.workspace_invitations%rowtype;
  v_source public.profiles%rowtype;
  v_profile_id uuid;
  v_membership_id uuid;
begin
  if v_actor is null then raise exception using errcode='42501',message='authentication_required'; end if;
  select * into v_user from auth.users where id=v_actor;
  if not found or v_user.email_confirmed_at is null then
    raise exception using errcode='42501',message='verified_email_required';
  end if;
  if length(coalesce(p_token,''))<>64 then
    return jsonb_build_object('accepted',false,'code','invitation_invalid');
  end if;
  select * into v_invitation from public.workspace_invitations
  where token_digest=extensions.digest(convert_to(p_token,'utf8'),'sha256') for update;
  if not found then return jsonb_build_object('accepted',false,'code','invitation_invalid'); end if;
  if v_invitation.accepted_at is not null then return jsonb_build_object('accepted',false,'code','invitation_already_accepted'); end if;
  if v_invitation.revoked_at is not null then return jsonb_build_object('accepted',false,'code','invitation_revoked'); end if;
  if v_invitation.expired_at is not null or v_invitation.expires_at<=now() then
    if v_invitation.expired_at is null then
      update public.workspace_invitations set expired_at=now() where id=v_invitation.id;
      insert into public.workspace_audit_events(organization_id,actor_auth_user_id,action,entity_type,entity_id,metadata)
      values(v_invitation.organization_id,v_actor,'workspace.invitation_expired','workspace_invitation',v_invitation.id,
        jsonb_build_object('role',v_invitation.role_code));
    end if;
    return jsonb_build_object('accepted',false,'code','invitation_expired');
  end if;
  if lower(v_user.email)<>v_invitation.recipient_email then
    return jsonb_build_object('accepted',false,'code','invitation_recipient_mismatch');
  end if;
  if exists(select 1 from public.organization_memberships where organization_id=v_invitation.organization_id and auth_user_id=v_actor) then
    return jsonb_build_object('accepted',false,'code','invitation_membership_exists');
  end if;

  select * into v_source from public.profiles where auth_user_id=v_actor
  order by (status='approved') desc,created_at,id limit 1;
  insert into public.profiles(
    organization_id,auth_user_id,role,status,first_name,last_name,email,phone,home_phone,address,
    contact_preference,emergency_contact,emergency_contact_phone,communication_preferences,approved_at
  ) values (
    v_invitation.organization_id,v_actor,v_invitation.role_code::public.account_role,'approved',
    coalesce(nullif(v_source.first_name,''),nullif(v_user.raw_user_meta_data->>'first_name',''),'Invited'),
    coalesce(nullif(v_source.last_name,''),nullif(v_user.raw_user_meta_data->>'last_name',''),'User'),
    lower(v_user.email),coalesce(v_source.phone,''),coalesce(v_source.home_phone,''),coalesce(v_source.address,''),
    coalesce(v_source.contact_preference,'text'),coalesce(v_source.emergency_contact,''),
    coalesce(v_source.emergency_contact_phone,''),coalesce(v_source.communication_preferences,'{}'::jsonb),now()
  ) returning id into v_profile_id;
  if v_invitation.role_code='umpire' then
    insert into public.crew_members(organization_id,profile_id,first_name,last_name,email,phone,active)
    select v_invitation.organization_id,v_profile_id,p.first_name,p.last_name,p.email,p.phone,true
    from public.profiles p where p.id=v_profile_id;
  end if;
  select id into strict v_membership_id from public.organization_memberships
  where organization_id=v_invitation.organization_id and auth_user_id=v_actor and profile_id=v_profile_id and status='approved';
  update public.workspace_invitations set accepted_at=now(),accepted_by_auth_user_id=v_actor where id=v_invitation.id;
  insert into public.user_workspace_contexts(auth_user_id,organization_id,membership_id,selected_at,last_validated_at)
  values(v_actor,v_invitation.organization_id,v_membership_id,now(),now())
  on conflict(auth_user_id) do update set organization_id=excluded.organization_id,
    membership_id=excluded.membership_id,selected_at=excluded.selected_at,last_validated_at=excluded.last_validated_at;
  insert into public.workspace_audit_events(organization_id,actor_auth_user_id,action,entity_type,entity_id,metadata)
  values(v_invitation.organization_id,v_actor,'workspace.invitation_accepted','workspace_invitation',v_invitation.id,
    jsonb_build_object('role',v_invitation.role_code,'profile_id',v_profile_id,'membership_id',v_membership_id));
  return jsonb_build_object('accepted',true,'organization_id',v_invitation.organization_id,
    'membership_id',v_membership_id,'profile_id',v_profile_id,'role',v_invitation.role_code);
end;
$$;

revoke all on function public.accept_workspace_invitation(text) from public,anon,authenticated;
grant execute on function public.accept_workspace_invitation(text) to authenticated;
