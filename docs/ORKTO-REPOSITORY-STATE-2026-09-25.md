# ORKTO - Repository State Report

Data: 25 de setembro de 2026  
Base auditada: `main` em `1e34f37`  
Status: auditoria e plano; nenhuma mudanca de runtime nesta etapa.

## Resumo executivo

A ORKTO ja possui um SaaS funcional de propostas com autenticacao, perfis, clientes, catalogo, pagamentos, propostas publicas, analytics e uma primeira WIA server-side. O produto, porem, ainda tem tres arquiteturas sobrepostas:

1. produto historico centrado em orcamentos;
2. Onda 0 Hermes/Swarm, majoritariamente mockada;
3. WiaOS atual, pequena e mais alinhada a diretiva vigente.

O caminho recomendado e consolidar um modular monolith no stack atual React/Vite + Express + Supabase. Migrar para Next.js agora nao resolve os riscos principais e criaria um rewrite caro. Next.js deve permanecer uma decisao posterior, baseada em necessidade mensuravel.

O primeiro batch recomendado e `Foundation Guardrails`: definir contexto de tenant, fronteiras de dominio, estado comercial, contratos de tools e desativacao segura dos mocks em producao. Nenhuma integracao de IA paga e necessaria nesse batch.

## A. Repository State Report

- Frontend: React 19, Vite 6, Tailwind 4, TypeScript.
- Backend: Express monolitico em `api/server.ts`, empacotado com esbuild.
- Dados/auth: Supabase Auth + Postgres/RLS.
- Deploy: Vercel, com compatibilidade Railway mantida.
- Pagamentos: Asaas, checkout recorrente e webhook assinado.
- Email: Resend.
- Observabilidade: Sentry parcial; auditoria de negocio parcial.
- IA atual: `ModelProvider` DeepSeek/mock, endpoint autenticado `/api/wia/decide`, guardrails deterministas e modo somente sugestao.
- Canal: entrada de WhatsApp simulada/legada; nao ha adapter oficial de producao fechado.
- Branch: limpa e sincronizada com `origin/main` no inicio da auditoria.
- Qualidade observada: typecheck e build passam; testes WiaOS cobrem cinco guardrails; nao existe suite completa de integracao/E2E.

## B. Architecture Map

```text
Browser React/Vite
  |-- Supabase client: auth + algumas consultas diretas com RLS
  |-- API Express: perfil, propostas, billing, WIA, inbox
  v
Express modular monolith (alvo)
  |-- Auth boundary
  |-- Tenant context [gap]
  |-- Commercial domain [parcial]
  |-- WiaOS orchestrator [inicial]
  |-- Tool registry [gap]
  |-- Policy/approval [dois caminhos concorrentes]
  |-- Provider adapters [DeepSeek/mock inicial]
  |-- Billing adapter (Asaas)
  |-- Channel adapter [gap]
  v
Supabase/Postgres
  |-- profiles, quotes, proposals, clients/services
  |-- orkto_conversations/messages/approval_tasks/audit_log
  |-- orkto_model_usage [migration versionada; aplicacao remota pendente]
  v
External systems
  |-- Asaas
  |-- Resend
  |-- Sentry
  |-- WhatsApp Business Platform [nao integrado]
  |-- AI providers [DeepSeek preparado, desativado]
```

Fronteira alvo: browser nunca chama canal, pagamento ou modelo diretamente. Toda acao passa por autenticacao, tenant context, policy, tool tipada, idempotencia e audit log.

## C. Legacy / Technical Debt Report

### Critico

- `api/orkto-routes.ts` expoe rotas mockadas sem autenticacao para inbox, aprovacoes, bots e dashboard. Esse modulo e registrado no servidor local, mas nao segue o mesmo caminho do entrypoint Vercel, causando comportamento diferente entre ambientes.
- `src/hooks/useInbox.ts` usa o webhook inbound como se fosse uma rota outbound de envio. O webhook exige segredo de canal, nao token de usuario; portanto o contrato esta conceitualmente incorreto.
- O webhook atual deriva `userId` de `req.user` mesmo sem middleware de autenticacao e cai em `demo-user`. Falta resolver tenant por `channel_connection` verificada.
- O backend usa service role e, portanto, ignora RLS. Cada query server-side precisa de escopo explicito; algumas rotas carregam dados amplos e filtram depois em memoria.

### Alto

- `api/server.ts` concentra dominio, billing, propostas, email, webhooks, WIA e inbox em mais de 1.500 linhas.
- `src/App.tsx` concentra roteamento, sessao, onboarding, dados e layout em quase 2.000 linhas.
- Hermes/Swarm, WIA e WiaOS coexistem com nomenclaturas e contratos diferentes.
- README ainda descreve a ORKTO como plataforma de orcamentos.
- Onboarding ainda usa `Oficina` como valor padrao e exemplo automotivo.
- Planos no codigo divergem da diretiva: `free/pro/business`, com Pro R$79,00, versus Start/Pro/Business/Scale propostos.

### Medio

- Tipos da inbox usam `[key: string]: any`.
- Testes de adapter imprimem resultados, mas nao fazem assercoes completas.
- Smoke test valida mocks publicos e reforca arquitetura que deve ser aposentada.
- Documentacao antiga de Hermes/Swarm continua parecendo vigente.
- O build alerta para bundle de autenticacao acima de 900 kB.

## D. Existing Feature Inventory

### Funcionais ou proximas de funcionais

- Landing, autenticacao e onboarding.
- Perfil/branding da empresa.
- Clientes e catalogo/servicos.
- Criacao, edicao, listagem e exclusao de propostas.
- Link publico, aceite/rejeicao e telemetria de visualizacao.
- Email transacional.
- Checkout Asaas e webhook com token e deduplicacao.
- Dashboard e analytics basicos.
- WIA visual integrada ao produto.
- Endpoint WIA autenticado, provider abstraction e fallback explicito.
- Guardrails iniciais: fonte para preco, opt-out, humano e aprovacao.
- Inbox/conversas/aprovacoes com schema e partes persistidas.
- RLS por usuario nas tabelas principais e tabelas de inbox.
- Rate limiting, CORS, Helmet e validacao Zod em rotas importantes.

### Simulados ou incompletos

- WhatsApp real.
- Envio outbound de conversa.
- Hermes/Swarm e bots.
- Automacoes/follow-up.
- AI Router por tier.
- Cost Governor.
- Estado comercial unificado.
- Tenant multiusuario e RBAC.
- Calendar, tasks e opportunities como dominios completos.

## E. Missing Feature Inventory

Ordem de valor e dependencia:

1. TenantContext + membership/RBAC.
2. Contratos canonicos de evento, estado e acao.
3. Tool Registry e executor seguro.
4. Ferramentas T0: `get_sales_today`, `get_open_quotes`, `get_customer`, `get_pending_approvals`.
5. Commercial State Engine: customer, opportunity, task, follow-up e transicoes.
6. Approval Engine unico.
7. AI Router com tiers logicos, sem provider obrigatorio.
8. Cost Governor e limites por tenant/plano/acao.
9. Adapter oficial de WhatsApp e mapeamento de channel connection.
10. Jobs/retry/idempotencia duravel.
11. Automation Engine.
12. Usage/billing por plano.
13. Avaliacoes de qualidade e custo por acao bem-sucedida.

## F. Security Risks

| Risco | Severidade | Evidencia | Mitigacao |
|---|---|---|---|
| Rotas mock sem auth | Critica | `api/orkto-routes.ts` | Nao registrar em producao; exigir auth e tenant context |
| Tenant incorreto no webhook | Critica | fallback `demo-user` | Resolver tenant por conexao assinada; rejeitar se ausente |
| Service role amplia blast radius | Alta | `api/server.ts` | Repositories sempre recebem tenant/user e filtram no SQL |
| Contrato outbound usa webhook inbound | Alta | `useSendMessage` | Criar tool `send_message` separada e governada |
| Tenancy por usuario, sem organizacao | Alta | schemas `user_id` | Introduzir tenants/memberships de forma aditiva |
| Divergencia local/Vercel | Alta | registro de rotas distinto | Um unico app factory e um unico manifest de rotas |
| Dados comerciais enviados a provider | Media | WIA provider | Minimizacao, consentimento, redacao e politica de retencao |
| Auditoria de IA pode falhar silenciosamente | Media | `Promise.allSettled` | Metrica/log de falha e outbox para eventos obrigatorios |
| Demo credentials fixas | Media | `/api/auth/demo-login` | Garantir flag explicita; remover credenciais fixas do runtime |
| Rate limit global insuficiente | Media | limite unico `/api` | Limites por usuario/tenant/rota sensivel |

## G. Database / Schema Assessment

### Pontos fortes

- RLS habilitada nas tabelas versionadas de conversas, mensagens, aprovacoes, auditoria e uso de modelo.
- Politicas usam ownership, nao apenas `TO authenticated`.
- Webhooks Asaas possuem tabela de deduplicacao.
- Propostas publicas usam slug e expiracao.

### Gaps

- Tenant atual equivale, na pratica, ao usuario proprietario. Nao suporta equipe com owner/manager/operator.
- Nao ha fonte unica para estado comercial/opportunity.
- `orkto_model_usage` nao possui tenant, plan, action, workflow, cache tokens, custo estimado, sucesso ou fallback count.
- Nao ha registry persistente de tools, executions, policies e idempotency keys genericas.
- Migrations antigas e schema raiz podem divergir; falta verificacao automatica de drift.
- A migration de model usage esta versionada, mas nao foi aplicada nesta etapa.

Direcao: mudancas aditivas, backfill verificavel e dual-read temporario. Nao renomear nem apagar tabelas existentes no primeiro batch.

## H. WIA / WiaOS Gap Analysis

| Componente | Estado | Gap principal |
|---|---|---|
| WIA UI | inicial funcional | contexto limitado e sem tool results persistentes |
| ModelProvider | DeepSeek/mock | falta AI Router e OpenRouter; nao ativar antes de T0 |
| Intent Router | inexistente | classificacao deterministica inicial |
| Context Engine | resumo de quotes | fontes canonicas, minimizacao e freshness |
| Commercial State | fragmentado | maquina de estados unica |
| Tool Registry | inexistente | schemas, auth, tenant, timeout, idempotencia |
| Policy Engine | legado mock | consolidar policy server-side unica |
| Approval Engine | parcial | vincular tool call, decisao e execucao real |
| Cost Governor | tokens basicos | budget e cost/success por tenant/plan/action |
| Action Engine | parcial/legado | separar proposta, aprovacao e resultado verificado |
| Automation | inexistente | trigger/conditions/actions/jobs |
| Memory | inexistente | resumo consentido, por tenant e com fonte |
| Event Bus | inexistente | outbox transacional primeiro; sem microservico |
| Observability | parcial | correlation id ponta a ponta e dashboards |
| Evaluation | cinco testes | fixtures e score de acao segura/correta |

## I. Prioritized Migration Plan

### Batch 1 - Foundation Guardrails (recomendado)

- Criar modulos `domain`, `application` e `infrastructure` dentro do monolito.
- Introduzir `TenantContext` e repositories com escopo obrigatorio.
- Unificar app factory/registro de rotas local e Vercel.
- Colocar rotas mockadas atras de flag somente desenvolvimento.
- Definir contratos `CommercialEvent`, `CommercialState`, `ToolDefinition`, `ToolExecution` e `Approval`.
- Implementar quatro tools read-only T0.
- Generalizar onboarding e atualizar README.

Gate: nenhuma rota mock publica em producao; ferramentas T0 retornam dados do tenant sem LLM; build/lint/testes passam.

### Batch 2 - WiaOS deterministic core

- Tool Registry + executor read-only.
- Intent Router deterministico.
- Context Engine com fontes e freshness.
- Estado comercial minimo e audit trail.
- WIA usa T0 antes do provider.

### Batch 3 - Tenant and approvals

- tenants/memberships/roles aditivos.
- migracao e backfill de ownership.
- Approval Engine unico.
- tools de escrita inicialmente sempre aprovadas.

### Batch 4 - AI Router + Cost Governor

- tiers T0-T5.
- providers configuraveis.
- budgets e custo estimado.
- nenhum fallback silencioso em acao sensivel.

### Batch 5 - Channel/jobs

- ChannelAdapter WhatsApp oficial.
- webhook assinado, tenant resolution, outbox, retry e idempotencia.
- follow-up cancelavel e opt-out.

## J. Task Graph

```text
R1 Architecture boundaries
  +--> R2 Unified app factory
  +--> R3 TenantContext
         +--> R4 Scoped repositories
                +--> R5 T0 tools
                       +--> R6 Tool Registry
                              +--> R7 WIA orchestrator
                                     +--> R10 AI Router
                                     +--> R11 Cost Governor
         +--> R8 Tenant schema/memberships
                +--> R9 Approval Engine
R2 + R3 + R6 + R9 --> R12 ChannelAdapter/jobs
R7 + R9 + R11 + R12 --> R13 Automation Engine
```

## K. Dependency Graph

- Auth e tenant context precedem qualquer tool de dados.
- Tools read-only precedem AI Router.
- Tool Registry e Approval Engine precedem tools de escrita.
- Cost Governor depende de model usage enriquecido e action outcome.
- WhatsApp depende de tenant resolution, event contract e idempotencia.
- Automation depende de jobs, tools, approvals e estado comercial.
- Billing enforcement depende de catalogo de planos estabilizado.
- Next.js nao e dependencia para nenhum item acima.

## L. Tasks Codex Should Perform

| ID | Task | Classe | Risco | Motivo |
|---|---|---:|---:|---|
| C-01 | TenantContext e authorization boundary | E | critico | isolamento e base de todo o sistema |
| C-02 | Revisao/migracao RLS e memberships | E | critico | dados e autorizacao |
| C-03 | Tool permission/execution layer | E | critico | controla efeitos externos |
| C-04 | Unificacao Policy/Approval Engine | D | alto | acoes sensiveis |
| C-05 | AI Router por tiers | E | alto | custo, seguranca e lock-in |
| C-06 | Cost Governor | E | alto | unidade economica e limites |
| C-07 | Billing/plan enforcement | D | alto | receita e acesso |
| C-08 | ChannelAdapter e webhook security | E | critico | entrada externa nao confiavel |
| C-09 | Review final de cada codigo delegado | D | alto | gatekeeper de arquitetura |

## M. Tasks Delegable to Cheaper Models

| ID | Task | Classe | Tier | Contexto | Codigo | Supervisao |
|---|---|---:|---:|---:|---:|---|
| D-01 | Atualizar README/copy de posicionamento | A | T1 | small | small | diff + spellcheck |
| D-02 | Remover defaults visuais de oficina | B | T1 | small | small | testes de UI |
| D-03 | Criar fixtures comerciais neutras | B | T1 | medium | medium | review de dados |
| D-04 | Extrair componentes puros de `App.tsx` | B | T2 | medium | medium | typecheck + visual |
| D-05 | Converter smoke mocks em fixtures test-only | B | T2 | medium | medium | integration tests |
| D-06 | Documentar endpoints e estados | A | T1 | medium | small | arquitetura |
| D-07 | Testes unitarios de tools T0 ja desenhadas | B | T2 | medium | medium | cobertura e tenancy |

Nenhuma tarefa foi delegada nesta auditoria. Os packets abaixo estao prontos para uso futuro.

## N. Cost / Complexity Classification

- A trivial: copy, docs, renames locais. T1.
- B routine: componentes puros, fixtures, testes de contratos estabilizados. T1/T2.
- C complex: repositories, estado comercial, observabilidade. T2/T3 com review Codex.
- D critical: approval, billing, jobs/outbox. Codex direto.
- E architectural: tenancy, AI Router, Cost Governor, tool security, channel security. Codex direto.

Estrategia para o teto de 55%: usar T0 para consultas; delegar apenas A/B; executar D/E uma vez, em batches pequenos; nao migrar framework; nao integrar provider pago antes do core deterministico.

## O. Files Likely Affected

### Batch 1

- `api/server.ts`
- `server.ts`
- `api/inbox-routes.ts`
- `api/orkto-routes.ts`
- `api/swarm-routes.ts`
- `api/wiaos/*`
- novos `api/domain/*`, `api/application/*`, `api/infrastructure/*`
- `src/App.tsx`
- `src/hooks/useInbox.ts`
- `src/components/inbox/*`
- `README.md`
- `.env.example`
- `tests/*`

### Somente em batch aprovado posterior

- `supabase/migrations/*`
- `src/lib/plans.ts`
- billing/Asaas
- configuracao Vercel

## P. Test Strategy

### Piramide

1. Unit: schemas, state transitions, policies, cost calculations e deterministic tools.
2. Contract: repositories, provider adapters, channel adapters e billing.
3. Integration: auth + tenant isolation + RLS + API.
4. E2E: conversa -> contexto -> sugestao -> aprovacao -> tool result.
5. Production smoke: health, auth denial, mock routes disabled, no secrets no bundle.

### Casos obrigatorios

- Tenant A nao le/escreve Tenant B.
- Usuario sem papel nao aprova acao.
- Evento duplicado nao duplica mensagem, task ou envio.
- Preco/desconto/prazo sem fonte nao avanca.
- Tool falha nao gera sucesso textual.
- Opt-out cancela jobs.
- Pedido humano interrompe automacao.
- Provider indisponivel degrada sem executar efeito.
- Budget excedido bloqueia/escalona conforme policy.
- Webhook invalido nao cria estado.
- Billing nao libera plano antes de evento confirmado e deduplicado.

### Gates por PR

- `npm run lint`
- unit/contract tests
- build de producao
- diff review
- security check quando tocar auth, RLS, billing, tools ou canais
- browser QA quando tocar UI

## Task Packets economicos

### TASK_ID D-01

- Objective: alinhar README e copy documental ao posicionamento AI-native.
- Reason: documentacao ainda define ORKTO como SaaS de orcamentos.
- Complexity: A.
- Risk: baixo.
- Estimated context size: small.
- Estimated generated-code size: small.
- Recommended model tier: T1.
- Allowed files: `README.md`, docs explicitamente indicados.
- Forbidden files: `api/**`, `src/**`, migrations, envs.
- Existing interfaces: termos WIA, WiaOS e modular monolith deste relatorio.
- Required types: nenhum.
- Design conventions: portugues simples; sem prometer autonomia total.
- Security constraints: nao copiar segredos ou dados reais.
- Acceptance criteria: README descreve conversa -> estado -> acao; stack real permanece correta.
- Tests required: links e comandos revisados manualmente.
- Exact output expected: patch documental apenas.

### TASK_ID D-02

- Objective: remover defaults fixos de oficina restantes do onboarding.
- Reason: nicho fixo foi revogado.
- Complexity: B.
- Risk: medio-baixo.
- Estimated context size: small.
- Estimated generated-code size: small.
- Recommended model tier: T1.
- Allowed files: `src/App.tsx` e componentes de onboarding diretamente usados.
- Forbidden files: API, billing, auth, migrations.
- Existing interfaces: `UserProfile.profession` deve continuar aceitando valor livre.
- Required types: preservar tipos existentes.
- Design conventions: exemplo neutro e configuravel.
- Security constraints: nenhuma mudanca de sessao ou persistencia.
- Acceptance criteria: busca em runtime nao encontra default `Oficina` nem exemplo `Mecanica`.
- Tests required: typecheck e QA visual desktop/mobile.
- Exact output expected: patch minimo, sem alterar fluxo.

### TASK_ID D-03

- Objective: criar fixtures neutras para testes de WiaOS.
- Reason: substituir dependencia de mocks comerciais ad hoc.
- Complexity: B.
- Risk: baixo.
- Estimated context size: medium.
- Estimated generated-code size: medium.
- Recommended model tier: T1/T2.
- Allowed files: `tests/fixtures/**`, testes novos.
- Forbidden files: runtime, migrations, envs.
- Existing interfaces: `WiaDecision`, conversas, quotes e approvals.
- Required types: importar contratos canonicos; nao usar `any`.
- Design conventions: negocios variados, dados ficticios, sem PII real.
- Security constraints: incluir prompt injection e cross-tenant como entradas hostis.
- Acceptance criteria: fixtures cobrem preco, opt-out, humano, duplicacao, desconto e falta de fonte.
- Tests required: unit suite deterministica.
- Exact output expected: fixtures + testes, nenhuma mudanca de producao.

## Gate de decisao

Nenhum batch de implementacao deve comecar sem selecao explicita. Recomendacao: selecionar `Batch 1 - Foundation Guardrails` e executa-lo em tres PRs pequenos:

1. app factory + mock isolation;
2. TenantContext + scoped repositories;
3. contratos de tool + quatro tools T0.
