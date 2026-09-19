# Arquitetura Onda 0 — Fundação e Contratos (Executável)

**Data:** 18/09/2026  
**Autor:** @merces (arquiteto de software, integrações, dados e segurança)  
**Status:** Rascunho para revisão — baseado no material orgânico já aprovado  
**Leitores:** @gueguel, @kaka, @xoto, @hermes  

---

## 1. O que esta entrega não é

- Não é o frontend da Inbox (isso é tarefa de @xoto quando a base estiver pronta).
- Não é a integração real com WhatsApp/Evolution API (estratégia: mockável primeiro, canal real depois).
- Não é deploy no Supabase com credenciais (os arquivos de migração já existem como `.sql`; a execução depende de @xoto + credenciais).
- Não é promover qualquer um dos quatro perfis locais atuais para produção (isso é decisão pendente, ver § Riscos).

Esta entrega é: **o contrato que o resto do sistema pode depender já, mesmo sem a implementação pronta.**

---

## 2. Resumo executivo da arquitetura

```
                        ┌─────────────────────────────────────────────────────┐
   WhatsApp / EA        │                   ORKTO                             │
   (externo) ─────────►│                                             │      │
                        │  Webhook Gateway ──► Normalizador ──► Fila        │
                        │       │                                    │      │
                        │       ▼                                    ▼      │
                        │  Idempotência    conversation_events  HermesAdapter │
                        │  replay-detection │                          │      │
                        │                     ▼                          │      │
                        │              Policy Engine ◄─────────────────┘      │
                        │                 │        │                           │
                        │      ┌──────────┘        └──────────┐              │
                        │      ▼                             ▼              │
                        │  approval_tasks                action_outbox        │
                        │      │                             │              │
                        │      ▼                             ▼              │
                        │   Humano                 WhatsApp / CRM / Asaas    │
                        │                                             │      │
                        │              audit_log + métricas ◄─────────┘      │
                        └─────────────────────────────────────────────────────┘
```

**Regra de ouro:** nenhuma tela, rota ou bot chama Hermes diretamente. Bots não enviam, concedem desconto nem cobram sem ferramentas governadas pelo Policy Engine. O Policy Engine é o único caminho para efeitos externos.

### Por que essa forma

- **Webhook Gateway + Normalizador + Fila:** desacopla recebimento de processamento, permite retry, garante que um replay de webhook não duplica efeito, e permite que Hermes esteja indisponível sem perder mensagens.
- **HermesAdapter versionado:** único ponto de contato entre ORKTO e o motor. Em homologação usa mock com traces; em produção troca a implementação sem mudar quem o chama.
- **Policy Engine:** todo efeito passa por ele. Sem ele, bot é só um shell que promete coisas que o sistema não controla.
- **Action Outbox:** fila de ambiente executável. Garante que uma ação aprovada vira um único envio rastreável, com retry e dead-letter.
- **Audit Log append-only + correlação:** toda decisão (bot, humano, policy, webhook) fica com `trace_id`, `workspace_id`, `conversation_id` e `agent_run_id`.

---

## 3. Componentes e contrato entre eles

### 3.1 Supabase como fonte de verdade

Use Postgres para tudo que é estado transacional e evento. Use RLS para isolamento de tenant. Use Realtime apenas para UI e presence, nunca como fonte de verdade de negócio. Use storage para anexos com expiração. Use Cron para jobs agendados (follow-up, relatórios). Use queues/PGMQ para filas duráveis quando estiver disponível; enquanto não estiver, a fila é a tabela `action_outbox` + consumidor polluente bem testado.

### 3.2 HermesAdapter (ADR 001 já documentado — aqui o contrato real)

Não repito o ADR. Resumo do contrato que o código vai obedecer:

```
classificação de intenção e contexto →  Policy Engine decide →  action_outbox
                                   ↑                                  │
HermesAdapter ◄────────────────────┘                                  │
        ▲                                                            │
        └── mock em testes, gateway real em produção                 │
```

O adapter retorna objetos plain JSON; nunca expõe interna do Hermes; nunca permite que uma tela chame o motor.

### 3.3 Policy Engine (ADR 002 já documentado — aqui as políticas operacionais)

O Policy Engine é o gate de todo efeito. Elege se a ação é:
- **Bloqueio:** não vai a lugar nenhum, vai para audit log com motivo.
- **Fila humana:** vai para `approval_tasks`.
- **Execução:** vai para `action_outbox`, depois envio externo.
- **Observação apenas:** registro interno, sem efeito externo.

Políticas obrigatórias na Onda 0: horário por workspace, consentimento por contato/canal, limite de desconto por plano, risco acima do limiar vai para fila humana (não bloqueio direto, salvo exceções comerciais), e idempotência de ação repetida.

---

## 4. Contratos de entrada e saída

Agora o que o sistema realmente aceita e emite. Todo contrato aqui é mockável — ou seja, pode ser testado sem canal real nem Hermes real.

### 4.1 Entrada: webhook do canal (WhatsApp/Evolution API agora, outros depois)

**Verbos e caminho:** `POST /api/orkto/whatsapp/webhook`  
**Sigilo:** assinatura opcional do canal; sem assinatura, o gateway pode aceitar em homologação, mas em produção exige.  
**Idempotência:** todo payload válido leva `event_id` único; replay é detectado e ignorado com registro no audit log.

Contrato do payload principal:

```json
{
  "event_id": "uuid ou string único do canal",
  "event_type": "message | status | contact | delivery",
  "workspace_id": "uuid do workspace ou slug",
  "channel": "whatsapp",
  "channel_identity": "+5521999999999",
  "payload": { ... formato nativo do canal ... },
  "received_at": "ISO-8601"
}
```

O normalizador converte isso para eventos internos estáveis:
- `incoming_message`
- `outgoing_message_status`
- `contact_update`
- `delivery_report`

O evento interno tem sempre: `event_id`, `workspace_id`, `conversation_id`, `trace_id`, `received_at`, e um sub-tipo normalizado. Isso é o que alimenta a fila, não o payload nativo.

### 4.2 Entrada: ações internas da ORKTO

Rota de ingestão simulada para homologação:
- `POST /api/orkto/whatsapp/webhook-sim` — recebe evento simulado, persiste, gera sugestão.

Rota de ingestão real (quando o canal estiver configurado):
- `POST /api/orkto/whatsapp/webhook` — mesma lógica, mas com assinatura e produção.

Nenhuma das duas permite que quem chama inicie diretamente uma cobrança, desconto ou envio. A entrada só cria evento e conversa/mensagem. O efeito executa depois pelo caminho Hermes + Policy Engine.

### 4.3 Saída: sugestões e ações humanas

A ORKTO emite para a UI e para o humano:
- `sugestão de resposta` → aprovada/edita/rejeita
- `tarefa de aprovação` → status, prazo, responsável
- `ação executada` → resultado, erro, rastreio

Contrato de sugestão pendente:
```json
{
  "suggestion_id": "uuid",
  "conversation_id": "uuid",
  "action_type": "suggest_reply",
  "proposed_content": "texto",
  "proposed_payload": { ... },
  "policy_decision": { ... },
  "trust_level_used": 1..4,
  "trace_id": "uuid",
  "expires_at": "ISO-8601"
}
```

Contrato de aprovação:
- `POST /api/orkto/approvals/:id/approve`
- `POST /api/orkto/approvals/:id/reject`
- `POST /api/orkto/approvals/:id/edit`

Cada uma gera um evento de auditoria e, se aprovada, move a ação para o outbox.

### 4.4 Saída: action_outbox

Toda ação que sai do Policy Engine entra no outbox com `idempotency_key`. O consumidor do outbox entrega e registra:
- status `pending → processing → sent → delivered/failed`
- `external_id`, `external_timestamp`, `error_message`
- retry com exponencial e limite; após limite vai para dead_letter_events

Contra-exemplo proibido: um bot envia direto para WhatsApp sem passar pelo outbox. Isso não existe na arquitetura.

---

## 5. Modelo de dados e migrações propostas

A partir do que já está escrito, a escolha é: **qual migração é a verdade?**

O material orgânico tem três migrações relacionadas:
1. `supabase/migrations/20260918_orkto_conversations_and_messages.sql`
2. `supabase/migrations/20260918_orkto_agents_and_actions.sql`
3. `supabase/migrations/20260918_orkto_swarm_foundation/001_conversations_agents_policies.sql`

O arquivo 3 é o mais completo: 18 tabelas, RLS, views, funções, triggers, includes workspaces, channel_accounts, conversations, messages, agent_definitions, agent_configs, agent_runs, agent_actions, approval_tasks, action_outbox, conversation_signals, priority_scores, mood_states, risk_scores, audit_log, feature_flags, dead_letter_events.

**Decisão executável:** adotar o conjunto do arquivo 3 como esqueleto da Onda 0 e reconciliar os dois outros dele. Não manter três migrações soltas. A migração única e estendida será nomeada `20260918_01_orkto_swarm_foundation.sql` e incorporará só o que o arquivo 3 não tem e o negócio aprovou.

O que a Onda 0 precisa na prática, já ordenado por dependência:
- `workspaces`, `channel_accounts`
- `conversations`, `messages`
- `agent_definitions`, `agent_configs`
- `agent_runs`, `agent_actions`, `approval_tasks`
- `action_outbox`, `dead_letter_events`
- `audit_log`
- `feature_flags`

Tabelas que já existiram na proposta mas estão para frente:
- `contacts / contact_identities / contact_consents` — adiar para quando o modelo de contato unificado estiver pronto, ou manter clientes atuais e derivar workspace_id por perfil no começo.
- `conversation_signals`, `priority_scores`, `mood_states`, `risk_scores` — incluídos no arquivo 3, prontos para uso quando o negócio quiser ativar scores.
- `playbooks`, `agent_feedback` — adiar para quando houver playbooks reais.

**Regras do modelo:**
- Toda tabela nova tem `workspace_id`, timestamps, índices e RLS.
- Chats existem por workspace; cliente fala por canal/identity; mensagem aponta para conversa.
- Ações de bot apontam para agent_run; agent_run aponta para conversa e mensagem disparadora.
- Approval_task aponta para agent_action; ação tem status de aprovação e execução separados.
- Audit log é append-only e escrito com SECURITY DEFINER via função dedicada.

### 5.1 O que pode executar antes das credenciais

Tudo o que é mockável:
- HermesAdapter com mock
- Policy Engine com políticas simuladas
- feature_flags
- rotas de inbox simuladas
- contratos de webhook e sugestão

Isso já está no espírito do material orgânico e é suficiente para a Onda 0 demonstrar que o contrato está fechado.

---

## 6. Políticas de autorização

A segurança aqui é em três camadas.

### 6.1 Autenticação e membresia
- Usuário entra via auth do Supabase.
- Membro de workspace é `workspace_members`; papel: owner, admin, operator, viewer.
- Tudo que o usuário faz atravessa RLS por workspace_members.

### 6.2 RLS no banco
- RLS em todas as tabelas novas.
- Política de isolamento: usuário só vê linhas do workspace onde é membro.
- Escrita de efeito externo só por funções SECURITY DEFINER controladas, não por plano do cliente.

### 6.3 Policy Engine em cima do RLS
- RLS isola tenant; Policy Engine isola ação.
- Mesmo um membro autenticado não executa desconto, cobrança ou transferência sem Policy Engine.
- Level de autonomia por bot e capacidade, não permissão global.
- Approvals: apenas humanos com permissão apropriada resolvem tarefas.
- Outbox: somente consumidor servidor escreve onde e quando envia; cliente nunca toca.

---

## 7. Observabilidade

O plano é mínimo, deliberado e correlacionável.

### 7.1 O que correlacionamos
Tudo que importa carrega: `workspace_id`, `conversation_id`, `agent_run_id`, `action_id`, `trace_id`.

### 7.2 O que medimos
- Custo: custo por execução de Hermes e por conversa, por workspace.
- Latência: webhook até persistência, persistência até sugestão, sugestão até ação, ação até outbox, outbox até entrega.
- Resultado: conversão, recuperação, taxa de aprovação de sugestão, opt-out, erro de política, dead letters.
- Saúde: retries, dead-letter, falha de job, indisponibilidade de Hermes, falha de canal.

### 7.3 Onde fica
- Audit log = trilha de decisão.
- Métricas expostas via logs estruturados e, depois, dashboard/supabase cron.
- Traces de Hermes correlacionados pelo `trace_id`.
- Latência e custo por execução no `agent_runs`.

---

## 8. Estratégia de testes

Pirâmide:
- **Unitário:** scores, políticas, máquinas de estado, limites, formatação, normalização de telefone.
- **Contrato:** HermesAdapter, Policy Engine, cada canal, Asaas/CRM, outbox.
- **Integração:** webhook → fila → agente → policy → outbox → evento de entrega, com Hermes mock.
- **E2E:** venda, recuperação, aprovação, cobrança, opt-out, rejeição humana, edição de sugestão.
- **Segurança:** RLS, isolamento entre tenants, replay de webhook, Realtime, segredos.
- **Agente:** conjunto fixo de conversas, ferramentas permitidas e casos adversariais.

Casos obrigatórios da Onda 0:
- webhook duplicado não duplica mensagem nem ação
- humano edita e rejeita sugestão
- Policy Engine bloqueia ação fora de janela ou sem consentimento
- ação fora do outbox não existe

---

## 9. Riscos e decisões pendentes

Decisões que não podem ser deixadas múm para a Fase 1:

1. **Qual migração é a verdade?** Escolha o esqueleto do arquivo 001 do swarm foundation e reconcile. Sem isso, o esquema migra em três direções diferentes.
2. **Hermes em homologação e produção:** versão, provedor, modelo, perfil, modo de execução. Nenhum dos quatro perfis locais é produção ainda. Decisão de @hermes + @gueguel.
3. **Canal oficial do WhatsApp:** Evolution API continua sendo o adaptador oficial ou muda? Se muda, o normalizador suporta o novo formato.
4. **Tenancy real:** workspaces com membros e papéis ou single-tenant por perfil no início? Isso impacta RLS e o que `workspace_id` significa na prática.
5. **Cobrança de canal:** número dedicado de cobrança por empresa ou canal central?
6. **Limites por plano:** desconto máximo, ações autônomas por dia, janela de horário — definir antes de qualquer bot em produção.
7. **Retenção e privacidade:** quanto tempo guarda mensagem, anexo, trace e audit? Revisão jurídica antes de cobrança agressiva e importação de histórico.
8. **Segredos:** WhatsApp, CRM, Asaas e keys do Hermes ficam fora do navegador e fora do código que vai pro repo.
9. **Capacidade de execução:** equipe real e ritmo definem o cronograma final, não o orgânico de 20 semanas.

---

## 10. O que a Onda 0 entrega como contrato ja losure

- **Contratos de entrada:** webhook com idempotência, normalizador de eventos internos, rota simulada.
- **Contratos de saída:** sugestão com policy_decision, tarefa de aprovação, ação no outbox, entrega com idempotency_key.
- **Contratos internos:** HermesAdapter versionado, Policy Engine com políticas mínimas, outbox com retenção e dead-letter, audit log com correlação.
- **Modelo de dados:** esqueleto de 18 tabelas pronto, RLS ativo, funções helper e views de inbox e aprovações.
- **Segurança:** isolamento por workspace, gate de políticas antes de efeito externo, segredos no servidor.
- **Observabilidade:** correlação obrigatória por workspace/conversa/run/action/trace, métricas mínimas de custo/latência/resultado.
- **Testes:** contrato mockável já, casos obrigatórios listados.

Se o time aprova esse conjunto, a Onda 0 está fechada como fundação e os contratos da primeira fatia vertical estão prontos para quem implementa — @xoto code, @hermes Hermes, @gueguel regras, @kaka e o resto quando chegar.

---

*Próximos passos concretos:* aprovar migração única, aprovar contratos de webhook e sugestão, aprovar canal do WhatsApp e modelo de tenancy, aprovar política de limites e janela, e depois executar migrações com credenciais. Isso abre a primeira fatia vertical: conversa real entra, aparece na inbox e gera sugestão segura em modo observação.
