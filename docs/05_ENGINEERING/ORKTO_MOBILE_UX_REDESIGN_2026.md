# ORKTO — Mobile UX redesign 2026

## Estado e isolamento

Data: 2026-10-21. Branch `codex/orkto-mobile-ux-2027`, worktree `Orktoverdeiro-mobile-2027`.

- Fonte frontend: `0c74ff53e2afdaffe2bd0afa246ea9750f4eef4e`.
- Base: Radar `30c2c089aaef356db3760ce68c99811d8b2b572a`.
- Commits Radar `5738f52`/`2cd2844` preservados, engine não reimplementada.
- PR #2 e seu checkout permanecem em `78497da5bfd52166c6852aa14c06ebbf84fa1248`, sem alterações.
- Sem push, merge, publicação, migração, mudança de RLS, permissão, billing, Pulso, WIAOS, Mutation Gateway ou webhook.
- A branch tem um guard Git Preview específico desativado, além dos guards anteriores; não se alterou a configuração de produção.

Esta é uma entrega de frontend e validação local. Não constitui homologação autenticada remota nem conclusão integral de testes físicos/acessibilidade/performance do produto.

## Referências estudadas e decisões aplicáveis

| Referência | Princípio observado | Aplicação nesta entrega |
|---|---|---|
| [Linear Mobile](https://linear.app/changelog/2026-01-22-customize-your-navigation-in-linear-mobile) | Barra inferior prioriza acessos recorrentes | Hoje, Inbox, Negócios, WIA e Mais; não se implementou personalização de navegação |
| [Intercom Inbox](https://www.intercom.com/help/pt-BR/articles/7911926-personalize-o-inbox-para-se-adequar-a-voce-e-ao-seu-melhor-modo-de-trabalhar) | Contexto e painéis podem ser recolhidos | Preservada progressão lista/conversa/contexto; instrução privada do composer passa a disclosure nativo |
| [HubSpot Mobile](https://br.hubspot.com/products/mobile?department=sales) | Continuidade comercial e acesso rápido aos registros | Lista de negócios legível, edição progressiva de propostas, destinos operacionais nomeados |
| [NN/g navegação](https://www.nngroup.com/articles/mobile-navigation-patterns/) | Destinos frequentes visíveis; opções ocultas menos descobertas | Mais passa a estar no dock, mantendo todos os módulos e criação rápida acessíveis |
| [NN/g tabelas](https://www.nngroup.com/articles/mobile-tables/) | Reorganizar dados sem perder contexto de comparação | Negócios em lista abaixo de xl; pipeline por etapas em coluna no mobile/tablet; rótulos de valor/etapa/data preservados |
| [web.dev introdução](https://web.dev/learn/design/intro) | Layout fluido e adaptação ao conteúdo | Grid/flex/minmax e reflow; não foi criada uma versão do desktop encolhida |
| [web.dev container queries](https://web.dev/blog/how-to-use-container-queries-now) | Componentes podem responder ao espaço disponível | Avaliado; não foi necessário adicionar polyfill/dependência para os ajustes encontrados |
| [WCAG reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) | Conteúdo utilizável em 320 CSS px | Matriz inclui 320 px e checks de overflow da página/área principal |
| [WCAG target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) | Mínimo AA de 24 px ou exceções; conforto pode ser maior | Alvo de 44 px em botões mobile; checkbox/radio 24 px com label confortável. Não se declara certificação WCAG |

Identidade preservada: Inter, laranja/carvão/creme, superfícies foscas e tokens existentes. Logo preservada. A skill Impeccable orientou a adaptação; o launcher de contexto estava indisponível, então DESIGN.md e implementação foram lidos diretamente. Sem instalação de runtime de design.

## Problemas encontrados e correções

| Problema | Severidade | Resultado |
|---|---|---|
| Dock some a 768 px, sidebar só aparece a 1024 px | Alta | Dock agora acompanha o breakpoint lg da sidebar |
| Menu completo acessível só pelo topo; criação ocupa destino central | Média | Mais no dock; criação rápida preservada dentro do menu |
| Hoje só oferece um cartão decorativo para abrir WIA | Média | Campo de pedido real com handoff para revisão, sem execução automática |
| Tela WIA não explica configuração vs funcionamento | Alta | Consulta de status existente e mensagem honesta, sem prometer disponibilidade |
| Código de motivo pode preceder a resposta útil | Média | Priorizar texto de resposta retornado |
| Radar fica depois de blocos extensos | Média | Radar antecede atenção/atividade, mantendo evidências e read-only |
| Colunas de negócios largas a partir de md | Alta | Resumo/lista até xl; colunas desktop com mínimos ajustados e alinhados |
| Kanban horizontal no mobile | Média | Etapas em coluna, mantendo seleção/movimentação autorizada existente |
| Composer privado compete com mensagem ao cliente | Média | Disclosure nativo, sem desmontar rascunho ou alterar contrato de envio |
| Campos de 10–14 px e controles menores que 44 px em telas legadas | Média | Camada mobile compartilhada com texto de formulário 16 px e targets mínimos |
| Três valores financeiros espremidos no formulário | Média | Quantidade/valor/desconto em coluna antes de sm; cálculo intacto |

Diagnóstico da WIA e proposta futura de fluxo por objetivos: [relatório específico](WIA_DIAGNOSIS_AND_GOAL_FLOW_2026-10-21.md). Configuração econômica e criação por linguagem livre continuam pendentes; não foram disfarçadas como problemas apenas visuais.

## Arquivos alterados

- `src/App.tsx`: apenas estado de mensagem e callbacks de UI Hoje/WIA/Integrações.
- `src/product/navigation/mobile-navigation.tsx`: dock, Mais e acesso à criação rápida.
- `src/product/screens/today-v2-page.tsx`: composer de handoff e posição do Radar.
- `src/product/screens/wia-workspace.tsx`, `wia-runtime-status.tsx`, `wia-runtime-label.ts`: apresentação, atalhos e status de configuração.
- `src/product/design/mobile-operations.css` e import em `src/index.css`: camada aditiva. Os quatro arquivos de design que o briefing protege continuam intactos.
- `src/components/DealsPage.tsx`: lista/pipeline responsivos, sem mudar mutações.
- `src/components/inbox/ConversationView.tsx`: disclosure de instrução privada, sem alterar aceite/entrega.
- `src/components/CreateQuote.tsx`: agrupamento responsivo dos campos financeiros.
- `tests/visual/harness.tsx`: reutilizado para 15 telas reais com fixtures; desconhecidos/billing externo bloqueados no fixture.
- `tests/mobile-operations-ui.test.ts`: quatro checks de contratos de apresentação/guard. Interação real é evidenciada separadamente pelo navegador.
- `vercel.json` e `scripts/tests/deploy-staging.test.mjs`: negar auto-publicação desta branch e comparar estritamente o restante das configurações.

## Validação visual local

Nove viewports: 320×700, 360×800, 375×812, 390×844, 412×915, 430×932, 768×1024, 1024×768, 1440×900.

15 telas × 9 tamanhos × 2 temas = **270 combinações de layout com fixtures**:
Hoje, Inbox, WIA, Negócios, Equipe, Auditoria, Ajuda, Perfil, Configurações, Propostas, criar proposta, Clientes, Catálogo, Billing e Integrações.

- Nenhum overflow de página/área principal detectado nessas combinações.
- Vazio, erro, permissão, configuração e loading: 20 casos adicionais dos quatro fluxos principais em 390 px escuro. O fixture loading de alguns feeds é transitório; não é um teste de latência.
- O primeiro lote mediu a busca da Ajuda abaixo de 16 px durante atualização do CSS; verificação estável posterior confirmou 16 px nas seis larguras de telefone. Registros brutos e recheck foram mantidos, sem apagar a discrepância.
- Mais → criar novo → Escape: abre/fecha e devolve foco ao Mais.
- Hoje → texto → WIA: texto preservado, sem resultado/consulta automática.
- Inbox → conversa: dock oculto, mensagem externa editável; a 390×844 composer dentro do viewport, 16 px.
- Landscape 844×390: composer entre y329,6 e373,6, dentro da tela; sem overflow. Isto não simula um teclado virtual real.
- Proposta: identificação fictícia → itens; quantidade2 × R$100,00 com10% = R$180,00, subtotal R$200,00, desconto R$20,00; nada salvo/enviado.
- Falha de consulta WIA: erro explícito e opção de tentar novamente, sem renderizar sucesso.

[Dados brutos da matriz](evidence/mobile-ux-2026-10-21/browser-matrix.json).

### Capturas

Todas são fixtures locais; nenhuma é comprovação remota:

- [Antes Hoje mobile](evidence/mobile-ux-2026-10-21/before-today-390-dark.png)
- [Depois Hoje mobile](evidence/mobile-ux-2026-10-21/after-today-390-dark.png)
- [WIA mobile](evidence/mobile-ux-2026-10-21/wia-390-dark.png)
- [Inbox/conversa](evidence/mobile-ux-2026-10-21/inbox-thread-light.png)
- [Campos de proposta](evidence/mobile-ux-2026-10-21/proposal-items-390-light.png)
- [Hoje desktop](evidence/mobile-ux-2026-10-21/today-1440-dark.png)

## Performance e limites

Sem nova biblioteca/runtime de UI; reaproveitado React, lucide e o harness existente. Consulta de disponibilidade WIA reaproveita GET de integrações e não executa inferência. Não foram adicionados loops/polling, shaders ou imagens pesadas. O controle de reduced-motion é preservado/aplicado na camada mobile.

O build ainda reporta vendor WebGL de aproximadamente889 kB minificado, preexistente. Não há benchmark antes/depois de INP, FPS, aparelho intermediário, rede lenta ou memória; portanto **não há promessa numérica de ganho de performance**. A camada fosca continua sujeita ao custo dos efeitos existentes.

## Pendências explícitas

- Teste em dispositivos físicos, teclado virtual, Safari/VoiceOver/TalkBack e zoom real de texto: NOT_TESTED.
- Auditoria completa de contraste e WCAG: NOT_TESTED; herdar tokens não constitui prova completa.
- Landing, login, onboarding, analytics e Central Econômica: sem validação browser completa nesta rodada. Não foram alteradas autenticação ou políticas para completar testes visuais.
- Sessões Google A/B, RLS/Edge remotos, inferência Gemini real e billing sandbox: continuam sujeitos à homologação existente. Fixtures não promovem esses gates.
- Playbooks continua especificação, sem editor/automação fictícia adicionados.
- Persistência de draft entre todas as trocas de módulo e longas listas reais: cobertura incompleta. Inbox mantém a lista montada durante abertura/retorno da conversa, mas não houve benchmark de longos históricos.
- Publish deste frontend: não executado. Revisar o candidato, ambiente, callbacks e autorização antes de publicar um novo Preview; produção/PR #2 preservadas.

## Readiness

`READY_FOR_PRODUCTION_CANDIDATE=NO`

A matriz final de testes e o SHA são registrados em `evidence/mobile-ux-2026-10-21/execution-summary.json`. PASS local não substitui PASS remoto.
## Matriz final de gates desta entrega

| Gate | Estado | Evidência / ambiente |
|---|---|---|
| Typecheck | PASS | `lint-0c74ff5.txt`, exit0 local |
| Aplicação | PASS | 313/313 no runner isolado, `regression-0c74ff5.txt` |
| Ferramentas | PASS | 108/108 no mesmo runner final |
| Build frontend/backend e smoke | PASS | `build-0c74ff5.txt`, placeholders staging, dist preservado |
| Layout responsivo | PASS local | 270/270 sem overflow, `final-layout-matrix-0c74ff5.json` |
| Handoff Hoje/WIA e erro visível | PASS local | Interações de fixture, sem inferência real |
| Dados/estado/backup original | PASS | `preservation.json`,106 arquivos conferidos |
| PR #2 e branch Radar | PASS preservação local | HEADs originais e status limpo; sem merge/push |
| Inferência Gemini real | BLOCKED_EXTERNAL | Sem política Pulso/tarifa vigentes aprovadas; segredo/escopo não verificados nesta rodada |
| Objetivo livre → registros comerciais | NOT_IMPLEMENTED | Contrato atual não despacha criação de múltiplas entidades; proposta técnica separada |
| Teste mobile físico/teclado/zoom/assistive tech | NOT_TESTED | Não confundir emulação Chromium com aparelho real |
| Homologação autenticada deste novo frontend | NOT_TESTED | Novo candidato não publicado |
| Readiness integral do produto | BLOCKED_EXTERNAL | Gates históricos Google/billing/fornecedores e aprovações permanecem |

Os primeiros ensaios encontraram oito fetches localhost bloqueados pelo sandbox, um import ESM incompatível do novo teste e uma comparação antiga de guards Vercel. A execução autorizada em localhost e os ajustes dos testes resolveram os impedimentos; o runner final no SHA acima passou integralmente. Não foram alteradas assertions de autorização, custos, RLS ou sucesso de fornecedor para passar a suíte.
