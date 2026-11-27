# Increment 7F: Auth Email Safety and Account Recovery

**Staging project:** `fdjhwxmphdzodxvhrblk`

**Hosted origin:** `https://the-slate-v2.pages.dev`

**Status:** deployed to V2; final reauthentication acceptance in progress

## Isolation design

Supabase Auth email is isolated independently from the application-generated
email queue accepted in Increment 7E. Staging uses Supabase's supported Send
Email Hook with the private Postgres function
`private.staging_auth_send_email_hook`.

The hook:

- is `SECURITY INVOKER` and executable only by `supabase_auth_admin`;
- accepts only the reserved, non-routable `@slate.invalid` recipient domain;
- accepts only the exact V2 Site URL and redirect origin;
- performs no HTTP request and has no SMTP or provider integration;
- stores no message body, action URL, OTP, password, or provider credential;
- encrypts the Auth token hash with a database-generated, private key;
- isolates encryption behind a private `SECURITY DEFINER` helper so the Auth
  role cannot read the key or use the `extensions` schema directly;
- expires captures after 15 minutes and permits a single claim;
- rejects unsupported actions and deliberately disables email-change delivery;
- fails closed if the key, recipient, action, or redirect is invalid.

An explicitly allowlisted V2 staging operator who is also a workspace
administrator may request a pending signup or recovery action through
`staging-auth-email-action`. The Edge Function validates
the exact staging project, rechecks administrator status in the database, and
uses its server-only service role to claim one capture. It returns the resulting
one-time Auth verification URL only to that authorized browser with
`Cache-Control: no-store`. The browser validates the Supabase hostname, verify
path, and V2 redirect before navigating. The plaintext token is never written
to the database, application logs, Git, or this report.

The capture records the claiming operator's Auth user id for audit. Direct
claim is denied to `anon` and `authenticated`; the hook is denied to `anon`,
`authenticated`, `service_role`, and `PUBLIC`.

## Configuration

The staging Auth configuration is intentionally narrow:

- Site URL: `https://the-slate-v2.pages.dev`
- redirect allowlist: `https://the-slate-v2.pages.dev/**`
- email confirmation remains required;
- Send Email Hook: enabled, Postgres, private schema;
- staging email-send limit: 10/hour for controlled lifecycle exercises;
- SMTP/provider credentials: none introduced;
- existing application communication cron: disabled.

Production Auth configuration and credentials were not inspected or changed.

## Application changes

- Signup continues to request confirmation with the current hosted origin.
- Forgot-password and administrator-reset redirects now use the actual hosted
  origin instead of a hard-coded production URL. Production therefore retains
  its production origin while V2 correctly remains on V2.
- A staging-only administrator card in Settings can open an approved pending
  signup or recovery action. The card is absent outside the exact staging
  project and V2 origin.
- Increment 7E's application-generated sink, its captures, and the historical
  queue remain separate and unchanged.
- Freshly issued sessions retry only the exact transient `JWT issued at future`
  gateway error once after 300 ms. This addresses a measured same-second
  Supabase gateway race without retrying invalid credentials or other Auth
  failures.

## Security verification

The Increment 7F migrations are additive. Live grant inspection confirmed:

- hook execute: `supabase_auth_admin` only;
- one-time claim: `service_role` only;
- operator authorization and metadata status: authenticated administrators,
  with server-side workspace-role enforcement;
- safe explicit function search paths on every new function.
- no Auth-role read access to the capture encryption key;
- no Auth-role usage of the `extensions` schema, so inherited pgcrypto
  function execute defaults are not reachable by the hook role.

The database console cannot assume `supabase_auth_admin`, so hook execution is
validated through the real Supabase Auth service rather than by weakening role
grants for a console test.

## Acceptance evidence

Initial deployed commit `7fad8e1` converged on the V2 Pages origin. The hosted Settings
page rendered the staging-only operator control and rejected a non-allowlisted
recipient with actionable feedback while moving focus to the alert.

Live negative checks through the actual staging API verified:

- an external reserved-domain recipient was rejected and no Auth user remained;
- a non-V2 redirect was rejected;
- anonymous operator and claim RPCs returned `401`;
- an unauthenticated Edge invocation returned `403`;
- one explicit operator is provisioned, with no broad administrator access;
- the 18 historical application deliveries remain pending and the application
  communication cron remains disabled.

Hosted lifecycle evidence completed before the final client retry deployment:

- synthetic signup was captured through the real Auth hook and confirmed from
  the hosted operator workflow;
- the verified account signed in with zero inherited workspace memberships and
  restored the correct onboarding state after refresh;
- hosted Forgot Password displayed enumeration-resistant feedback;
- the recovery action was claimed once through the hosted operator workflow;
- password update completed through the hosted recovery page and returned the
  user to Login with an explicit success confirmation;
- database evidence records one claimed signup action and one claimed recovery
  action, with no external-recipient captures.

Validation results:

- focused Increment 7F security contract: 8/8 passed;
- previously combined Auth/application email and account security: 23/23 passed;
- complete regression: 1,295 passed, one intentionally skipped (1,296 total);
- V2 staging artifact build and isolation verification: passed;
- migration history: 97 migrations, including all Increment 7F changes;
- `staging-auth-email-action`: deployed version 2 with JWT verification and
  exact-origin CORS; deployment id
  `89e2391c-2d9c-45f1-b824-5b1e91091410`.

Final closure requires reauthentication with the changed password against the
deployed same-second JWT retry and refresh restoration. Replay and expiration
remain enforced by the one-time claimed state and 15-minute database expiry;
the focused contract and database authorization tests cover both negative
paths without logging or reusing an action token.

## Production requirements

Before production email activation, separately approve and configure a
production transactional provider, verified sender domain, template set,
bounce/complaint handling, rate limits, alerting, and incident shutdown. The
staging hook must never be enabled in production and `@slate.invalid` must never
be treated as a production recipient. Production activation requires its own
change review and canary plan.

## Current limitations

- The safe capture mechanism is an operator-assisted staging test facility,
  not a customer email inbox.
- Email-change delivery is intentionally unavailable in staging until a
  dedicated two-address acceptance design is reviewed.
- Billing, production SMTP/provider setup, and historical backlog disposition
  are outside this increment.
