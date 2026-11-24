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
