# Increment 7F: Auth Email Safety and Account Recovery

**Staging project:** `fdjhwxmphdzodxvhrblk`

**Hosted origin:** `https://the-slate-v2.pages.dev`

**Status:** implementation complete; hosted lifecycle acceptance pending

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

## Security verification

Migration `20261127203712_staging_auth_email_capture.sql` is additive. Live
grant inspection confirmed:

- hook execute: `supabase_auth_admin` only;
- one-time claim: `service_role` only;
- operator authorization and metadata status: authenticated administrators,
  with server-side workspace-role enforcement;
- safe explicit function search paths on every new function.

The database console cannot assume `supabase_auth_admin`, so hook execution is
validated through the real Supabase Auth service rather than by weakening role
grants for a console test.

## Acceptance evidence

To be completed after the hosted deployment:

- signup capture, confirmation, login, and refresh restoration;
- recovery capture, password reset, logout, and reauthentication;
- expired/replayed action rejection;
- external recipient and incorrect redirect rejection;
- invitation and tenant-isolation regression;
- exact test, artifact, deployment, and invariant results.

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
