# Increment 4A — Hosted session restoration

## Scope

This sub-increment fixes the hosted startup sequence before workspace switching
or neutral-game schema work begins. It does not change the database, Supabase
Auth configuration, module entitlements, or production infrastructure.

## Root cause

The hosted shell rendered the Login page, replaced browser history with Login,
and marked initialization complete before Supabase `getSession()` and profile
hydration finished. A valid persisted session could therefore appear logged out
during every hard refresh. The service worker is network-first for navigation,
and the Supabase client was already configured with `persistSession`, automatic
token refresh, and callback URL detection; neither was the source of the false
Login state.

## Resolution

- Hosted startup now renders a neutral, non-authenticated "Restoring your
  session" state while session and workspace access are verified.
- Login is rendered only after restoration authoritatively reports no usable
  session or an error.
- A valid session restores the prior internal page from browser history when it
  remains an authenticated destination; otherwise it opens the dashboard.
- Initialization becomes complete only after the restoration outcome is known.
- Explicit logout behavior remains unchanged and clears the Supabase session and
  authenticated application snapshots.

## Verification

- A delayed-session browser fixture proves Login is never rendered while
  restoration is in flight.
- Existing hard-reload, global logout, authentication, runtime configuration,
  and service-worker cache tests remain enabled.
- The complete Playwright regression suite and the staging-only artifact build
  are required before deployment.

## Deferred to Increment 4B

Secure workspace switching requires replacing legacy single-profile tenant
derivation with a server-validated active membership. That migration and the
neutral game ownership model remain separately reviewable work; neither is
simulated with a client-supplied organization identifier in this sub-increment.
