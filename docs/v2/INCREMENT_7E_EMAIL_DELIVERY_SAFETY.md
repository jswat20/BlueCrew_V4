# Increment 7E: Email Delivery and Communication Safety

**Staging project:** `fdjhwxmphdzodxvhrblk`

**Environment:** V2 staging only

**Status:** accepted for application-generated staging email; Auth email remains deliberately disabled pending its separate sink

## Architecture inventory

The Slate has two independent email boundaries:

1. **Supabase Auth email.** Signup confirmation, password recovery, email changes,
   and Auth-managed invitations are emitted by Supabase Auth. They do not pass
   through the application communication queue. Staging must therefore keep
   Auth email constrained separately; the application sink does not make Auth
   email safe.
2. **Application transactional email.** Domain events are written to
   `communication_events`, expanded into `communication_deliveries`, leased by
   a worker, rendered from allowlisted templates, and submitted to a provider.
   The production-capable worker remains `process-communication-emails` with a
   server-only invocation credential and Resend adapter.

Implemented application events include account approval, official registration
and approval, claims and assignments, game reminders and game changes, and
messaging notifications. Workspace invitation links are currently returned once
to the authorized inviter and are not automatically emailed. Tournament and
facility-specific outbound notifications are not implemented. These are product
gaps, not acceptance results to manufacture with generic email.

## Staging fail-closed boundary

Migration `20261127201646_staging_email_safety_sink.sql` adds a private capture
store and narrowly scoped RPCs. The `staging-email-sink` Edge Function:

- runs only when its Supabase URL contains the exact staging project reference;
- requires a valid JWT and a server-validated workspace administrator;
- claims only deliveries explicitly marked `staging_email_test`;
- accepts only approved, same-workspace profiles at the reserved
  `@slate.invalid` domain;
- uses an adapter with no network or provider implementation;
- stores delivery metadata and outcome, never the message body, link token,
  provider credential, or service-role credential;
- exposes queue claim and capture operations only to `service_role`;
- leaves the production worker, sender, provider adapter, and historical queue
  unchanged.

The capture row is evidence that the sink accepted a rendered message. It is
not evidence of inbox delivery. Likewise, a real provider's acceptance means
only that the provider accepted the API request.

The existing application cron remains disabled. The 18 pre-existing pending
deliveries do not contain the staging marker and cannot be selected by the sink
claim RPC.

## Reliability behavior

- Queue leasing uses `FOR UPDATE SKIP LOCKED` and expiring lease tokens.
- A stable delivery idempotency key is retained across attempts.
- A delivery attempt must be begun under its current lease before capture.
- Capture uniqueness on `(delivery_id, attempt_number)` prevents duplicate
  evidence for a retried request.
- Success moves a delivery to `sent`; it cannot be claimed again.
- Retryable failure uses the established bounded retry policy (maximum three
  attempts with 60/300/900-second backoff).
- The controlled failure mode fails the first attempt and succeeds on retry,
  without making a network request.
- Recipient preferences and tenant-qualified profile relationships continue to
  be enforced by the established event and delivery pipeline.

## Staging verification evidence

Database acceptance on November 27, 2026 safely exercised four synthetic
deliveries: Officials assignment, League game-time change, account approval,
and a controlled transient failure. Results:

- four distinct deliveries reached `sent`;
- one controlled failure was captured and then succeeded on attempt two;
- no capture addressed a recipient outside `@slate.invalid`;
- non-administrator enqueue, cross-workspace recipient, unsupported event, and
  browser-side queue claim attempts were rejected;
- all 18 historical pending deliveries remained pending;
- active communication cron jobs remained zero.

The account-approval event validates the account template and queue path. It is
not a claim that workspace invitation delivery exists. Invitation acceptance
continues to use the previously accepted one-use link workflow with a verified
synthetic identity.

The hosted V2 application was also re-opened in a persistent authenticated
browser session and restored its active workspace and tenant-scoped schedule.
The deployed `staging-email-sink` is version 1 with JWT verification enabled.
No Cloudflare application deployment was required because this increment did
not change browser application code.

Validation results:

- focused email regression: 30/30 passed;
- complete regression: 1,287 passed, one intentionally skipped;
- post-reconciliation focused safety regression: 6/6 passed;
- V2 staging artifact build and isolation verification: passed;
- staging migration history: 87 migrations, including all three Increment 7E
  forward migrations;
- performance advisor: the new capture-table foreign-key index was added;
- security advisor: the existing intentionally anonymous public tournament RPC
  remains the only anonymous `SECURITY DEFINER` finding. The new authenticated
  staging RPCs are intentionally callable but perform server-side administrator
  authorization; worker RPCs remain service-role-only.

## Supabase Auth email boundary

Auth email must remain separately constrained in staging. Before exercising
signup confirmation or password recovery, configure either an approved local
test inbox/custom SMTP sink or a Supabase Send Email Hook that enforces an
approved recipient allowlist and does not log action links or tokens. Do not use
production SMTP credentials. Until that control is configured and verified,
Auth email flows are intentionally not exercised as outbound staging mail.

## Production activation checklist

1. Obtain change approval and verify production project and deployment targets.
2. Verify the sender domain and DKIM/SPF/DMARC configuration with the selected
   transactional provider.
3. Configure production credentials only in the provider/Supabase secret store.
4. Confirm production never deploys or invokes `staging-email-sink`.
5. Review event templates, required fields, safe links, and tenant branding.
6. Confirm suppression, unsubscribe/preference behavior, bounce and complaint
   handling, and abuse-rate limits.
7. Run one allowlisted canary per supported event and correlate queue state with
   provider acceptance; do not equate acceptance with inbox placement.
8. Configure backlog depth, failure-rate, lease-expiry, and oldest-pending alerts.
9. Establish retry/backlog operator ownership and an approved replay procedure.
10. Enable scheduling only after the queue has been reviewed and historical
    rows have an explicit disposition.
11. Document the emergency shutdown: disable the schedule, revoke the worker
    invocation secret, and then disable/rotate provider credentials if needed.
12. Reactivate only after recipient scope and the pending queue are re-audited.

## Remaining operational gaps

- A dedicated Auth email sink/allowlist has not yet been configured.
- Workspace invitation email is not implemented; secure manual transfer remains
  the supported flow.
- Tournament and facility notification products are not implemented.
- Provider webhooks, bounce/complaint suppression, and delivery dashboards need
  implementation before production messaging activation.
- Production credentials, sender-domain verification, scheduling, and backlog
  replay remain deliberately untouched.
