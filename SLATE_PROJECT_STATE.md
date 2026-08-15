# SLATE — PROJECT STATE / AI HANDOFF

## Release Candidate Checkpoint — 2026-08-15

- **Branch:** `pilot-polish`
- **Purpose:** prepare the integrated production-pilot work as a clean, reproducible release candidate without merging, deploying, or mutating hosted data.
- **Automated baseline:** **970 passed / 0 failed / 0 skipped** from the final full Playwright run after the umpire-portal corrections. This baseline must be reproduced from the committed source before the branch is pushed.
- **Implemented umpire portal:** responsive Dashboard, Claim Games and filters, My Schedule with completed-game visibility, Pending Claims, Notifications, Profile/Crew Card and Official History, and page-based Game Hub entry points, together with the associated account, personnel, notification, and production-build work.
- **Deferred:** secure server-backed profile-photo upload/storage and a universal modal-based Game Hub. The existing profile-photo presentation and page-based Game Hub are not substitutes for those deferred capabilities.
- **Production release status:** release-candidate preparation only. Production acceptance is not complete until the clean production build and artifact verification pass, the committed branch is reviewed, the controlled deployment is performed, and the required authenticated production smoke checks succeed.
- **Schema history:** all eleven forward-only migrations from `202608120001` through `202608140005` are already applied to production and must be preserved exactly in Git as authoritative history. Do not reapply them during release-candidate preparation.
- **Release gate:** run the complete clean-source verification from the committed branch. After a later authorized deployment, perform production smoke testing without exposing credentials or private test data.

The older milestone narrative below is retained as historical context. Where it conflicts with this checkpoint, this checkpoint is authoritative.

## 1. Executive Summary

Slate (repository/package legacy name: `BlueCrew_V4` / `blue-crew-app`) is a pilot-production web application for youth-baseball umpire operations. It supports organization administrators, assigners, and umpires managing Crew records, games, assignments, claims, availability, account onboarding, operational review, notifications, and transactional email.

The current production pilot targets Lake Shore Youth Baseball, Fall 2026. The canonical application is `https://app.worktheslate.com`. Production uses Supabase project `dynxjiqrdlhfhrjnhvgn` in `us-east-2` and Cloudflare Pages project `the-slate-production`.

Maturity: production pilot, not a clean post-pilot product. Release tag `v1.0.0-pilot` exists, and the post-tag integrated work is being prepared on `pilot-polish` as a release candidate. Browser automation is extensive (latest full result: **970 passed / 0 failed / 0 skipped**), while controlled production smoke acceptance remains a separate release gate.

Overall goal: safely invite and operate the first real organization without adding speculative features or weakening tenant, role, identity, or communication integrity.

## 2. Current Development Status

### Working (test and/or prior production evidence)

- Supabase Auth sign-up, verification, login, password recovery, and approved-account access.
- Code-free public umpire registration: server forces role `umpire`, status `pending`, and the sole eligible active organization.
- Transactional one-click pending-umpire approval, including deterministic Crew matching/creation, profile linkage, notification, communication event, and audit activity.
- Legacy Registration-Code-era pending profiles are compatible with approval after migration `202608130002`.
- Administrator/assigner/umpire authorization and organization-scoped RLS.
- Crew roster hydration, creation, deactivation, identity diagnostics/linking, and hosted repository update path.
- Locations/fields, schedule import, games, assignments, assignment claims, availability, completion/review workflows, dashboards, notifications, reporting, reminders, and transactional email infrastructure.
- Cloudflare production build produces a curated artifact, excludes local/demo/admin-only files, validates browser-safe Supabase configuration, and fingerprints runtime/critical Crew scripts.
- PWA metadata/icons/install guidance.
- Production security headers (CSP, HSTS, frame denial, nosniff) were observed active.
- Latest automated baseline: 970 Playwright tests passed, with zero failed and zero skipped.

### Partially working / acceptance pending

- **Crew edit from a linked Crew card:** an E3 rendering fix is implemented, tested, built, and deployed, but the user has not yet performed the final authenticated desktop CJ retest after deployment `4a0e640e`.
- Content-addressed production asset delivery works in build verification, but the custom-domain CDN has shown propagation/cache races. The build now uses both physical content hashes and matching query keys for the critical Crew scripts.
- External visual Getting Started material was intentionally not regenerated after onboarding UX changes.

### Broken

- No currently proven broken code after the E3 fix, but Crew edit must remain a **P0 acceptance blocker** until the real authenticated desktop test succeeds.
- If the next manual click shows a `CREW-EDIT-E#` code, the blocker remains open; use the diagnostic mapping in section 10.

### Not yet implemented

- Speculative multi-organization selection during public registration.
- SMS/push delivery despite channels existing in the communication enum.
- A new top-level Admin feature. Production intentionally removes the dead Admin navigation destination rather than building it.

### Planned / deferred

- Regenerate external onboarding guide/screenshots after real onboarding acceptance.
- Broader multi-tenant onboarding only when product requirements demand it.
- Cleanly commit and push the production-closeout work only with explicit user authorization.

## 3. Current Task / Where We Stopped

### Task

Resolve the authenticated production Crew editor failure for CJ without changing CJ manually.

### Failure history and proven cause

The real administrator flow was:

`Crew → open CJ Crew card → Edit Crew Member`

Successive diagnostics narrowed the failure to safe code `CREW-EDIT-E3`, meaning `renderEditCrewDrawerContent()` threw before the drawer mounted. The unsafe expression was:

`member.levels.includes(option.canonical)`

The production object could lack mapped `levels` even though the persisted database record had a valid non-null `eligible_levels text[]` (CJ/recent record: empty array). The legacy detail card tolerated missing `member.levels`; the editor did not.

### Implemented correction

- `components/crew.js` normalizes member eligibility from `member.levels` or fallback `member.eligible_levels` through `levelTerminologyService.normalizeLevels()`.
- It also normalizes configured levels before `.map()`.
- It no longer directly calls `member.levels.includes()`.
- Safe launch diagnostics E1–E6 remain.
- The exact absent-mapped-eligibility shape has a hosted click/save regression.
- Critical Crew scripts are copied to physical content-hashed filenames during production build and referenced with the same hash as query key.

### Validation/deployment

- Focused Crew editor/rendering tests: 39/39.
- Final factory/cache-focused tests: 14/14.
- Historical checkpoint suite: 935/935; superseded by the 970/0/0 release-candidate baseline above.
- Production build and artifact verification passed.
- Final deployment: `4a0e640e`.
- Canonical HTML referenced `components/crew.d81bd0cfd30f.js?v=d81bd0cfd30f`; live content contained normalization, no unsafe direct includes call, and retained E3 diagnostics.

### What remains / immediate action

The user must perform the real authenticated desktop acceptance:

1. Open CJ Crew card.
2. Click Edit Crew Member.
3. Confirm the editor opens.
4. Change one intended field.
5. Save and confirm `Crew member saved.`
6. Reload and confirm persistence.

Do not edit CJ from tooling. If launch fails, obtain the displayed `CREW-EDIT-E#` code before changing code.

## 4. Architecture

### Frontend

- Static, unbundled HTML/CSS/classic JavaScript served from `index.html`.
- Global services/components rather than ES modules or a framework.
- UI rendering is imperative and template-string based (`components/`, `js/ui/`, `js/schedule/`).
- `app.js` handles page routing/render coordination.
- Local/demo mode persists to browser/local repositories; hosted mode uses Supabase-backed snapshots and repositories.

### Backend/data

- Supabase Postgres in schema `public` plus Supabase `auth.users`.
- RLS is the primary tenant/role data boundary.
- Security-definer RPCs implement sensitive transactional commands: provisioning, approval, Crew creation/identity linking, schedule import, claims, assignments, game updates, reminders, and communication delivery.
- No conventional application server.

### Authentication/authorization

- Supabase Auth email/password and email verification.
- `profiles.auth_user_id` is unique and links Auth to application identity.
- Roles: administrator, assigner, umpire. Status: pending, approved, rejected.
- Pending accounts are intentionally denied normal organization data.
- Crew login linkage is `crew_members.profile_id`; integrity trigger requires same organization, approved umpire profile, and valid Auth identity.

### State management

- Service-level snapshots in hosted mode (for example administrative Crew and profile snapshots).
- Mapping boundary: `js/services/sharedDomainMappingService.js` converts snake_case database rows to camelCase UI objects.
- Repository boundary: `js/repositories/supabaseSharedRepository.js` performs explicit Supabase reads/RPCs/mutations.
- Local mode uses data arrays/storage helpers. Never accidentally reintroduce local fallback into hosted authenticated reads.

### External services/background work

- Supabase Edge Functions:
  - `process-communication-emails`
  - `send-account-password-reset`
- Resend-backed transactional email.
- Postgres communication-event/delivery queue with leasing, retry, idempotency, and cron-triggered worker.
- Game reminder enqueue function and cron.
- Cloudflare Pages hosts the static production artifact.

### High-level data flow

Browser Auth → Supabase session → profile/role/status resolution → RLS-scoped reads or trusted RPC → Postgres transaction → optional notification/communication event → email worker → Resend.

## 5. Technology Stack

- JavaScript (classic browser scripts; Node/CommonJS build scripts)
- HTML5/CSS
- Node.js observed: `v24.19.0`
- npm observed: `11.17.0`
- Playwright `1.62.1`; package range uses `^1.61.1`
- `@axe-core/playwright ^4.12.1`
- Supabase CLI `^2.111.0`
- `@supabase/server ^1.4.1`
- `http-server ^14.1.1`
- PostgreSQL/Supabase, PL/pgSQL, RLS, Edge Functions (TypeScript/Deno runtime)
- Cloudflare Pages/Wrangler (installed through `npx`/environment)
- Resend transactional email

## 6. Repository Structure

- `index.html`: script load order, shell DOM, production-visible asset references.
- `app.js`: navigation/page render coordination and application initialization.
- `components/`: major page/template renderers; `components/crew.js` owns add/edit Crew drawers and save UI.
- `js/ui/`: UI controllers. `crewCard.js`, `accounts.js`, `operationsCenter.js`, `login.js`, and `accountRegistration.js` are production-critical.
- `js/services/`: business logic and hosted/local mode behavior. Key files: `crewService.js`, `accountService.js`, `supabaseAuthService.js`, communication services, assignment/claim/availability/location services.
- `js/repositories/`: Supabase and local repository boundaries. `supabaseSharedRepository.js` is critical.
- `js/schedule/`: schedule/workload/drawer interactions; `workloadPanel.js` contains a legacy Crew detail-card implementation.
- `data/`: local defaults/demo arrays and settings. Production build empties Crew/game data and removes demo loaders.
- `supabase/migrations/`: ordered schema/RLS/RPC migrations through `202608130002`.
- `supabase/functions/`: email worker and password-reset Edge Functions plus shared communication templates.
- `scripts/`: config generation, production build/verifier, local test server, production-link/push helpers.
- `tests/`: 151 Playwright spec files plus hosted Supabase fixture and global setup.
- `docs/`: architecture, Supabase, communications, migration, and operational documentation.
- `assets/`, `css/`, `styles.css`: images/icons/styles.
- `dist/`: generated production artifact; rebuild, do not treat as source.
- `work/`, `test-results/`, `playwright-report/`: temporary/diagnostic outputs; not authoritative source.

## 7. Database / Data Model

Core tables from `202608040001_initial_schema.sql`:

- `organizations`: tenant, timezone, active flag, JSON settings.
- `seasons`: organization seasons; partial unique index allows one active season per organization.
- `profiles`: application identity linked uniquely to `auth.users`; role/status/contact/profile metadata.
- `crew_members`: operational roster identity, optional unique profile link, contact data, `eligible_levels text[]`, `preferences jsonb`, active flag.
- `locations`, `fields`: organization venue hierarchy.
- `games`: season/location/field scoped schedule and lifecycle/report/review data.
- `game_assignments`: per-game positions, assignee, status, lock/decline data.
- `assignment_claims`: umpire claims and decisions with uniqueness for pending/approved states.
- `availability`: per-Crew date/time availability.
- `notifications`: account or role/audience notifications with reminder idempotency keys.
- `activities`: audit/activity stream.
- `report_presets`, `migration_runs`.
- `organization_invitations`: retained legacy invitation infrastructure; no longer required for ordinary public registration.
- `communication_events`, `communication_deliveries`: channel-neutral event and delivery queue.

Important integrity assumptions:

- Every tenant-scoped relationship includes `organization_id` and composite foreign keys where needed.
- Do not weaken RLS or accept organization/role/status from public registration clients.
- `profiles.auth_user_id` is unique.
- One Crew record per linked profile per organization.
- `validate_crew_profile_link` requires a valid approved umpire profile; approval RPC must approve the profile before linking Crew within the same transaction.
- Crew Contact Email is operational data; Login Email is Auth/profile identity. Do not silently synchronize them.
- Crew matching during approval is exact normalized verified email only. Ambiguous, inactive, or already-linked matches fail closed.
- Assignment and claim uniqueness/transition triggers must remain intact.

Migrations are forward-only. Do not edit/reorder already-applied production migrations; add a new migration.

## 8. Application Flow

### Public onboarding

Register first/last/email/phone/password → Supabase verification → trusted `provision_public_pending_umpire` selects the sole active organization and creates pending umpire profile → administrator sees pending account → `approve_pending_umpire` validates identity and same organization → exact-email Crew match or Crew creation → profile approval/link → notification/email/activity → user logs in with existing credentials.

### Crew management

Administrator opens Crew → authoritative roster loads from Supabase plus identity diagnostics → add uses `create_crew_member` RPC → edit uses `crewService.updateMember()` and direct RLS-scoped `crew_members` update → reload authoritative roster. Identity link/relink/unlink uses trusted RPC, not raw browser mutation.

### Schedule/assignment

Administrator/assigner imports or edits games → positions become assignments → assign directly or open for claims → eligible umpire claims → manager approves/rejects → assignment and communications update transactionally.

### Availability/umpire portal

Approved linked umpire loads own Crew identity → reads/updates own availability → sees own/open eligible assignments → claims/declines/completes as permitted.

### Communications

Database operation enqueues `communication_events`/deliveries → worker claims email deliveries under lease → template renders → Resend sends → worker completes/retries/skips → notifications remain separately queryable in app.

## 9. Implemented Features

- Authentication/account lifecycle: implemented; hosted Supabase only in production.
- Code-free public registration: implemented and deployed; no client role/org/status selection.
- One-click approval: implemented and deployed; legacy-compatible after ordering migration.
- Rejection email event: implemented using existing communication infrastructure.
- Accounts/Operations Center pending workflows: implemented through shared approval contract.
- Crew CRUD: creation and normal hosted mutation implemented; linked-card edit E3 fix deployed, manual acceptance pending.
- Crew identity integrity/diagnostics/password reset: implemented.
- Locations/fields: administrator creation RPCs implemented.
- Scheduling/import/assignment management: implemented with hosted RPCs and tests.
- Assignment claims/declines/withdrawal/repair: implemented with transition guards.
- Availability and profile self-service: implemented with ownership restrictions.
- Notifications/activity/communications/reminders: implemented.
- Reporting/export/presets: implemented to pilot scope.
- PWA metadata/install affordance: implemented.
- Production artifact/security headers/cache recovery: implemented, including content-addressed critical scripts.

## 10. Known Bugs / Errors

### P0 — Crew editor real acceptance pending

- Symptom before fix: authenticated administrator received `Unable to open Crew editor... [CREW-EDIT-E3]` for CJ.
- Proven cause: editor called `.includes()` on missing `member.levels` despite valid empty persisted `eligible_levels`.
- Files: `components/crew.js`, mapping/service/card/build/test files noted in git status.
- Fix: normalize mapped/persisted eligibility and configured levels before rendering.
- Status: deployed, automation green, real CJ retest not yet reported.
- Next: perform manual retest only; do not edit CJ using tooling.

Safe diagnostic codes retained:

- E1 Crew lookup
- E2 drawer host missing
- E3 field/preference/eligibility render exception
- E4 DOM mount exception
- E5 drawer absent after mount
- E6 unexpected outer launch failure

### Production asset cache/propagation fragility

- Symptom: custom canonical domain briefly served an older body under a newly advertised query-string URL during deployment propagation.
- Attempted/final mitigation: production build creates physical SHA-derived filenames for Crew component/workload/card scripts and appends the same hash query key. Verifier checks existence and hash.
- Status: implemented; do not casually remove.

### External documentation stale

- Registration screenshots showing Registration Code and approval screenshots showing mandatory Crew dropdown are stale.
- Status: intentionally deferred until onboarding acceptance completes.

## 11. Technical Debt / Fragile Areas

- Large classic-script global namespace. Duplicate/legacy Crew card implementations (`workloadPanel.js` and `crewCard.js`) can overwrite globals; delegated handler now protects hosted Edit activation.
- Dual hosted/local mode substantially increases branching and permits tests to exercise a different path accidentally.
- Snapshot-based state can become stale after mutations; successful commands generally refresh authoritative snapshots.
- Production is unbundled; script load order in `index.html` is architectural.
- Many tests use a Supabase fixture rather than a real database. SQL/RLS verification and manual production acceptance remain necessary for high-risk changes.
- Very large dirty worktree after release. Do not separate files without preserving relationships.
- `package.json` lacks dedicated lint/typecheck scripts.
- Custom-domain CDN behavior has shown non-atomic propagation; always verify canonical HTML and exact referenced assets after deployment.

## 12. Important Design Decisions

- Public registration is code-free for ordinary umpires, but server-trusted provisioning forces role/status/org. Reason: reduce pilot onboarding friction without opening privilege/tenant selection.
- Sole-active-organization rule fails closed at zero or multiple organizations. Reason: pilot-safe tenancy without speculative selection UX.
- Approval is one trusted transaction that matches/creates Crew, links, approves, notifies, communicates, and audits. Reason: eliminate partial onboarding state and duplicate manual entry.
- Approval uses exact verified-email Crew matching only. Name/phone matching is intentionally forbidden.
- Identity integrity trigger remains strict. Approval ordering was corrected rather than weakening the trigger.
- Login Email and Crew Contact Email are intentionally distinct ownership domains.
- Registration invitation infrastructure remains for compatibility, though normal public registration no longer uses it.
- Dead production Admin navigation is hidden; no new Admin feature was built solely for acceptance.
- Production build is curated and content-addresses critical assets instead of introducing a bundler late in pilot.

## 13. Things NOT To Break

- Branch/history: preserve `pilot-polish`; no rewrite, reset, commit, or push without explicit instruction.
- Do not lose uncommitted/untracked production work.
- Never expose service-role keys, management tokens, DB passwords, Resend keys, worker secrets, or user PII.
- Do not manually mutate/approve/re-register CJ or create duplicate CJ Crew/Auth/profile data.
- Do not weaken RLS, identity triggers, exact-email matching, organization scoping, or pending-account denial.
- Do not allow public client input to choose role, status, organization, or Crew identity.
- Preserve approval idempotency and communication idempotency.
- Preserve historical coverage; current expected suite is 970 tests with zero failures and zero skips.
- Preserve CSP-compatible event handling and current security headers.
- Preserve physical content-fingerprinting of critical production scripts until CDN behavior is redesigned and proven.
- Do not deploy preview branch when production is intended: Cloudflare Pages production branch is `main`; deploy artifact with `--branch main` without changing Git branch.

## 14. Configuration / Environment

Environment/configuration names observed (values intentionally omitted):

- `SUPABASE_URL`
- `SUPABASE_PROJECT_REF`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_ANON_KEY` (legacy/docs compatibility)
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `COMMUNICATION_WORKER_SECRET`
- `SLATE_APP_URL`
- `SLATE_EMAIL_FROM`
- `SLATE_EMAIL_REPLY_TO`
- `SLATE_PRODUCTION_EMAIL_FROM`
- optional `PLAYWRIGHT_EXECUTABLE_PATH`

Browser config is generated into ignored `config/supabase.js`; production build generates a fingerprinted runtime config. Never transfer real `.env` files or credentials into chat/source.

## 15. Development Commands

Run from repository root:

```powershell
npm install
npm run start:hosted
npm run start:local
npm test
npx playwright test tests/supabase-hosted-crew-management.spec.js
npm run build:production
npm run verify:production-artifact
git diff --check
```

Supabase CLI is installed as a dependency. Supported repository helper scripts:

```powershell
npx supabase migration list
npx supabase db push
./scripts/link-production-project.ps1
./scripts/push-production-migrations.ps1
```

The production push helper prompts for the DB password. Prefer normal Supabase migration history; never paste secrets into commands/logs. Edge Function deploy examples are documented in `docs/transactional-email-operations.md`.

Production artifact deployment currently used:

```powershell
npx wrangler pages deploy dist --project-name the-slate-production --branch main --commit-dirty=true
```

Do not deploy until production env variables are set, build/verifier/tests pass, and deployment is authorized by the task.

No supported lint or typecheck npm script exists.

## 16. Testing Status

- Framework: Playwright Test, one worker, retry once, local HTTP test server.
- Accessibility: axe coverage.
- 151 `.spec.js` files.
- Latest complete result: **970 passed / 0 failed / 0 skipped** on 2026-08-15.
- Coverage includes services, UI, authorization, hosted repository behavior, identity, claims, communications, cache recovery, production artifact, PWA, and Crew E3 regression.
- Supabase hosted tests generally use `tests/fixtures/supabase-auth.fixture.js`; they are not a substitute for production/Postgres verification.
- Current critical manual test is the CJ Crew-card Edit/Save/reload flow described in section 3.
- After Cloudflare deploy, verify the canonical domain, not only the deployment preview; inspect exact hashed asset contents.

## 17. Git / Recent Changes

- Current branch: `pilot-polish`.
- HEAD: `cb0a880` (`Release v1.0.0 Pilot`), tagged `v1.0.0-pilot`, tracking `origin/pilot-polish`.
- No commits after release; no push performed.
- Recent committed milestones: 7.7, 7.5 security/identity, 7.4 communications, 7.3 delivery/workflows, Milestone 6 pilot UX.

Dirty worktree is intentional and material. Modified tracked files include application shell, Crew/settings, Supabase repositories/services/auth, registration/login/accounts/operations UI, production build/verifier, communication functions, styles/docs, and numerous tests.

Important untracked source files include:

- `assets/icons/`
- `manifest.webmanifest`
- `js/ui/installHelper.js`
- production helper scripts
- migrations `202608120001` through `202608130002`
- new production/onboarding/cache/PWA/approval tests
- this `SLATE_PROJECT_STATE.md`

Also untracked: `work/` (temporary). Preserve until reviewed, but do not treat it as source or transfer secrets/dumps. The prior plaintext production restore dump was deleted and verified absent.

## 18. Open TODOs

### P0

1. Perform real authenticated desktop CJ Crew Edit → Save → reload acceptance on deployment `4a0e640e`.
2. If failure displays a diagnostic code, capture the code and browser console error; diagnose only that stage.
3. Preserve/capture the full dirty worktree before changing accounts/machines.

### P1

1. Once acceptance succeeds, update project status from pilot blocker to accepted/GO as appropriate.
2. Review and commit the production-closeout changes only with explicit user instruction.
3. Regenerate stale onboarding visual guide/screenshots.
4. Audit production migration history against local migrations `202608120001`–`202608130002`.

### P2

1. Reduce duplicate Crew-card/global-function fragility without redesigning during acceptance.
2. Add real Postgres integration coverage for highest-risk RLS/RPC paths if a stable test project is available.
3. Document/standardize Cloudflare cache purge/atomic deployment procedure.

### P3

1. Consider bundling/modules after pilot, not during blocker closure.
2. Add explicit lint/typecheck tooling.

## 19. Immediate Next Steps

1. **Ask the user for the result of the post-`4a0e640e` authenticated CJ Crew Edit/Save/reload retest; do not alter CJ.**
2. Re-read `components/crew.js`, `js/ui/crewCard.js`, `js/services/crewService.js`, the hosted Crew fixture, and this handoff before editing.
3. Confirm branch/status and preserve all dirty files.
4. If acceptance passes, record that result and reassess pilot GO; do not invent more work.
5. If acceptance fails, use the displayed E-code and console error to target the exact stage.
6. Run focused tests first, then production build/verifier, `git diff --check`, and full suite.
7. Deploy only the verified artifact to Cloudflare Pages production branch `main`.
8. Verify canonical HTML plus exact content-hashed assets after deployment propagation.
9. Never commit/push unless the user explicitly authorizes it.

## 20. Risks / Unknowns

- Final real CJ acceptance after `4a0e640e` is unknown.
- The available Codex in-app browser was anonymous and connected Chrome was unavailable; prior production diagnosis relied on user-reported safe code plus exact hosted reproduction.
- Production migration history should be rechecked before future schema changes; local files include applied production migrations but the handoff does not contain credentials.
- Some external guide artifacts are outside the repository or not identified precisely.
- CDN custom-domain propagation/cache behavior is not fully explained; mitigations are implemented, not a platform-level root-cause fix.
- The dirty tree contains changes from several closeout phases; commit boundaries were intentionally not created.

## 21. AI Developer Instructions

- Start by reading this file, `git status`, recent log, and the exact files involved in the active task.
- Treat user production observations as authoritative over fixture-only tests.
- Diagnose read-only before mutation. Protect PII and credentials in outputs.
- Keep changes minimal, general, and pilot-focused. No unrelated feature work or architecture refactor.
- Use `apply_patch` for source edits; preserve unrelated dirty changes.
- Add forward-only migrations; never rewrite applied migration history.
- Preserve hosted/local separation and never permit hosted fallback to local business data.
- Use service/repository/RPC boundaries rather than direct UI data mutation.
- Maintain RLS and identity integrity; fix transaction ordering or normalization rather than bypassing guards.
- Add regression coverage for the exact production category, not real CJ data.
- Run focused tests, production build/verifier, `git diff --check`, then complete Playwright suite for shared code.
- Verify Cloudflare production deployment is `Environment: Production`/branch `main`; a `pilot-polish` or `production` branch argument creates a preview.
- Verify canonical assets after deploy. Do not trust only the preview URL.
- Do not commit, push, approve users, edit CJ, or change production data unless explicitly instructed.

## 22. FINAL HANDOFF

### CURRENT STATE:

Slate is a production-pilot Supabase/Cloudflare static application with extensive automated coverage and operational onboarding/communication infrastructure. The integrated post-`v1.0.0-pilot` work is being converted into a clean release candidate on `pilot-polish`. Latest full automation is 970 passed / 0 failed / 0 skipped.

The last Crew editor failure was narrowed by production diagnostic E3 to an unsafe eligibility render assumption. A general normalization fix is deployed in `4a0e640e`, with physical content-addressed assets and cache-safe query keys. It is not yet manually accepted.

### LAST KNOWN TASK:

Fix authenticated linked Crew-card editing for CJ without manually changing CJ. The E3 normalization fix and exact regression are complete and deployed.

### NEXT ACTION:

Obtain the user’s real authenticated desktop result for: open CJ → Edit Crew Member → edit → Save → reload. If it fails, capture the safe E-code and console error before any code change.

### BIGGEST KNOWN RISK:

Losing or partially transferring the large dirty worktree, followed by mistakenly assuming `origin/pilot-polish` contains the production-closeout work. Secondary risk: declaring Crew editing fixed based only on tests rather than the pending CJ acceptance.

### MOST IMPORTANT FILES:

- `SLATE_PROJECT_STATE.md`
- `index.html`
- `app.js`
- `components/crew.js`
- `js/ui/crewCard.js`
- `js/schedule/workloadPanel.js`
- `js/services/crewService.js`
- `js/services/accountService.js`
- `js/services/sharedDomainMappingService.js`
- `js/repositories/supabaseSharedRepository.js`
- `scripts/build-production.cjs`
- `scripts/verify-production-artifact.cjs`
- `supabase/migrations/202608110001_identity_linkage_integrity.sql`
- `supabase/migrations/202608130001_public_umpire_registration_and_approval.sql`
- `supabase/migrations/202608130002_approval_identity_link_order.sql`
- `tests/fixtures/supabase-auth.fixture.js`
- `tests/supabase-hosted-crew-management.spec.js`
- `tests/production-runtime-config-cache.spec.js`
