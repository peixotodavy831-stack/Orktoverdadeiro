## Retomada vigente — WhatsApp/planejamento R2 de 27/10/2026

Ler [execução e matriz R2](ORKTO_WHATSAPP_PLANNING_R2_2026-10-27.md), [inventário de 40 requisitos](ORKTO_PLANNING_2027_REQUIREMENTS.md) e [manual de configuração real](ORKTO_WHATSAPP_LIVE_SETUP.md). Código WhatsApp 3f0e179; fonte final d57cff0. Regressão local399+108, replay53/53 e upgrade46/46; nenhum deploy ou E2E positivo Meta. Fonte publicada do planner bloqueada por autorização de origem; cópia local lida com hashes. Conexões/envios/tarifas Meta continuam0 no staging em27/10. READY_FOR_PRODUCTION_CANDIDATE=NO.

---
## Atualização WhatsApp — 26/10/2026

Implementação isolada em codex/orkto-whatsapp-e2e, código 4e2787037e4a6df256b3cfc7e3d9ca9d334de2c1. Ler [relatório e matriz](WHATSAPP_E2E_RESULT_2026-10-26.md) e [configuração externa](WHATSAPP_META_OWNER_SETUP_2026-10-26.md). Testes locais não substituem Meta real. Sem configuração Meta, conexão ou tabela de tarifas aprovada no staging; nenhuma publicação/envio executado. READY_FOR_PRODUCTION_CANDIDATE=NO.

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
| Central Econômica | PARTIAL | Simulador existente; projeção local ampliada para 0–1.000 empresas, taxas, tributos hipotéticos, Opex, pró-labore e capacidade da reserva | Dados de tarifa, contratos e custos operacionais reais ainda não homologados | Cálculos locais e premissas editáveis; confirmação contábil e custos observados |
| Asaas | BLOCKED_EXTERNAL | Ciclo nativo e preflight GET-only existentes | Customer sintético, notificações OFF, secrets e autorização B01–B13 | Eventos reais sandbox e reconciliação sem cobrança comercial |
| Meta | PARTIAL | Cloud API, Embedded Signup, assinatura, dedup, persistência, handoff | Associação phone/WABA e decisões de recibos merecem correção antes de ativar | Binding inequívoco, replay protegido e resultado auditável |
| Planos/landing | PARTIAL | Cinco preços aprovados, checkout OFF, proposta Enterprise; landing ganhou casos de uso e FAQ | Viewport real de celular/tablet e jornada de contato ainda precisam de confirmação local | UI responsiva, oferta honesta, interesse sem falso checkout |
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
| 5 | Auditar simulador, landing/onboarding, preparar Pilot 01 e runbooks | Médio | Médio | Central Econômica, testes e docs atuais | Médio | Entregas financeiras locais concluídas; browser QA NOT_VERIFIED |

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

### Ciclo 5 — planejamento financeiro, crescimento e localização

- Preparados seis documentos de lançamento com pesquisa datada, premissas, fontes e limitações: plano financeiro mestre, orçamento do primeiro mês, economia unitária, crescimento, internacionalização e finanças do fundador.
- Atualizada a Central Econômica existente com escala até 1.000 empresas, separação entre empresas e clientes atendidos, taxa percentual/fixa de pagamento, tributo parametrizado, custo direto, Opex, pró-labore e capacidade da reserva de 40%. A fonte continua local; campos hipotéticos não são custos realizados. A interface explicita que caixa estimado não é saldo bancário nem lançamento contábil.
- Pricing localizado por `Intl` em pt-BR, en-US e es-419; casos de uso e FAQ acrescentados à landing. Isso forma uma base de formato e copy, não uma tradução integral nem disponibilidade de checkout.
- Workbook com fórmulas entregue, com abas de resumo, premissas, projeções e fontes. Foi exportado e reimportado, recalculado com mudanças de imposto e recebimento, e a inspeção de erros retornou zero. WhatsApp permanece excluído do cálculo até confirmar preço e contrato.
- `PASS_LOCAL`: 26/26 testes focados de finanças, localização, pricing e estimativa WhatsApp; lint sem erro; `readiness:build` isolado com frontend/public URL/servidor/runtime aprovados e `distPreserved=true`. O build ainda alerta que o chunk WebGL excede 500 KB (aprox. 889 KB); desempenho em navegador não foi medido.
- SEO verificado apenas no código-fonte: title, descrição, canonical parametrizado, robots, sitemap e metadados sociais estão presentes. A inspeção visual e de interações no browser, inclusive viewport móvel e acessibilidade com teclado/leitor, ficou `NOT_VERIFIED`: a tentativa de servidor local foi bloqueada pelo Windows (WinError 10013) e a política do browser recusou `file:` e não permite contornar essa restrição. Não inferir QA de viewport a partir do build.
- Próxima ação financeira: confirmar com contador regime/CNAE/fator R, auditar faturas e contratos efetivos e obter rate card Meta; maior bloqueio técnico em paralelo continua sendo a associação ambígua cliente/telefone no ingest Meta com replay PostgreSQL 17 descartável.
- Nenhum gate remoto ou de produção recebe PASS por esta rodada. `READY_FOR_PRODUCTION_CANDIDATE=NO` e G01–G12/B01–B13 permanecem bloqueados.

## Matriz atual — validação desta branch (2026-10-22)

O snapshot de código validado é **134de66ea0d514b674a090f6f10e3e8fde7d0922**, exportado por git archive para `.tmp-launch/review-source`. Não inclui as alterações concorrentes presentes no worktree. Commits apenas documentais posteriores não constituem novo runtime homologado.

| Gate | Estado | Evidência / limite |
|---|---|---|
| Binding phone/WABA, paginação e recibos Meta | PASS_LOCAL | Testes focados e regressão; sem Graph real |
| Confirmação de inscrição/coexistência Meta | PASS_LOCAL | HTTP 200 sem success=true recusado; claim do navegador não vira habilitado |
| Pricing de cinco planos mensais | PASS_LOCAL | Catálogo, billing e QA de fixtures; checkout permanece OFF |
| Playbook preparação e aprovação obrigatória | PASS_LOCAL | Parser, Radar, tenant, gate, replay e commit com doubles; sem ativação |
| Tarefa/auditoria de Playbook em SQL real | NOT_TESTED | Reusa RPC existente; falta replay PostgreSQL descartável desta branch |
| Typecheck frontend/backend e Edge | PASS_LOCAL | clean-lint-134de66.log e clean-edge-134de66.log; Edge compile, não runtime remoto |
| Build e smoke HTTP | PASS_LOCAL | clean-build-134de66.log: frontend/publicUrl/server/runtime true, distPreserved true |
| Secret scan | PASS_LOCAL | clean-secrets-134de66.log: 630 arquivos, 0 findings/0 blockers |
| Regressão aplicação | PASS_LOCAL | clean-regression-134de66.log: 362/362; ferramentas registradas separadamente ao terminar |
| CI remoto deste código | NOT_TESTED | Sem push, workflow remoto ou deployment |
| Mobile/tablet, teclado e instalação real | NOT_TESTED | Override CUA não alterou viewport; DOM observado permaneceu 1280px |
| Google A/B real e G01–G12 | BLOCKED_EXTERNAL | Sem duas sessões legítimas controladas nesta rodada; histórico não substitui novo runtime |
| Asaas B01–B13 | BLOCKED_EXTERNAL | Customer sintético, notificações OFF, secret store e autorização de rodada ainda sem prova atual |
| Meta/Gemini reais | BLOCKED_EXTERNAL | Não habilitados/testados nesta branch; nenhuma mensagem ou inferência paga |
| Recuperação gerenciada de banco | BLOCKED_EXTERNAL | Recurso e restauração real não verificados |
| Franquias, assentos, termos e término de acesso | BLOCKED_EXTERNAL | Decisões comerciais do proprietário, sem números inventados |
| ORKTO Pilot 01 | NOT_TESTED | Protocolo preparado; sem participante ou resultado real alegado |
| Preservação checkout original | PASS_LOCAL | Verificador: 106/106, head bff22b7/status/branch inalterados, backup verificado |
| PR #2 local | PASS_LOCAL | Checkout de origem preservado em 78497da; nenhum merge/push/deploy nesta rodada |

### Ocorrências da validação do snapshot 134de66

- Primeira regressão no sandbox: 291/367, 76 falhas, principalmente fetch loopback bloqueado. Não é prova de vulnerabilidade remota.
- Repetição fora do sandbox no worktree misto: 366/367. Única falha: teste de localização concorrente es-419 esperava outra separação numérica. Ferramentas não rodaram, porque o runner interrompe após falha de aplicação. Não alterar silenciosamente trabalho concorrente.
- Build inicial no sandbox falhou ao resolver vite; execução autorizada fora do sandbox passou. O build limpo do snapshot também passou.
- Warning de bundle grande permanece. Não houve medição de desempenho em aparelho, rede real ou grande tenant; não declarar melhora de tempo sem medir.
- Naquele snapshot, simulador/Cost Governor/Central Econômica existentes foram preservados; não foi criado simulador duplicado. As alterações de finanças aqui registradas no Ciclo 5 pertencem a uma validação posterior e não estavam contidas nos quatro commits daquele snapshot.

### Produto e sequência

Agora o pricing tem comparação e condições honestas; Enterprise mantém solicitação existente. A WIA tem entrada explícita para recuperação com revisão e sem falso envio. Meta deixa de aceitar claims/sucessos não comprovados. A fatia permanece gated e não representa automação externa pronta.

Pilot 01 preparado em ORKTO_PILOT_01_PROTOCOL.md. Próxima engenharia: tratar associação ambígua de cliente no ingest Meta, validar aprovação/tarefa com SQL real e melhorar seleção contextual de proposta. Instruções de retomada em NEXT. Produção permanece intocada.

**READY_FOR_PRODUCTION_CANDIDATE=NO**

### Fechamento da validação limpa

PASS_LOCAL no snapshot 134de66: **362/362 aplicação +108/108 ferramentas**, npm run test:all exit 0. Não confundir com a execução do worktree misto que falhou no teste concorrente de localização. Manifesto sanitizado com SHA, comandos e hashes dos logs: evidence/launch-2027/validation-134de66.json.

## Continuação executiva R2 — 23/10/2026 (revisão vigente)

Referência: ORKTO_LAUNCH_R2_EXECUTION_2026-10-23.md. Este bloco atualiza as limitações históricas, sem reclassificar provas locais como remotas.

- Localização: a expectativa incorreta já estava corrigida nas alterações locais; 23 testes focados passaram no início. Consolidada sem mudar padrão pt-BR.
- Engenharia: corrigidos stress de taxas no equilíbrio, seletor dark do Tailwind e precedência mobile da landing. Reutilizado simulador, adicionado planejamento técnico Pulso sem reserva/ledger/franquia.
- PASS_LOCAL: 372 aplicação +108 ferramentas, lint, lint Edge, build/smoke, secret scan. Runtime consolidado e1e680e. Preservação do checkout antigo 106/106 e PR #2 local intacta.
- PASS_LOCAL_SQL: PostgreSQL portátil 17.11, replay 50/50 migrations, upgrade Supabase-like 43/43 posteriores ao baseline, asserts existentes e novo Playbook A↔B, aprovação/rejeição/replay/papel suspenso. pg_dump/restore de fixtures e novo assert passaram. Não há migration/grant ou banco remoto alterado.
- PASS_LOCAL visual: nove telas × mobile 390×844/tablet 768×1024, sem overflow horizontal. Contraste corrigido, thread oculta dock, erro de proposta foca campo e FAQ/comparação funcionam. Dispositivo físico/leitor e Central Econômica autenticada remota continuam NOT_TESTED.
- Finanças obrigatórias entregues: XLSX recalculado/reimportado, três cenários, sete volumes, fontes datadas e premissas. B modela R$1.414,33/mês, capital R$5.847,60 e equilíbrio 13 contas do mix ou 27 com reserva de 40%; não é cotação, franquia ou lucro garantido.
- Estratégia: calendário orgânico de 30 dias, primeiros cinco clientes, roteiros, SEO e funil manual; comparação de cinco regiões recomenda Brasil primeiro. Nenhuma campanha ou demanda comprovada.
- A ambiguidade cliente/telefone no ingest Meta permanece defeito aberto de engenharia. G01–G12/B01–B13, fornecedores reais, recuperação gerenciada, termos e política comercial permanecem bloqueados. Nenhum push, deploy, merge, compra ou efeito real.

READY_FOR_PRODUCTION_CANDIDATE=NO.


## Uso comercial R3 — 23/10/2026

Relatório vigente: ORKTO_SELLABLE_R3_2026-10-23.md. Código 748a625, correção Meta d7ba958. Corrigido o vínculo automático ambíguo de cliente/telefone em migration aditiva 51, preservando ACL, RLS e vínculos existentes. Radar abre rascunho contextual na WIA sem copiar UUID, sem enviar pedido ou mensagem automaticamente. PASS_LOCAL: 374 aplicação +108 ferramentas; lint, Edge typecheck, build/smoke, scan, replay PG17 51/51 e upgrade 44/44. Controle negativo reproduz defeito antigo; versão corrigida passa. QA fixture em 390/768/1280 px sem overflow e com rascunho correto. Nenhuma publicação ou validação remota. Condições comerciais, Google A/B, Asaas, fornecedores e recuperação gerenciada continuam gates externos. READY_FOR_PRODUCTION_CANDIDATE=NO.

## Auditoria real somente leitura R4 — 23/10/2026

Relatório vigente: ORKTO_PUBLIC_RELEASE_BLOCKERS_R4_2026-10-23.md. Supabase staging ACTIVE_HEALTHY; 50 migrations e correção local 51 ainda ausente. Funções atuais core32/Meta3/billing3. Confirmados RLS em tabelas públicas, nenhuma SECURITY DEFINER pública executável por anon ou sem search_path fixado, piloto ativo, 19 tabelas sem políticas e sem grants DML aos papéis clientes. Cinco helpers booleanos autenticados revisados sem ampliação de acesso. Customer sandbox aprovado: zero. Organização free: nenhuma prova de recuperação gerenciada e proteção de senha vazada disponível apenas em plano superior. Advisors de desempenho INFO exigem medição; não remover índices nem ampliar grants para silenciá-los. Nenhuma mutação cloud ou execução G/B nesta rodada. READY_FOR_PRODUCTION_CANDIDATE=NO.
