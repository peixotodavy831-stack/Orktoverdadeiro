# ORKTO Security Audit Current

## Focused staging checkpoint — 2026-10-07

This is a current focused checkpoint, not a completed release audit. Production was not changed. The 2026-10-02 observations below remain historical. Staging is at migration 31/31; the current Edge Function is version 13.

| Surface | Current result | Evidence / limit |
| --- | --- | --- |
| Staging database grants and RLS | PASS for catalog coverage | Read-only catalog inspection after migration 31 found all 61 public relations with RLS enabled where applicable, no public view lacking `security_invoker`, and zero public tables granting anon/authenticated INSERT/UPDATE/DELETE. This is metadata evidence; live tenant tests cover only selected paths. |
| Edge command boundary | PASS for completed commands | `orkto-core-mutations` version 13 has JWT verification. All 12 public command RPCs have no anon/authenticated EXECUTE, service-role EXECUTE and a fixed search path. Live A/B Inbox and Quote create/edit/archive tests passed authorization, cross-tenant denial, replay and audit. Remaining write commands are open. |
| Browser A/B covered path | PASS for covered path | The guarded `orkto-staging` Preview `orkto-staging-lqpus4zzt-peixoto-s-projects1.vercel.app` passed Playwright 2/2 again after migration 31, including authenticated Inbox/WIA collection reads, tenant-visible Clients, Quote create/edit/archive, cross-workspace denials, logout/session swap and responsive shell. This does not verify all action paths or malicious request variants. |
| Mock route exposure | PASS for staging configuration | `backend/app-factory.ts` mounts `orkto-routes.ts` only behind `ORKTO_ENABLE_MOCK_ROUTES=true` and throws for staging, Preview and Vercel runtimes. The old `InboxPage.tsx` references `webhook-sim` but is not imported by the live product shell. |
| SECURITY DEFINER helper review | PASS for exposed helper set | Read-only staging catalog after migration 28 enumerated 24 `public` definer functions: 21 are not executable by anon/authenticated; three authenticated-callable helpers are `orkto_is_workspace_admin`, `orkto_is_workspace_member`, and `orkto_legacy_owner_matches`. All 24 have a fixed empty `search_path`; source inspection of the three helpers found qualified table references and caller membership checks. Real staging A/B RPC tests returned true for each owner's workspace and false for the foreign workspace across all three helpers; an anonymous helper call was denied. The rest of the release audit remains open. |
| Release review | PENDING | Terminal Deal, Quote extend/generate/public transitions, import Contacts and WIA prepare/execute still have direct backend write paths or incomplete live evidence. Authorization, IDOR, concurrency, audit atomicity, rate limiting and error leakage remain to be checked after conversion. [PostgreSQL 17 CI run 37678982727](https://github.com/peixotodavy831-stack/Orktoverdadeiro/actions/runs/37678982727) passed both fixture replays and SQL/security assertions through migration 31; this does not close the application release review. |
| Production-path architecture | PENDING | Source inspection found several completed core commands route through the Edge gateway only when `APP_ENV=staging`; the non-staging branch retains older direct backend writes, and the current gateway bridge pins the staging Supabase URL. This local code has not been deployed to production, but a Production Candidate must resolve the divergence and fail closed until the production gateway/migrations are provisioned in the separately authorized go-live. |
| Secret scan | PASS with review item | Latest scan: 416 files, zero blockers, one public Supabase anon configuration in old ignored `dist`. The old anon key is public configuration, not a service-role credential; it is not valid staging build evidence. |
| Quote error disclosure | PASS for fixed route | A simulated PostgREST persistence error containing an internal marker returned HTTP 500 with a generic client message. The marker and database code were absent from the response; only a bounded error code was logged. Focused regression, full local suite, isolated build/smoke and the subsequent guarded staging Preview browser path passed. |
| Inbox receipt semantics | PASS locally; live send OFF | The send UI now requires an explicit response state. `REQUEST_ACCEPTED` and `PROVIDER_ACKNOWLEDGED` say delivery is unconfirmed; only `DELIVERED` says delivery is confirmed. Focused mapping test passed and the guarded staging Preview E2E passed with the channel still disabled. No real provider acknowledgement or delivery was simulated. |
| Security SQL assertion | PASS for read-only prefix; full fixture NOT RUN | On staging after migration 28, the catalog/sequence privilege checks and actual anonymous read denial in the read-only prefix of `supabase/tests/assert_security_contract.sql` completed without error. The full file later inserts a fixture into `auth.users` and attempts client writes, so it was not run on staging. Its full disposable-database replay remains pending. |

`READY_FOR_PRODUCTION_CANDIDATE=NO`. The open mutation rows and incomplete release review block the security checkpoint and final snapshot.

The temporary staging bootstrap Edge Function is still listed as ACTIVE, version 2, with `verify_jwt=true`. Read-only retrieval of its deployed source showed that it unconditionally returns HTTP 403 `readiness_bootstrap_disabled`; no administrative operation remains callable through its current code. Physical deletion remains a cleanup item, not proof that the release audit is complete.

Updated: 2026-10-02
Status: `INCOMPLETE_DEEP_SCAN_PENDING; GATES_OPEN` — current evidence recorded; not a production security sign-off.

## Scope and evidence

- Checkout branch `production-readiness/migration-replay-20260928`, HEAD `d5ad917eb398c2802fb0ad3a85600d16b32dc7a0`; working tree remains dirty. Reused `ORKTO_SECURITY_AUDIT_2026-09-28.md`, `ORKTO_SECURITY_BASELINE_RESULT_2026-09-28.md`, and the 142-route `ORKTO_API_AUTHORIZATION_MATRIX.md`; reviewed only related code, SQL assertions, and tests.
- The earlier review records that its automated scanner failed before producing a final artifact. No completed scanner artifact was present; this report closes the requested local checkpoint and labels missing evidence `NOT_VERIFIED` rather than restarting a whole-repository scan.
- Focused application checks: all 40 unique cases passed across the scoped run and loopback-only app-factory rerun. Latest full regression, run with `.env` loading disabled and external credential variables removed from the test process, passed 148 TypeScript cases plus 22 readiness-tool cases (170/170). `npm run lint` passed. `npm run readiness:build` passed frontend build, server bundle, and local smoke; the existing `dist` tree was preserved.
- `readiness:secret-scan`: 373 files, 0 blocking findings, 1 review item classified as public Supabase anon configuration in the pre-existing `dist/assets/index-DFPc2TH1.js`, with metadata `ref=qneqljlphgkptebsaonb`, `role=anon`; the credential value is omitted. The isolated staging build itself had no production ref. This is a public client key, not a service-role secret, but the local `dist` bundle is production-targeted and must not be used as staging evidence.
- Local PostgreSQL 17 is unavailable (`psql` and Docker are absent). PostgreSQL 17 workflow run [36888355161](https://github.com/peixotodavy831-stack/Orktoverdadeiro/actions/runs/36888355161) passed on commit `d5ad917`: the legacy fixture replay passed `18/18` migrations; the Supabase-like baseline replay passed `11/11` pending migrations. Both logs explicitly report PASS for `assert_local_migrations.sql` and `assert_readiness.sql`; both workflow jobs and the security assertion step completed successfully. These were ephemeral CI databases; neither staging nor production received migration writes.

## Accidental Preview evidence

- Vercel project `orkto` (`prj_XiwDjfbGC8sq8L8zb59lcZA4HUny`), deployment `dpl_7sgkse2opm8t67UCHgwMUD6JNfPY`, branch `production-readiness/migration-replay-20260928`, commit `a56c45a03105bd44536b5e30abf8724e771a0c9d`. Fresh metadata on 2026-10-01 confirms `source=git`, `READY`, type `LAMBDAS`, and `target=null`; the deployment's URL/alias are generated Vercel Preview hostnames. No production target or production alias is present. `PRODUCTION_DOMAIN_AFFECTED=NO` from available deployment metadata.
- Current project environment review (2026-10-01): the Project tab lists these names with `Production` scope only; the Preview filter is empty and the Shared tab has no linked Preview variables. No values were opened or copied. The current Production-scope names are:

  | VARIABLE_NAME | SCOPE | SENSITIVE | POSSIBLE_PRODUCTION_ACCESS |
  |---|---|---|---|
  | `GEMINI_API_KEY` | Production | YES | NO — Production scope only in current configuration |
  | `SUPABASE_SERVICE_ROLE_KEY` | Production | YES | NO — Production scope only in current configuration |
  | `VITE_SUPABASE_ANON_KEY` | Production | NO | NO — Production scope only in current configuration |
  | `VITE_SUPABASE_URL` | Production | NO | NO — Production scope only in current configuration |
  | `ASAAS_WEBHOOK_SECRET` | Production | YES | NO — Production scope only in current configuration |
  | `ASAAS_API_KEY` | Production | YES | NO — Production scope only in current configuration |
  | `RESEND_API_KEY` | Production | YES | NO — Production scope only in current configuration |
  | `ASAAS_ENVIRONMENT` | Production | NO | NO — Production scope only in current configuration |
  | `RESEND_FROM` | Production | NO | NO — Production scope only in current configuration |
  | `APP_URL` | Production | NO | NO — Production scope only in current configuration |

- The dashboard does not provide the environment-variable snapshot or an audit history tied to this deployment. Therefore the table describes current scope only; historical Preview eligibility is `UNKNOWN`. The current Preview configuration has no project or shared variables, but this does not establish what the deployment received at build time. `SUPABASE_SERVICE_ROLE_KEY`, provider, billing, and messaging exposure for that historical deployment remain `UNKNOWN`.
- Current Preview Supabase target is `NONE` based on its empty current Project/Shared Preview configuration. Historical `PREVIEW_SUPABASE_TARGET=UNKNOWN`: production `VITE_SUPABASE_URL` is currently Production-only, but the deployment's historical environment snapshot is unavailable. Production Supabase logs had two PostgreSQL entries within the two-minute build interval, but neither is attributable to this deployment; no matching Preview hostname or deployment identifier was found. Do not interpret that as proof no connection happened.
- Runtime evidence: the previously queried deployment runtime window returned no `requestPath` rows. A later deployment-filtered aggregate query returned HTTP 400; the deployment-build-log connector returned `Tool get_deployment_build_logs not found`. Project-level overview counts (14 CDN requests, 9 function invocations in the observed six-hour window) cannot be assigned to this deployment. Therefore deployment-specific HTTP requests and function invocations are `NOT_FOUND_IN_AVAILABLE_EVIDENCE`; server initialization and attributable DB/provider/message/billing activity are `NOT_VERIFIABLE`. None of these absences proves that activity never occurred.
- Current Vercel Ignored Build Step remains saved as `Only build production`, with exit 0 for non-production. The additional Vercel Git configuration in `vercel.json` disables Git deployments for `production-readiness/*`; its static guard test passed. After commit `d5ad917` was pushed, a read-only deployment listing for project `orkto` returned zero records newer than the earlier canceled fallback record. This dynamically verifies that the readiness-branch push produced no new Preview/deployment record. The fallback Ignored Build Step had previously canceled the build for commit `2c72c4e`.
- Root cause (`ACCIDENTAL_PREVIEW_ROOT_CAUSE`): the production Vercel project `orkto` was connected to the repository with Preview Branch Tracking set to `All unassigned branches`, and no readiness-branch exclusion existed in the deployed configuration. That Git integration created the accidental Preview. Separately, the checkout's ignored `.vercel/project.json` was linked to production and posed a manual CLI hazard; Git metadata confirms it did not cause this Git-sourced deployment. The local link now names only `orkto-staging` (`prj_KZm12jmZIKL3Tqnk2I9DBa9MabKc`).
- Incident classification: historical environment eligibility remains `UNKNOWN`; current Preview scopes are empty and current listed production credentials are Production-only, but no historical deployment env snapshot/audit history is available. No evidence proves cases B, C, or D, and they cannot be excluded. `PRODUCTION_DOMAIN_AFFECTED=NO` from deployment metadata. No production DB writes, external provider/message/billing calls, secret values, rotations, promotion, or deployment deletion were performed.

## Coverage

| Surface | Result | Evidence and boundary |
|---|---|---|
| Authentication | `LOCAL_TESTED; LIVE NOT_VERIFIED` | App-factory checks passed; `backend/core-app.ts:213` calls `auth.getUser`. No staging Auth A/B run. |
| Authorization | `PARTIAL / NOT_VERIFIED` | Static inventory has 142 routes, 49 `REVIEW REQUIRED`, 53 `NOT EVIDENCED`, and 88 `CONDITIONAL` markers; handler branches remain open. |
| Tenant isolation | `LOCAL_TESTED; RLS NOT_VERIFIED` | Tenant-context tests passed; database A/B assertions were not run. |
| IDOR | `PARTIAL / NOT_VERIFIED` | Route matrix and public-token review exist; authenticated staging A/B/browser checks remain unrun. |
| RLS and grants | `CI_POSTGRES17_PASS; STAGING NOT_VERIFIED` | The ephemeral legacy/baseline replays and `assert_security_contract.sql` completed; no live staging assertion. |
| `SECURITY DEFINER` | `CI_POSTGRES17_PASS; STAGING NOT_VERIFIED` | `assert_readiness.sql` and `assert_security_contract.sql` passed in CI; no live staging assertion. |
| Public routes and tokens | `PARTIAL` | New proposal tokens use 24 random bytes and `no-store`; legacy 8-character links remain valid through their existing expiry window. |
| WIA | `LOCAL_TESTED` | Focused WIA tests passed; provider tests use fakes. |
| Billing and PIX | `PIX_ENGINEERING_LOCAL=PASS` | 8/8 PIX TypeScript cases pass; `assert_readiness.sql` passed in both PostgreSQL 17 CI replays, covering durable claims, references, replay and terminal states. Public PIX remains disabled. |
| Webhooks | `CI_POSTGRES17_PASS; LIVE NOT_VERIFIED` | SQL assertions cover duplicate, out-of-order, stale-claim, and terminal events; no staging or production execution. |
| Service-role boundary | `LOCAL_REVIEWED; GRANTS NOT VERIFIED` | Service-role client construction is server-side in `backend/core-app.ts:151-165`; database grants remain unverified. |
| Secret leakage | `0 blockers; 1 review` | Scanner classified one bundled anon key as public configuration; no secret value is included. |
| Error/log leakage | `LOCAL_TESTED` | Structured-redaction tests passed; Preview runtime produced no grouped path rows. |
| CORS | `LOCAL_REVIEWED; RUNTIME CONFIG NOT VERIFIED` | `backend/core-app.ts:104-119` uses an origin allowlist and accepts origin-less requests; CORS does not replace API authentication. |
| Rate limiting | `OPEN` | `backend/core-app.ts:123-144` uses process-local in-memory limiters, not a shared store. |

## Findings

- **F-01 — Severity: UNDETERMINED / HISTORICAL ACCESS UNKNOWN.** **Location:** Vercel production project `orkto`, deployment `dpl_7sgkse2opm8t67UCHgwMUD6JNfPY`. **Evidence:** the deployment was Preview/READY with no Production target; current Preview variable list is empty, and current service-role/provider/billing/messaging names are Production-only, but no deployment-time env snapshot or audit history was available. **Impact:** historical production access cannot be excluded or asserted. **Status:** `OPEN_HISTORICAL_ENVIRONMENT_UNKNOWN`; no sensitive exposure is asserted without evidence.
- **F-02 — Severity: MEDIUM.** **Location:** `ORKTO_API_AUTHORIZATION_MATRIX.md` and route handlers. **Evidence:** 49 routes remain `REVIEW REQUIRED` and 53 `NOT EVIDENCED` in the static inventory. **Impact:** Full route-level authorization, tenant, and IDOR behavior is not established. **Status:** `NOT_VERIFIED`.
- **F-03 — Severity: MEDIUM.** **Location:** migration `20260928130000_durable_payment_and_delivery_ledgers.sql`; `supabase/tests/assert_readiness.sql`; `supabase/tests/assert_security_contract.sql`. **Evidence:** Both PostgreSQL 17 CI replays passed and executed the SQL assertions. **Impact:** CI validates the isolated candidate only; staging remains at 17 and has not been migrated. **Status:** `CI_PASS; REMOTE_STAGING_NOT_AUTHORIZED`.
- **F-04 — Severity: MEDIUM.** **Location:** `backend/core-app.ts:123-144`. **Evidence:** Limiters use the default per-process store. **Impact:** Traffic spread across serverless instances can exceed the effective aggregate limit. **Status:** `OPEN_INFRASTRUCTURE_GAP`.
- **F-05 — Severity: MEDIUM.** **Location:** public proposal-token compatibility path. **Evidence:** New links use 24 random bytes; existing 8-character links are retained until expiry. **Impact:** Unexpired legacy links have lower entropy than newly issued links. **Status:** `COMPATIBILITY_WINDOW`.

## Stop conditions

- Staging remains `TARGET_MIGRATIONS=18`, `STAGING_MIGRATIONS=17`; preflight remains `STAGING_SCHEMA_OUTDATED`. No remote migration was applied.
- Snapshot is deferred: the worktree remains dirty, the accidental Preview's historical environment eligibility is unknown, and staging remains at 17. `STG-006` is verified: the code-level Git branch exclusion and fail-closed runner are tested, and commit `d5ad917` produced no new deployment record in `orkto`. `STG-007` remains open because the deployment-time environment snapshot/audit history was unavailable. Both stay inside `SESSION_1_STAGING_BOOTSTRAP`; no third session was created.

## Final closure addendum — 2026-10-02

This addendum records the current checkout review and supersedes conflicting statements above about the latest build, live staging RLS, and runtime evidence. Earlier records remain historical evidence. No source/configuration, database, credential, deployment, or Git remote was changed by this closure review.

### A1 — accidental Preview and historical exposure

- Rechecked deployment `dpl_7sgkse2opm8t67UCHgwMUD6JNfPY`: Git source, project `orkto` / `prj_XiwDjfbGC8sq8L8zb59lcZA4HUny`, READY, Preview (`target=null`), commit `a56c45a03105bd44536b5e30abf8724e771a0c9d`. The only known alias is a Vercel Preview hostname; no production domain/target alias is present. `PRODUCTION_DOMAIN_AFFECTED=NO`.
- The current deployment-filtered runtime-log query returned no rows. This is `NOT_FOUND_IN_AVAILABLE_EVIDENCE` for deployment runtime events; Vercel access logs, deployment build logs, and a deployment-time env snapshot/audit history were unavailable. Therefore HTTP requests are `NOT_VERIFIABLE`; server initialization and attributable DB/provider/message/billing calls are also `NOT_VERIFIABLE`. No runtime rows do not establish that no request occurred.
- A production Supabase project-level log query returned 48 PostgreSQL events in the sampled hour, without deployment correlation; no edge/function log rows were returned for that window. These events cannot be attributed to the Preview. No production SQL was executed.
- The last recoverable Vercel environment-scope review is dated 2026-10-01; it was not refreshable in this pass because the available connector exposes no environment-variable history/listing. It listed the following current Production-only names, with no current Project/Shared Preview variables. This does not establish the environment injected into the historical deployment.

  | VARIABLE_NAME | SCOPE (last observed) | SENSITIVE | HISTORICAL_PREVIEW_EXPOSURE |
  |---|---|---|---|
  | `GEMINI_API_KEY` | Production | YES | UNKNOWN |
  | `SUPABASE_SERVICE_ROLE_KEY` | Production | YES | UNKNOWN |
  | `VITE_SUPABASE_ANON_KEY` | Production | NO | UNKNOWN |
  | `VITE_SUPABASE_URL` | Production | NO | UNKNOWN |
  | `ASAAS_WEBHOOK_SECRET` | Production | YES | UNKNOWN |
  | `ASAAS_API_KEY` | Production | YES | UNKNOWN |
  | `RESEND_API_KEY` | Production | YES | UNKNOWN |
  | `ASAAS_ENVIRONMENT` | Production | NO | UNKNOWN |
  | `RESEND_FROM` | Production | NO | UNKNOWN |
  | `APP_URL` | Production | NO | UNKNOWN |

- `HISTORICAL_SECRET_EXPOSURE=NOT_VERIFIABLE`; `PREVIEW_SUPABASE_TARGET=UNKNOWN`; production service-role, provider, billing, and messaging exposure are all `UNKNOWN`. The available evidence supports neither asserting exposure nor excluding it. Risk remains historical production-data or external-action access if those variables were eligible at build/runtime. Current containment: readiness Git branch exclusion plus staging-pinned runner and `.vercel/project.json`; no later `orkto` deployment record after the guard commit was found. No rotation, promotion, deletion, or production access test was performed. Keep human risk acceptance and any targeted rotation decision in Session 1.
- Root cause: the production `orkto` project was Git-connected to this repository with Preview Branch Tracking set to `All unassigned branches`, without the readiness branch exclusion in its deployed Git configuration. That integration created the Preview. The ignored local `.vercel/project.json` was a separate CLI hazard, not the source of the Git deployment. Vercel documents branch-specific Git deployment controls in [Git Configuration](https://vercel.com/docs/project-configuration/git-configuration).

### A2–A16 — current gate evidence

| Gate | Current status | Evidence and remaining limit |
|---|---|---|
| Authorization (A2) | `PARTIAL` | Static inventory has 142 routes; it still contains REVIEW REQUIRED / NOT EVIDENCED entries. Local tests cover selected auth, tenant spoofing, and WIA denials. No live HTTP matrix with invalid token, another workspace, forged resource ID, webhook, billing, messaging, and internal endpoints was completed. |
| RLS/grants (A3) | `PARTIAL — staging subset verified` | Read-only staging catalog review found 57/57 public tables with RLS enabled; browser `anon` had no table grants; `authenticated` had SELECT on 47; `service_role` had full table access on 57. Eight RLS tables have no policies and remain inaccessible to browser roles by grants. Three authenticated-callable `SECURITY DEFINER` membership/legacy-owner helpers were reviewed; browser CREATE on `public` is revoked. Live synthetic A/B reads below passed, but this does not cover every table, RPC, and write path. Supabase RLS is an additional defense; it does not replace server authorization ([RLS guide](https://supabase.com/docs/guides/database/postgres/row-level-security)). |
| Tenant isolation (A4) | `PARTIAL — tested relations passed` | In one transaction with explicit rollback, staging Tenant A read A and got zero B rows for clients, conversations, messages, deals, quotes/proposals, payment records, WIA actions, and audit records; forged B client/quote IDs returned zero; a nonmember saw zero tested workspace rows. Membership/admin/legacy-owner helper checks for B returned false. Post-rollback verification found no synthetic records left. This is not a full route/write/RPC adversarial suite. |
| Staging/production isolation (A5) | `PARTIAL` | Local staging boundary pins Vercel `orkto-staging` (`prj_KZm12jmZIKL3Tqnk2I9DBa9MabKc`) and Supabase `ghrjongiodziasupakrk`; isolated frontend build contained no production ref. Project credentials, all provider callbacks, cron/jobs, storage, analytics, and live endpoints were not comprehensively verified. The previously found production Supabase ref in the old ignored `dist` bundle is public anon configuration, but demonstrates that stale `dist` must not be used as staging proof. |
| WIA boundary (A6) | `PARTIAL` | Existing tools are read-only; recommendations/approval records are internal writes behind backend checks and audit. No external execution tool is currently registered. No complete injection-to-direct-endpoint adversarial test or independent per-provider server kill switch was demonstrated. |
| Idempotency/replay (A7) | `PARTIAL` | Local tests cover selected PIX concurrent key, webhooks, message reconciliation, and retry behavior. Migration 18 contains the newer durable ledgers but staging remains at 17; no real external effect or staging concurrency test was run. |
| Audit trail (A8) | `PARTIAL` | Local schema/tests cover actor/workspace/action metadata; synthetic staging audit reads were tenant-isolated. No live external action can establish end-to-end request→approval→provider result reconstruction. Raw `console.error`/`error.message` sites remain outside the redacting logger. |
| Kill switches (A9) | `PARTIAL` | Public PIX stays disabled/503 and message adapter is unavailable/configuration-required. No separately verified server-side kill switch for every WIA external execution, billing, messaging, and provider exists. |
| API hardening (A10) | `PARTIAL` | Source review found a process-local in-memory rate limiter, 10 MB JSON body limit, CORS allowlist, `helmet()` on `/api`, and Zod on several mutations. This pass did not verify complete SSRF/open-redirect/CSRF/CSP/abuse behavior or distributed rate limits. |
| Secret/log hygiene (A11) | `PARTIAL` | Secret scan: 373 files, zero blockers, one review-only public Supabase anon configuration in pre-existing ignored `dist` (`qneqljlphgkptebsaonb`, role anon); no secret value was emitted. The scanner excludes `.env`; Git history scan was unavailable because `gitleaks` is absent. Raw error logging remains. |
| Provider resilience (A12) | `PARTIAL` | LLM paths have bounded timeout behavior and tests use fakes. Asaas fetch lacks an explicit timeout in the reviewed path; live provider timeout/retry/duplicate behavior was not tested. |
| Failure safety (A13) | `PARTIAL` | Unit tests simulate selected provider/webhook failures. No safe live failure-injection run covered ambiguous external completion, process interruption, or provider/database split-brain. |
| Backup/restore (A14) | `NOT_VERIFIED` | Current backup retention, achievable RPO/RTO, and a restore test were not verifiable. No destructive operation was run. Human evidence/recovery plan is required in Session 1. |
| Rollback (A15) | `PARTIAL` | Existing runbooks describe deployment rollback and migration forward-fix/compensation. No current deployment rollback or restore was executed; staging was not downgraded. |
| Observability (A16) | `PARTIAL` | Request/correlation IDs and redaction tests exist; available logs do not reliably distinguish all auth, database, provider, billing, messaging, and WIA failures. Raw error logging and missing deployment attribution remain. |

### Current regression and scanner state

- `npm run test:all` passed 170/170 in a temporary copy of this dirty checkout with `.env` excluded; dotenv reported zero injected variables. A prior test invocation loaded dotenv variable counts (9 and 5) into the test process but displayed no values; the isolated successful rerun performed no external operation. `npm run lint` passed.
- `npm run readiness:build` in this pass built the frontend and confirmed the isolated public bundle did not reference the production Supabase ref. The server bundle failed in the Windows sandbox with `Access is denied` resolving `../../..` / `server.ts`; the smoke step therefore did not run. The pre-existing ignored `dist` was preserved.
- Local migration replay was not run: readiness preflight rejected the missing explicit target; the CI validator then passed repository preflight (18 files) but stopped because no PostgreSQL connection variables/database URL were configured. `psql` and Docker are unavailable. Historical PostgreSQL 17 CI run `36888355161` remains PASS for 18/18 legacy and 11/11 baseline-like migrations plus SQL assertions on `d5ad917`; it is not fresh evidence for this dirty checkout. Staging remains at 17; no migration was applied.
- Codex Security Deep Scan is still in progress after rejoining the same target-based scan. Its initial waiter detached; the scan was not canceled. No canonical parent manifest/findings/coverage have been returned, so no completion/seal call has been made and no finding-free result is asserted. `SECURITY_CHECKPOINT=INCOMPLETE` pending the terminal scan result.
- `FRONT_A_DONE=NO`; `SNAPSHOT_ELIGIBLE=NO`. The worktree is already dirty with parallel local work; this review created no commit or remote change. Preserve the existing work and do not push, deploy, migrate remotely, rotate credentials, or snapshot from this state.
