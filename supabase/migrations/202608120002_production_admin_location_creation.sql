create or replace function public.create_location_complex(p_name text)
returns public.locations language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_row public.locations%rowtype;
begin
  if not public.is_administrator() then raise exception 'administrator_required'; end if;
  if nullif(btrim(coalesce(p_name,'')),'') is null then raise exception 'location_name_required'; end if;
  insert into public.locations(organization_id,name)
  values(public.current_organization_id(),btrim(p_name)) returning * into v_row;
  return v_row;
end; $$;

create or replace function public.create_location_field(p_location_id uuid, p_name text)
returns public.fields language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_row public.fields%rowtype;
begin
  if not public.is_administrator() then raise exception 'administrator_required'; end if;
  if nullif(btrim(coalesce(p_name,'')),'') is null then raise exception 'field_name_required'; end if;
  if not exists(select 1 from public.locations where id=p_location_id and organization_id=public.current_organization_id()) then raise exception 'location_not_found'; end if;
  insert into public.fields(organization_id,location_id,name)
  values(public.current_organization_id(),p_location_id,btrim(p_name)) returning * into v_row;
  return v_row;
end; $$;

revoke all on function public.create_location_complex(text) from public;
revoke all on function public.create_location_field(uuid,text) from public;
grant execute on function public.create_location_complex(text) to authenticated;
grant execute on function public.create_location_field(uuid,text) to authenticated;
