-- Private self-service profile photos. The canonical object name is auth.uid()/profile.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-photos', 'profile-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.enforce_profile_photo_path()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.photo_path is not null
    and (new.auth_user_id is null or new.photo_path <> new.auth_user_id::text || '/profile') then
    raise exception 'profile_photo_path_invalid';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_profile_photo_path() from public;
create trigger profiles_enforce_photo_path before insert or update of photo_path, auth_user_id on public.profiles
for each row execute function public.enforce_profile_photo_path();

create policy profile_photos_select_own on storage.objects for select to authenticated
using (bucket_id = 'profile-photos' and name = auth.uid()::text || '/profile');
create policy profile_photos_select_manager_in_organization on storage.objects for select to authenticated
using (
  bucket_id = 'profile-photos'
  and public.is_assigner_or_administrator()
  and exists (
    select 1 from public.profiles
    where profiles.organization_id = public.current_organization_id()
      and profiles.auth_user_id::text = split_part(storage.objects.name, '/', 1)
      and storage.objects.name = profiles.auth_user_id::text || '/profile'
  )
);
create policy profile_photos_insert_own on storage.objects for insert to authenticated
with check (bucket_id = 'profile-photos' and name = auth.uid()::text || '/profile');
create policy profile_photos_update_own on storage.objects for update to authenticated
using (bucket_id = 'profile-photos' and name = auth.uid()::text || '/profile')
with check (bucket_id = 'profile-photos' and name = auth.uid()::text || '/profile');
create policy profile_photos_delete_own on storage.objects for delete to authenticated
using (bucket_id = 'profile-photos' and name = auth.uid()::text || '/profile');
