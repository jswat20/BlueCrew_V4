# Transactional email operations

Milestone 7.2 uses the `process-communication-emails` Supabase Edge Function and Resend. The browser never receives provider or worker credentials.

## Required Edge Function secrets

- `RESEND_API_KEY`
- `SLATE_EMAIL_FROM` — a sender on a verified Resend domain
- `COMMUNICATION_WORKER_SECRET` — a long, random invocation credential

Optional:

- `SLATE_EMAIL_REPLY_TO`
- `SLATE_APP_URL` — deployed HTTPS application origin; omit while the pilot is local-only

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are supplied to the deployed Edge Function runtime. Never copy these values into browser configuration.

## Deployment and trusted invocation

Apply migrations through `202608080002_email_delivery_worker.sql`, configure secrets through the Supabase secret manager, and deploy `process-communication-emails`.

Invoke the function with an HTTPS `POST` whose `Authorization` header contains the server-held `COMMUNICATION_WORKER_SECRET`. Do not place that credential in a browser, URL, repository file, or client-visible scheduler definition.

The response contains counts only (`claimed`, `sent`, `failed`, and `skipped`). It never returns recipient addresses, message bodies, provider credentials, or service-role credentials.

## First pilot smoke

1. Confirm the Resend sender/domain is verified and the intended recipient is permitted by the current Resend account mode.
2. Approve one real hosted assignment claim for that recipient.
3. Confirm one `claim-approved` row exists in `communication_events` and one email row exists in `communication_deliveries`.
4. Invoke the worker once from a trusted terminal or server environment.
5. Confirm the delivery becomes `sent`, `attempt_count` is `1`, `sent_at` is populated, and `provider_message_id` is retained.
6. Confirm the recipient inbox receives the expected alias-first, AM/PM, U-position email.
7. Invoke the worker again and confirm no second provider message is created.

If Resend is in test mode, use only the provider-permitted validation recipient and record that limitation. Do not invent or bypass a sender identity.

## Scheduling

Recurring invocation is intentionally deferred until the deployed function URL and a Vault-held invocation secret are available. A one-minute `pg_cron`/`pg_net` schedule may then call the same authenticated endpoint. The secret must be read from Vault server-side and must never be embedded in migration SQL.
