# SaaS tenant foundation and cross-module audit

Date: 2026-11-22

## Controlling model

`organizations.id` remains the tenant identifier. Every customer workspace owns
its own catalog, facilities, schedules, officials, communications, and audit
history. Same-named records in different organizations are unrelated. No shared
facility registry or implicit cross-tenant conflict detection is permitted.

## Additive foundation

Migration `20261122230517_saas_workspace_memberships_and_entitlements.sql`
adds:

- `organization_memberships`: independent Auth-user membership per workspace;
- `organization_membership_roles`: multiple per-workspace role grants;
- `organization_module_entitlements`: backend League/Umpire/Tournament module access;
- `workspace_audit_events`: append-only tenant lifecycle evidence;
- private membership, role, and entitlement authorization helpers;
- `get_workspace_context()`: self-scoped workspace/module discovery;
- `provision_saas_workspace(...)`: service-role-only tenant onboarding.

Existing profiles are backfilled idempotently. Existing organizations receive
all three modules through `legacy_backfill`, preserving fall umpire behavior and
the accepted hosted catalog. Competition writes remain League-entitled. Sports,
facilities, fields, availability, closures, and reservations are shared
workspace infrastructure and require at least one operational module rather than
League specifically. Client roles cannot mutate memberships, roles,
entitlements, or audit events directly.

Two follow-up advisor-hardening migrations explicitly remove Supabase's
automatic public-function grants, retain tenant provisioning for `service_role`
only, reduce browser table privileges to `SELECT`, and add covering foreign-key
indexes. This is material because RLS does not protect `TRUNCATE`.

## Dependency audit

| Area | Tenant isolation | League dependency | Umpire dependency | Disposition |
|---|---|---|---|---|
| Competition catalog | Organization-qualified RLS/FKs | Required | None | Reuse; enforce League entitlement |
| Facilities/reservations | Organization-qualified RLS/FKs and atomic conflicts | Optional/shared | Optional/shared | Reuse for all three modules; no shared registry |
| Seasons | Organization-qualified | Currently required by legacy games | Used indirectly by umpire schedules | Refactor into neutral scheduling context |
| Games | Organization-qualified | Mandatory season/location/field FKs | Parent of assignments/claims | Architectural blocker: decouple before new League scheduling |
| Assignments/claims | Organization-qualified | Depend on legacy game only | Required | Reuse after neutral-game compatibility layer |
| Crew/availability | Organization-qualified | None | Required | Reuse; migrate authority to memberships |
| Profiles/auth helpers | Organization-qualified but one Auth user/one profile | Shared authorization | Shared authorization | Replace incrementally with active membership/profile |
| Communications | Organization-qualified, game links optional | Optional | Optional | Reuse outbox; keep staging delivery disabled |
| Tournaments | Not implemented | None required | Optional staffing only | Independent Tournament entitlement; add after neutral games |

## Verified blocker

The current `games` table requires non-null `season_id`, `location_id`, and
`field_id`, while `game_assignments` requires a game. Therefore the existing
model does not satisfy either independent-module rule:

- an Umpire-only workspace cannot create a staffing game without League/facility
  seed records;
- a League game can exist without assignments, but its identity is still coupled
  to the legacy umpire-era game structure.

No further organizational scheduling should be built on this shape. The next
schema design must retain legacy IDs while allowing optional League competition
and optional Umpire staffing extensions.

## Tenant onboarding and authorization

Tenant provisioning is a trusted platform operation, not a browser-admin
capability. The service-role-only onboarding RPC validates name, slug, timezone,
owner Auth identity, and enabled modules; creates the organization, approved owner
membership, administrator grant, entitlements, and an audit event atomically.

A browser-selected workspace is context only. Future switching must validate an
approved membership in the database, resolve the workspace-specific profile and
roles, then clear all cached/subscribed tenant state before hydration.

## Entitlement enforcement transition

League entitlement remains mandatory for League competition writes. Shared
facility resources accept League, Umpire, or Tournament entitlement. Reads remain
membership/RLS scoped. Umpire entitlement enforcement is
deferred until legacy game/profile helpers are separated; enabling it prematurely
would risk the fall umpire application. The next increment must enumerate and
wrap all Umpire mutation RPCs before a tenant can be sold as Umpire-only.

Tournament is a third independent entitlement. Adding it to onboarding and
removing the facility-to-League dependency is the prerequisite foundation, not a
claim that tournament registration, pools, standings, or brackets already exist.

## Remaining risks

- Active workspace switching is not yet implemented.
- `profiles.auth_user_id` remains unique, so a user cannot yet hydrate a distinct
  profile in two workspaces.
- Existing RLS helpers still resolve the legacy profile's organization and role.
- Umpire entitlement is modeled but not yet enforced across legacy RPCs.
- Full restore rehearsal remains outstanding.
- Staging outbound email remains disabled; the 18 pending deliveries are preserved.

