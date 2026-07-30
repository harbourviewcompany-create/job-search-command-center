-- Schedule follow-up draft creation daily (after job pull)
-- Requires pg_cron + pg_net and vault secrets from 003_schedule_job_pull.sql

SELECT cron.schedule(
  'daily-follow-up-scheduler',
  '0 13 * * *', -- 13:00 UTC daily
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/follow-up-scheduler',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'job_pull_auth_key')
    ),
    body := jsonb_build_object('source', 'cron', 'triggered_at', now())
  ) AS request_id;
  $$
);
