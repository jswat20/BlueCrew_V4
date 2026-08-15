# Transactional email operations

Milestone 7.2 uses the `process-communication-emails` Supabase Edge Function and Resend. The browser never receives provider or worker credentials.

## Required Edge Function secrets

- `RESEND_API_KEY`
- `SLATE_EMAIL_FROM` — required production sender identity: `The Slate <notifications@worktheslate.com>`
- `COMMUNICATION_WORKER_SECRET` — a long, random invocation credential

Optional:

- `SLATE_EMAIL_REPLY_TO`
- `SLATE_APP_URL` — deployed HTTPS application origin; omit while the pilot is local-only

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are supplied to the deployed Edge Function runtime. Never copy these values into browser configuration.

## Production sender

- Display name: `The Slate`
- Sender email: `notifications@worktheslate.com`
- Verified domain: `worktheslate.com`
- Provider: Resend

The worker validates `SLATE_EMAIL_FROM` against this exact identity and returns `worker_sender_not_configured` without claiming or sending deliveries when it is missing or different. It does not fall back to a Resend test sender.

## Deployment and trusted invocation

Apply migrations through `202608090001_automatic_communication_email_worker.sql`, configure secrets through the Supabase secret manager, and deploy `process-communication-emails`.

For the linked staging project, set the sender and deploy with:

```powershell
pnpm exec supabase secrets set 'SLATE_EMAIL_FROM=The Slate <notifications@worktheslate.com>' --project-ref fsgjautpkdftvqynsjlb
pnpm exec supabase functions deploy process-communication-emails --project-ref fsgjautpkdftvqynsjlb
```

Do not place `RESEND_API_KEY` or `COMMUNICATION_WORKER_SECRET` in command history when initially configuring or rotating them; use the existing secure secret-entry workflow.

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

The production sender must remain `The Slate <notifications@worktheslate.com>`. Do not substitute a Resend test identity.

## Scheduling

Migration `202608090001_automatic_communication_email_worker.sql` installs the `process-communication-emails-every-minute` pg_cron job with schedule `* * * * *`. The job uses `pg_net` to send a `POST` to the worker and reads both values below from Vault at execution time:

- `slate_communication_worker_url` — the complete deployed function URL ending in `/functions/v1/process-communication-emails`
- `slate_communication_worker_secret` — the same value configured as the Edge Function's `COMMUNICATION_WORKER_SECRET`

Provision or rotate these values through the Supabase Vault UI or another secure server-side secret-entry workflow. Never paste the worker credential into a migration, repository file, browser configuration, URL, or operational log. The cron definition stores only the Vault secret names.

The Edge Function authentication and service-role boundary are unchanged. An anonymous caller still receives `401 unauthorized`; pg_cron is trusted only because it resolves the bearer credential inside Postgres at run time.

## Scheduled-worker observability

Operators can inspect delivery state without exposing provider credentials:

```sql
select status, count(*)
from public.communication_deliveries
where channel = 'email'
group by status
order by status;

select started_at, finished_at, status, return_message
from cron.job_run_details
where jobid = (
  select jobid from cron.job
  where jobname = 'process-communication-emails-every-minute'
)
order by started_at desc
limit 20;
```

Delivery history remains authoritative and is never deleted by the schedule. Idle executions return `claimed = 0`, `sent = 0`, `failed = 0`, and `skipped = 0`; sent rows are not claimed again, and retryable failures continue to use the existing maximum-attempt and stable-idempotency-key behavior.
