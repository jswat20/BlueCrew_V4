drop policy if exists notifications_delete_manager on public.notifications;

create policy notifications_delete_manager_or_recipient
on public.notifications
for delete
to authenticated
using (
  organization_id = public.current_organization_id()
  and public.is_approved_account()
  and (
    public.is_assigner_or_administrator()
    or recipient_profile_id = public.current_profile_id()
  )
);
