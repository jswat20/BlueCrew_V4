# Supabase schema and security decisions

## Model

Every business row is organization-scoped. Composite foreign keys include `organization_id` where needed so a row cannot reference a parent in another organization. UUIDs are backend identifiers; `legacy_*_id` columns preserve BlueCrew compatibility.

Canonical roles are `administrator`, `assigner`, and `umpire`. Profiles link `auth.users` to one organization. A crew member optionally links one profile, allowing unregistered roster members while preventing one account from linking to multiple crew records in an organization.

Game lifecycle values are `scheduled`, `completed`, `submitted`, `returned`, `approved`, `postponed`, and `cancelled`. Assignment values are `needs_assignment`, `open_for_claim`, `pending_approval`, `assigned`, and `locked`. Claim values are `pending`, `approved`, `rejected`, and `withdrawn`.

## Security

- RLS is enabled on every application table.
- Helper functions derive organization, profile, crew member, and role from `auth.uid()`; browser claims do not choose authorization roles.
- Umpires cannot update assignments. They create claims for themselves and manage only their own availability.
- A profile-update trigger restricts non-administrators to approved self-service contact/preference columns even when a full row is submitted.
- Assigners manage games, assignments, and claims, but not accounts or organization configuration.
- Administrators manage organization profiles, roster, seasons, locations, and fields.
- Activities are append-only to authenticated clients.
- Notifications are visible through explicit recipient or audience policies.
- Anonymous users receive no direct organization-table access.

## Registration boundary

Milestone 2A intentionally grants no anonymous profile insert. Milestone 2B must create a Supabase Auth user and then call the controlled invitation-based provisioning boundary specified in `docs/supabase-bootstrap-and-registration.md`. A browser must never select its own organization or elevated role through raw inserts or editable JWT metadata.

## Unresolved decisions for review

1. Whether game reviews/reports should remain JSONB for the pilot or be normalized before broader reporting.
2. Whether profile photos move to Supabase Storage in 2B or a later milestone.
3. Whether assigners require limited contact fields beyond crew-member display data.
4. The exact invitation lifetime, issuance UI, and recovery process within the fixed controlled-registration boundary.
5. Retention periods for activities, notifications, declined claims, and minor-related contact data.
6. The transactional RPC contract for claim approval, direct assignment, decline/reopen, schedule import, and reminder generation. RLS defines who may act; Milestone 2B/2C must make multi-row transitions atomic.

For the pilot, parent-controlled credentials do not create a distinct role or broader access. A guardian data model remains post-pilot scope.
