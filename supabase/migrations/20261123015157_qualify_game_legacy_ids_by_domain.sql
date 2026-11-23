-- Independent modules may use the same external identifier without sharing a
-- scheduling record. Keep duplicate protection within each tenant and domain.

alter table public.games
  drop constraint if exists games_organization_id_legacy_game_id_key;

alter table public.games
  add constraint games_organization_id_game_domain_legacy_game_id_key
  unique (organization_id, game_domain, legacy_game_id);

comment on constraint games_organization_id_game_domain_legacy_game_id_key on public.games is
  'Prevents duplicate imported identifiers inside one workspace game domain while allowing independent modules to reuse source identifiers.';
