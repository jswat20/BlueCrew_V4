-- Cover the global sport lookup used by the organization_sports foreign key.
create index organization_sports_sport_code_idx
  on public.organization_sports (sport_code);
