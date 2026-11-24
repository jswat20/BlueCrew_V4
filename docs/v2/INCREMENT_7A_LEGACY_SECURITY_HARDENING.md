# Increment 7A — Legacy Security Hardening

## Baseline classification

The staging inventory contained 119 `public`-schema `SECURITY DEFINER`
functions. Thirty-six were executable by `anon`, 101 by `authenticated`, and
seven inherited execution from `PUBLIC`. The advisor also reported four
functions without a fixed `search_path` and three RLS-enabled, RPC-owned tables
without policies.

Function classes:

- **Intentionally public:** `get_public_tournament(uuid)` only. It accepts an
  opaque publication token and returns a fixed, allowlisted read-only document.
- **Authenticated application operations:** workspace context, league,
  officials, tournament, facility, messaging, profile, availability, and
  notification RPCs called by the signed-in application. Their internal
  authorization and organization checks remain authoritative.
- **Internal triggers/helpers:** personnel identifiers, profile protections,
  reservation validation, notification composition, RLS automation, and
  official-history projection. Direct client execution is removed.
- **Privileged operations:** tenant provisioning and email delivery workers
  remain service-role-only.

## Changes

- Revoke inherited `PUBLIC` execution from every public-schema definer.
- Revoke `anon` execution from every definer except
  `get_public_tournament(uuid)`.
- Revoke anonymous table privileges accidentally present on facility
  availability, closures, reservations, and league-viewer scopes.
- Revoke authenticated execution of trigger-only and internal composition
  helpers while preserving the application-facing authenticated RPCs.
- Fix the search path of `is_administrator`,
  `is_assigner_or_administrator`, `is_approved_account`, and `set_updated_at`.
- Add explicit deny-direct-access policies to `message_deletions`,
  `personnel_id_counters`, and `user_workspace_contexts`. Their vetted
  definer functions continue to own all access.

## Rollback considerations

Rollback should restore only grants proven necessary by a failing legitimate
caller; it must not restore blanket `PUBLIC` or `anon` execution. Search-path
changes are behavior-preserving. The deny policies may be dropped if an
authenticated direct-table workflow is deliberately introduced together with
a tenant-scoped replacement policy. The public tournament grant can be revoked
independently to make every publication immediately inaccessible.

## Verification requirements

- Database probes for `anon`, `authenticated`, and cross-workspace negative
  cases.
- Public tournament response allowlist and mutation denial.
- Full application regression and staging artifact verification.
- Hosted acceptance across workspace switching and all four product modules.
- Re-run security, performance, and health advisors after migration.

## Staging verification — 2026-11-23

- Migration `20261124003511` applied only to staging project
  `fdjhwxmphdzodxvhrblk`; the linked dry run is subsequently up to date.
- Definer execution changed from `anon` 36 to 1, `authenticated` 101 to 90,
  and inherited `PUBLIC` 7 to 0. The remaining anonymous function is exactly
  `get_public_tournament(uuid)`.
- Anonymous reservation reads, closure writes, and publication mutations are
  denied. The public tournament function returns only `tournament`,
  `divisions`, `teams`, `pools`, `games`, `standings`, and `brackets`, with no
  email, phone, membership, or audit fields.
- The mutable-search-path and RLS-without-policy advisor categories fell to
  zero. The one remaining anonymous-definer warning is the documented public
  tournament endpoint. Ninety authenticated-definer warnings remain because
  those functions are intentional signed-in APIs or RLS authorization helpers;
  conversion to invoker functions requires per-function redesign and is not a
  safe blanket change.
- Performance advisors still report 36 unindexed foreign keys, 12 multiple
  permissive-policy findings, 44 unused indexes, one table without a primary
  key, and one Auth connection configuration notice. The scheduling-sensitive
  findings are primarily legacy composite game/team/location and assignment
  references. They are recorded for query-plan-led index work; adding all
  advisor-suggested indexes without workload evidence would increase write
  cost and duplicate existing access paths. Health advisors report no issues.
- Full regression: 1,260 passed and 1 intentionally skipped. The staging-only
  artifact build passed locally and in GitHub Actions. Hosted session restore,
  completed workspace switching, Officials scheduling, Facility resources,
  League/Complete workspace access, Tournament operations, and anonymous
  tournament publication all loaded successfully after the grant changes.
- Outbound email remains isolated: 18 pending deliveries and zero active cron
  jobs.
