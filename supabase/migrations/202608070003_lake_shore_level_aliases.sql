-- Organization terminology is display/import configuration; canonical levels remain authoritative.

update public.organizations
set settings = jsonb_set(
      settings,
      '{level_aliases}',
      '{"6U":"Clinic","8U":"Pinto","10U":"Mustang","12U":"Bronco","14U":"Pony","16U":"Colt"}'::jsonb,
      true
    ),
    updated_at = now()
where slug = 'lake-shore'
   or lower(name) = 'lake shore'
   or lower(name) like 'lake shore %';
