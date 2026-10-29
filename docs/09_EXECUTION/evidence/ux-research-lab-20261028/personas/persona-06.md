# Persona 6 — avaliação inicial independente

Base: `c289f78`. Persona: usuário principalmente Android/mobile, que quer concluir tarefas sem computador. Apenas leitura do código; nenhuma interação, envio, autenticação ou teste em Android físico. As conclusões de uso abaixo são simulação da persona; impactos no teclado e no toque são hipóteses. Captura ou viewport não equivale a dispositivo Android físico. Esta avaliação preserva o julgamento inicial, sem revisar o produto atualizado ou conclusões de outras personas.

1. **Compreensão:** reconheço “Hoje”, “Conversas” e “Negócios” como destinos de trabalho. A proposta dividida em três passos oferece direção.
2. **Confusão:** “WIA” exige conhecimento prévio. Depois de salvar a proposta, preciso descobrir onde abrir seu detalhe para gerar o link.
3. **Tarefa que conseguiria:** simulo localizar um cliente e iniciar um negócio vinculado; o detalhe oferece “Criar negócio para este cliente”.
4. **Bloqueio:** cadastrar cliente com teclado aberto parece vulnerável a corte do formulário; não confirmo esse comportamento em dispositivo.
5. **Desnecessário:** para um atendimento rápido, “Mood Ring”, índices e explicações comerciais antes do histórico acrescentam leitura.
6. **Difícil:** revisar vários itens de proposta envolve rolagem dentro de uma área limitada, além da rolagem da página; a prévia fica depois do formulário no mobile.
7. **Intuitivo:** voltar às conversas tem botão próprio; o envio mantém rascunho no erro e distingue solicitação aceita de entrega confirmada.
8. **Melhorar:** priorizar conclusão no celular: formulário rolável, telefone com teclado adequado e acesso direto ao detalhe após salvar.
9. **Uso diário:** a estrutura sugere utilidade para consultar clientes e responder conversas. Não há evidência nesta avaliação para afirmar que consigo concluir o ciclo comercial inteiro no Android.
10. **Única mudança:** tornar “Novo Cliente” uma superfície móvel rolável, com salvar sempre alcançável quando o teclado estiver aberto.

## Achados na base c289f78

- **P1 — hipótese de bloqueio ao cadastrar:** `src/components/ClientsPage.tsx:827` usa `overflow-hidden` no diálogo; `src/product/design/mobile-operations.css:141` limita diálogos a `100dvh`, sem adicionar rolagem. **Condição:** altura disponível menor que o formulário, especialmente com teclado. Campos finais e “Salvar Registro” podem ficar inacessíveis.
- **P2 — conclusão da proposta exige redescoberta:** `src/components/CreateQuote.tsx:845–855` orienta abrir o detalhe para gerar link, mas a ação apresentada retorna ao Dashboard. **Condição:** proposta recém-salva e usuário querendo compartilhar pelo celular. Observação por leitura; dificuldade prevista.
- **P2 — teclado inadequado para telefone:** `src/components/ClientsPage.tsx:853–860` define WhatsApp como `type="text"`, sem `inputMode`. **Condição:** preenchimento no Android. A falta de indicação numérica é observada; teclado efetivo não foi testado.

## Rodada 2 — revisão independente do diff contra c289f78

Leitura sintética do estado atual em 2026-10-29. Nenhum browser, dispositivo físico, provedor ou interação real. Respostas em primeira pessoa são simulação da persona; referências abaixo descrevem código observado, e efeitos no Android permanecem hipóteses. Não foram consultadas outras personas.

1. **Compreensão:** continuo entendendo os destinos principais. Telefone agora declara o tipo de dado esperado; o cadastro parece mais preparado para uso no celular.
2. **Confusão:** após salvar proposta, ainda sou orientado a abrir seu detalhe, mas recebo “Ir para o Dashboard”. Não identifico ali uma continuidade direta até compartilhar.
3. **Tarefa que conseguiria:** simulo cadastrar cliente sem computador com maior confiança: o formulário ganhou rolagem e limite de altura. Isso não comprova persistência nem alcance com teclado Android aberto.
4. **Bloqueio:** o risco inicial do cadastro foi tratado no código: regra específica limita a `100dvh - 32px` e permite rolagem; camada 130 supera a 90 do dock nos níveis declarados. O teclado pode redimensionar a área visual de modo distinto entre ambientes; não considero o caso físico encerrado.
5. **Desnecessário:** para consulta rápida, índices e “Mood Ring” ainda competem com o histórico. Minha preferência seria revelar esse contexto sob demanda.
6. **Difícil:** a proposta mantém rolagem interna de itens e prévia abaixo do formulário. Também permanece a descoberta de onde gerar o link após salvar.
7. **Intuitivo:** em ponteiro coarse, Enter deixa de solicitar envio; o botão assume essa ação. Telefones de cadastro, edição e proposta declaram `tel`, `inputMode` e autocomplete.
8. **Melhorar:** igualar a proteção de camada do detalhe do cliente à do cadastro e oferecer acesso direto ao detalhe da proposta salva.
9. **Uso diário:** a edição e composição parecem menos trabalhosas. Rascunhos por conversa ficam na Inbox montada; não infiro recuperação após recarregar, sair do módulo ou trocar sessão.
10. **Única mudança:** oferecer “Abrir proposta salva” imediatamente após concluir os três passos, para avançar ao link no celular.

### Reavaliação e achados remanescentes

- **Tratados por leitura, sem validação Android:** risco inicial de corte em Novo Cliente (`src/product/design/mobile-operations.css:160`; `src/components/ClientsPage.tsx:828,836`) e indicação de teclado telefônico (`ClientsPage.tsx:866,1059`; `CreateQuote.tsx:482–483`).
- **P2 — continuidade após salvar permanece:** `src/components/CreateQuote.tsx:845–855`. Condição: querer compartilhar proposta recém-salva. Instrução exige detalhe; ação visível retorna ao Dashboard. Dificuldade inferida, não interação medida.
- **P2 — hipótese de sobreposição no histórico:** `src/components/ClientsPage.tsx:924` mantém o detalhe em `z-50`; `src/product/navigation/mobile-navigation.tsx:50` declara dock em 90. Condição: detalhe aberto no mobile com dock visível. Pode haver sobreposição de controles inferiores, dependendo dos contextos de empilhamento; requer verificação visual. Cadastro e importação já declaram 130.
