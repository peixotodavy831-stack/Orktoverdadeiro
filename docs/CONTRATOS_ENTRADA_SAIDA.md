# Contratos de Entrada e Saída — Onda 0 e Primeira Fatia Vertical

**Autor:** @merces  
**Data:** 18/09/2026  
**Status:** Contrato alvo para implementação — baseado em ADRs 001–007 e material orgânico

Esta seção formaliza o que o sistema aceita, o que emite, e o que nunca faz.

---

## Regra zero

- Nenhuma tela, rota ou bot chama Hermes diretamente.
- Bot não envia mensagem, concede desconto ou executa cobrança sem Policy Engine + outbox.
- Toda ação externa passa por `action_outbox` com `idempotency_key`.
- Toda execução importante carrega `trace_id`, `workspace_id`, `conversation_id`, `agent_run_id` e `action_id`.

---

## 1. Entrada externa — canal

### 1.1 Webhook de canal (simulado ou real)

**Caminho:** `POST /api/orkto/whatsapp/webhook`  
**Modo homologação atual:** `POST /api/orkto/whatsapp/webhook-sim` (mock, sem persistência)

**Contrato recebido pelo gateway:**

```json
{
  "event_id": "string — idempotência",
  "event_type": "message | status | contact | delivery",
  "workspace_id": "uuid ou slug",
  "channel": "whatsapp",
  "channel_identity": "phone ou waid",
  "payload": { ... formato nativo do canal ... },
  "received_at": "ISO-8601"
}
```

**O que o gateway garante:**
- valida tamanho e formato mínimo
- detecta replay pelo `event_id`
- gera `trace_id` e evento interno normalizado
- rejeita e registra no audit log se for duplicata ou fora de janela configurada

**O que o normalizador emite:**

```json
{
  "event_id": "interno",
  "trace_id": "uuid",
  "workspace_id": "uuid",
  "conversation_id": "uuid ou null para novo",
  "event_type": "incoming_message | outgoing_status | contact_update | delivery_report",
  "channel": "whatsapp",
  "channel_identity": "string",
  "content": "string",
  "content_type": "text | image | audio | document | location | system",
  "direction": "incoming | outgoing | system",
  "sender_type": "customer | human | bot | system",
  "received_at": "ISO-8601",
  "raw_payload": { ... para auditoria ... }
}
```

**O que essa entrada NÃO faz:**
- não inicia cobrança
- não concede desconto
- não envia mensagem
- não decide política

A entrada só persiste evento e conversa/mensagem. O efeito entra depois pelo Hermes + Policy Engine.

---

## 2. Entrada interna — ação do sistema

### 2.1 Ingestão de simulação

`POST /api/orkto/whatsapp/webhook-sim`  
Corpo atual: `workspaceId`, `contactName`, `contactPhone`, `message` e `senderType` opcional.
Efeito atual: cria IDs efêmeros, executa o `HermesAdapter` mockado e devolve sugestão e tarefa de aprovação simuladas. Não persiste conversa, mensagem ou aprovação.

### 2.2 Comando da WIA (contrato alvo)

```json
{
  "conversation_id": "uuid",
  "content": "mensagem ou transcricao",
  "input_mode": "text | voice | mixed",
  "agent_hint": "human | hunter | farmer | recovery | collection",
  "effort": "fast | balanced | deep",
  "attachment_refs": []
}
```

No estado atual, os endpoints aceitam apenas o texto. Anexos devem ser enviados antes para armazenamento privado e referenciados por ID; binarios, caminhos locais e URLs arbitrarias nao entram no envelope. A API valida workspace, MIME, tamanho, permissao e ownership. A escolha da WIA nunca ignora HermesAdapter, Policy Engine ou aprovacao exigida.

Essas validações descrevem o comportamento alvo; ainda não estão implementadas no endpoint mockado.

### 2.3 Aprovação de sugestão

```
POST /api/orkto/approvals/:id/approve
POST /api/orkto/approvals/:id/reject
POST /api/orkto/approvals/:id/edit
```

**Contrato de aprovação:**
```json
{
  "approval_id": "uuid",
  "action": "approve | reject | edit",
  "edited_content": "opcional, para edit",
  "rejection_reason": "opcional, para reject",
  "actor_id": "uuid do humano"
}
```

**Efeito:**
- gera evento de auditoria
- se aprovado, move a ação para `action_outbox`
- nunca envia direto do handler de aprovação

No estado atual, essas rotas operam sobre respostas simuladas e não gravam no Supabase nem enfileiram uma ação externa.

### 2.4 Controle de bot

```
GET /api/orkto/bots
POST /api/orkto/bots/:id/pause
POST /api/orkto/bots/:id/resume
```

Mudar estado do bot só pausa/resume; não executa efeito pelo caminho.

---

## 3. Saída para a UI e para o humano

### 3.1 Sugestão de resposta

```json
{
  "suggestion_id": "uuid",
  "conversation_id": "uuid",
  "action_type": "suggest_reply",
  "proposed_content": "texto",
  "proposed_payload": { ... },
  "policy_decision": {
    "allowed": true,
    "policies": ["horario", "consentimento", "limite_desconto"],
    "blocked_reason": null,
    "trust_level_used": 2
  },
  "trace_id": "uuid",
  "expires_at": "ISO-8601",
  "confidence": "number ou null"
}
```

**Propriedades:**
- `policy_decision` explica o que foi verificado
- sugestão tem prazo de expiração
- bot sugerido e level de autonomia usados são visíveis

### 3.2 Tarefa de aprovação

```json
{
  "task_id": "uuid",
  "conversation_id": "uuid ou null",
  "action_summary": { "type": "...", "description": "..." },
  "priority": "low | normal | high | urgent",
  "assigned_to": "uuid ou null",
  "status": "pending | in_review | approved | rejected | edited | cancelled | escalated",
  "expires_at": "ISO-8601",
  "trace_id": "uuid"
}
```

### 3.3 Ação executada / falha

```json
{
  "action_id": "uuid",
  "agent_run_id": "uuid",
  "action_type": "send_message | discount | schedule_followup | ...",
  "execution_status": "executed | failed | cancelled",
  "execution_result": { ... },
  "execution_error": "opcional",
  "policy_applied": ["..."],
  "trace_id": "uuid",
  "executed_at": "ISO-8601"
}
```

---

## 4. Saída externa — action_outbox

**Contrato do outbox:**

```json
{
  "id": "uuid",
  "workspace_id": "uuid",
  "agent_action_id": "uuid ou null",
  "target_channel": "whatsapp | email | crm | internal",
  "target_identity": "phone | email | id",
  "payload": { ... },
  "template": "opcional",
  "status": "pending | processing | sent | delivered | failed | cancelled",
  "attempts": 0,
  "max_attempts": 5,
  "external_id": "opcional",
  "external_timestamp": "ISO-8601 ou null",
  "error_message": "opcional",
  "idempotency_key": "string única",
  "created_at": "ISO-8601"
}
```

**Contratos de consumo:**
- somente um consumidor processa cada ação
- idempotência é garantida pelo `idempotency_key` no banco
- falha vai para `dead_letter_events` após `max_attempts`
- entrega registrada com `external_id` e `external_timestamp`

**O que não pode acontecer:**
- bot chama WhatsApp direto
- envio duplicado por retry sem idempotência
- política violada antes do outbox
- segredo de canal exposto no payload para o navegador

---

## 5. Eventos de correlação / audit log

**Contrato de evento de auditoria:**

```json
{
  "event_id": "uuid",
  "workspace_id": "uuid",
  "event_type": "bot_run | action_executed | approval | policy_violation | webhook_received | ...",
  "actor_type": "bot | human | system | webhook",
  "actor_id": "uuid ou null",
  "event_data": { ... },
  "conversation_id": "uuid ou null",
  "agent_run_id": "uuid ou null",
  "action_id": "uuid ou null",
  "trace_id": "string",
  "created_at": "ISO-8601"
}
```

**Propriedades:**
- append-only
- escrito por função SECURITY DEFINER
- todo efeito externo e decisão importante vai para aqui

---

## 6. Respostas de erro padronizadas

```json
{
  "error": "codigo",
  "message": "legível",
  "trace_id": "uuid",
  "details": { ... opcional ... }
}
```

Códigos mínimos:
- `POLICY_VIOLATION`
- `DUPLICATE_EVENT`
- `INVALID_IDEMPOTENCY`
- `OUTBOX_FAILED`
- `BOT_NOT_AUTHORIZED`
- `CONSENT_MISSING`
- `OPERATION_OUTSIDE_WINDOW`

---

## 7. O que não é contrato ainda (adiante)

- entrega real de WhatsApp com status bidirecional
- conciliação de CRM/Asaas
- eventos de delivery completa
- coleção de sinal de risco automatizada
- relatórios automáticos

Esses entram depois, com o mesmo padrão de idempotência e correlação já definido aqui.

---

*Contratos revisados e prontos para quem implementa. Quem aceita um evento consegue rastrear o que foi, por que foi e quem aprovou.*
