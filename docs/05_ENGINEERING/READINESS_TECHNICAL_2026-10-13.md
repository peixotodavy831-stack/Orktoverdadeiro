# ORKTO — technical readiness checkpoint — 2026-10-13

**Historical checkpoint.** Current app, test evidence and consolidated dependencies are in [MVP_CLOSURE_2026-10-14.md](MVP_CLOSURE_2026-10-14.md). Its d693e2f Preview replaces c1660be for new validation; retain the SHA-specific evidence below without treating it as current-SHA approval.

Status: **IN PROGRESS / NOT APPROVED**. Production is outside this execution. Commercial/legal approval is a separate phase.

## Frozen evidence and candidate change

The accepted baseline is SHA `65d5f8ac8284e495bd95d742172da11f6a25b782`, Preview `dpl_6oqdS1C4pkSNHAN3fLEvoNz8yPZf`. Its 2/2 authenticated launcher cases and 26 focused cases remain historical PASS for that candidate. Full sanitized records were copied before another test can reset output: `test-results/technical-gates-65d5f8a/auth-ab-safe-results.json` (SHA-256 `f1fa62a74d0f568478975f25c59ffdca1be81aa38ec434937db2b6f2e340b26c`) and `auth-ab-runner.json` (`39084ffb09a904e5e582c495ade48a750fdf3fa08c91d3f730f1baf0e2ed51c8`). They are ignored test artifacts, not a release snapshot.

A read-only live probe found health/readiness missing security headers and disallowed CORS origins returning 500. Local corrections move Helmet before the public probes and explicitly deny untrusted origins with 403 and a bounded request-correlated event. New tests preserve authentication and origin restrictions. These runtime changes require a new staging candidate and fresh mandatory checks; the old browser PASS cannot approve them.

## Current immutable candidate

- App SHA: c1660be6081da10fa8eda4c2afb4baccb51ed4fa. Deployment: dpl_DQ6hZVM5ia4TsKmCHK52Y69bAemq, READY, Preview (API target null / CLI target preview), exclusively orkto-staging.
- URL: https://orkto-staging-fl4uvx2qw-peixoto-s-projects1.vercel.app/
- Later harness-only changes do not alter backend/frontend/Edge/SQL runtime content. No new app deployment is needed for them.
- The latest owner command omitted PreviewUrl/ExpectedSha and actually validated the old default SHA 65d5f8a, as both persisted safe-results and runner records prove. That extended run was 2/4 PASS, not current-candidate approval; cleanup passed. Original 2/2 accepted evidence remains preserved separately.
- Two genuine harness defects were corrected: repeated contact role label was scoped to the uniquely created list item; WIA history now uses serviceRunId and also verifies the trace ID and actor. No assertion removed, timeout raised, or UI semantics weakened.
- Wrapper defaults now point to c1660be and print the public SHA before masked prompts. Five cases are discovered: health, core A/B, logout revocation, WIA/Inbox/provenance, public-proposal version/accept/reject/immutability. Discovery/typecheck is not execution.

## Gate matrix

| Gate | Status | Evidence / remaining condition |
| --- | --- | --- |
| Production isolation | PASS | Only staging was changed. Explicit CLI project/ref/Preview guard passed; no production deployment, schema or secret changed. |
| Migration replay | PASS | Exact current SHA c1660be: [PostgreSQL 17 CI 38502775304](https://github.com/peixotodavy831-stack/Orktoverdadeiro/actions/runs/38502775304), both legacy 41/41 and remote-like baseline + 34 pending/security jobs succeeded. SQL unchanged. |
| Staging ledger | PASS | 41 entries. Forty match normalized SQL content; migration 33 differs only in comments/blank lines (normalized SHA-256 `6c883f799011541749959e6bfae3a6ac51c08dd41854fe0273c701e12b240934`). No ledger repair or migration applied. |
| Effective schema | PASS | CI/staging fingerprints equal for tables (61), columns (756), constraints (382), indexes (169), policies (72), table/column grants, sequences and grants, function grants and triggers. Two WIA function body hashes differ only with migration-33 formatting. Supabase adds redundant postgres schema USAGE and managed default ACLs; current object grants remain identical. |
| RLS and privileged functions | PASS | All 61 public tables have RLS; browser DML is absent. Twelve no-policy tables have no browser SELECT either. Three authenticated membership helpers deny anon, use auth.uid()/active membership, return booleans, and have empty search_path. Other privileged routines are service-only. Real own/foreign helper checks passed in the baseline launcher. |
| Edge/source parity | PASS | `orkto-core-mutations` v23 ACTIVE/verify_jwt=true; all eleven deployed files match local normalized SHA-256 content. Disabled bootstrap remains an unconditional 403; public proposal function is intentionally token-authenticated rather than JWT-authenticated. |
| Preview secret metadata | PASS | CLI env ls Preview readback: ten keys, all Preview-scoped; no admin/service/provider/billing/messaging credential names. Values were neither decrypted nor printed. Runtime readiness is staging. |
| Password breach defense | BLOCKED | Advisor warning remains. Auth panel shows Free and states leaked-password protection requires Pro. No upgrade or risk acceptance was made automatically. [Platform requirement](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). |
| Auth callback configuration | PASS | Site URL and the single redirect now equal https://orkto-staging-fl4uvx2qw-peixoto-s-projects1.vercel.app. Obsolete project-20yh0.vercel.app removed. Dashboard readback and screenshot retained. |
| Public API headers/CORS | PASS | Current immutable Preview health/ready 200 with nosniff/HSTS/request-ID echo; anonymous clients 401; hostile Origin 403 without ACAO. Sanitized origin-denied runtime log matches request 93584dc2-ece7-4a2c-87ad-af6fe2dac692. |
| Logout | BLOCKED | Exact current SHA authenticated repetition NOT RUN. Extended owner run used default old SHA 65d5f8a: logout 204, local session removed, revoked refresh rejected 400, reload signed out. Original NETWORK_ERROR not reproduced as a functional/revocation failure; original transport cause remains unproven. |
| WIA/Inbox release flow | BLOCKED | Latest extended run was on 65d5f8a: WIA approve/reject, replay and foreign denials passed; history assertion incorrectly used trace runId, not persisted serviceRunId. Harness corrected with both IDs and actor assertions. Inbox decisions not reached. Corrected current-SHA execution still requires private runner input. |
| Authorization negatives | BLOCKED | Foreign workspace, suspended membership, insufficient member role, spoofed role and original owner/active restoration passed in the owner run on 65d5f8a against the unchanged Edge v23. New-SHA full authenticated repetition remains NOT RUN. |
| Audit/correlation | PASS | Read-only rows in orkto_wia_events for 13 mutation event types contain actor, workspace, entity and request_id; contacts also have audit_log records linked by trace_id/event_id. No contents, secrets or customer data exported. |
| Runtime logs | PASS | Current Preview origin-denial event correlated to exact request UUID. Hobby retention limits earlier log access; no claim of exhaustive historical logging. |
| Recovery/rollback | PASS | Staging assessment complete: 54 scoped tables checked, no business records associated with the sole non-synthetic account; only profile/workspace/member/internal subscription, no external billing refs. Legacy/webhook/collective tables empty; seven seed plans; Storage empty. Rebuild strategy and schema-compatible app rollback documented; managed PITR/full restore rehearsal NOT RUN and no production restore claim. |
| Performance | PASS | Current public response 3185 ms / DOM 3676 ms; five JS requests, no measured regression from baseline. Build keeps 889 kB WebGL asynchronous, charts 336 kB and entry 162 kB. Advisor index warnings are review items, not measured bottlenecks. |
| Accessibility/responsive | PASS | Current public language/names/keyboard focus, zero unnamed visible controls, no overflow at 390/768/1440, zero browser page errors. Authenticated keyboard/dialog/mobile proof remains scoped to old accepted E2E until current-SHA rerun. |
| Regression | PASS | After HTTP fixes: 198 application + 43 tooling tests, lint/typecheck, isolated frontend/server build and smoke. Full logs retained locally. |
| Secret/log hygiene | PASS | Source/functions/migrations/tests/current public probe/CI and isolated frontend/server output scan: 321 files, zero findings before CI artifact download; final expanded artifact scan is recorded separately below. Raw credential-bearing reports are withheld; only sanitized timelines retained. |
| Final release security checkpoint | BLOCKED | Current-SHA authenticated matrix, public-token lifecycle and corrected WIA/Inbox proof are NOT RUN; leaked-password platform decision unresolved. Metadata and local tests cannot substitute for these gates. |
| Snapshot / Production Candidate | BLOCKED | Snapshot not generated; READY_FOR_PRODUCTION_CANDIDATE=NO. Commercial/legal approval and future UX changes are separate work. |

## Advisor interpretation

- [RLS without policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy): intentional deny-all/service-only tables; adding broad policies would break the approved boundary.
- [Authenticated SECURITY DEFINER](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable): reviewed boolean membership predicates, not generic privileged CRUD. JWT user identity and active membership constrain them. Existing negative HTTP tests are retained.
- [Unindexed foreign keys](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys), [unused indexes](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index), [RLS initplan](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan): performance findings require query/row-count evidence. The sussurro predicate constrains active tenant plus recipient/sender; do not replace it with tenant-wide access merely to remove a warning.
- Managed default privileges apply to **future** objects and are not grants on existing tables. Migration 17 deliberately avoids global platform ACL changes; every future application migration must explicitly revoke browser writes and privileged RPC EXECUTE. Current effective table/column/function grants match the reviewed CI target.

## Deployment and rollback constraints

Use an isolated clean checkout linked to orkto-staging, explicit Preview target and SHA, and the existing source/project/ref guard. Never merge main, promote to production, or reuse a production credential. Preserve the baseline Preview as rollback reference. The HTTP-only patch does not change schema or require migration; an app rollback is schema-compatible with ledger 41. Database recovery remains a separate named procedure, not an app rollback or ledger repair.

## Recovery limits and final private input

The staging rebuild assessment covers disposable business fixtures, schema/seed and synthetic Auth bootstrap. Existing owner Auth identity/profile is excluded from cleanup. The strategy authorizes no deletion here. PostgreSQL 17 recreates all 41 migrations on both baseline paths; real synthetic Auth bootstrap already passed. A complete project disaster restore including Auth identity continuity was not rehearsed, so RTO is unmeasured; no managed point-in-time RPO is claimed on Free. Production backup/restore remains a separate go-live gate. See ORKTO_INCIDENT_RECOVERY_RUNBOOK.md.

Remaining owner/platform actions are consolidated in SESSION_1_FINAL_STAGING: supply staging admin/public keys privately to the masked launcher for the final 5-case run, and decide the plan/security policy for unavailable leaked-password protection. There is no request to put a service-role in Preview. No new administrative public endpoint or security bypass was introduced.

The old logout request alone cannot prove failure: the focused real browser test on 65d5f8a observed the 204 acknowledgement and rejected refresh reuse. It also cannot approve the new SHA. Direct API grants, schemas and deployed Edge source are unchanged; the remaining requirement is actual current-SHA execution.

Process-local technical rate limits are defense in depth, not distributed quotas. Trusted WIA also has workspace/user event ceilings and durable plan usage checks. No external billing, messaging or paid fallback was activated. Index warnings are retained for workload-driven tuning; no broad grants or policies were added.

## Final local verification and retained evidence

After the harness corrections: full regression 198/198 application and 43/43 tooling PASS (including TLS/diagnostics fixtures), lint/typecheck PASS, five browser cases discovered without authenticating. This is not a five-case browser PASS. Source/Edge/migration/current docs/CI/logs/build artifacts scan: 350 files, zero findings; bounded last-100-commit application/runner history scan: zero findings; all five retained trace ZIPs (25 entries) have no secrets, raw network headers/cookies/bodies or unreviewed entries. Current app/runtime paths still match c1660be exactly. No additional deploy was needed for test/documentation-only changes.

Durable sanitized summary and report hashes: [evidence/technical-gates-c1660be.json](evidence/technical-gates-c1660be.json). The original accepted baseline has its own [summary/hash](evidence/auth-ab-65d5f8a-summary.json). Full ignored local artifacts remain in test-results and were not deleted or converted into a final snapshot.
