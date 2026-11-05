# Scheduled recovery worker

The production recovery worker is invoked by GitHub Actions every five minutes at
`https://apren.vercel.app/api/cron/recovery`. Vercel Hobby Cron Jobs are limited
to one scheduled invocation per day, which is not frequent enough for expiring
reservation holds; therefore this repository intentionally does not register a
Vercel Cron Job.

## Required secrets

Configure the same high-entropy secret in both locations:

- Vercel project `apren`, **Production** environment: `CRON_SECRET`
- GitHub repository `CyberGrills/apren`, Actions secrets: `SEVEN_CRON_SECRET`

Generate a value locally with `openssl rand -hex 32`. Use the same randomly generated value in both settings. Do not commit it, add it to
a workflow file, or paste it into an issue or pull request. Redeploy production
after adding or changing the Vercel environment variable.

## Execution safety

- The endpoint accepts `GET` only and requires the bearer secret in production.
- A PostgreSQL session-level advisory lock prevents overlapping worker executions
  across serverless instances. The lock connection is held separately from the
  worker pool, so the scheduled function pool is configured for two connections.
- Existing queue leases, row locks, retry limits, and idempotent state transitions
  remain responsible for per-record processing safety.
- The endpoint returns a conflict-free `202` when another worker owns the lock,
  `200` after a completed pass, and a sanitized `500` on worker failure.
- GitHub Actions does not cancel an in-progress worker run. The five-minute
  schedule is best-effort and can be delayed by GitHub; it is not a hard real-time
  execution guarantee.

## Activation checklist

1. Merge the reviewed implementation PR.
2. Add `CRON_SECRET` to Vercel Production and `SEVEN_CRON_SECRET` to GitHub Actions.
3. Confirm the Vercel production deployment is ready.
4. Run the workflow manually once and confirm a `200` response.
5. Confirm subsequent scheduled runs appear in GitHub Actions and inspect Vercel
   function logs for worker failures.

No database migration or schema change is required to enable the scheduler.
