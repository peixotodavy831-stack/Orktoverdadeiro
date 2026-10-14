# Current staging recovery assessment

Scope: ghrjongiodziasupakrk only, 41 migrations, PostgreSQL 17.6. No restore or destructive operation executed. Strategy: REBUILD_FROM_MIGRATIONS_AND_SYNTHETIC_SEED for disposable application fixtures, with the owner's Auth identity/profile excluded from synthetic cleanup.

Read-only classification: 19 Auth accounts, 18 synthetic by known fixture email patterns, one outside those patterns. Across 54 scoped public tables, the non-synthetic identity has one workspace, membership and internal subscription; zero commercial records, zero external customer/subscription references. One profile remains. Five legacy/webhook/collective tables have zero rows; catalog contains seven seed plans; Storage contains no objects. This supports a staging fixture rebuild, not deletion of the owner's account or a claim of a production backup.

## Recovery procedure (prepared, not executed against current staging)

1. Stop the readiness runner and staging writes; preserve exact app/Edge SHA, migration manifest, ledger mapping and schema fingerprints. Record current account/row classification again; any real/unique customer data changes this strategy. Never choose a production ref.
2. Rehearse in a disposable PostgreSQL 17 instance using the existing CI legacy fixture + 41 migrations and remote-like baseline + 34 pending migrations. Current exact-SHA run 38502775304 passed both with security assertions. Do not blindly replay old timestamped migrations on an existing Supabase ledger.
3. For an actual staging disaster, use a separate explicitly identified staging target or a reviewed schema restore. Preserve existing Auth identities when available; never DROP auth/storage schemas, delete the owner's login, or copy password hashes into artifacts. If a new project is required, project/ref/origin updates and owner authentication recovery must be separately verified before use.
4. Seed only versioned plan definitions and synthetic readiness fixtures using the trusted private runner. Recreate synthetic users with ephemeral passwords in memory; never reuse a production admin key. Baseline real Auth A/B/bootstrap passed; complete project recreation and human identity continuity have not been tested.
5. Deploy only the verified Edge source with JWT/membership/role/strict command/audit protections, set staging-only app origins and keep legal/external provider flags OFF. Browser DML remains denied.
6. Compare ledger 41, schema/grants/functions fingerprints; run SQL/security assertions, health/readiness, real Auth A/B, tenant denials, core writes, WIA/Inbox, replay and cleanup. Re-enable the staging runner only after evidence passes.

RPO: fixtures/seed are reconstructible; there is no asserted point-in-time managed RPO on Free and test audit history may need recreation from retained evidence. RTO: not measured; CI reconstruction duration is not an end-to-end disaster RTO. Full project disaster restore is NOT RUN. Do not treat this assessment as proof that production data can be restored. A verified production backup/restore point is still required before the separately authorized production migration.

App rollback: retain 65d5f8a as prior verified artifact; c1660be HTTP patch uses the same schema/Edge and is schema-compatible. Redirect staging only to a known immutable artifact if needed, then repeat current auth/tenant smoke. No automatic production rollback. A partial database migration must stop and reconcile catalog/ledger before a forward fix; do not drop payment/audit/idempotency ledgers or reopen browser grants.

---

# ORKTO incident and recovery runbook

Status: rehearsal document; no production action is authorized by this file.

1. **Declare and contain.** Record UTC time, environment/project refs, request/correlation IDs, impacted workspaces and last known good snapshot. Do not paste passwords, tokens or raw customer content into incident tickets. Freeze deploys and automated jobs in the affected environment.
2. **Bad app deploy:** route traffic to the last verified artifact only if database compatibility is proven. Otherwise disable the affected route/flag and forward-fix. Re-run health, Auth, tenant A/B and write/read smoke.
3. **Bad migration:** stop writes, capture ledger/catalog/row counts and follow `DATABASE_ROLLBACK_PLAN.md`. Never rerun a partially committed migration or invoke ledger repair without reconciliation.
4. **Database outage:** stop jobs that can duplicate external effects; return controlled errors. On recovery, reconcile pending actions, webhook IDs and idempotency keys before resuming.
5. **WIA/model outage:** disable paid fallback. Keep deterministic tools/approved actions separate; surface `PROVIDER_UNAVAILABLE` or `CONFIGURATION_REQUIRED`. Do not silently mock production.
6. **Messaging outage or uncertain send:** preserve draft and provider reference; mark `UNKNOWN` until adapter reconciliation. Never retry an external send solely because an HTTP request timed out.
7. **Billing outage or uncertain PIX:** stop checkout, preserve payment-intent/webhook ledgers, reconcile with provider sandbox/real account only under approved incident authority. Never issue a second charge with a new key to “unstick” one customer.
8. **Secret leak:** revoke/rotate the affected credential in its owning environment, invalidate sessions when required, scan build/log artifacts, and verify cross-environment separation. Do not rotate production secrets while investigating staging.
9. **Tenant isolation incident:** disable the affected endpoint immediately, preserve immutable audit evidence, determine affected workspaces via safe IDs, and obtain legal/security review before notification or restoration.
10. **Exit:** document root cause, exact fix, regression test, data reconciliation and go/no-go approval. Re-enable jobs/channels/providers individually with monitoring. Keep legal-gated collective memory and public cases OFF.
