# ADR 007 — Estratégia de Testes da Onda 0 e Primeira Fatia Vertical

**Status:** Aprovado  
**Autor:** @merces  
**Data:** 18/09/2026  
**Decisão:** testes começam por contrato mockável e só escalam para integração e E2E quando a base e o canal estão prontos.

## Contexto

A Onda 0 tem que provar o contrato antes de depender de Hermes real, WhatsApp real e Supabase real. A estratégia segue a pirâmide e cobre os casos difíceis que o material orgânico já listou.

## Pirâmide

- Unitário: scores, políticas, máquinas de estado, limites, formatação, normalização de telefone
- Contrato: HermesAdapter, Policy Engine, canal, Asaas/CRM, outbox
- Integração: webhook → fila → agente → policy → outbox → entrega, com Hermes mock
- E2E: venda, recuperação, aprovação, cobrança, opt-out, rejeição, edição
- Segurança: RLS, isolamento, replay, Realtime, segredos
- Agente: conversas fixas, ferramentas permitidas, adversariais

## Casos obrigatórios — Onda 0

- webhook duplicado não duplica mensagem nem ação
- humano edita, aprova e rejeita sugestão
- Policy Engine bloqueia fora de janela e sem consentimento
- ação sem outbox não existe
- isolamento entre workspaces

## Gate da Onda 0

Um simulador recebe mensagem, Hermes escolhe bot simulado e nenhuma ação externa é executada. Isso fecha a Onda 0 sem canal nem Hermes reais.

## Consequências

- A entrega pode ser validada antes de credenciais
- Credenciais não bloqueiam a verificación do contrato
- Rollback e feature flag são testados antes do rollout

## Referentes

- merces (estratégia e contrato)
- xoto (execução)
- gueguel (casos de negócio)
