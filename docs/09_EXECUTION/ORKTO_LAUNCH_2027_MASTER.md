# ORKTO Launch Control 2027

**READY_FOR_PRODUCTION_CANDIDATE=NO**

## Baseline — 2026-10-22

Branch isolada `feat/orkto-launch-2027`, worktree `Orktoverdeiro-launch-2027`, base `aa6e4de6924e6516866eada9dd5a09ec081151eb`. Sem push/merge/deploy. PR #2 é homologação; esta branch é integração de engenharia. Evidências locais não encerram G01–G12 ou B01–B13.

| Origem inspecionada | HEAD local | Uso nesta integração |
|---|---|---|
| Product Excellence | aa6e4de | Base mais recente, com navegação, contador Pulso e UI |
| PR #2 Google-only | 78497da | Preservada; gates remotos permanecem independentes |
| Intelligence/Meta R2 | afb2f9e | Ancestral da base; não copiar arquivos antigos sobre os atuais |
| Mobile | 8a87fbb | Já integrado na base |
| Radar R1 | 30c2c08 | Já integrado; 5738f52/2cd2844 preservados |
| Playbooks R1 | 1f194ce | Definição/validador e prévia já integrados |
| WIA Efficiency R1 | f98709a | Engine pura já integrada, endpoint corrigido para POST |
| Checkout antigo protegido | bff22b7 | Seis modificados +100 não rastreados; não alterar |

Os SHAs acima foram verificados com `git worktree list` e branches locais. A presença local não comprova publicação remota. A PR #2 e os checkouts de origem não serão usados como área de edição.

## Inventário de módulos

| Módulo | Estado | Implementado / parcial | Bug ou prova faltante | Critério de conclusão |
|---|---|---|---|---|
| Google/PKCE/workspace | BLOCKED_EXTERNAL | Google-only, allowlist, executor e motores G01–G12 | Sessões reais A/B, reuse, expiração e operações sensíveis no candidato publicado | HTTP real isolado, sem exportar sessões |
| Clientes/negócios/propostas | PARTIAL | APIs, gateways, histórico, cálculos e vínculo cliente→negócio | E2E autenticado e avaliação de duplicidades/cancelamento | Jornada com dados sintéticos autorizados e provas por SHA |
| Conversas | PARTIAL | Lista/thread/contexto, leitura e recibos separados | Integração real de canal e comportamento de falhas | Entrada oficial persistida e contexto autorizado |
| WIA/WIAOS | PARTIAL | Ferramentas, T0, modelos, preparação/aprovação e auditoria | Criação por objetivos e homologação real continuam limitadas | Resultado confirmado, sem falso sucesso ou execução livre |
| Radar | PARTIAL | Engine R1 de leitura, evidências e tela Hoje | Provas de RLS remoto e grandes tenants reais | Mesmas regras/fontes com isolamento real |
| Playbooks | PARTIAL | Definição/validador/prévia R1 | Fatia executável precisa reutilizar gateways e ações existentes | Contexto→aprovação→tarefa→resultado auditado, sem envio automático |
| Efficiency | PARTIAL | Planejamento POST autenticado, estimativas, métricas limitadas | Tarifa/modelos/ledger reais não homologados nesta branch | Classificação sem inferência e execução com Cost Governor |
| Pulso/Cost Governor | PARTIAL | Ledger, reservas, classes, saldo e contador em Hoje | Franquias comerciais e validação de concorrência remota | Consumo versionado/autorizado, sem saldo inventado |
| Central Econômica | PARTIAL | Simulador de cenários existente e reserva planejada 40% | Auditar cobertura de operações/modelos/tarifas sem duplicar simulador | Hipóteses separadas de caixa e custo confirmado |
| Asaas | BLOCKED_EXTERNAL | Ciclo nativo e preflight GET-only existentes | Customer sintético, notificações OFF, secrets e autorização B01–B13 | Eventos reais sandbox e reconciliação sem cobrança comercial |
| Meta | PARTIAL | Cloud API, Embedded Signup, assinatura, dedup, persistência, handoff | Associação phone/WABA e decisões de recibos merecem correção antes de ativar | Binding inequívoco, replay protegido e resultado auditável |
| Planos/landing | PARTIAL | Cinco preços aprovados, checkout OFF, proposta Enterprise | Integrar pricing fornecido sem três planos fictícios ou desconto anual | UI responsiva, oferta honesta, interesse sem falso checkout |
| Mobile/PWA | PARTIAL | Navegação e layouts, manifesto e ícones existentes | Teclado/aparelho/instalação reais; nenhum Capacitor encontrado na rodada anterior | Jornadas confortáveis e instalação verificada no escopo autorizado |
| Recuperação/operação | BLOCKED_EXTERNAL | Runbooks e ferramentas existentes | Restauração real e infraestrutura contratada não revalidadas | Backup/restauração efetivos sem copiar dados pessoais |
| ORKTO Pilot 01 | NOT_TESTED | Jornada alvo definida | Falta empresa participante autorizada e uso real | Métricas observadas sem transformar fixtures em resultados |

## Prioridade de execução

Escala qualitativa: impacto/risco/reutilização/esforço. Reavaliar após cada ciclo.

| Ordem | Tarefa | Impacto | Risco mitigado | Reutilização | Esforço | Situação |
|---|---|---|---|---|---|---|
| 1 | Validar que phoneNumberId pertence ao WABA antes de concluir Embedded Signup | Alto | Alto | Adaptador e testes atuais | Baixo | Em execução |
| 2 | Não promover recibo de webhook quando o ledger rejeitar/conflictar | Alto | Alto | RPC e event boundary atuais | Médio | A investigar |
| 3 | Integrar pricing-card na oferta de cinco planos, sem ciclo anual ou recursos inventados | Alto | Médio | CommercialPlans e catálogo aprovados | Médio | Planejado |
| 4 | Implementar fatia Playbooks usando tarefa/aprovação existentes | Alto | Alto | WIAOS/Mutation Gateway | Médio/alto | Inspecionar contratos antes de escrever |
| 5 | Auditar simulador, landing/onboarding, preparar Pilot 01 e runbooks | Médio | Médio | Central Econômica, testes e docs atuais | Médio | Planejado |

## Regras de evidência e execução

- Estados de validação: PASS_LOCAL, PASS_REMOTE, FAIL, BLOCKED_EXTERNAL, NOT_TESTED. DONE significa implementação concluída no escopo descrito, não liberação comercial.
- Base anterior: 348 testes de aplicação +108 ferramentas PASS_LOCAL em `7cd5ba7`; não atribuir esse resultado a novos commits sem execução.
- Usar testes existentes, acrescentar casos de regressão do defeito e fazer commits exclusivos por ciclo.
- Billing, envios externos e inferências pagas permanecem desativados. Nenhuma nova conta, grant, tarifa ou franquia comercial.
- UI fornecida de pricing é referência de componente. Sua restrição de três tiers e desconto anual de exemplo conflitam com a missão de preservar cinco planos; serão adaptados ao catálogo real.
- Intervenções externas ficam em BLOCKED_EXTERNAL; avançar nas demais frentes sem repetir logins/credenciais já ausentes.

## Execuções desta rodada

Inventário inicial concluído. Implementações, SHAs, comandos, resultados e evidências serão acrescentados ao encerrar cada ciclo.

### Ciclo 1 — binding Meta e decisões do ledger

- Implementado: consulta do vínculo `WABA-ID/phone_numbers` antes de inscrever o app; paginação com cursor em URL Graph fixa, no máximo cinco páginas. Não segue `paging.next`, evitando destino arbitrário. Vínculo ausente, resposta malformada e loops falham fechados.
- Implementado: webhook diferencia APPLIED/DUPLICATE, STALE_IGNORED/NOT_FOUND e conflitos do ledger. EVENT_CONFLICT e PROVIDER_REFERENCE_CONFLICT não viram processed. Decisão desconhecida solicita retry; erro de finalização também.
- PASS_LOCAL: 17/17 testes focados (`node --import tsx --test tests/meta-connection.test.ts tests/meta-edge-boundary.test.ts tests/meta-webhook.test.ts`), `npm run lint:edge` (compilação, não runtime Deno remoto).
- Falha inicial de infraestrutura registrada: tsx ausente no conjunto compartilhado. Resolvido com `npm ci --ignore-scripts --no-audit --no-fund` exclusivamente neste worktree, 304 pacotes do lockfile; sem alterar dependências de outros checkouts.
- Referência primária: [coleção oficial Meta — Get Phone Numbers](https://www.postman.com/meta/whatsapp-business-platform/request/e9ady51/get-phone-numbers). A página developers.facebook.com retornou 429; não houve acesso a contas, tokens ou Graph real nesta prova.
- NOT_TESTED: Embedded Signup e recibo real em staging. Associação ambígua de clientes no ingest SQL continua pendente; não corrigida implicitamente por estas mudanças.
- Proteção explícita da nova branch em `vercel.json`: deployment Git desabilitado. Sem push/deploy.

### Ciclo 2 — planos comerciais

- Componente de pricing fornecido integrado a CommercialPlans, usado por landing e billing. Cinco planos e preços aprovados, somente mensal, comparação acessível e condições sem checkout. Enterprise mantém o formulário já existente. Nenhum desconto, franquia, assento ou direito inventado.
- PASS_LOCAL: 23/23 testes de catálogo/billing; typecheck. Navegador local de fixtures: cinco preços, comparação e abertura Enterprise; nenhuma solicitação enviada.
- Prova visual: `evidence/launch-2027/pricing-comparison-dark-1280.jpg`. Ambiente localhost:4177, não staging.
- Limitação: o override de viewport 390x844 retornou DOM de 1280px em duas abas. Desktop observado; mobile/tablet NOT_TESTED nesta rodada, não inferidos do CSS responsivo.
- Alterações concorrentes detectadas em backend/core-app.ts, backend/finance/finance-model.ts, FinanceDashboard.tsx e tests/finance-model.test.ts: preservadas, não incluídas neste commit.

### Ciclo 3 — Playbook governado de recuperação

- Implementada preparação determinística no dispatcher WIA atual, reutilizando Radar, claim/finish com fingerprint, quota e auditoria. Gate proposal_recovery ACTIVE obrigatório, desligado por padrão; nenhuma ativação externa.
- Resultado elegível aguarda aprovação no fluxo existente. Aprovação reutiliza a RPC que cria somente tarefa interna idempotente; não há novo executor, grants, migrations, inferência ou envio. Legado PREPARE_WIA_T0 não aceita esta preparação com efeitos.
- UI WIA valida UUID e coloca pedido no composer sem enviar automaticamente. A seleção por UUID é uma limitação de UX, não uma jornada contextual completa.
- PASS_LOCAL: 20/20 Playbook + WIA focados. Contratos com doubles, não SQL real. Interface de erro/rascunho observada em localhost:4177, 1280px.
- Especificação e limites: PLAYBOOK_PROPOSAL_RECOVERY_SLICE.md. SQL real/remote E2E continuam NOT_TESTED/BLOCKED_EXTERNAL.

### Ciclo 4 — confirmação Meta sem falso sucesso

- Inscrição na WABA exige resposta success=true, além de HTTP válido. Resposta vazia/false não conclui conexão.
- Coexistência enviada pelo navegador não comprova elegibilidade/habilitação; retornos enabled/eligible/ineligible do cliente ficam unknown até existir verificação do fornecedor. not_requested é somente preferência, não autorização de canal.
- PASS_LOCAL: conjunto combinado Meta + Playbook/WIA 39/39. Nenhuma chamada real Graph, token ou configuração cloud.
- Continuação prioritária: associação ambígua cliente/telefone no ingest SQL; exige migration aditiva e replay PostgreSQL antes de qualquer rollout. Não foi alterada nesta rodada.
