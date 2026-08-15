-- Milestone 7.3C: invoke the trusted communication email worker every minute.
-- The endpoint and bearer credential are provisioned separately in Vault. No
-- secret value belongs in this migration or in the cron job definition.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $schedule$
declare
  existing_job_id bigint;
begin
  select jobid
    into existing_job_id
    from cron.job
   where jobname = 'process-communication-emails-every-minute';

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule(
    'process-communication-emails-every-minute',
    '* * * * *',
    $worker$
      select net.http_post(
        url := (
          select decrypted_secret
            from vault.decrypted_secrets
           where name = 'slate_communication_worker_url'
        ),
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (
            select decrypted_secret
              from vault.decrypted_secrets
             where name = 'slate_communication_worker_secret'
          )
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 30000
      ) as request_id;
    $worker$
  );
end
$schedule$;

