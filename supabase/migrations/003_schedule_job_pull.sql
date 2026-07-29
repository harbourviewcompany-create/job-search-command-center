-- Schedule daily job pull Edge Function via pg_cron + pg_net
-- Prerequisites:
--   1. Deploy edge function: supabase functions deploy daily-job-pull
--   2. Set function secrets: ADZUNA_APP_ID, ADZUNA_APP_KEY (and optional INDEED_PUBLISHER_ID)
--   3. Enable extensions: pg_cron, pg_net (Dashboard → Database → Extensions)
--   4. Store project URL + service role (or anon) in Vault as below

-- Enable extensions if not already
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Store secrets in Vault (run once; replace placeholders)
-- select vault.create_secret('https://YOUR_PROJECT_REF.supabase.co', 'project_url');
-- select vault.create_secret('YOUR_SERVICE_ROLE_OR_ANON_KEY', 'job_pull_auth_key');

-- Unschedule previous job if re-running this migration
SELECT cron.unschedule('daily-job-pull')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'daily-job-pull'
);

-- Daily at 12:00 UTC (8:00 AM Eastern in standard time; adjust as needed)
-- Cron: minute hour day-of-month month day-of-week
SELECT cron.schedule(
  'daily-job-pull',
  '0 12 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
           || '/functions/v1/daily-job-pull',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer '
        || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'job_pull_auth_key')
    ),
    body := jsonb_build_object('source', 'pg_cron', 'triggered_at', now()::text)
  ) AS request_id;
  $$
);

-- Verify: SELECT * FROM cron.job WHERE jobname = 'daily-job-pull';
