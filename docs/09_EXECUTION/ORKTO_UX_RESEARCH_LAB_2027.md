# ORKTO 2027 — UX Research Lab

Ciclo concluído em 29/10/2026, em branch isolada **feat/orkto-ux-research-lab-2027**. O ciclo cobre revisão sintética, interação real no frontend local, correções e regressão. Não é homologação comercial ou pesquisa com clientes reais.

## Resultado e escopo

Dez agentes produziram avaliações iniciais independentes e reavaliaram o código corrigido. Oito falhas de usabilidade foram reproduzidas no baseline e corrigidas. A revisão da primeira implementação encontrou um problema adicional no fechamento com Escape; o novo cenário UX09 passou após a correção. Também foram melhoradas a indicação de telefone, a explicação da WIA e a definição de Pulsos.

O runtime corrigido é `04d24c93e9b37a54b8ca0ac385fa77a991adb3fa`. O commit `4154ce8877398b30a9a009bc048410a59180d0da` corrige apenas o import ESM de um teste; `cf4cf4d080dc8bfe26482534e9b53b8f52c00232` acrescenta reexecução pontual e verificação desktop/IME; `f293848c22922b159877db01300a5d866b3f58a3` impede ambiguidade de captura antiga. **src não mudou após 04d24c9.** Nenhum commit foi enviado, implantado ou incorporado à PR2.

| Gate | Estado | Evidência e limite |
|---|---|---|
| Dez revisões independentes iniciais | PASS | [Personas](ORKTO_PERSONA_EVALUATIONS_2027.md); simulações de fonte, não pessoas reais |
| Dez reavaliações e crítica estruturada | PASS | Arquivos individuais preservam as duas rodadas e divergências; adendos identificam mudanças posteriores |
| Jornadas A–H do frontend | PASS nas execuções identificadas | Baseline 8/8; rodada posterior 7/8 por timeout local em C, depois C PASS na reexecução; [JSONs](evidence/ux-research-lab-20261028/README.md) |
| Oito defeitos UX01–UX08 reproduzidos | PASS corrigidos localmente | Antes 8 FAIL; depois 8 PASS; não é homologação remota |
| Escape entre clientes / UX09 | PASS local | A com edição não salva → Escape → B mantém dados; importação conserva fechamento protegido por leitura do código |
| Desktop/Shift+Enter/IME / UX10 | PASS local | Rascunho e envio somente à fixture503; zero mensagem externa |
| Responsividade DOM | PASS local | 56 combinações antes +56 depois; quatro telas, sete larguras, dois temas; zero overflow horizontal |
| Inspeção visual posterior | PASS no recorte inspecionado | Oito capturas desktop/tablet/mobile; botão Salvar em 390×430 desobstruído; não é auditoria integral de contraste |
| Regressão aplicação | PASS local | 410/410; inclui quatro cenários de rascunho; adaptadores isolados sem credenciais de fornecedor |
| Ferramentas e proteção de deploy | PASS local | 108/108 no runner serial existente; uma rodada paralela anterior teve timeout, preservado no relato |
| Typecheck/lint | PASS local | npm run lint; TypeScript sem erros |
| Build e smoke | PASS local | Scratch build de 04d24c9; frontend, servidor, health, SPA, barreira de autenticação e proteção de fonte |
| Secret scan | PASS local | Zero achados e bloqueadores; resultado exato em validation/secret-scan.log; não registra valores de credenciais |
| Pesquisa com usuários reais | NOT_TESTED | [Protocolo preparado](ORKTO_REAL_USER_TEST_PROTOCOL.md); nenhuma entrevista realizada |
| Android/iPhone físicos, leitor de tela e WCAG global | NOT_TESTED | Chromium emulado não substitui essas verificações |
| Google A/B, API/Edge/PostgREST remotos | NOT_TESTED nesta missão | Testes locais existentes não são evidência de tenant real |
| Meta/Asaas/Gemini e política comercial | BLOCKED_EXTERNAL para prontidão comercial | Preservados os gates anteriores; nenhuma chamada, cobrança, envio ou inferência pagos realizados |
| Publicação / merge / produção | NOT_TESTED e não executados | Apenas branch local; bloqueio Git de deploy automático desta branch |

A consolidação reúne18 casos distintos com PASS em execuções documentadas; **não é uma execução integral 18/18 sem falhas**. O teste C falhou no page.goto de 5s, antes de interação e sem erro React; passou no diagnóstico e no rerun pontual. O limite de navegação do runner foi separado dos 5s de interação e passou a 15s. A falha original permanece no JSON.

## Método e interpretação

As perguntas comuns e as vinte avaliações estão vinculadas em [personas](ORKTO_PERSONA_EVALUATIONS_2027.md). Os agentes iniciais trabalharam sobre `c289f787ab2135724373449dd0b807ddab4ce26d`, sem conclusões compartilhadas. O baseline de produto é esse commit; o harness tinha adaptações locais de fixture e não era um checkout limpo. Não apresentar o SHA como hash do adaptador inteiro daquela rodada.

As interações reutilizam o harness React e Chromium já instalados. O runner em tests/visual/research-journeys.mjs bloqueia rede fora de 127.0.0.1:4181. Cadastro e proposta são estado em memória que reproduz os callbacks do App; envio recebe503 da fixture e mantém texto; WIA devolve resposta sintética. Não houve escrita em banco, criação de usuário/workspace, autenticação Google, aprovação externa ou inferência real.

Os JSONs registram perfil, tamanho, passos/cliques/teclas concluídos, duração automatizada, erros e estado. Duração de robô sob carga/compilação não é tempo de usuário e não fundamenta promessa de produtividade. Clareza e uso diário nas personas são hipóteses, não resultados estatísticos. Não há notas SUS ou depoimentos inventados.

Calibração separada: corrigimos seletor ambíguo da lista, o callback de proposta e DTO opcional incompleto do harness. A suspeita de proposta salva sem detalhe foi descartada; o App já abria o detalhe. A primeira implementação de modal ainda ficava abaixo do dock; a segunda corrigiu a camada. O novo teste de rascunhos precisou do sufixo.js no runner ESM. Nenhum desses passos é anunciado como resultado de fornecedor.

## Alterações do produto

- Clientes: foco inicial, contenção de Tab, Escape e retorno ao acionador compartilhados com a navegação móvel; rótulos associados; telefones apropriados; formulário rolável e sobreposição acima do dock. Escape limpa edição, e importação respeita busy guard existente.
- Conversas: rascunhos separados por conversa durante a Inbox montada. Ficam somente em memória, são ocultados/limpos na troca de sessão e não persistem ao recarregar ou desmontar. Resposta assíncrona de sessão antiga não apaga rascunho novo. Desktop preserva Enter/Shift+Enter; toque usa Enter para nova linha; IME não dispara envio.
- Hoje/WIA: todas as ações retornadas ficam disponíveis para filtrar pendências antes de resumir atividade. Revisar ação leva o ID à seção de Aprovações e foca a revisão, sem executar. Limite da capacidade da WIA fica visível junto ao pedido.
- Radar R1: expansão/recolhimento dos sinais retornados. Nenhuma alteração na engine, limiares, fonte ou capacidade de escrita.
- Pulsos: definição curta de unidade de consumo; saldo continua desconhecido quando a franquia não foi aprovada. Não há novos créditos, franquias ou equivalências.

## Preservações

Backend, migrations, RLS, permissões, Cost Governor e Central Econômica não foram alterados. Os cinco planos permanecem Start R$ 79,90, Pro R$ 149,90, Business R$ 299,90, Scale R$ 599,90 e Enterprise sob consulta. Não foram criados assentos, tarifas ou direitos contratuais.

PR2 e worktrees anteriores permanecem fora desta entrega. Não houve reset, clean, stash destrutivo, sobrescrita da branch anterior ou commit coletivo de trabalhos existentes. A regra em vercel.json apenas nega deploy Git desta nova branch e seu teste correspondente foi atualizado.

## Evidências e reprodução

1. Na branch isolada, iniciar `npx vite --host 127.0.0.1 --port 4181 --strictPort` com dependências e Chromium já instalados.
2. Executar `node tests/visual/research-journeys.mjs` para a suíte atual, ou `--only=C-conversation-draft` para reexecução pontual. A suíte atual inclui novos testes UX09/UX10; não fingir que existiam no baseline.
3. Executar `npm run test:all`, `npm run lint`, `npm run readiness:build` e `npm run readiness:secret-scan`.
4. Consultar [índice](evidence/ux-research-lab-20261028/README.md), [resumo estruturado](evidence/ux-research-lab-20261028/validation-summary.json) e manifest de hashes. O script de captura visual está preservado como procedimento no diretório de evidências.

Uma captura antiga de UX04 permaneceu após screenshot silenciosamente falho; ela foi identificada por data, excluída das conclusões visuais e substituída por captura com nome único e status explícito no recheck. O arquivo antigo foi preservado, sem atribuir-lhe frescor falso. As imagens finais revisadas estão em visual-review e no recheck UX04.

## Continuidade

Este ciclo terminou como revisão e melhoria local. [Matriz de problemas](ORKTO_USABILITY_ISSUES_2027.md) mantém hipóteses e pendências de produto: onboarding guiado, responsáveis/carga, histórico e justificativa de rejeição da WIA, termos técnicos de integração e auditoria assistiva. Não se pode concluir que o produto inteiro esteja pronto para venda pública a partir dessas fixtures.

Não há autorização humana indispensável para revisar este resultado local. Pesquisa real, homologação de fornecedores, política comercial e eventual publicação são etapas separadas com seus próprios gates; não foram silenciosamente encerrados.

**READY_FOR_PRODUCTION_CANDIDATE=NO**
