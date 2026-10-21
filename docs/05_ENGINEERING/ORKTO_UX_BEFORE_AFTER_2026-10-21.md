# R2 — evidências locais antes/depois

Implementação: `c5861c86da19784098767b02208a4d7662787d7f`.
Fixtures explícitas em `tests/visual/harness.tsx`; nenhuma credencial real ou conversa de cliente.
`READY_FOR_PRODUCTION_CANDIDATE=NO`.

## Comparação sem métricas inventadas

Antes: screenshot fornecido pelo proprietário no Preview `21c76du92` mostra dock opaco de ponta a ponta, botão central + e conteúdo atrás. Esse host antigo não foi alterado. A base local já continha dock de cinco destinos e melhorias móveis, mas ainda usava superfície .97 de opacidade e reserva de espaço dependente da estrutura das páginas.

Depois: barra flutuante, fundo dark rgba(28,27,25,.68), blur(24px) saturate(125%), margens 12px e reserva de 104px + safe-area no container. No navegador 390×844, dock top=766,4 e bottom=832; ao rolar até o fim, último painel bottom=644,1, acima do dock. Nenhum overflow horizontal observado nesse recorte. Não significa que conteúdo nunca passe sob o dock durante a rolagem.

| Jornada observada | Antes | Depois medido localmente |
| --- | --- | --- |
| Lista → rascunho contextual | Painel contextual apenas explicativo; não havia resultado equivalente para medir | 3 cliques: conversa → abrir contexto → preparar contexto |
| Abrir fontes | Não havia fontes deste novo resultado | +1 clique em Fontes e limites |
| Enviar ao cliente | Não executado | Não executado; campo de envio continuou vazio após editar o rascunho |
| Tempo de execução | Não medido | Não medido; nenhuma porcentagem de economia declarada |

## Verificações no navegador real (dados fictícios)

- 390×844 dark: Hoje, final da página, dock com transparência/blur computados, lista, thread, drawer, rascunho editável e fontes. Escape fechou drawer e devolveu foco ao botão de contexto; dock ausente dentro da conversa.
- 768×1024 light: lista/thread/contexto; erro controlado da assistência exibiu mensagem e permitiu nova tentativa. Sem overflow horizontal observado.
- 1440×900 dark: painel lateral, estado vazio concluído (cliente não identificado e nenhum rascunho), loading com botão desabilitado. Sem overflow horizontal observado.
- Não é teste completo de todas as telas, teclado virtual, leitor de tela, todas as densidades ou contraste WCAG. Redução de transparência e fallback sem blur foram implementados e revistos em código, não simulados no navegador nesta rodada.

## Capturas

- [Dock móvel e último conteúdo](evidence/intelligence-r2/mobile-dock-dark.png)
- [Rascunho local e fontes](evidence/intelligence-r2/mobile-context-draft.png)
- [Erro no tablet](evidence/intelligence-r2/tablet-context-error.png)
- [Vazio desktop](evidence/intelligence-r2/desktop-empty.png)
- [Loading desktop](evidence/intelligence-r2/desktop-loading.png)
- [Revisão no SHA final](evidence/intelligence-r2/desktop-final-review.png): atualizar contexto preservou o texto editado e o compositor externo permaneceu vazio.

As capturas iniciais foram feitas durante desenvolvimento imediatamente anterior ao commit. O fechamento automatizado vinculado ao SHA final está em [validation.json](evidence/intelligence-r2/validation.json). Fixtures visuais não comprovam endpoint remoto.

## Gates de entrega

| Gate | Estado | Alcance |
| --- | --- | --- |
| Isolamento do trabalho e preservação | PASS | hashes/status do checkout original, PR #2 limpa, branches próprias preservadas |
| Lint/typecheck | Ver validation.json | local, SHA identificado |
| Regressão aplicação/ferramentas | Ver validation.json | testes existentes e casos novos; sem provedores |
| Build/runtime smoke | Ver validation.json | build isolado; health/SPA/auth/source protection, sem credenciais |
| Secret scan | Ver validation.json | scanner existente, sem exportar segredos |
| Meta produção/Embedded Signup real/coexistência | BLOCKED_EXTERNAL | conta/configuração/provas oficiais e autorização da rodada |
| Correções dos gaps Meta detectados | FAIL / pendente engenharia | detalhadas no relatório WhatsApp R0 |
| Google A/B remoto, Asaas sandbox, restauração gerenciada | BLOCKED_EXTERNAL / preservados | não repetidos nem promovidos a PASS nesta rodada |
| Push/deploy/merge/produção | NOT_TESTED e não executados | branch com publicação automática bloqueada |

## Próxima fronteira

Revisar o R0 local, corrigir os gaps de binding/recibo/cliente ambíguo e homologar o canal oficial. Somente depois integrar preparo de plano WIAOS e ações aprovadas no Mutation Gateway. Radar e Playbooks continuam fronteiras distintas: não há automação externa habilitada por esta entrega.
