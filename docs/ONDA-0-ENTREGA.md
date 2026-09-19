# Entrega Onda 0 + Primeira Fatia Vertical da Onda 1

**Data:** 18/09/2026  
**Worker:** gueguel  
**Status:** Entregue

## Resumo

Esta entrega executa o prompt mestre do swarm ORKTO, entregando a Onda 0 (fundação e contratos) e a primeira fatia vertical da Onda 1 (operação assistida) em modo homologação, sem enviar mensagens reais.

## O que foi entregue

### Onda 0 - Fundação e Contratos

1. **Inventário tecnico do repositório**
   - Express/React/Vite/Supabase existentes
   - Autenticação, perfis, clientes, propostas, pagamentos (Asaas)
   - Identidade visual consolidada

2. **ADRs de arquitetura (docs/adrs/)**
   - ADC 001: HermesAdapter - Interface entre ORKTO e Hermes Agent
   - ADR 002: Policy Engine - Motor de Políticas de Autonomia
   - ADR 003: Modelo de Dados para Conversas, Mensagens e Eventos

3. **Migrações Supabase (supabase/migrations/)**
   - `20260918_orkto_conversations_and_messages.sql` - Tabelas de conversas, mensagens, contatos, participantes
   - `20260918_orkto_agents_and_actions.sql` - Tabelas de bots, execuções, ações, aprovações, auditoria

4. **Harness de testes e mocks**
   - `api/orkto-core/hermes-adapter.ts` - Mock do HermesAdapter com traces
   - `api/orkto-core/policy-engine.ts` - Policy Engine com políticas de tempo, consentimento, desconto, risco, autonomia
   - `api/orkto-core/feature-flags.ts` - Feature flags para controle de visibilidade

### Onda 1 - Primeira Fatia Vertical (Operação Assistida)

1. **Inbox operacional unificada**
   - `api/orkto-routes.ts` - Rotas para inbox, conversas, sugestões e aprovações
   - GET /api/orkto/inbox - Lista de conversas priorizadas
   - GET /api/orkto/conversations/:id - Detalhe de conversa
   - GET /api/orkto/suggestions/:id - Sugestões pendentes

2. **Ingestão simulada de WhatsApp**
   - POST /api/orkto/whatsapp/webhook-sim - Recebe evento simulado, persiste, gera sugestão

3. **Sugestões de resposta com aprovação humana**
   - POST /api/orkto/approvals/:id/approve - Aprova sugestão
   - POST /api/orkto/approvals/:id/reject - Rejeita sugestão
   - POST /api/orkto/approvals/:id/edit - Edita sugestão

4. **Central de Bots**
   - GET /api/orkto/bots - Lista de bots com estado, trust level, capacidades
   - POST /api/orkto/bots/:id/pause - Pausa bot
   - POST /api/orkto/bots/:id/resume - Retoma bot

5. **Painel Hoje (Command Center)**
   - GET /api/orkto/dashboard - Resumo operacional do dia

## Como testar

```bash
# Iniciar servidor
npm run dev

# Testar webhook simulado
curl -X POST http://localhost:3000/api/orkto/whatsapp/webhook-sim \
  -H "Content-Type: application/json" \
  -d '{"workspaceId":"ws-001","contactName":"Maria Silva","contactPhone":"+5511999999999","message":"Olá, gostaria de saber mais"}'

# Testar inbox
curl http://localhost:3000/api/orkto/inbox

# Testar dashboard
curl http://localhost:3000/api/orkto/dashboard

# Testar bots
curl http://localhost:3000/api/orkto/bots

# Testar sugestão de conversa
curl http://localhost:3000/api/orkto/conversations/conv-001
```

## Entregas não incluídas nesta fatia

- Frontend da Inbox (componentes React)
- Ingestão bidirecional real com WhatsApp/Evolution API
- Persistência no Supabase (requer credenciais)
- Bots reais com conectores do Hermes

## Riscos e decisões pendentes

1. **Credenciais do Supabase:** Não configuradas neste ambiente - migrações são arquivos SQL prontos para execução
2. **Integração Hermes real:** Pendente de configuração do gateway e credenciais Nous Portal
3. **WhatsApp/Evolution API:** Pendente de configuração do número e webhook
4. **Modelo de tenancy:** Escolha entre workspaces ou profiles existentes ainda por decidir
5. **Perfil de produção:** Quais bots irão para produção e com quais modelos/provedores

## Próximos passos recomendados

1. Executar migrações no Supabase
2. Configurar credenciais e variáveis de ambiente
3. Implementar frontend da Inbox com os componentes existentes
4. Conectar integração real com WhatsApp (Evolution API ou Cloud API)
5. Configurar Hermes Adapter com gateway real
6. Adicionar testes de contrato e E2E

## Arquivos criados

```
docs/adrs/
  001-hermes-adapter.md     # ADR HermesAdapter
  002-policy-engine.md      # ADR Policy Engine
  003-data-model.md         # ADR Modelo de Dados

supabase/migrations/
  20260918_orkto_conversations_and_messages.sql  # Tabelas de conversas/mensagens
  20260918_orkto_agents_and_actions.sql          # Tabelas de bots/ações/auditoria

api/orkto-core/
  hermes-adapter.ts    # Mock HermesAdapter com traces
  policy-engine.ts     # Policy Engine com políticas
  feature-flags.ts     # Feature flags

api/orkto-routes.ts    # Rotas da Inbox, Bots, Dashboard

server.ts              # Atualizado com registro das novas rotas
```
