-- Supabase grants exposed-schema routines to API roles by default. Remove the
-- anonymous grants explicitly and cover actor foreign keys flagged by advisors.
revoke execute on function public.create_facility(text,text,text,text[],text,text) from anon;
revoke execute on function public.update_facility(uuid,text,text,text,text[],text,text) from anon;
revoke execute on function public.create_facility_field(uuid,text,text[],text,smallint,smallint,text) from anon;
revoke execute on function public.update_facility_field(uuid,text,text[],text,smallint,smallint,text) from anon;
revoke execute on function public.create_field_availability_rule(uuid,smallint,time,time,date,date) from anon;
revoke execute on function public.create_field_closure(uuid,text,text,timestamptz,timestamptz,text) from anon;
revoke execute on function public.save_field_reservation(uuid,uuid,text,text,timestamptz,timestamptz,uuid,text) from anon;
revoke execute on function public.cancel_field_reservation(uuid) from anon;

create index field_availability_rules_creator_idx on public.field_availability_rules (organization_id, created_by_profile_id);
create index field_closures_creator_idx on public.field_closures (organization_id, created_by_profile_id);
create index field_reservations_cancelled_by_idx on public.field_reservations (organization_id, cancelled_by_profile_id) where cancelled_by_profile_id is not null;
