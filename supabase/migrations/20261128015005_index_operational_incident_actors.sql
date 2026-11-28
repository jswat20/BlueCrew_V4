-- Cover optional actor foreign keys so incident lifecycle updates do not add
-- avoidable referential-check cost.
create index operational_incidents_ack_profile_idx
  on public.operational_incidents (acknowledged_by_profile_id)
  where acknowledged_by_profile_id is not null;
create index operational_incidents_recovery_profile_idx
  on public.operational_incidents (recovered_by_profile_id)
  where recovered_by_profile_id is not null;
