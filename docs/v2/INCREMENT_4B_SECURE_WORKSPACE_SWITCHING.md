# Increment 4B — Secure multi-workspace switching

## Scope

Increment 4B replaces the legacy first-profile tenant assumption with a
server-validated active workspace. It preserves the Increment 4A restoration
sequence and does not introduce neutral game ownership; that remains Increment
4C.

## Authorization model

- One Auth user may have one workspace-specific profile and membership in each
  organization. The profile uniqueness boundary is now
  `(organization_id, auth_user_id)`.
- `user_workspace_contexts` stores the server-owned active membership. Browser
  roles have no table privileges and no RLS policy for direct access.
- `select_active_workspace` accepts a requested organization only after it
  validates the caller's approved membership, approved linked profile, matching
  role grant, and active organization.
- The legacy identity helpers now resolve through that validated context. If a
  stored context exists but is no longer valid, resolution returns `NULL`
  instead of falling back to another tenant.
- A single valid membership remains backward compatible through an automatic
  server selection. Multiple memberships require an explicit launcher choice.
- Membership suspension, revocation, profile detachment, or deletion clears an
  active context. Explicit logout also clears it and records an audit event.
- Workspace selection and clearing create organization-qualified audit events.

The application reloads the active profile, organization settings, role,
entitlements, locations, games, personnel, notifications, activity, and
messaging state after a switch. Prior snapshots and selections are cleared
before the next tenant is published. Navigation is recalculated from the active
workspace's role and enabled modules.

## Migration and rollback

Migration `20261123003820_secure_active_workspace_context.sql` was applied only
to staging project `fdjhwxmphdzodxvhrblk` after the local and remote ledgers
matched through `20261122234858` and a linked dry run listed only this migration.
Production was not targeted.

Before customer multi-membership data exists, rollback consists of restoring
the prior identity helpers and profile policies, dropping the profile membership
synchronization and invalidation triggers, dropping `user_workspace_contexts`,
and restoring the global Auth-user uniqueness constraint. After one Auth user
has multiple workspace profiles, rollback requires an export and an explicit
profile-consolidation decision; it must not restore global uniqueness blindly.

## Verification

- Focused workspace, session restoration, and migration-contract tests: 5
  passed.
- Affected hosted-fixture regression set after fixture reconciliation: 33
  passed.
- Complete Playwright regression suite: 1,217 passed, 1 intentionally skipped.
- Production artifact build and artifact verification passed.
- The fail-closed V2 staging artifact build passed with the exact staging
  project reference and URL.
- A staging database transaction proved: both synthetic memberships enumerate;
  Alpha resolves as administrator; Beta resolves independently as
  `league_viewer`; cross-workspace profile reads return zero rows; cross-workspace
  mutation affects zero rows; a non-member workspace selection raises an
  authorization error; and a suspended active membership immediately resolves
  to no workspace. The revocation portion was rolled back.
- Security advisors report the new context table as RLS-enabled with no policy,
  which is intentional because it is RPC-only. Other reported SECURITY DEFINER
  grants and mutable search paths are inherited debt and remain follow-up work.

## Hosted acceptance

Hosted deployment ID, deployed commit, and browser evidence are recorded after
the V2 Pages deployment converges. The acceptance fixtures are synthetic
workspaces `Increment 4B Alpha` and `Increment 4B Beta`. No real email is sent.

## Increment 4C recommendation

The smallest safe next step is an additive ownership discriminator for games,
not three rewritten scheduling systems:

1. Add a required game domain (`league`, `officials`, or `tournament`) plus an
   optional domain-specific owner reference, backfilling every legacy game as
   `officials` without changing identifiers or assignment relationships.
2. Add one backend creation command per enabled module. Each command derives the
   active organization, checks that module's entitlement, and creates the same
   canonical game time/location record without requiring another module.
3. Add RLS and transition tests proving each module can create and read only its
   own workspace games, while optional umpire staffing continues to reference
   the canonical game explicitly.

Defer bracket generation, league schedule generation, and automatic cross-module
linking until this ownership boundary has passed hosted acceptance.
