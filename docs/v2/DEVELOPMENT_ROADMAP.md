# The Slate V2 prioritized development roadmap

This roadmap applies only to `slate-v2-development`, staging Supabase project
`fdjhwxmphdzodxvhrblk`, and `https://the-slate-v2.pages.dev`.

## P0 — restore a trustworthy staging baseline

1. **Maintain the repaired automated-test baseline.** The nine reproducible
   failures were resolved with local-calendar fixes and semantic contract tests;
   keep the complete suite at zero unexplained failures.
2. **Complete provider-level outbound-email isolation.** Cron and the two manual
   Edge Function senders are disabled in staging. Add a safe sink for native
   Auth signup/recovery mail and define a synthetic-recipient strategy before
   creating hosted role accounts.
3. **Finish Cloudflare configuration audit.** Verify the dedicated Pages project,
   `slate-v2-development` integration, `npm run build:v2-staging`, `dist`, staging
   variables, absence of production/custom domains, and preview/production
   branch rules.
4. **Reconcile migration provenance.** Preserve the existing registry, recover
   authoritative SQL, and test any future baseline/reconciliation only in a
   disposable database before staging.

Exit criteria: clean staging build, zero unexplained test failures, outbound
channels isolated, and recorded Cloudflare/Supabase target evidence.

## P1 — umpire and account management

1. Consolidate administrator account review, eligibility, Crew linkage, role,
   status, and personnel history into one authoritative workflow.
2. Make identity conflicts explicit: verified login email, contact email, Crew
   link, active status, requested role, and league-viewer scope.
3. Add focused hosted acceptance for create/request, approve, reject, link,
   deactivate, reactivate, and profile-photo lifecycle using synthetic accounts.
4. Retain database-enforced role and organization boundaries; browser controls
   remain presentation only.

Exit criteria: every state transition is atomic, audited, organization-scoped,
and covered by administrator and non-administrator denial tests.

## P1 — game and schedule operations

1. Preserve the repaired local-calendar behavior in Workbench and Operations
   Center across supported time zones and daylight-saving transitions.
2. Unify game creation, editing, lifecycle changes, deletion, staffing, claims,
   and assignment views around one canonical game/assignment snapshot.
3. Preserve exact `gameId`, `assignmentId`, and `claimId` identity through every
   review and mutation path.
4. Expand synthetic acceptance for one- through four-official crews, concurrent
   claims, replacements, declines, cancellations, postponements, completion,
   review, and schedule import/export.

Exit criteria: refresh-safe state across administrator, assigner, and umpire
sessions with no stale controls or identity fallbacks.

## P2 — league-viewer experience

1. Validate all-division and selected-division scopes against hosted RLS.
2. Provide an intentionally read-only schedule, roster, Crew Card, and reporting
   experience with no mutation affordances.
3. Add cross-organization and out-of-scope division denial tests.

Exit criteria: league viewers see exactly their authorized scope and cannot
reach mutations through UI, client services, RPCs, or direct table access.

## P2 — communications and notifications

1. Retain the worker/browser-delivery boundary contract and staging-disabled
   manual sender stubs until a safe delivery sink is approved.
2. Establish staging-safe delivery sinks and synthetic recipient conventions.
3. Validate message, announcement, assignment, claim, game-change, account, and
   reminder idempotency without exposing message content in email.
4. Restore scheduled processing only after an explicit staging acceptance gate.

Exit criteria: one authoritative event produces the expected in-app/email audit
records, no duplicates, no private-content leakage, and no real-recipient risk.

## P3 — release readiness and quality

1. Address dependency advisories through reviewed, pinned upgrades.
2. Add CI ordering so artifact-contract tests always run after the staging build.
3. Add authenticated mobile/desktop acceptance at supported breakpoints and
   retain accessibility checks.
4. Document rollback, data-fixture cleanup, deployment verification, and exact
   staging-to-release promotion gates. Production promotion remains a separate,
   explicitly authorized task.
