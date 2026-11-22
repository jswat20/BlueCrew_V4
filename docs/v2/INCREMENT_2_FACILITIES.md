# Increment 2: Facilities and Reservation Management

## Architecture

Increment 2 extends the established `locations` and `fields` identities rather than replacing them. Canonical games retain their organization-qualified location/field foreign key. `field_reservations` is independent and has an optional organization-qualified game link for later scheduling integration.

Time boundaries are stored as `timestamptz`; facilities own an IANA timezone for interpreting recurring local availability. Reservations use half-open `[start,end)` ranges, require `end > start`, and must fit one local calendar day and one active availability rule. Active closures are checked by a backend trigger.

The `btree_gist` exclusion constraint on `(organization_id, field_id, tstzrange)` rejects overlapping active reservations atomically, including concurrent transactions. Cancelled reservations are outside the constraint predicate and release their slot. Adjacent ranges do not overlap.

All new records carry `organization_id`, use organization-qualified foreign keys, have RLS enabled, and permit mutations only for the current approved administrator. Trusted RPCs derive organization and actor from the authenticated database session. Existing game and umpire-assignment paths were not rewritten.

## Hosted workflow

The Settings page now provides responsive facility inventory and reservation timeline workflows:

- create and edit facilities with address, timezone, supported sports, status, and notes;
- create and edit fields with supported sports, status, age range, and division notes;
- add recurring field availability;
- create maintenance, blackout, weather, or administrative closures;
- create, reschedule, and cancel game, practice, tournament, and administrative-hold reservations;
- display active and cancelled reservations after reload.

## Multi-organization membership design

Facilities use the current organization boundary during this increment. The later membership transition should add:

- `people`: one platform identity per Auth user;
- `organization_memberships`: one organization-specific approval/status row per person;
- `roles` and `membership_roles`: multiple independent grants per organization, without extending a PostgreSQL enum;
- typed scope tables for divisions, facilities, and tournaments;
- organization-qualified audit events for grants, revocations, and switches.

Authorization must derive membership from `auth.uid()` and each row's `organization_id`; a client-selected organization is context, never authority. The switcher must clear tenant caches/subscriptions and reject late responses from the prior tenant. Sport switching remains subordinate to the selected organization.

Transition order: add/backfill membership tables; preserve existing profile IDs; introduce membership-aware hydration; convert policies in bounded groups with denial tests; then retire `profiles.auth_user_id unique`, single-role authority, `.maybeSingle()` hydration, and first-profile helper assumptions. Broad membership changes are intentionally deferred so this increment remains deployable.

## Verification

- Migration history was reconciled before the single additive migration was applied to staging.
- Automated contracts cover tenant keys, backend time rules, cancellation, half-open adjacency, RLS, and hosted UI entry points.
- Database probes verified non-administrator mutation rejection and cross-organization invisibility/update denial; probe transactions were rolled back.
- The complete regression suite and staging-only artifact verification are required before deployment.

## Known limitations and next increment

- Recurring availability rules are create-only in the first UI; inventory, fields, reservations, and reservation times are editable.
- Reservations cannot span local midnight.
- Game linkage exists in the schema but canonical game creation/edit does not yet create or update reservations atomically.
- Shared-facility authority and cross-tenant grants are deliberately deferred.
- A richer week/month calendar can replace the current responsive chronological timeline after canonical scheduling integration.

Next increment: connect game scheduling transactions to field reservations, retain rollback-safe imports, and add integrated field/umpire availability presentation without changing the canonical game identity.
