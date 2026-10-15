# Current checklist decision — 2026-10-15

**BLOCKED_EXTERNAL_OWNER_ACCESS; READY_FOR_PRODUCTION_CANDIDATE=NO; SNAPSHOT=NOT_GENERATED.** Runtime c9584fe / dpl_5C2FZVYGJrgqixp5btBKKRh7XK9D remains unchanged.

| Mandatory gate | Current status | Evidence / completion condition |
| --- | --- | --- |
| 44 migrations reconciled | PASS | Remote 20261015163447 maps to local 20261014160000_google_pilot_gate_fails_closed.sql by content/function hashes; no duplicate. |
| CI / focused tooling | PASS | PostgreSQL17 + deploy boundary 91e6041 SUCCESS; readiness 24/24, Google local 3/3. |
| Runtime target / exact redirect / closed UI | PASS_SCOPE | Auth settings request observed on staging; exact Preview Site URL and redirect persisted; disabled Google-only CTA. |
| Preview secret metadata | PASS_METADATA | 12 names; no privileged secret names; values never opened. |
| Google provider / approved cohort | BLOCKED_EXTERNAL_OWNER_ACCESS | Google OFF; Google Cloud credential APIs fail to load; allowlist empty and owner must approve identities/roles. |
| Real Google PKCE/session/logout/revocation/linking / tenant A-B / core E2E | NOT RUN | Required on exact candidate after provider/cohort; old password E2E cannot substitute. |
| Health/headers/CORS/log correlation | BLOCKED_AUTHENTICATED_PREVIEW_ACCESS | No-session 302 protection response; app endpoints inaccessible through normal browser, no bypass. |
| Security release checkpoint | BLOCKED | Structural/local controls reviewed; authenticated Google and app-traffic gates remain open. |
| Recovery | PASS_PRESENCE / NOT RUN_RESTORE | Verified checkpoint 1 / 57 rows; full restore not executed. Preserved account unchanged. |
| PR metadata | BLOCKED_GITHUB_WRITE_PERMISSION | API 403; browser logged out; corrected body prepared. |
| Production | PASS_UNTOUCHED | No production authorization/action. |

[Full evidence and one grouped owner action](GOOGLE_ONLY_PILOT_CLOSURE_2026-10-15.md). Commercial/legal approvals remain separate. Snapshot only after required technical gates, no inferred readiness.

## Historical checklist decision — superseded

# Current checklist decision

`READY_FOR_PRODUCTION_CANDIDATE=NO`; snapshot final **NOT GENERATED**. Current exact candidate is `c9584feb52eca364100e95abcfef7037316c6147` / Preview `dpl_5C2FZVYGJrgqixp5btBKKRh7XK9D` in `orkto-staging`, READY/Preview.

| Gate | Current status | Evidence / next condition |
| --- | --- | --- |
| Staging migrations | BLOCKED — 43/44 | Read-only SQL Editor query returned 43 ledger entries; latest is `20261014152518`. Local pending migration 44 is `20261014160000_google_pilot_gate_fails_closed.sql`, SHA-256 `20FFABFB627B8BD30BB36FB2F2E1F00BD862840F3E12FC8DD63BC47309E21D7D`. It passes PostgreSQL 17 CI but is not applied remotely. Use a supported authenticated migration path, then recheck ledger and assertions. |
| Google-only UI | PASS — fail-closed | Exact Preview has no password form; Google login is disabled and configuration-required. |
| Google OAuth | BLOCKED_OWNER_CONFIGURATION | Supabase Google and Email providers are visibly OFF; Auth hooks are ENABLED. No Google client credentials or approved pilot identities. Redirect allowlist did not load. Real callback/PKCE/session E2E NOT RUN. |
| Tenant/auth adversarial | NOT RUN on exact candidate | Synthetic password A/B cannot substitute for Google identity A/B. One origin-unknown staging account remains preserved. |
| Vercel Preview secret metadata | PASS for reviewed names/scopes | Mode flags are Config, Preview-only, exact branch. No privileged/service-role/provider/billing/messaging secret names; values were not revealed. |
| Health/readiness/observability | NOT_VERIFIABLE | Direct health/ready requests were blocked by browser/runner; no SSO bypass link was created; current deployment logs/analytics not validated. |
| Local CI | PASS for c9584fe | 213/213 app + 57/57 readiness; lint/typecheck, builds, smoke, diff check, secret scan 387 files/zero findings. PostgreSQL 17 and deploy-boundary PR checks succeeded. |
| Production | PASS — untouched | No production target, data, Auth, secret or service was changed. |

The 5/5 E2E on `d693e2f` and prior password-based A/B runs are historical; neither proves Google-only on `c9584fe`. The Supabase Free leaked-password warning is not treated as fixed. Commercial/legal approval is a separate pilot gate; no payment, paid provider, public launch or production go-live is authorized by this technical status.

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
