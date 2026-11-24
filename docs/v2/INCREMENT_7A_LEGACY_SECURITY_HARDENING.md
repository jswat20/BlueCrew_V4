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

## Final hosted acceptance — 2026-11-23

Increment 7A is formally accepted on the isolated V2 deployment. The final
acceptance pass covered the following live staging behavior:

- A fresh administrator login, refresh restoration, logout/login boundary, and
  switching among League-only, Officials-only, Tournament-only, and
  Facility-only workspaces.
- A League game was rescheduled through the hosted editor to 2027-03-14 at
  20:00 on Acceptance Field B. Its canonical game ID remained
  `197be855-3d7d-48c4-8b8e-5175d78ecb68`; the backend created active
  reservation `6b0d0dcf-d843-40b5-ade6-08443911b022`. An invalid availability
  attempt was rejected without changing the original game or reservation.
- An Officials-only game was created without League prerequisites and a
  synthetic official was assigned through Build Crew. The assignment persisted
  after reload. The existing Officials import workflow was also re-exercised.
- A synthetic Tournament pool result was corrected from 2-5 to 3-5. The public
  result and recalculated standings persisted after reload.
- A Facility-only administrative hold was created for 2027-03-01 from 18:00 to
  20:00. A same-field 19:00-21:00 overlap was rejected by the backend and the
  original reservation remained active.
- Direct database authorization probes confirmed that an authenticated user
  cannot select a workspace without an approved membership
  (`workspace_membership_required`). Anonymous callers can execute only the
  allowlisted public tournament RPC and cannot insert organizations or
  reservations or select profiles. The public response contains only
  `tournament`, `divisions`, `teams`, `pools`, `games`, `standings`, and
  `brackets`.
- Outbound email isolation was rechecked after acceptance: all 18 pending
  deliveries remain pending and no cron job is active.

Three hosted defects discovered during final acceptance were repaired without
loosening authorization: duplicate session hydration no longer logs out a
multi-workspace user (`2813053`), asynchronous crew assignments are awaited and
reported accurately (`29e52e4`), and switching workspaces clears cached
facility state before loading the destination tenant (`4d94ac8`). Each repair
includes a focused regression test and was deployed through the staging-only
pipeline.
