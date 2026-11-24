# Increment 7B — Customer Onboarding

## Milestone 1: self-service workspace foundation

Migration `20261124013000_self_service_workspace_onboarding.sql` introduces a
narrow authenticated onboarding boundary without exposing the trusted
service-role provisioning function. A verified Auth user can create a workspace
for itself through `create_customer_workspace(...)`. The transaction creates the
organization, workspace-specific approved administrator profile and membership,
selected module entitlements, server-owned active-workspace context, and audit
event together.

The function validates workspace identity, IANA timezone, and the four-module
allowlist. It serializes requests per Auth user and limits self-service creation
to two workspaces per hour and five total. Anonymous callers have no execution
grant. A unique-slug conflict is returned as a safe domain error. No service-role
credential or organization identifier is accepted from the browser.

`enable_workspace_module(...)` allows an administrator to add one of League,
Officials, Tournament, or Facility Scheduling to the server-validated active
workspace. It cannot target another organization and records an audit event.
Billing remains deliberately out of scope.

The hosted client now presents a workspace-creation screen when an authenticated
user has no approved memberships. Single-workspace and multi-workspace users
retain their existing entry behavior. The administrator can add another module
from the active-workspace control.

## Verification and rollback

- The staging migration dry run identified exactly one pending migration before
  it was applied to `fdjhwxmphdzodxvhrblk`.
- A transaction-rolled-back database probe created the complete tenant graph and
  confirmed `authenticated` execution and denied `anon` execution. The probe
  left no organization row behind.
- Automated coverage verifies the security properties, no-workspace entry state,
  module selection, administrator hydration, and existing workspace switching.
- The complete regression finished with 1,265 passing and one intentionally
  skipped test. The staging-only curated artifact build and verification passed
  with the explicit staging project ref and URL.
- The post-migration security advisor retains the one intentional anonymous
  public-tournament warning. Authenticated-definer notices increased from 90 to
  92 for the two new, deliberately authenticated and internally authorized
  onboarding operations; no new anonymous execution was introduced. Existing
  performance-advisor debt is unchanged.
- Rollback should revoke both new RPC grants first. The functions may then be
  dropped; existing workspaces created through them are ordinary tenant records
  and must not be deleted automatically.

## Remaining milestones

Milestone 2 will add recipient-bound, expiring workspace invitations and explicit
role assignment with a safe staging delivery surface. Milestone 3 will complete
new-account hosted acceptance, invitation acceptance by a second synthetic user,
and post-reauthentication persistence. Outbound staging email remains disabled;
the existing 18 pending deliveries are not part of onboarding delivery.

## Hosted milestone evidence — 2026-11-23

Commit `8c70d2dd1efa0e843793eeec5024629aef343482` passed staging safety run
`45307346122` and was deployed by the existing Cloudflare Pages staging
connection. The hosted application exposed the new module-onboarding control.
In synthetic workspace `Increment 4B Alpha`, the administrator enabled
Tournament Management alongside the existing League and Facility modules. The
backend recorded the entitlement with source `subscription`; the hosted header
showed `Facilities · League · Tournament` after a full refresh.

The no-workspace creation form is deployed and covered by the hosted-runtime
browser fixture, but its live new-account demonstration remains a Milestone 2
acceptance item. Completing that scenario requires a synthetic verified Auth
identity and a safe invitation/verification delivery surface; real staging
email will not be enabled to manufacture that condition.

## Milestone 2: secure workspace invitations

Migrations `20261124015251`, `20261124015824`, and `20261124015915` add the
recipient-bound invitation boundary. The first migration was created with the
Supabase CLI and applied only after the linked staging dry run identified it as
the sole pending migration. Two narrowly scoped follow-ups initialize invited
League Viewer scope and make the profile-role enum conversion explicit.

### Security and lifecycle

- `issue_workspace_invitation(...)` generates 256 bits of randomness inside
  Postgres. Only the SHA-256 digest is stored; the plaintext token is returned
  once to the authorized administrator.
- The staging interface constructs a URL fragment (`#invite=...`), copies it on
  demand, and removes it from the address bar before application startup. The
  token is never placed in a query string, database listing, audit event, or
  diagnostic result.
- Invitations are bound to one normalized recipient email, active workspace,
  server-stored role, and expiration. Defaults are 72 hours, with a hard range
  of 1–168 hours.
- Issuance is limited to three invitations per inviter per ten minutes and 20
  per workspace per day. Duplicate pending invitations, self-invitations, and
  invitations for existing workspace members fail closed.
- Acceptance requires an authenticated, email-confirmed Supabase identity whose
  email matches the locked invitation row. The browser supplies only the token;
  it cannot choose the workspace, recipient, or role during acceptance.
- Profile, approved membership, role, optional Umpire crew identity, League
  Viewer scope, active-workspace context, acceptance state, and audit event are
  committed atomically. Replay returns `invitation_already_accepted`.
- Administrators can list safe metadata, revoke, and regenerate. Regeneration
  replaces the digest, increments a bounded counter, and reveals the replacement
  token only in that response. Accepted invitations cannot be regenerated.
- The invitation table has RLS enabled and no browser table grants. All access
  is through fixed-search-path RPCs. Anonymous roles can execute neither
  issuance nor acceptance.

### Staging authorization evidence

Using existing verified synthetic staging identities, a database-level
end-to-end acceptance created a second membership in `Increment 4B Alpha` with
exactly the invited `league_viewer` role and an all-divisions workspace-local
scope. Recipient mismatch, revocation, expiration, replay, and self-invitation
were each rejected with their specific fail-closed result. Issuance,
acceptance, revocation, regeneration, and expiration produced audit events.
Plaintext-token columns and direct `anon`/`authenticated` table grants are zero.

The test mechanism kept invitation tokens inside database variables; no live
token was printed, committed, or copied into diagnostics. Existing public
tournament access and outbound communication configuration were not changed.

### Milestone 2 verification

- The focused invitation, onboarding, and workspace-switching suites passed 11
  tests. The complete regression passed 1,270 tests with one intentionally
  skipped test in 6.6 minutes.
- The staging-only curated artifact build and verification passed with project
  ref `fdjhwxmphdzodxvhrblk` and its staging URL supplied explicitly.
- Post-acceptance staging inspection confirmed 18 pending communication
  deliveries and zero active cron jobs. No pending delivery was processed.
- The security advisor still reports the single intentional anonymous
  `get_public_tournament(uuid)` SECURITY DEFINER endpoint. The five invitation
  RPCs are authenticated-only and enforce verified identity, active-workspace
  administration, or exact recipient binding internally. No anonymous
  invitation execution or direct table access was introduced.
- The performance advisor reports existing legacy debt plus one informational
  missing covering index for the invitation acceptance audit foreign key. This
  does not affect authorization or correctness and is deferred to a measured
  index-maintenance increment.
