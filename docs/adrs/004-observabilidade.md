# ADR 004 — Observabilidade de Custo, Latência e Correlação

**Status:** Aprovado  
**Autor:** @merces  
**Data:** 18/09/2026  
**Decisão:** toda execução da ORKTO carrega correlação completa e expõe métricas mínimas de custo, latência e resultado.

## Contexto

Sem correlação e métricas mínimas, qualquer problema de custo, latência ou comportamento de bot vira caça-vesgos depois. O sistema tem que poder responder: quanto custou essa execução, quanto tempo levou, que decisão foi tomada e porque.

## Decisão

Todo evento que atravessa Hermes, Policy Engine, ações, outbox e entrega externa registra:
- `trace_id` único por operação
- `workspace_id`, `conversation_id`, `agent_run_id`, `action_id`
- `started_at`, `finished_at`, `duration_ms`
- `cost_estimate` quando aplicável
- `source`, `policy_decision`, `status`

As métricas mínimas são: custo por execução/conversa, latência por etapa, taxa de aprovação, taxa de dead-letter, falha de job, indisponibilidade, isolamento.

## Onde fica

- `agent_runs`: latency_ms, cost_estimate, trace_id, status
- `audit_log`: correlação de decisões
- `action_outbox`: tentativas, erros, dead-letter
- Logs estruturados e dashboard futuro via Supabase Cron

## Consequências

- Nenhuma execução importante é anônima
- Custo e latência são mensuráveis antes de qualquer rollout
- Incidentes de isolamento ou replay são detectáveis

## Referentes

- merces (observabilidade e correlação)
- xoto (implementação de métricas)
