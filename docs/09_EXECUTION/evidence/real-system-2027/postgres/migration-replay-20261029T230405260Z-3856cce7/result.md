# ORKTO migration replay evidence

- Run: `migration-replay-20261029T230417783Z-7fcb2fc2`
- Target: `local`
- Status: **PASS**
- Phase: `TARGET_SCHEMA_INVENTORY`
- PostgreSQL: `PostgreSQL 17.11 on x86_64-windows, compiled by msvc-19.44.35228, 64-bit`
- Migrations: 54/54
- Auth gate: `MANUAL_AUTH_CONFIGURATION_REQUIRED`
- Remote diff: `NOT_EVALUATED_IN_REPLAY`
- Full log: `full-validation.log`

## Migration results

| Version | File | SHA-256 | Result |
| --- | --- | --- | --- |
| 20260905220031 | `20260905220031_initial_secure_orkto_schema.sql` | `9d92b7107486a944ae58001c4c33d207c6bad656ef7234dc00e6e11105ab16ac` | PASS |
| 20260906145611 | `20260906145611_harden_billing_and_profiles.sql` | `62f7e293ffda2092de626077caf7f41086d9d7e76ce9e6ec3b937750596aa5c9` | PASS |
| 20260908094252 | `20260908094252_quote_retention.sql` | `9c36a555b21453645105a4b8404dbb3092f3ad75ce0ecc77de95975b3c4c93c9` | PASS |
| 20260908094655 | `20260908094655_quote_retention_cleanup.sql` | `8f1c0922256a31f0df36d6434b393617c5a5ff72fa62a3e9145337d95dbb27d5` | PASS |
| 20260908184808 | `20260908184808_launch_hardening_verified_empty_legacy_columns.sql` | `338c0c6cff694624f8c945e0a8c8d74dffe794a126381d883d147caf6b721706` | PASS |
| 20260908184908 | `20260908184908_launch_hardening_followup.sql` | `7d6982cd9c92cd9b4952f7b5d7c95317c5c2d45f8ff1007d951cafc5d17b656f` | PASS |
| 20260923225648 | `20260923225648_create_tony_persistent_memory.sql` | `c6d8145b447ccdb50bc1b29ebecbd42b95cc91ff81d8d14609e0ced8f5250afa` | PASS |
| 20260924000000 | `20260924000000_orkto_conversations_and_messages.sql` | `1b1d9ba65c8bb255c9a3731a1950425496515637817881ca1edb911ec1d388fd` | PASS |
| 20260925000100 | `20260925000100_wiaos_model_usage.sql` | `e68db8a96191c6b39ed4593dd3a4cfee2130891161ac1d964bdd8d2167f8a722` | PASS |
| 20260926000100 | `20260926000100_internal_finance_pok.sql` | `f86879bdd1d7c8e45c06df7a04a13b1a6bdb266e508714c2febd37969db72eac` | PASS |
| 20260926192349 | `20260926192349_orkto_full_operational_v01.sql` | `7477df343416449cac89e83a84b8e7a6cc22958e619f330cad331fd81fda3054` | PASS |
| 20260927120000 | `20260927120000_workspace_legacy_ownership.sql` | `44557ae2449a5a4c2a44c2533864e03f2211016e423a4299116a5294efd0f63b` | PASS |
| 20260927150000 | `20260927150000_core_commercial_relations.sql` | `2c428a2f95d34b207a4a23888c3b2ff058e018c9c98256911d2b92858e7c5cd1` | PASS |
| 20260927160000 | `20260927160000_sussurro_recipient_acl.sql` | `32f9ab59e735d659cb2cd20b52b4acaf432a9338a8cf3c2327347e28ed26f549` | PASS |
| 20260927170000 | `20260927170000_billing_finance_convergence.sql` | `2cc23d38176d51f99b3b477f3730b23da34d0cf9aaf74cbfd0561559303c5bf4` | PASS |
| 20260927180000 | `20260927180000_advanced_convergence6.sql` | `868ef0acde34f8c418abb881b588916026b783842065848056242c42db504e01` | PASS |
| 20260928120000 | `20260928120000_security_reconciliation.sql` | `96684377537661d30c7a9dbac7efd30a00b554cbf99f4511e565bc3bd50effef` | PASS |
| 20260928130000 | `20260928130000_durable_payment_and_delivery_ledgers.sql` | `103354a8fe3290fe38de7796b8be1ae38d4aafffcd76bd700e9b1c9ad7b7edde` | PASS |
| 20261003234000 | `20261003234000_core_client_mutation_gateway.sql` | `9447ddaba553251dffe64776660c093dd0970bbf89b19a3a8f25bbf3621b3fd9` | PASS |
| 20261004000000 | `20261004000000_core_client_update_archive_gateway.sql` | `2e062c87139524b045236702a92a8db1d25578f1aae22b5c985bb911ca5a5a10` | PASS |
| 20261004002000 | `20261004002000_core_catalog_mutation_gateway.sql` | `cad1ceb5d5b7431ff467a7a7bbf716f10c3da8029e5f98694f7bd072b71d9c12` | PASS |
| 20261004004000 | `20261004004000_core_deal_mutation_gateway.sql` | `f125c2d423df66bccdf49114997e1963c2b1a94a8e729c1c6d67e9004cac7d3f` | PASS |
| 20261004010000 | `20261004010000_core_wia_decision_gateway.sql` | `86127c721f85c2de8288ebd0a7df2db19eebb907bb347b83ed49c11e4322beb1` | PASS |
| 20261004012000 | `20261004012000_core_quote_create_gateway.sql` | `ef33c25f650bbd1204328a6619f120b086003d0a04795b26a8d81999e0724c6a` | PASS |
| 20261004014000 | `20261004014000_core_inbox_priority_gateway.sql` | `e12331873f332d38f51ded80076d4adafd15954ccfaba8d34f43f0dd8fb41d9f` | PASS |
| 20261004020000 | `20261004020000_core_quote_customer_match_guard.sql` | `e864d4f7981344bc1ecbd21b946cdec8b30a3cbb32388b890177d92f582f957f` | PASS |
| 20261005010000 | `20261005010000_core_profile_onboarding_gateway.sql` | `5426026ed7129d837e161df79b524c9bf67faec277a5e2d61cc55c488ab58df6` | PASS |
| 20261007003905 | `20261007003905_core_inbox_state_gateway.sql` | `7f550ada984d331a4248d3b622bfb1d38049aa2a53304e68a4c167e7440fd7f1` | PASS |
| 20261007010000 | `20261007010000_core_quote_archive_gateway.sql` | `1c3a9df5507ebb9f0c1cf6eb3d375a19dc9e193157ab3211416edfc10594b0ed` | PASS |
| 20261007020000 | `20261007020000_core_quote_update_gateway.sql` | `cd80c289f066b197f710d496fa94f735954fecde2951ee5c09cae1ea1e3c8c80` | PASS |
| 20261007030000 | `20261007030000_quote_legacy_link_invalidation.sql` | `ec1f4f40a659a4f137a574b5268e5756c9df17ebe03e2a3ec8469b5fe77da877` | PASS |
| 20261007040000 | `20261007040000_core_deal_outcome_gateway.sql` | `f62f2fd0a1e77cbbb91d1d51d3cdd05b2b7d3dbb5b432961b7146990b2c31ca4` | PASS |
| 20261008000000 | `20261008000000_core_wia_prepare_gateway.sql` | `52fc2b25ea16b590575a3b29184a839ea8c031aacf99d8cf872ff054cbf748c8` | PASS |
| 20261008010000 | `20261008010000_core_live_quote_gateway.sql` | `269d4f73458720c2fc0e3282688b8b05c6ce3c52be60f826cc3689a4acbef367` | PASS |
| 20261009000000 | `20261009000000_core_quote_retention_gateway.sql` | `e1078541de7a13b62254f42bab7511081aef5e1203d3305624d4c7f65233eb06` | PASS |
| 20261009010000 | `20261009010000_quote_retention_workspace_plan.sql` | `824ab166cd00402f106f9edfdf8dd749449aaace9ee01fec0b18e2871bdb8a61` | PASS |
| 20261009175400 | `20261009175400_core_approval_task_decision_gateway.sql` | `1e405ddb6c3415a9d988dd148c308b6172a095e67db1b7731d559c0c7a812468` | PASS |
| 20261009190000 | `20261009190000_core_contact_mutation_gateway.sql` | `756f6a4a134d893027b1bec4b5bc302e35f107f663025ef45076cef14e3fa8d6` | PASS |
| 20261010160000 | `20261010160000_live_quote_audit_actor_fix.sql` | `4f6fe61637077b45a850a424caf4458ce88ad068a294d2886e2c74b881f38680` | PASS |
| 20261010170000 | `20261010170000_live_quote_publication_state.sql` | `458141cb489758165fd8fea63ab7760f3fa96852c496455ef15768e87279dcfa` | PASS |
| 20261010180000 | `20261010180000_auth_profile_provisioning.sql` | `cbac47121edd1fdd42b18fd74bcff2f1bbcaaa1197010b357370bb6410143189` | PASS |
| 20261014145836 | `20261014145836_google_only_closed_pilot.sql` | `cf63c9b41e045e9c6686e7c3bbf4f816d31973bac204e500166b451bebbab4a0` | PASS |
| 20261014152518 | `20261014152518_restrict_pilot_recovery_to_synthetic_scope.sql` | `e6688f783b424917e9b026aedebf57259d529edad31d43cb455f328584a18c35` | PASS |
| 20261014160000 | `20261014160000_google_pilot_gate_fails_closed.sql` | `0e270ab99981f128e1617408f667e4c2cd23ca0733342dba5db77a16eafe255c` | PASS |
| 20261016010000 | `20261016010000_personal_profile_gateway.sql` | `12735b92f3327f3b8376a7b47d617455a0b2838db1d7122118a1560e7389eafa` | PASS |
| 20261016020000 | `20261016020000_wia_request_provenance.sql` | `a51a3c7e932faaf6daf8fecdb1055d054a03d25d05916e6a176d960a482e1258` | PASS |
| 20261016030000 | `20261016030000_meta_whatsapp_connections.sql` | `fa154b94c7e8aae6dcd626c69975746562eb22694424aed3b0bab2b3ca3f7432` | PASS |
| 20261016050000 | `20261016050000_meta_whatsapp_performance_indexes.sql` | `6e46bfa3dbe23fef63166e8fb92dd6315f7b85243e9a37424e4ba1c08afa85ca` | PASS |
| 20261016060000 | `20261016060000_commercial_billing_pulso.sql` | `aaba842e2303947f47f2ac0cb6ad1f264dca0b90becbd4a8f0248244b9ebb093` | PASS |
| 20261016182215 | `20261016182215_billing_native_lifecycle.sql` | `6f2d9e1eaab9baebc8038d1de1804efe32b2a9b3fce5bf6ab16e4351447c25c6` | PASS |
| 20261023162021 | `20261023162021_meta_unique_client_match.sql` | `7f80a967668d167a8e0f157dc61883134c72f417ae3c06c3a84bf86f91d5abd4` | PASS |
| 20261026164542 | `20261026164542_meta_disconnect_guard.sql` | `e43f3052d8a913ff28b14b94bce9693797fd48e016ae3a5c8188ca4835748ff0` | PASS |
| 20261027111004 | `20261027111004_meta_unsupported_message_notice.sql` | `0d9916aa1b0b07822f37c6c8b7773654b2fd17ff9a7ddf55c84f80f285e37c03` | PASS |
| 20261029224850 | `20261029224850_wia_private_chat_history.sql` | `67b777002eae4d6308534f7edb57bc377bf7796e983c426fd195287de003d144` | PASS |

## Assertions

| Assertion | Result |
| --- | --- |
| RLS and browser grants | PASS |
| workspace memberships and legacy backfills | PASS |
| tenant A/B isolation and cross-tenant constraints | PASS |
| constraints, foreign keys, and indexes | PASS |
| legacy rows and trigger restoration | PASS |
| Starter active proposal limit: fixture 1 + 4 = 5; next rejected | PASS |
| Scale entitlement and expired-trial rejection | PASS |

Target inventory: `target-schema-inventory.json`
Inventory SHA-256: `0bab9726977dc1cb0d747d3284e5e63105bce8c122a9c7f67a4ca25c9c8e46c3`
