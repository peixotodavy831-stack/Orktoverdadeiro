# R2 — simplificação e preservação

Fonte local: `c5861c86da19784098767b02208a4d7662787d7f`, base `8a87fbb`.
`READY_FOR_PRODUCTION_CANDIDATE=NO`. Não publicado; o Preview antigo do comentário não recebeu estas alterações.

## Preservação verificada

- Novo worktree `Orktoverdeiro-intelligence-2027`, branch solicitada `feat/orkto-intelligence-whatsapp-2027`.
- Base inclui o frontend móvel e Radar já revisados; fetch somente leitura confirmou ausência de commits novos da PR #2 em relação à base compatível.
- PR #2 permanece em `78497da5bfd52166c6852aa14c06ebbf84fa1248`, checkout limpo; sem push, merge ou alteração da PR.
- Radar permanece em seu worktree, incluindo `5738f52` e `2cd2844`; nenhuma reimplementação da engine.
- Playbooks divergiu em `1f194ceacf316876f439534714437febbc911baf`. Preservado na branch própria, sem copiar arquivos completos sobre o frontend mais recente. Sua integração é futura, não funcionalidade entregue no R2.
- Verificador do backup original confirmou 6 arquivos rastreados modificados + 100 não rastreados: 106 hashes e bytes intactos; HEAD `bff22b7aa29e909e5e560ca4dbf53ea742726d8f` e status inalterados. Nenhum reset, clean ou stash.

## Mudanças realizadas

| Problema | Correção local | Limite |
| --- | --- | --- |
| Dock quase opaco e colado às bordas | Fundo translúcido, blur 24px, borda, cantos e margens | Fallback opaco para redução de transparência/sem suporte |
| Últimos elementos atrás do dock | Reserva de espaço no container das páginas e na lista de conversas | A barra continua flutuante durante rolagem; último conteúdo pode ser trazido acima dela |
| Nome técnico Inbox | Navegação Conversas; título Central de Conversas | URLs, IDs, arquivos e contratos internos mantidos |
| WIA contextual só explicativa | Botão Preparar contexto, estados, cliente e rascunho local | Não interpreta semanticamente o texto nem executa mutações |
| Risco de publicar investigação | Guard exato da branch R2 em deploymentEnabled=false | Produção e configuração staging não alteradas |

Fluxo principal: Hoje → Conversas → conversa → contexto → próximo passo revisável.
Dock: Hoje, Conversas, Negócios, WIA, Mais. Conversa aberta esconde o dock para preservar o compositor.

## Reutilização arquitetural

- WIAOS e Mutation Gateway continuam sendo a fronteira de futuras ações aprovadas. O novo GET não chama gateway, não grava aprovação nem simula auditoria persistida.
- Radar continua determinístico e somente leitura. Não há nova engine de sinais.
- Pulso, Cost Governor, Central Econômica e cinco planos não foram alterados. Não há franquias ou direitos inventados.
- Métodos de envio, acknowledgements e delivery permanecem separados do novo rascunho local. Nada é marcado como enviado por preparar ou editar texto.

## Revisão React e segurança

Componente pequeno, import de backend somente como tipo, requisição sob ação humana, cancelamento no unmount e descarte de resposta obsoleta. Estado vinculado à conversa; atualizações preservam rascunho não vazio. Erros sem payload do fornecedor. Sem HTML arbitrário, storage de sessão, novas bibliotecas ou efeitos que enviem mensagens.

Acessibilidade local: labels dos campos, botão desabilitado durante loading, aria-live, menu contextual com Escape/restauração de foco existentes, alvos mínimos móveis e redução de transparência. Não equivale a auditoria WCAG completa.
