# Atualização de integração — 21/10/2026

**Baseline vigente: 78497da (PR #2).** A análise abaixo é preservada como fotografia da branch antiga bff22b7 e NÃO descreve integralmente a arquitetura atual. O contrato integrado está em ORKTO_RADAR_SPEC_MINIMA_2026-10-20.md e o resultado local em ORKTO_RADAR_R1_INTEGRATION_2026-10-21.md.

Correções da comparação atual:

- G1: Radar R1 recuperado seletivamente nesta branch isolada; não implantado.
- G2: existe produtor de orkto_tasks no gateway WIA (`20261004010000_core_wia_decision_gateway.sql`); cria tarefa interna aprovada sem due_at nesse caminho. Portanto, não afirmar ausência de produtor; agendamento de prazo continua lacuna separada. A data prevista de fechamento não vira tarefa.
- G6: Pulso e Cost Governor existem em `_shared/wia-request.ts`, `_shared/cost-governor.ts` e migration comercial 20261016060000. UI Pulso em src/components/BillingPage.tsx. Central Econômica/financeiro e suas reservas atuais não recebem dependência nem escrita do Radar; nenhuma regra de receita/franquia/consumo alterada.
- Auth atual é Google-only/piloto com middleware e cliente JWT-bound. Radar exige membership preexistente e consultas por esse cliente; a rota antiga não atendia estritamente à ausência de provisionamento.
- Histórico de mensagens com cap global poderia gerar inferências falsas. R1 agora informa consulta parcial e não calcula leads quando esse histórico atinge o limite.
- Mensagem outbound persistida não equivale a entrega; sem decisão registrada na proposta não significa ausência comprovada de resposta em todo canal. Textos/evidências foram ajustados.
- Futuro Playbooks reutiliza a arquitetura documentada em ORKTO_PLAYBOOKS_2027_ARCHITECTURE.md, Mutation Gateway, aprovação e orçamento. Nenhum executor/autonomia é habilitado pelo R1.

**READY_FOR_PRODUCTION_CANDIDATE=NO.** Nenhum PASS local atualiza a homologação remota existente.

---

## Fotografia histórica da branch antiga
# ORKTO Radar — análise de lacunas — 20/10/2026

**Escopo:** viabilidade de um Radar de sinais comerciais (inspirado em capacidades de Agentforce Sales, HubSpot Guided Selling, Gong Deal Intelligence e Intercom Fin Procedures — sem copiar código, interface ou propriedade intelectual). Este documento registra apenas o que foi verificado no checkout em 20/10/2026. **Produção não alterada. Nenhum merge. Nenhum envio externo ativado.**

**Método:** leitura direta de migrations, rotas, telas e testes deste checkout (branch `production-readiness/migration-replay-20260928`, HEAD `bff22b7` + trabalho local não commitado preservado). Referências no formato `arquivo:linha` comprovam cada afirmação.

## 1. Substrato existente e verificável

### 1.1 Dados brutos que alimentam sinais

| Insumo | Tabela | Campos relevantes | Evidência |
| --- | --- | --- | --- |
| Propostas | `public.quotes` | `status` (draft/sent/viewed/pending/approved/rejected/expired), `sent_at`, `viewed_at`, `approved_at`, `rejected_at`, `total`, `archived_at`, `customer_id`, `deal_id`, `workspace_id` | `supabase/migrations/20260905220031_initial_secure_orkto_schema.sql:34`, vínculos em `20260927150000_core_commercial_relations.sql:7-10` |
| Conversas (leads) | `public.orkto_conversations` | `status` (open/active/paused/closed/archived), `contact_name`, `contact_phone`, `last_message_at`, `created_at` | `supabase/migrations/20260924000000_orkto_conversations_and_messages.sql:4` |
| Mensagens com direção | `public.orkto_messages` | `conversation_id`, `direction` (incoming/outgoing), `sent_at`, `read_at` | consumidas em `backend/operational-routes.ts:694` |
| Tarefas/follow-ups | `public.orkto_tasks` | `status` (open/in_progress/completed/cancelled), `due_at`, `completed_at`, `deal_id`, `customer_ref` | `supabase/migrations/20260926192349_orkto_full_operational_v01.sql:57` |
| Negócios | `public.orkto_deals` | `stage`, `status`, `expected_close_on`, `value_cents`, `updated_at` | `20260926192349_orkto_full_operational_v01.sql:47` |
| Sinais de cliente | `public.orkto_customer_signals` | `signal_type`, `value`, `occurred_at`, `expires_at`, `provenance` | `20260926192349_orkto_full_operational_v01.sql:109` |
| Notificações | `public.orkto_notifications` | `type`, `title`, `body`, `entity_type`, `entity_ref`, `idempotency_key`, `read_at` | `20260926192349_orkto_full_operational_v01.sql:229` |

### 1.2 Motores determinísticos já existentes

- `assessOperationalRisk` (`backend/orkto-core/full-operational.ts:77`) — motor de regras `operational-risk-v1` com peso para `proposal_unanswered`, `long_silence`, `overdue_payment`; persiste em `orkto_risk_assessments` (`backend/operational-routes.ts:771`).
- `rankConversation` (`full-operational.ts:48`) — fila prioritária com SLA configurável via `orkto_feature_configs.feature_key='priority_triage'` (`operational-routes.ts:716`).
- Rota de fila prioritária `GET /api/priority/inbox` (`operational-routes.ts:680`) já agrega conversas, deals, riscos, compras, sinais e mensagens — padrão de agregação a reutilizar.

### 1.3 Gates e infraestrutura de ação

- **Mutation Gateway:** comandos SECURITY DEFINER versionados (`supabase/migrations/2026100*`); WIA nunca envia mensagem nem chama provider — decisão WIA com gateway (`20261004010000_core_wia_decision_gateway.sql`) e preparação de ação com `status='prepared'` (`20261008000000_core_wia_prepare_gateway.sql`).
- **Aprovações:** `orkto_wia_actions` com ciclo `prepared → awaiting_approval → approved/rejected` (`20260926192349…sql:86`); rotas approve/reject em `operational-routes.ts:1983-1993`; notificação `approval_required` idempotente em `operational-routes.ts:2152`.
- **Auditoria:** `orkto_audit_log` (`20260924000000…sql`) + `orkto_wia_events`/`orkto_wia_tool_calls`/`orkto_model_usage`.
- **Fronteiras externas:** PIX responde `503 CONFIGURATION_REQUIRED`; WhatsApp outbound `CONFIGURATION_REQUIRED`; e-mail real de cadastro/recovery bloqueado por SMTP (`docs/05_ENGINEERING/MVP_CLOSURE_2026-10-14.md:66-68`).
- **Testes:** runner Node (`node --test`), suíte isolada via `npm run test:all` (`scripts/run-tests-isolated.mjs`), focados via `tsx --test tests/<arquivo>`; `lint` = `tsc --noEmit`; gates `readiness:*` em `package.json:23-32`.

## 2. Lacunas reais (o que NÃO existe)

| # | Lacuna | Evidência | Impacto no Radar |
| --- | --- | --- | --- |
| G1 | **Nenhum módulo "Radar"** — zero resultados por `radar`/`sinal comercial` em `src/`, `backend/`, `docs/` | grep 20/10/2026 | Feature nova; deve ser incremental, sem novo subsistema de infra |
| G2 | **`orkto_tasks` não tem produtor** — nenhuma leitura/escrita em `backend/` ou `src/` | grep 20/10/2026 (zero matches) | "Follow-up vencido" baseado só em tarefas seria sempre vazio; precisa de fonte real (ver §3) |
| G3 | **`orkto_customer_signals` quase sem produtores** — único writer é `explicit_opt_out` na entrada de mensagem (`backend/core-app.ts:2054`); demais leituras não encontram dados | grep 20/10/2026 | Sinais derivados precisam ser computados sob demanda a partir dos dados brutos, não lidos dessa tabela |
| G4 | **`/api/notifications` existe mas nenhuma tela consome** (`operational-routes.ts:1141`; zero matches em `src/`) | grep 20/10/2026 | Persistir notificações de Radar hoje não teria superfície; fatia 1 deve ser read-only |
| G5 | **Não há agenda/scheduler de follow-up de proposta** genérico; apenas automações específicas (recuperação de proposta `operational-routes.ts:2003`, recompra `:1598`) já com opt-out respeitado | código citado | Detecção deve ser sob demanda (pull), não agendada, na fatia 1 |
| G6 | **"Pulso" e "Central Econômica" não existem com esses nomes** — navegação real: Hoje, Inbox, Clientes, Negócios, Propostas, Catálogo, WIA, Relatórios (`src/product/navigation/navigation-config.ts:18-46`); financeiro interno = dashboard founder-only (`backend/core-app.ts` rotas `/api/internal/finance/*`) | código citado | Reuso deve usar os módulos reais; nomes do briefing não correspondem 1:1 ao código |
| G7 | **`next_action` de negócio existe só como campo de interface** no frontend, sem engine que o popule | `src/product/screens/deals-page.tsx` | Radar pode recomendar próxima ação, mas não deve fingir que o campo é operacional |

## 3. Consequências de desenho

1. **Detecção pull, determinística, sob demanda:** `GET /api/radar` calcula os três sinais por consulta, a partir de `quotes`, `orkto_conversations`+`orkto_messages`, `orkto_tasks` e `orkto_deals`. Sem cron, sem nova tabela, sem migration.
2. **Follow-up vencido precisa de duas fontes honestas:** (a) tarefas `open/in_progress` com `due_at` no passado — quando existirem; (b) hoje, na prática, a fonte real é `orkto_deals` abertos com `expected_close_on` vencido. A fatia 1 une as duas com `source` explícito na evidência (`task_due` / `deal_expected_close`), sem apresentar uma como se fosse a outra.
3. **Fatia 1 é 100% read-only:** nenhuma escrita em `orkto_notifications`, `orkto_customer_signals` ou `orkto_wia_actions`. Ação continua manual (abrir proposta/conversa/negócio). Persistência de notificação idempotente e preparação de rascunho via WIA ficam para fatias seguintes, atrás dos gates existentes.
4. **Reuso de SLA:** minutos de atendimento usam `priority_triage.slaMinutes` (padrão 60, já limitado 5–1440 em `operational-routes.ts:716`), em vez de inventar nova configuração.
5. **Respeito a opt-out:** qualquer fatia futura que sugira contato deve continuar consultando `explicit_opt_out` (padrão já aplicado em `operational-routes.ts:917,1618,2085,2114`).

## 4. Estado de validação desta análise

Leitura de código e migrations neste checkout; nenhuma consulta a banco remoto; nenhum deploy. O que a análise NÃO prova: comportamento de staging/produção, dados reais dos workspaces, ou que thresholds propostos são os corretos para o negócio (são defaults documentados, ajustáveis por configuração em fatia futura).
