# ORKTO database privilege contract — candidate, 2026-09-28

Scope: ORKTO-owned relations in `public`, after the pending migrations. This is a *proposed local security contract*, not evidence that production already enforces it. The source of the table inventory is CI artifact `10947877741` (16 migrations); the remote public-schema ACL baseline is documented in `REMOTE_DRIFT_REMEDIATION_PLAN_2026-09-28.md`. Do not apply this contract to Supabase-owned `auth`, `storage`, `realtime`, `vault`, `cron`, or other managed schemas.

For all rows below, `USAGE` and `EXECUTE` are **N/A at table level**. `public` schema `USAGE` is allowed to `anon`, `authenticated`, `service_role`, and `postgres`; it is not a table grant. Function `EXECUTE` is defined separately. `RLS=Y` means enabled with tenant/owner-specific policies, not a universal `USING(true)`. No browser role receives `TRUNCATE`, `REFERENCES`, `TRIGGER`, or `MAINTAIN` on ORKTO tables. `service_role` is server-only, has table `SELECT,INSERT,UPDATE,DELETE` and may need administrative privileges; `postgres` is the owner/administrative role. `PUBLIC` receives no explicit ORKTO-table privilege. No implicit grant is relied upon.

Privilege codes used in each table row: `—` = no privilege; `S` = SELECT only; `CRUD` = SELECT,INSERT,UPDATE,DELETE. `C0` = no column-level grants to `anon`, `authenticated`, or `PUBLIC`; table-level SELECT gives authenticated access to columns only after RLS. Current source search found only browser SELECT on `profiles`; profile writes pass through the backend. The candidate therefore removes legacy profile column writes, but old deployed clients must be checked in staging. The server API is the only intended write path for commercial tables; the unreferenced `src/lib/supabase.ts` legacy quote helper is not a production contract.

| Schema.table | anon S/I/U/D | authenticated S/I/U/D | service_role S/I/U/D | postgres S/I/U/D | PUBLIC | Column privileges | RLS / policy required | Rationale |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| public.asaas_webhook_events | — | — | CRUD | CRUD | — | C0 | Y / server-only | Webhook idempotency, not browser data |
| public.clients | — | S | CRUD | CRUD | — | C0 | Y / workspace SELECT | Customer read; writes require API policy |
| public.services | — | S | CRUD | CRUD | — | C0 | Y / workspace SELECT | Catalog price integrity |
| public.quotes | — | S | CRUD | CRUD | — | C0 | Y / workspace SELECT + restrictive retention | Proposal price/approval integrity |
| public.proposals | — | S | CRUD | CRUD | — | C0 | Y / workspace SELECT | Public slug access uses backend, not anon table SELECT |
| public.quote_extensions | — | S | CRUD | CRUD | — | C0 | Y / workspace SELECT | Extension history read only |
| public.payment_records | — | S | CRUD | CRUD | — | C0 | Y / workspace SELECT | Payment status read only |
| public.profiles | — | S | CRUD | CRUD | — | C0 | Y / owner policies + billing guard | Profile browser read; writes use backend API |
| public.tony_conversations | — | — | CRUD | CRUD | — | C0 | Y / no browser policy | Legacy server memory |
| public.tony_memories | — | — | CRUD | CRUD | — | C0 | Y / no browser policy | Legacy server memory |
| public.orkto_accounting_exports | — | — | CRUD | CRUD | — | C0 | Y / server-only | Accounting data |
| public.orkto_approval_tasks | — | S | CRUD | CRUD | — | C0 | Y / workspace SELECT | Human approval queue, API writes |
| public.orkto_audit_log | — | S | CRUD | CRUD | — | C0 | Y / workspace SELECT | Audit immutable to browser |
| public.orkto_automation_jobs | — | S | CRUD | CRUD | — | C0 | Y / workspace SELECT | Job state visible, server executes |
| public.orkto_automation_runs | — | S | CRUD | CRUD | — | C0 | Y / workspace SELECT | Run history |
| public.orkto_automations | — | S | CRUD | CRUD | — | C0 | Y / workspace SELECT | Config via API |
| public.orkto_case_studies | — | S | CRUD | CRUD | — | C0 | Y / workspace SELECT | Public publication legally gated in backend |
| public.orkto_channel_usage | — | S | CRUD | CRUD | — | C0 | Y / workspace SELECT | Usage read, server accounting |
| public.orkto_collection_cases | — | S | CRUD | CRUD | — | C0 | Y / workspace SELECT | Collection actions require policy |
| public.orkto_collection_events | — | S | CRUD | CRUD | — | C0 | Y / workspace SELECT | Event history |
| public.orkto_collective_memory_contributions | — | — | CRUD | CRUD | — | C0 | Y / server-only | Cross-workspace gate remains legally disabled |
| public.orkto_collective_memory_items | — | — | CRUD | CRUD | — | C0 | Y / server-only | Shared memory disabled |
| public.orkto_contacts | — | S | CRUD | CRUD | — | C0 | Y / workspace SELECT | Contact read |
| public.orkto_conversations | — | S | CRUD | CRUD | — | C0 | Y / workspace SELECT | Inbox read, API writes |
| public.orkto_customer_signals | — | S | CRUD | CRUD | — | C0 | Y / workspace SELECT | Operational signal read |
| public.orkto_deals | — | S | CRUD | CRUD | — | C0 | Y / workspace SELECT | Deal read, stage changes via API |
| public.orkto_duplicate_reviews | — | S | CRUD | CRUD | — | C0 | Y / workspace SELECT | Merge review |
| public.orkto_feature_configs | — | S | CRUD | CRUD | — | C0 | Y / workspace SELECT | Workspace flag read, admin writes via API |
| public.orkto_finance_assumptions | — | — | CRUD | CRUD | — | C0 | Y / server-only | Internal ORKTO finance |
| public.orkto_finance_transactions | — | — | CRUD | CRUD | — | C0 | Y / server-only | Internal ORKTO finance |
| public.orkto_import_jobs | — | S | CRUD | CRUD | — | C0 | Y / workspace SELECT | Import progress |
| public.orkto_import_rows | — | S | CRUD | CRUD | — | C0 | Y / workspace SELECT | Import review |
| public.orkto_live_quote_events | — | S | CRUD | CRUD | — | C0 | Y / workspace SELECT | Public token event via backend |
| public.orkto_live_quotes | — | S | CRUD | CRUD | — | C0 | Y / workspace SELECT | Public token view via backend |
| public.orkto_messages | — | S | CRUD | CRUD | — | C0 | Y / workspace SELECT | Inbox read; sending via approval/channel API |
| public.orkto_model_usage | — | S | CRUD | CRUD | — | C0 | Y / workspace SELECT | Cost telemetry read |
| public.orkto_notifications | — | S | CRUD | CRUD | — | C0 | Y / workspace SELECT | Notification read; state via API |
| public.orkto_plan_catalog | — | — | CRUD | CRUD | — | C0 | Y / server-only | Commercial assumptions not public |
| public.orkto_plan_price_versions | — | — | CRUD | CRUD | — | C0 | Y / server-only | Unapproved prices |
| public.orkto_plan_usage | — | S | CRUD | CRUD | — | C0 | Y / workspace SELECT | Entitlement usage read |
| public.orkto_purchases | — | S | CRUD | CRUD | — | C0 | Y / workspace SELECT | Purchase history |
| public.orkto_replay_records | — | S | CRUD | CRUD | — | C0 | Y / workspace SELECT | Replay read |
| public.orkto_reports | — | S | CRUD | CRUD | — | C0 | Y / workspace SELECT | Reports read |
| public.orkto_risk_assessments | — | S | CRUD | CRUD | — | C0 | Y / workspace SELECT | Explainable risk read |
| public.orkto_sussurros | — | S | CRUD | CRUD | — | C0 | Y / recipient/workspace SELECT | Private operator-only notes |
| public.orkto_tasks | — | S | CRUD | CRUD | — | C0 | Y / workspace SELECT | Task read |
| public.orkto_wia_actions | — | S | CRUD | CRUD | — | C0 | Y / workspace SELECT | Approval/action writes via API |
| public.orkto_wia_chat_messages | — | S | CRUD | CRUD | — | C0 | Y / workspace + user SELECT | WIA chat history |
| public.orkto_wia_events | — | S | CRUD | CRUD | — | C0 | Y / workspace SELECT | WIA trace events |
| public.orkto_wia_memories | — | S | CRUD | CRUD | — | C0 | Y / workspace SELECT | Contextual memory read |
| public.orkto_wia_runs | — | S | CRUD | CRUD | — | C0 | Y / workspace SELECT | WIA run read |
| public.orkto_wia_tool_calls | — | S | CRUD | CRUD | — | C0 | Y / workspace SELECT | Tool trace read |
| public.orkto_workspace_invites | — | S | CRUD | CRUD | — | C0 | Y / workspace admin SELECT | Invite management |
| public.orkto_workspace_members | — | S | CRUD | CRUD | — | C0 | Y / workspace SELECT | Membership read |
| public.orkto_workspace_subscriptions | — | S | CRUD | CRUD | — | C0 | Y / workspace SELECT | Billing state read |
| public.orkto_workspaces | — | S | CRUD | CRUD | — | C0 | Y / workspace SELECT | Workspace read |
| public.orkto_wrapped | — | S | CRUD | CRUD | — | C0 | Y / workspace SELECT | Recap read |

### Function, sequence and schema contract

- `public` schema: `USAGE` for `anon`, `authenticated`, `service_role`, `postgres`; no `CREATE` for browser roles. `auth` and `storage` privileges are Supabase-managed and outside this contract.
- ORKTO `SECURITY DEFINER` functions: `orkto_is_workspace_member(uuid)`, `orkto_is_workspace_admin(uuid)` and `orkto_legacy_owner_matches(uuid,uuid)` may be executed by `authenticated` and `service_role`, with fixed search path and tenant/user validation in function body. Other `orkto_*` functions are server/trigger only; `anon`, `authenticated`, and `PUBLIC` have no `EXECUTE`. Functions must not accept arbitrary workspace ID as proof of membership.
- All current `public` functions are ORKTO-owned in the tested targets (16 on the vanilla fixture; 17 on the Supabase-like baseline) and must have `postgres` ownership. Legacy `tony_search_context`, `extend_quote_retention`, `purge_expired_quotes`, `guard_quote_retention`, `bind_proposal_retention`, `check_proposal_expiry` and `protect_profile_billing_fields` are `service_role`/owner-only when present, including trigger functions. Direct browser `EXECUTE` is denied. Future functions need explicit review before adding browser execution.
- `public.tony_conversations_id_seq`, `public.tony_memories_id_seq`, `public.orkto_finance_assumptions_version_seq`: no `anon`/`authenticated`/`PUBLIC` sequence privilege; server/admin only. No other sequence is covered without ownership review.
- Supabase default ACL entries for `postgres` and `supabase_admin` are **PLATFORM_KEEP** globally, **ORKTO_OVERRIDE** on each named application object. The candidate must remove inherited object privileges explicitly; never bulk-change platform default ACLs.

### Required proof before promotion

1. Inventory all 57 public tables and assert each row above has RLS and the exact browser role privileges, including independent column grants.
2. Run as `anon`, authenticated owner A/B/member and `service_role`; verify SELECT and negative INSERT/UPDATE/DELETE, cross-tenant IDs, indirect FKs, and privileged RPCs.
3. Confirm profile editing on staging after legacy column grants are removed; current React source uses direct Supabase for profile SELECT only.
4. Simulate Supabase-like defaults before migrations and compare the final effective ACLs, not just source `GRANT` statements.
