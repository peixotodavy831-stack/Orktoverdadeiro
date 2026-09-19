# ADR 003: Modelo de Dados para Conversas, Mensagens e Eventos

**Data:** 18/09/2026  
**Decisão:** Criar tabelas novas para conversas, mensagens, contatos, sinais, execuções de bots, aprovações e auditoria, todas com `workspace_id`, timestamps e RLS.  
**Status:** Aprovado

## Contexto

A ORKTO atualmente não possui modelo persistente de conversas e mensagens do WhatsApp. Para a Inbox operacional e o fluxo de sugestões, precisamos de:
- Conversas com participantes e contexto
- Mensagens com tipo, conteúdo e metadados
- Contatos com identidades e consentimentos
- Sinais de prioridade, mood e risco
- Execuções de bots com traces e custo
- Tarefas de aprovação humana
- Audit log append-only

## Tabelas propostas

### workspaces (nova)
Empresas/espaços de trabalho com configuração de canais, horários e limites.

### workspace_members
Membros de workspace com papel e permissões.

### contacts
Contatos unificados (substitui clients futuro), com RLS por workspace.

### contact_identities
Identidades de contato (WhatsApp, e-mail, telefone fixo).

### contact_consents
Registro de consentimentos por canal e uso.

### conversations
Conversas com metadata, status e relação com contatos.

### conversation_participants
Participantes de conversa com papel (cliente, humano, bot).

### messages
Mensagens com tipo (recebida, enviada, sistema), conteúdo e metadados de WhatsApp.

### message_attachments
Anexos de mensagens (imagem, voz, documento).

### conversation_signals
Sinais calculados: prioridade, sentiment, urgência, risco.

### priority_scores
Scores de prioridade com pesos e explicação.

### mood_states
Estado do Mood Ring com confiança e explicação.

### risk_scores
Scores de risco com sinais e recomendação.

### agent_definitions
Definições de bots especialistas com capacidades e limites.

### agent_configs
Configuração por workspace de cada bot (estado, dial de confiança).

### agent_runs
Execuções de bots com trace, contexto e resultado.

### agent_actions
Ações executadas ou sugeridas por bots.

### agent_feedback
Feedback humano sobre ações de bots (aceita, edita, rejeita).

### playbooks
Playbooks de ação com versões e limites.

### approval_tasks
Tarefas de aprovação humana com status e ação proposta.

### action_outbox
Fila de ações a serem executadas (WhatsApp, e-mail, CRM).

### audit_log
Log append-only de todas as ações e decisões.

## Migrações necessárias

1. `20260918_orkto_conversations_and_messages.sql` - Tabelas de conversas e mensagens
2. `20260918_orkto_contacts_and_consents.sql` - Tabelas de contatos
3. `20260918_orkto_agents_and_actions.sql` - Tabelas de bots e execuções
4. `20260918_orkto_approvals_and_audit.sql` - Tabelas de aprovações e auditoria
5. `20260918_orkto_signals_and_scores.sql` - Tabelas de sinais e scores

## Consequências

- Todas as tabelas terão RLS por workspace_id.
- Índices adequados para consultas de inbox e filtros.
- Relationamento com quotes existente via source_conversation_id.
- Estrutura pronta para Realtime e filas do Supabase.

## Referentes

- merces (arquiteto de dados)
- xoto (implementação das migrações)
