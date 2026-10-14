# Current checklist decision

READY_FOR_PRODUCTION_CANDIDATE=NO. Use [the dated gate matrix](READINESS_TECHNICAL_2026-10-13.md) for PASS/FAIL/BLOCKED evidence. Existing checkboxes below are not silently marked complete. c1660be Preview and exact-SHA PostgreSQL 17 CI passed; local 198+43, build/lint/smoke and public HTTP/a11y/performance/correlation passed. Final Auth A/B/WIA/Inbox/public-token execution remains BLOCKED_PRIVATE_RUNNER_INPUT. Leaked-password defense remains BLOCKED_FREE_PLAN. Snapshot NOT GENERATED.

The previous accepted 2/2 run belongs to 65d5f8a; the later four-case run also used 65d5f8a because parameters were omitted and failed two harness assertions. These are preserved separately. Corrected five-case harness now defaults to c1660be. Staging recovery assessment/rebuild is documented with owner identity excluded and full disaster restore NOT RUN. Production backup/restore and GO/NO-GO require the separate production session; commercial/legal readiness and future UX work are not implied by technical checks.

---

# ORKTO release-candidate checklist

Status: **not approved**. Each checkbox requires a link/hash to evidence for the exact candidate snapshot; local tests or old v04 evidence cannot be reused after code changes.

## Pre-deploy

- [ ] Snapshot manifest, all source hashes, branch/commit and migration count match the reviewed candidate; secret scan passes on source, build, snapshot and logs.
- [ ] PostgreSQL 17 replay and assertions pass for **all candidate migrations**; compare the effective schema and ledger of the target environment. Unknown diff = NO-GO.
- [ ] Database backup is restore-tested; migration lock/writes window, forward-fix owner and stop criteria are agreed.
- [ ] Auth, roles, membership, grants, SECURITY DEFINER, RLS and tenant A/B negative tests pass in staging with real sessions.
- [ ] Core app browser E2E covers login/session, Hoje, Clientes, Negócios, Catálogo, Propostas, Inbox, WIA approval/rejection, audit and refresh on two synthetic workspaces.
- [ ] API IDOR, public tokens, billing, webhook and import abuse tests pass; PIX remains OFF unless durable-idempotency and provider reconciliation are separately proven.
- [ ] WIA Gemini gateway/router failures are controlled; no paid fallback. Channel delivery labels distinguish accepted from receipt-backed delivered.
- [ ] Request/action/job correlation and redaction are checked against actual staging traffic; no passwords, admin keys or tokens in artifacts.
- [ ] Desktop/mobile, light/dark, loading/empty/error/permission states and keyboard smoke are reviewed.
- [ ] Performance measured online; optional WebGL is lazy. Warnings alone are review items, measured regressions require triage.
- [ ] Legal flags for cross-workspace memory and public cases are OFF. External messaging, payment and paid model access are separately approved or OFF.
- [ ] Supabase Auth leaked-password setting and redirect URLs are verified manually for the release environment.

## Deploy and post-deploy

1. Recheck exact environment refs immediately before deployment. Any production/staging mismatch = STOP.
2. Deploy the reviewed artifact only. Do not build from a drifting dirty tree.
3. Run health, Auth, safe read/write smoke, A/B isolation, WIA configuration/approval state, Inbox configuration state and logout. No real message, charge or paid call by default.
4. Compare logs, metrics and request IDs; investigate any unexplained 4xx/5xx, workspace crossover, missing audit event or duplicate external effect.

## Rollback triggers and decision

Tenant crossover, secret exposure, duplicate charge/send, failed migration or critical Auth outage = immediate NO-GO/containment. App rollback only if schema-compatible; otherwise disable affected path and apply a reviewed forward fix. Follow `DATABASE_ROLLBACK_PLAN.md` and `ORKTO_INCIDENT_RECOVERY_RUNBOOK.md`. Final GO requires explicit human authorization in Session 2 of `ORKTO_HUMAN_ACTION_BACKLOG.md`.
