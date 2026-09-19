# ADR 005 — Contrato de Webhook e Eventos de Canal

**Status:** Aprovado  
**Autor:** @merces  
**Data:** 18/09/2026  
**Decisão:** toda entrada de canal passa por Webhook Gateway + Normalizador e vira evento interno estável antes de qualquer processamento.

## Contexto

Canal real pode mudar, formato nativo pode mudar, assinatura pode mudar. A ORKTO não pode acoplar negócio a payload nativo do canal. Além disso, webhook duplicado, replay e payload fora de janela já vêm como problema real de produção.

## Decisão

- Gateway valida origem, tamanho e idempotência antes de persistir.
- O evento interno tem sub-tipos estáveis, não o formato nativo.
- Idempotência por `event_id`: replay é registrado e ignorado.
- Todo webhook vira um evento correlacionado antes de chegar ao Hermes.

## Contrato de entrada externa

POST `/api/orkto/whatsapp/webhook`
- `event_id`: idempotência
- `event_type`: message | status | contact | delivery
- `workspace_id` ou slug
- `channel_identity`
- `payload`: formato nativo
- `received_at`

## Contrato de evento interno

- `event_id`, `workspace_id`, `conversation_id`, `trace_id`
- `event_type` normalizado
- `received_at`

## Consequências

- Canais trocáveis sem risco ao negócio
- Replay detectável e auditável
- Hermes e Policy Engine não veem payload nativo, veem evento normalizado

## Referentes

- merces (contratos e gateway)
- xoto (normalizador e consumidor)
