-- Enabled only after private.run_operational_retention() passed a rollback-only
-- staging exercise. This job references monitoring tables only.
select cron.unschedule(jobid) from cron.job where jobname = 'slate-operational-retention';
select cron.schedule(
  'slate-operational-retention',
  '17 3 * * *',
  'select * from private.run_operational_retention()'
);
