# ORKTO Product Excellence — 2026-10-22

**READY_FOR_PRODUCTION_CANDIDATE=NO**

Entrega de engenharia e UX local, em `feat/orkto-product-excellence-2027`. Nenhum push, merge, Preview remoto ou mudança em produção foi realizado. As provas desta rodada não encerram os gates de homologação da PR #2.

## 1. Identidade e preservação

| Referência | SHA / situação verificada |
|---|---|
| Base atual da interface / Intelligence R2 | `afb2f9e324fc2c1ca7381ee7d6c06029856acb89` |
| PR #2, Google-only pilot | `78497da5bfd52166c6852aa14c06ebbf84fa1248`; OPEN e draft na consulta inicial |
| Radar R1 | `30c2c089aaef356db3760ce68c99811d8b2b572a`; preservado |
| Playbooks R1 de origem | `1f194ceacf316876f439534714437febbc911baf`; preservado |
| WIA Efficiency R1 de origem | `f98709a646b8e272456757466ce6e10a878b4439`; preservado |
| Integração backend desta entrega | `7022e4a` |
| Fonte final testada nesta entrega | **`7cd5ba7af72da5dba0f81494890b7754f2bc8f06`** |

Worktree: `Orktoverdeiro-excellence-2027`, criado separadamente. A base foi escolhida pelo histórico real: a UI atual já continha os trabalhos mobile, Radar, equipe, contexto de conversas e componentes WIA/Pulso; Playbooks e Efficiency estavam numa linha divergente. Foram copiados somente seus módulos puros e testes, com integração pontual de rotas. Nenhum arquivo inteiro de rotas ou UI foi substituído por versões antigas.

O checkout original permanece em `bff22b7aa29e909e5e560ca4dbf53ea742726d8f`. O verificador de preservação confirmou os **106 arquivos** do manifesto: seis modificados rastreados e cem não rastreados, mesmos hashes, branch, HEAD e status, com backup verificado. Não houve reset, clean, stash ou commit coletivo dessas alterações. O worktree Intelligence continuou sem diferenças rastreadas. A nova branch recebeu proteção explícita `deploymentEnabled=false`, coberta pela regressão das ferramentas.

## 2. Auditoria e prioridades

Leitura de `DESIGN.md`, tokens, camada oficial de marca, arquitetura, estado corrente, checklist de release e contratos. Arquitetura antiga e resultados históricos foram tratados como contexto, sem promovê-los a provas do candidato atual.

| Prioridade | Problema comprovado | Tratamento |
|---|---|---|
| Alta | Planejamento Efficiency aceitava `message` no query string | POST JSON autenticado, validação estrita, GET legado 405, nenhuma mensagem refletida no erro |
| Alta | Trocar GET por POST fazia o helper de workspace aplicar bloqueio de plano para escrita | Operação interna explicitamente `read_only`, apenas nessa rota; membership e proibição de provisionamento mantidas |
| Alta | Playbooks/Efficiency disponíveis apenas em branches separadas | Reutilização seletiva das engines; nenhuma nova camada de execução |
| Média | Oito destinos operacionais/inteligência mais suporte visíveis na sidebar | Quatro destinos principais e grupo “Mais”; todos os módulos preservados |
| Média | WIA abria cinco consultas de ações mesmo sem abrir histórico | Aprovações inicialmente; histórico completo sob demanda; cancelamento de respostas obsoletas |
| Média | Histórico do cliente não iniciava um negócio com vínculo preenchido | Ação contextual abre o formulário e valida o cliente na coleção disponível; não salva automaticamente |
| Média | Em 320 px, rótulos do dock encostavam | Rótulos de 11 px nesse limite, mantendo áreas de toque e cinco destinos |
| Média | Prévia da proposta mostrava telefone fictício e número fixo `1040` | Campos ausentes explícitos, número definido ao salvar e identificação “Não salva” |
| Média | Erro de proposta sem anúncio acessível nem foco no campo obrigatório | `role=alert`, cor semântica e foco no nome/telefone faltante |
| Média | Ledger de eficiência limitado a 5.000 linhas sem explicitar alcance dos totais | `records_returned`, `limit`, `possibly_truncated` e `totals_scope=returned_rows_only` |
| Baixa | Descrição de clientes falava em carros para todos os segmentos e prometia inteligência futura | Texto operacional geral e orientação para histórico → oportunidade |

### Superfícies auditadas

- **Hoje:** Radar R1, evidências e abertura de contexto já existentes preservados; nenhuma ação automática adicionada.
- **Conversas:** lista → conversa → contexto, drawer mobile e compositor existente preservados. Contexto foi aberto em fixture; o dock não aparece no thread. Nenhum envio foi acionado.
- **Negócios:** lista mobile, filtros e ações independentes de drag-and-drop preservados. Playbook de recuperação ficou disponível como prévia no próprio contexto comercial.
- **Propostas:** três etapas, seleção de cliente, cálculos e persistência existentes preservados. Melhorias de honestidade da prévia e recuperação de erro.
- **Clientes:** acesso a histórico e formulário de negócio com cliente selecionado; sem novo cadastro implícito.
- **WIA:** Pedido/Aprovações/Histórico preservados; planejamento passa a ser acessível e explicitamente distinto de execução.
- **Plano/Pulso:** componente existente e limites não configurados preservados, sem equivalência inventada Pulso/token.
- **Catálogo, relatórios, equipe, auditoria, ajuda, perfil, integrações e configurações:** acesso mantido em Mais; telas disponíveis no harness auditadas para largura. Relatórios pesados continuam carregados sob demanda na aplicação.

## 3. Referências públicas e REA

Pesquisa em documentação oficial, sem acessar contas de terceiros, copiar interfaces/código proprietário ou contornar proteções. Não foi realizada uma comparação autenticada desses produtos.

| Fonte pública consultada | Padrão documentado | Aplicação na ORKTO |
|---|---|---|
| [Linear: Triage](https://linear.app/docs/triage) | Revisar e priorizar entradas antes de incorporá-las ao fluxo | Atenção e aprovações separadas do histórico; navegação principal reduzida |
| [Salesforce: Next Best Action](https://help.salesforce.com/s/articleView?id=platform.nba_implementation_checklist.htm&language=en_US&type=5) | Recomendações dependem de contexto e regras; aceitação é etapa própria | Radar somente leitura, prévia do processo e aprovação continuam distintos |
| [HubSpot: ações nos registros](https://knowledge.hubspot.com/records/use-cards-on-records#quick-actions) | Abrir editores de ações junto ao registro atual | Histórico do cliente → formulário de negócio com vínculo preenchido |
| [Intercom: Copilot](https://www.intercom.com/help/en/articles/8587194-how-to-use-copilot) | Assistência contextual e conferência de fontes antes de responder | Contexto e revisão humana preservados; prévia WIA não executa nem envia |
| [Notion: sidebar](https://www.notion.com/help/navigate-with-the-sidebar) | Organização com grupos recolhíveis e acesso consistente | Grupo Mais na sidebar, destinos completos no menu mobile |

As decisões de reduzir carga cognitiva são inferências de design apoiadas nessas referências e na inspeção da ORKTO; não são resultados de pesquisa com usuários nem prova de aumento de conversão.

Na revisão de acesso também foram consultados o [changelog Supabase](https://supabase.com/changelog), a documentação de [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) e de [proteção da Data API](https://supabase.com/docs/guides/api/securing-your-api). Grants e políticas de linha são camadas distintas; não foi concedido acesso para contornar falhas de configuração. As URLs Markdown não puderam ser lidas pelo leitor web, e foram usadas as páginas HTML oficiais. Esta consulta documental não é uma inspeção das políticas implantadas.

**REA:** CLI `rea-agents@6.7.0` disponível; MCP REA não estava exposto e `doctor` apontou registro Codex ausente/config drift. Não foi alterada a configuração global nem instalado motor nativo. A capacidade CLI real foi utilizada no próprio `server.cjs` gerado pelo build isolado.

[Disponibilidade](evidence/product-excellence/rea-availability.json) e [análise estática resumida](evidence/product-excellence/rea-summary.json): um JavaScript analisado, zero falhas de parsing, 44 arquivos inventariados fora da seleção. Evidence `ev_842afba8f2aeb13c19c7960c0ff6baefe2c3117d2151ec2f2494e66a91f8daf5`. Os 262 findings são fatos da análise, **não 262 vulnerabilidades**. Não houve execução do bundle pelo REA nem auditoria dinâmica de aplicações concorrentes.

## 4. Implementação e fronteiras

### Planejamento WIA

`POST /api/wia-efficiency/plan` aceita apenas `{ "message": "..." }` em JSON, de 1 a 2.000 caracteres após trim. Campos extras e tipos incompatíveis são rejeitados. O GET antigo retorna 405 com `Allow: POST`. Respostas da rota usam `Cache-Control: private, no-store`.

Autenticação e membership continuam obrigatórias, com resolução pelo cliente vinculado ao JWT quando disponível. A rota não cria workspace, owner ou usuário. O marcador interno de leitura não foi aplicado a rotas de mutação. A prévia não invoca modelos, não consulta registros comerciais, não reserva Pulsos e não libera execução. Sua classificação não substitui os checks reais de tarifa, política, saldo e autorização.

Falhas do cálculo não registram a mensagem nem payloads do fornecedor. O limite semântico é 2.000 caracteres; o parser JSON global de 10 MB permaneceu inalterado. A nova UI envia o corpo por POST; rejeitar URLs antigas não apaga históricos/logs eventualmente produzidos por clientes antigos.

Métricas permanecem agregadas por workspace e mês, com calendário validado. As grants do banco não foram ampliadas: se o backend não puder ler tarifas/ledger, a operação falha explicitamente. Totais representam apenas linhas retornadas; um limite inferior imposto pelo PostgREST remoto ainda exige avaliação de cobertura no ambiente real.

### Playbooks

`GET /api/playbooks/proposal_recovery/preview` reutiliza a definição e validador existentes. A UI explica uso, sequência e ponto de aprovação. Mesmo se a configuração indicar ACTIVE, a resposta continua `read_only=true` e `execution_available=false`. Nenhum botão inicia processo, cria tarefa, agenda contato ou envia mensagem. Radar e WIAOS continuam sendo os módulos existentes; execução futura passa pelas fronteiras governadas e homologação própria.

### Interface e jornadas

Inter, carvão, laranja oficial, temas e superfícies existentes foram preservados. Não foram adicionados fornecedores, dependências de UI, blur em grandes áreas ou controles flutuantes. A camada mobile recebeu ajustes específicos para rótulos, tipografia de inputs e prévias. Pedidos e mudanças de seção cancelam requisições de leitura antigas; prévias antigas não reaparecem após edição.

O atalho cliente → negócio usa apenas um cliente presente na coleção atual. Abre um rascunho local e mantém o Mutation Gateway existente para o salvamento. Não cria vínculo no servidor ao clicar.

### Arquivos de implementação

- Backend: `backend/orkto-core/playbooks.ts`, `backend/wiaos/efficiency.ts`, integração em `backend/operational-routes.ts`.
- UI: `src/product/screens/operation-previews.tsx`, `wia-workspace.tsx`, adapter `wia-actions.ts`, navegação desktop/configuração e `mobile-operations.css`.
- Jornadas: `src/App.tsx`, `ClientsPage.tsx`, `DealsPage.tsx`, `CreateQuote.tsx`.
- Testes: `playbooks.test.ts`, `wia-efficiency.test.ts`, `wia-actions-loading.test.ts`, fixtures do harness existente.
- Proteção de publicação: `vercel.json` e teste existente de configuração.

## 5. Provas visuais e funcionais

Todas as capturas são do **harness local com dados fictícios**, em `127.0.0.1:4176`; a marca de fixture permanece visível. A base visual anterior foi capturada em `4175`. Nenhuma captura comprova dados ou autenticação de staging.

| Comparação | Evidência |
|---|---|
| WIA anterior, base `afb2f9e`, 390 px | [Antes](evidence/product-excellence/wia-before-390.jpg) |
| WIA com planejamento somente leitura, 390 px | [Depois](evidence/product-excellence/wia-after-390.jpg) |
| Navegação e WIA, desktop escuro | [Desktop](evidence/product-excellence/wia-after-desktop.jpg) |
| Processo comercial no contexto de Negócios | [Desktop claro](evidence/product-excellence/deals-processes-desktop-light.jpg) |
| Cliente já selecionado no formulário de negócio | [Jornada B](evidence/product-excellence/client-to-deal-390.jpg) |
| Revisão de proposta, menor largura | [Jornada C](evidence/product-excellence/proposal-review-320.jpg) |
| Contexto de conversa sem dock sobre o compositor | [Jornada F](evidence/product-excellence/conversation-context-390.jpg) |

[Rodada 1](evidence/product-excellence/responsive-round1.json) e [rodada 2](evidence/product-excellence/responsive-round2.json): **98 verificações de geometria**, sete telas × sete larguras × dois temas. Larguras 320, 360, 390, 430, 768, 1024 e 1440; sem overflow horizontal da raiz nos casos registrados. Rodada 1 foi a auditoria e rodada 2 a confirmação após ajustes; o dock de 320 px recebeu também medição pontual final de 11 px/áreas de aproximadamente 56 px. Isso não é uma certificação de acessibilidade ou teste em aparelhos físicos.

[Oito módulos secundários em 320 px](evidence/product-excellence/secondary-screens-320.json), [estados das prévias](evidence/product-excellence/preview-states.json) e [jornadas funcionais](evidence/product-excellence/functional-fixtures.json).

- Proposta: erro por nome ausente anunciado e foco devolvido ao campo. Quantidade 2 × R$ 1.000,00, desconto de 10% → total R$ 1.800,00. Salvamento negado pela fixture mostra erro e não avança para sucesso.
- Cliente: histórico → abrir negócio → cliente preenchido, sem salvar. Antes era necessário sair do contexto, abrir formulário e selecionar o cliente novamente.
- WIA: prévia pronta, falha, sessão negada e loading conferidos. Alterar o pedido cancela o loading antigo. O botão de execução da WIA não foi acionado nessa prova de planejamento.
- Playbooks: loading, erro com recuperação e sequência somente leitura conferidos. Fechar a seção cancela a leitura pendente.
- Conversa: contexto móvel abre em dialog; o dock fica ausente no thread. Nenhuma mensagem foi enviada.

## 6. Performance medida

[Comparação de builds e hashes](evidence/product-excellence/build-comparison.json). Builds isolados da base e da entrega, com verificação de preservação de `dist`, sem credenciais externas.

| Medida | Base | Entrega |
|---|---:|---:|
| JavaScript de entrada, bytes | 168.251 | 167.840 |
| JavaScript de entrada gzip, bytes | 43.374 | 43.396 |
| CSS gzip, bytes | 32.098 | 32.317 |
| Chunk WIA gzip, bytes | 5.776 | 5.931 |
| Novo chunk compartilhado de prévias gzip | — | 2.082 |
| WebGL gzip | 239.493 | 239.493 |
| Consultas de ações na abertura da WIA | 5 no fluxo anterior | 1 no fluxo atual |

Não há alegação de redução do bundle gzip de entrada: ele ficou 22 bytes maior. WebGL não aparece nos modulepreloads iniciais em nenhum dos builds e foi preservado sem reescrita. Os módulos de prévia ficam no chunk de páginas operacionais, sem puxar engines Node para o navegador.

A redução das consultas iniciais foi validada por testes do adapter contando chamadas fetch de fixture. O Histórico continua fazendo as cinco consultas existentes em paralelo, mantendo os limites e sem ocultar estados. Isso não mede RTT real nem latência de banco. Tempos pontuais de build não foram transformados em promessa de ganho. CPU, memória, p95/p99, teclado físico/virtual de aparelhos e desempenho de grandes tenants remotos não foram medidos.

## 7. Validação e matriz de gates

[Resumo verificável](evidence/product-excellence/validation.json), vinculado à fonte `7cd5ba7`. Testes executados no worktree correspondente; hashes dos logs locais registrados. O commit documental posterior não altera a fonte validada.

| Gate | Resultado | Ambiente / evidência |
|---|---|---|
| Integração seletiva e preservação | PASS | Local; manifesto 106 arquivos e heads das branches |
| Planejamento/Playbooks/carregamento | PASS | 28 testes focados; autenticação, tenant, métodos, payload, ausência de writes, 5.005 linhas sintéticas limitadas a 5.000 |
| Regressão da aplicação | PASS | 348/348 testes locais |
| Ferramentas de readiness | PASS | 108/108 testes locais |
| Typecheck/lint | PASS | `npm run lint` = `tsc --noEmit` |
| Build e smoke | PASS | Frontend, render de URL pública, servidor, health, SPA, fronteira auth e proteção de fontes; `distPreserved=true` |
| Secret scan | PASS | Scanner existente; nenhuma credencial registrada nas evidências |
| UI responsiva e jornadas descritas | PASS | Somente fixtures locais, com alcance explicitado acima |
| REA selecionado | PASS | Análise estática do próprio server, sem veredito de segurança remoto |
| Google real / expiração / revogação no novo SHA | NOT_TESTED | Não reexecutado no redesign; sem novas sessões ou extração de tokens |
| RLS, API e Edge A/B reais no novo SHA | BLOCKED_EXTERNAL | Gates da PR #2 continuam exigindo executor/ambiente homologados; esta branch não foi publicada |
| Asaas sandbox B01–B13 | BLOCKED_EXTERNAL | Pré-requisitos e autorização controlada herdados; billing não ativado |
| Gemini/Meta reais e entregas externas | NOT_TESTED | Rollouts históricos preservados; nenhuma inferência paga ou mensagem executada |
| Recovery gerenciada / restauração real | BLOCKED_EXTERNAL | Evidência operacional externa ainda necessária; nenhuma operação irreversível |
| CI remota / migrations remotas | NOT_TESTED | Sem push/SQL novo; não se atribui PASS remoto à regressão local |
| Instalação PWA / teclado em aparelho real | NOT_TESTED | Manifest existente preservado, sem segundo projeto mobile |

A primeira integração revelou três falhas locais: o POST somente leitura estava passando pela checagem de plano de escrita. O defeito foi corrigido no helper com escopo explícito e os testes foram repetidos. As execuções finais acima têm zero falhas; não houve supressão de testes para obter esse resultado.

## 8. Economia e segurança preservadas

Exatamente cinco planos: **Start R$ 79,90; Pro R$ 149,90; Business R$ 299,90; Scale R$ 599,90; Enterprise sob consulta**. O catálogo, Cost Governor, Mutation Gateway, ledger, grants/RLS, autenticação Google/PKCE, configuração Asaas e controles Meta não foram modificados. Nenhuma franquia, tarifa, assento ou direito contratual foi criado. Reserva corporativa de 40% continua sendo meta financeira sujeita a caixa real, sem automação ou reserva criada nesta entrega.

Planejamento é estimativa, sem consumo confirmado. A UI não apresenta referências internas de milli-Pulso como franquia comercial nem promete equivalência com tokens. Configuração ausente não se transforma em saldo zero ou permissão implícita.

## 9. Limitações e próximas prioridades

1. Revisar os commits locais antes de integrar a qualquer branch de homologação. Confirmar destino, ambiente Google-only e autorização antes de publicar um Preview isolado; a publicação está bloqueada por padrão.
2. Após publicação autorizada, validar os endpoints novos com autenticação real, grants do ambiente e A/B; repetir somente os gates afetados no SHA publicado.
3. Fechar separadamente as pendências reais de billing sandbox, recuperação e integrações. Esta missão não fornece nova aprovação para cobranças, envios ou inferência paga.
4. Jornada A (Google → workspace → onboarding → primeira ação) não foi homologada novamente. Não confundir o harness com usuário real.
5. WIA não ganhou criação autônoma de cliente/negócio por linguagem livre. A preparação de pedidos, consulta, aprovação e execução continuam nos contratos existentes; prévia não é permissão para agir.
6. O Playbooks R1 integrado é somente prévia. Execução governada futura exige binding de contexto, idempotência, aprovação, auditoria e testes reais próprios.
7. PWA: há manifesto referenciado no HTML e ícones SVG; não foi encontrado projeto Capacitor nem registro de service worker no código auditado. Não foram adicionados cache de dados autenticados, promessa de uso offline ou outro projeto mobile.
8. As suspeitas de integração Meta já registradas no relatório R0 permanecem fora desta alteração; uma revisão futura deve verificar associação inequívoca de cliente, vínculo phone/WABA e decisões de recibos. A regressão local não encerra essa auditoria.

**Conclusão:** incremento implementado e validado localmente, com navegação mais simples, jornadas com contexto, prévias governadas e menos consultas iniciais da WIA. Sem liberação comercial ou de produção. **READY_FOR_PRODUCTION_CANDIDATE=NO.**

## 10. Ajuste posterior — contador de Pulsos em Hoje

Após a entrega inicial, o proprietário apontou a ausência do contador na tela Hoje. Ele existia apenas em Plano & cobrança. O novo `pulso-counter.tsx` apresenta saldo disponível e consumo no topo de Hoje, consultando o endpoint existente `GET /api/billing/current` e reutilizando `quotaSnapshot`. Não cria créditos, franquias, cobranças ou equivalência com tokens. Há estados distintos para loading, falha, franquia ausente e saldo inconsistente, com cancelamento de leitura pendente e atualização pelo botão Atualizar Hoje.

O atalho “Ver consumo” abre Plano & cobrança. Conferência local no navegador: estado não configurado visível, cenário sintético de 258 disponíveis / 742 utilizados ou reservados / 1.000 de franquia e navegação até consumo aprovados. Esses números são exclusivamente da fixture `quota-demo`; não são franquia comercial aprovada. [Captura padrão, sem saldo inventado](evidence/pulso-counter/today-counter.jpg). Typecheck `npm run lint` PASS; as suítes e builds acima pertencem à fonte `7cd5ba7` e não foram reexecutados para este ajuste. Sem validação remota ou deploy. A aba atualizada usa a porta local 4176; 4175 permanece na versão anterior. **READY_FOR_PRODUCTION_CANDIDATE=NO.**
