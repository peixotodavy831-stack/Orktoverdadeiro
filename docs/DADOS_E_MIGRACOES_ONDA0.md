# Modelo de Dados e Migrações Propostas — Onda 0

**Autor:** @merces  
**Data:** 18/09/2026  
**Status:** Executável — baseado nos ADRs existentes e nas migrações já escritas no repo

---

## 1. O que já existe no repo (estado atual)

O material orgânico já traz três arquivos de migração Supabase:

1. `supabase/migrations/20260918_orkto_conversations_and_messages.sql`
2. `supabase/migrations/20260918_orkto_agents_and_actions.sql`
3. `supabase/migrations/20260918_orkto_swarm_foundation/001_conversations_agents_policies.sql`

O arquivo 3 é o mais completo: 18 tabelas, RLS, views, funções e triggers em um único arquivo. Por isso a decisão prática é: **usar o conjunto do arquivo 3 como esqueleto e consolidar os outros dois dele, não manter três migrações soltas e possivelmente divergentes.**

---

## 2. Decisão de schema para a Onda 0

### 2.1 Tabelas obrigatórias na Onda 0

A fatia vertical primeira precisa disso, não de tudo que o ADR 003 traçou como possível:

- `workspaces` — tenant raiz
- `channel_accounts` — conta do canal (WhatsApp agora)
- `conversations` — conversa com status, sinais leves, last_message_at
- `messages` — mensagens normalizadas com raw_payload para auditoria
- `agent_definitions` — bots especialistas e suas capacidades
- `agent_configs` — dial de confiança e limites por workspace
- `agent_runs` — execuções Hermes com trace, custo e latência
- `agent_actions` — ações propostas/executadas, status de aprovação e execução separados
- `approval_tasks` — tarefas humanas com prioridade, prazo e responsável
- `action_outbox` — fila de envio com idempotency_key
- `dead_letter_events` — eventos que falharam o processamento
- `audit_log` — append-only com função SECURITY DEFINER
- `feature_flags` — controle de visibilidade por workspace

Essas 13 tabelas são o mínimo que permite a primeira fatia vertical: conversa entra, evento interno sai, Hermes classifica, Policy Engine decide, humano aprova se necessário, ação vai para o outbox, outbox entrega.

### 2.2 Tabelas que o arquivo 3 já tem mas preferencialmente adiar para frente

- `conversation_signals` — útil quando os sinais reais de urgência/sentimento estiverem ativos
- `priority_scores` — pronto no arquivo 3; pode ser ativado quando a inbox ordenada for necessária
- `mood_states` — pronto no arquivo 3; ativar quando o Mood Ring for implementado
- `risk_scores` — pronto no arquivo 3; ativar na fase de risco
- `playbooks`, `agent_feedback` — adiantados apenas quando houver playbooks reais e feedback estruturado

Isso não significa remover os DDLs; significa não depender deles na primeira entrega. Se o time quiser, pode deixá-los no mesmo arquivo e só não usá-los no código da Onda 0.

---

## 3. Documentação das tabelas principais

Aqui está o que o time precisa saber para implementar, de forma condensada e sem repetição do SQL.

### 3.1 workspaces

É o tenant raiz. No início pode ser derivado do perfil dono; depois vira modelo de workspaces reais com membros. Campos essenciais: `id`, `name`, `slug`, `owner_id`, `plan`, `created_at`, `updated_at`.

RLS: o usuário vê o workspace onde é dono ou membro.

### 3.2 channel_accounts

Conta de canal por workspace. Agora só WhatsApp importa. Campos essenciais: `id`, `workspace_id`, `provider`, `external_id`, `is_primary`, `status`, `config` e timestamps.

RLS: membro do workspace vê e gerencia as contas do próprio workspace.

### 3.3 conversations

Conversa é a jornada por canal com um contato. Campos essenciais: `id`, `workspace_id`, `channel_account_id`, `phone`, `name`, `status`, `source`, `priority_score`, `priority_reason`, `mood_state`, `mood_confidence`, `risk_score`, `last_message_at`, `last_message_by`, `created_at`, `updated_at`.

RLS: isolamento por workspace.

### 3.4 messages

Mensagem normalizada. Campos essenciais: `id`, `conversation_id`, `workspace_id`, `channel_message_id`, `direction`, `type`, `content`, `content_type`, `sender`, `sender_name`, `sent_at`, `delivered_at`, `read_at`, `raw_payload`, `processed_by_agent`, `agent_run_id`, `policy_checked`, `policy_decision`, `created_at`.

Triggers importantes:
- atualizar `last_message_at` e `last_message_by` na conversa
- correlação com `agent_run_id` quando for processada pelo Hermes

RLS: isolamento por workspace.

### 3.5 agent_definitions

Bots especialistas com capacidades declaradas. Campos essenciais: `id`, `workspace_id`, `name`, `slug`, `description`, `role`, `capabilities`, `default_trust_level`, `is_active`, `is_global`, timestamps.

RLS: visível no próprio workspace ou global.

### 3.6 agent_configs

Configuração por workspace de cada bot: dial de confiança, pausa, playbook e limites. Campos essenciais: `id`, `workspace_id`, `agent_slug`, `trust_level`, `is_paused`, `playbook`, `limits`, timestamps.

RLS: somente workspace dono.

### 3.7 agent_runs

Execução Hermes. Campos essenciais: `id`, `workspace_id`, `conversation_id`, `triggering_message_id`, `agent_id`, `intent`, `risk_level`, `plan`, `status`, `trust_level_used`, `tools_called`, `result_summary`, `cost_usd`, `latency_ms`, `error`, `created_at`, `completed_at`.

Essa tabela é uma das principais fontes de correlação e métrica.

### 3.8 agent_actions

Ação proposta/executada. Campos essenciais: `id`, `agent_run_id`, `workspace_id`, `action_type`, `action_subtype`, `target_type`, `target_id`, `proposed_content`, `proposed_payload`, `status`, `approved_by`, `approved_at`, `rejection_reason`, `edited_content`, `executed_at`, `execution_result`, `error`, `created_at`.

Dois status separados são importantes: um para aprovação e outro para execução. Isso evita a armadilha de “a ação já foi aprovada, mas ainda não foi enviada” versus “foi enviada, mas aprovado não”.

### 3.9 approval_tasks

Tarefa humana. Campos essenciais: `id`, `workspace_id`, `agent_action_id`, `assigned_to`, `priority`, `title`, `description`, `requires_response`, `suggested_reply`, `context`, `status`, `resolved_at`, `created_at`.

RLS: isolamento por workspace.

### 3.10 action_outbox

Fila de envio externo. Campos essenciais: `id`, `workspace_id`, `agent_action_id`, `channel_account_id`, `target_type`, `target_address`, `payload`, `status`, `attempt_count`, `max_attempts`, `last_attempt_at`, `last_error`, `delivered_at`, `idempotency_key`, `created_at`.

O `idempotency_key` é o que garante que um retry não duplique o efeito.

RLS: isolamento por workspace; service role pode gerenciar.

### 3.11 dead_letter_events

Onde os eventos falhos param. Campos essenciais: `id`, `workspace_id`, `original_event_type`, `original_payload`, `error`, `attempt_count`, `next_retry_at`, `resolved`, `created_at`.

Importante para observabilidade e para re-processamento manual quando necessário.

### 3.12 audit_log

Append-only das decisões. Campos essenciais: `id`, `workspace_id`, `actor_type`, `actor_id`, `actor_name`, `action`, `target_type`, `target_id`, `request_id`, `correlation_id`, `details`, `created_at`. Escrito por função SECURITY DEFINER.

---

## 4. Migração proposta

### 4.1 Arquivo único recomendado

Criar:

- `supabase/migrations/20260918_01_orkto_swarm_foundation.sql`

Esse arquivo deve ser a versão consolidada do arquivo 3, com o seguinte ajuste prático: manter só o que a Onda 0 precisa, deixar claro quais tabelas são futureiras e tirar duplicações entre os três arquivos atuais.

### 4.2 Forma recomendada

- Primero: migrar o esqueleto das 13 tabelas obrigatórias, RLS e função de auditoria.
- Depois: views e triggers independentes que não bloqueiam a primeira entrega.
- A_PARTIR daí: ativar `priority_scores`, `mood_states` e `risk_scores` quando o negócio estiver pronto.
- Separar `playbooks` e `agent_feedback` para migração própria quando houver playbooks reais.

Isso mantém a Onda 0 executável sem acoplar a entrega a características que ainda não existem.

### 4.3 O que não fazer agora

- Não alterar `quotes` e `clients` existentes sem reversão clara. O ADR 003 e o plano orgânico já indicam que `quotes` pode precisar de `workspace_id` e `source_conversation_id` no futuro, mas isso é mudança de schema existente e deve vir com plano de reversão ou migração em duas etapas.
- Não depender de `contacts` unificados antes da Onda 0 ter a conversa funcionando. No início, `phone` e `name` na conversa resolvem o necessário.

---

## 5. Relação com o schema existente

O schema atual tem `profiles`, `quotes`, `clients`, `services`. O modelo da Onda 0 não os exclui. Ele vem em cima como camada de conversa, bots e ações, com RLS por workspace. Quando o time for unificar clientes em `contacts`, a transição deve ser adiada para após a Onda 0 estar executando, para não atrapalhar a primeira fatia vertical.

---

*Esse documento é o guia de implementação de schema para a Onda 0. O SQL está nos arquivos de migração; este aqui é a decisão e o raciocínio para quem vai implementar, revisar ou estender.*
