# Staging browser E2E harness

The browser suite is opt-in and pinned to the isolated Vercel and Supabase staging identities. It refuses missing synthetic identities, non-staging preview hosts, a different project ID/ref, or known production references.

## Single command after Session 1 configuration

Set the required values only in the secure runner environment, never in chat or source files:

- `ORKTO_STAGING_PREVIEW_URL`: final HTTPS Preview URL whose hostname is labeled staging.
- `ORKTO_STAGING_EXPECTED_SHA`: full 40-character Git SHA of that exact Preview deployment.
- `ORKTO_STAGING_E2E=1`: explicit opt-in to the synthetic staging run.
- `ORKTO_STAGING_SUPABASE_URL`: `https://ghrjongiodziasupakrk.supabase.co`.
- `ORKTO_STAGING_SUPABASE_ADMIN_KEY`: staging-only Auth Admin / server key.
- `ORKTO_STAGING_SUPABASE_PUBLISHABLE_KEY`: publishable/anon key from the same staging project.
- `ORKTO_STAGING_ADMIN_KEY_SHA256` or the accepted project-bound fingerprint when the key is opaque.
- `ORKTO_STAGING_PUBLISHABLE_KEY_SHA256` when the public key is opaque.
- `APP_ENV=staging`, `VITE_APP_ENV=staging`, `VERCEL_PROJECT_ID=prj_KZm12jmZIKL3Tqnk2I9DBa9MabKc`, and `ORKTO_STAGING_VERCEL_PROJECT_ID` with the same pinned project ID.

Then run:

```powershell
npm run readiness:staging:auth-e2e
```

The Auth runner verifies the staging key boundary, then authenticates with Vercel to bind the Preview URL to the staging project and exact SHA **before any synthetic mutation**. On Windows the Vercel child uses the system CA; the CLI `inspect` response omits SHA, so the runner checks SHA against metadata from the ID-scoped project deployment list. It uses the Supabase Auth Admin API to create/rotate only the two synthetic identities, prepares idempotent synthetic records, tests RLS-negative operations, then invokes Playwright in a child process. The child receives only the Preview URL, pinned public project identities and SHA, and short-lived synthetic email/password values. It does not receive the administrative key, public key, or unrelated inherited process environment. Passwords are never written to storage state, files, reports, or logs.

## Browser coverage and retained evidence

The current spec validates `/api/health` and `/api/ready`, signs in as A, verifies A-only client rows, reloads to check session persistence, visits Today/Clients/Deals/Catalog/Proposals/Inbox/WIA, captures synthetic-only screen images at 390, 768, 1280, and 1440 widths, signs out, signs in as B, and verifies the client list does not contain A's record. It rejects browser requests to known production hosts and any non-staging Supabase project, plus uncaught page errors, same-origin network failures, and same-origin 5xx responses.

Playwright traces and video are intentionally disabled: traces may serialize `Authorization` headers or browser storage even when credentials do not appear in test output. Failure screenshots contain only the synthetic staging UI and are kept under ignored `test-results/`. If trace retention is later required, add and review a redaction/export step before enabling it.

The current staging ledger is 41/41 per the latest recorded remote evidence, but this document does not substitute for a fresh ledger check. The authenticated A/B browser spec has **not** passed on the current SHA `6099a2cc44d9194afb30a331a9ac52bd15602065` / deployment `dpl_DZCCuMt8NSFbgZ5DbtQyDX3bh6uw`. No staging admin key is available in this runner session. The historical dashboard-created `.invalid` users have passwords unavailable to the runner, so browser login on earlier hostnames cannot close this gate. The secure runner must use a staging-only admin key in a protected runner session; never place it in Vercel Preview or source. The harness itself does not provision a browser binary, secret or deployment.

An unauthenticated GET to the exact immutable Preview returned HTTP 302 to `vercel.com` on 13/10. Playwright therefore also needs an owner-approved way through Vercel Authentication for this staging deployment. The earlier authorization for temporary bypass applied only to `/api/health` and `/api/ready`; it does not authorize a full-suite bypass. Do not disable deployment protection or place a bypass credential in the repository to make the suite run.
