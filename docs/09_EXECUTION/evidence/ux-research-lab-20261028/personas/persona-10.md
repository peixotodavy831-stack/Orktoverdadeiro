# Persona 10 — avaliação inicial independente

Especialista técnico em acessibilidade. Base examinada: `c289f78`, via `git show`. Somente leitura de código e hipóteses sintéticas; sem navegador, teste com leitor de tela, simulação de deficiência ou certificação/conclusão global de conformidade WCAG. Esta é a avaliação inicial, anterior à rodada 2; o produto atualizado não foi revisado.

1. **Compreensão — observado por leitura:** Clientes concentra cadastro, contatos e histórico; CreateQuote organiza identificação, itens e condições comerciais.

2. **Confusão — hipótese:** a diferença entre cadastrar, consultar histórico e editar pode exigir exploração. Os campos de edição perdem a associação explícita entre rótulo e controle presente no cadastro.

3. **Tarefa que conseguiria — simulado:** localizar um cliente pela busca e iniciar um orçamento parecem viáveis. A busca tem nome acessível; os campos principais do orçamento possuem rótulos associados.

4. **Bloqueio — observado por leitura/impacto hipotético:** os diálogos de Clientes declaram modalidade, mas não implementam foco inicial, contenção de Tab, Escape e devolução ao acionador. Isso pode deixar a navegação por teclado atrás da sobreposição.

5. **Desnecessário — hipótese:** fontes de 8–10px em metadados e explicações impõem esforço de leitura sem benefício claro para decisões comerciais.

6. **Difícil — hipótese:** sugestões de clientes aparecem após foco ou digitação, mas o campo não comunica expansão nem relação com a lista. Os resultados são botões alcançáveis por Tab; não encontrei interação de combobox por setas.

7. **Intuitivo — observado por leitura:** a navegação móvel tem texto junto aos ícones, indicação de página atual e botão “Mais” com estado expandido. Seus painéis possuem tratamento explícito de teclado e foco.

8. **Melhorar — observado por leitura:** padronizar os diálogos usando o comportamento já existente na navegação móvel; associar os rótulos da edição; substituir cinzas fixos por tokens semânticos.

9. **Uso diário — hipótese:** a estrutura favorece repetição, mas inconsistências de foco entre módulos e textos pequenos podem aumentar o esforço. Há estilos globais de foco visível e controles móveis ampliados, pontos positivos que exigem confirmação visual.

10. **Única mudança:** aplicar um componente de diálogo acessível compartilhado em Clientes, com ciclo completo de foco e teclado.

## Achados prioritários da avaliação inicial

- **P1 — Clientes: modalidade sem gerenciamento de foco.** `src/components/ClientsPage.tsx:821–831` e `914–934`, na base `c289f78`. Condição: abrir cadastro ou detalhes pelo teclado. Não há implementação local de foco inicial, contenção, Escape ou restauração; comportamento efetivo permanece sem teste.
- **P1 — Edição sem associação dos rótulos.** `src/components/ClientsPage.tsx:1034–1074`, na base `c289f78`. Condição: editar cadastro. Os `label` não envolvem os controles nem têm `htmlFor`; inputs e textarea correspondentes não fornecem nome alternativo explícito.
- **P2 — Legibilidade inconsistente.** `src/components/CreateQuote.tsx:432` e `src/components/ClientsPage.tsx:840`, na base `c289f78`. Condição: tema claro. Rótulos usam `text-zinc-400` sobre superfícies claras, apesar de tokens semânticos existentes. Risco de contraste insuficiente; contraste renderizado não medido.

## Rodada 2 — revisão independente do diff (2026-10-29)

Comparação do código atual com `c289f78`. Avaliação sintética por leitura de fonte, sem navegador, teste com leitor de tela, simulação de deficiência ou certificação WCAG. Nenhuma outra persona ou relatório agregado foi consultado. Os fluxos abaixo são inferências do código, não execuções reais.

1. **Compreensão — observado por leitura:** o fluxo comercial permanece reconhecível; Clientes e navegação móvel passam a compartilhar `useModalFocus`.
2. **Confusão — hipótese:** Escape agora existe nos diálogos de Clientes, porém não executa os mesmos encerramentos que os botões; o estado reaberto pode divergir.
3. **Tarefa que conseguiria — simulado:** cadastrar cliente por teclado parece mais viável: o nome recebe foco inicial, Tab é contido e os rótulos permanecem associados. Telefone ganhou tipo e sugestões de teclado adequados.
4. **Bloqueio — inferência da fonte:** editar A, pressionar Escape e abrir B mantém `isEditing` e os campos de A. Salvar pode aplicar esses campos a B; requer correção antes de considerar o fluxo seguro.
5. **Desnecessário — hipótese:** persistem metadados minúsculos e terminologia auxiliar; não houve mudança ampla na densidade informacional.
6. **Difícil — observado/hipótese:** o autocomplete de CreateQuote continua sem comunicar expansão/relação com sugestões; a alteração nesse arquivo limita-se ao telefone. Sua descoberta por tecnologia assistiva segue sem validação.
7. **Intuitivo — observado por leitura:** os painéis móveis preservam Escape, foco inicial e retorno ao acionador; o hook agora filtra controles sem área renderizada e trata Tab que parte de fora do painel.
8. **Melhorar — observado por leitura:** unificar os callbacks de fechamento com as rotinas existentes, incluindo limpeza de edição e proteção durante importação.
9. **Uso diário — hipótese:** os rótulos de edição agora têm `htmlFor`/`id`, resolvendo o defeito estrutural inicial. O cadastro recebe `max-height: calc(100dvh - 32px)` e rolagem; teclado virtual, zoom, toque e contraste renderizado ainda exigem teste. A regra depende de ancestral `.orkto-glass-shell`.
10. **Única mudança:** garantir que Escape e botão Fechar executem a mesma rotina de encerramento, preservando as proteções operacionais.

### Pendências prioritárias

- **P1 — Escape preserva edição de outro cliente.** `src/components/ClientsPage.tsx:168`, `722`, `1043–1084`, `1106–1116`. Condição inferida: editar A → Escape → abrir histórico de B → salvar. O callback não limpa `isEditing`; os campos antigos são combinados com `selectedClientHistory` de B. Não reproduzido em navegador.
- **P2 — Escape ignora encerramento protegido da importação.** `src/components/ClientsPage.tsx:169`, `262–264`. Durante `importLoading`, Escape ainda fecha, embora `closeImport` impeça isso; também deixa prévia/erros/estados anteriores para a reabertura. A chamada em andamento não é cancelada pelo fechamento. Impacto operacional depende da etapa; não foi realizado envio.
- **P2 — Contraste continua parcialmente incerto.** Rótulos de cadastro/edição passaram a `orkto-product-muted`, mas `src/components/CreateQuote.tsx:432` mantém `text-zinc-400`; não há medição renderizada que permita encerrar a pendência. Fontes pequenas permanecem.

### Adendo de acompanhamento — revisão de fonte (2026-10-29)

As duas regressões de Escape identificadas na rodada 2 estão corrigidas por inspeção de fonte: `ClientsPage.tsx:168` agora limpa `isEditing` ao fechar os detalhes, e `:169` delega à rotina `closeImport`, que preserva a proteção durante `importLoading` e limpa o estado ao encerrar (`:262–264`). Isso resolve as causas apontadas no código; não constitui execução dos cenários.

Os overlays de novo cliente (`:828`) e importação (`:621`) agora declaram `z-[130]`, superior ao `z-[90]` do dock móvel (`mobile-navigation.tsx:50`). O overlay de histórico/detalhes ainda declara `z-50` (`ClientsPage.tsx:926`); sua ordem visual efetiva e eventual exposição do dock exigem confirmação, considerando os contextos de empilhamento.

**Regressão de navegador UX09: pendente com o agente principal.** Nenhum teste de navegador ou leitor de tela foi executado por esta persona; sem certificação WCAG. As demais incertezas registradas permanecem.

### Correção final do estado de fonte — `04d24c9`

Inspecionado diretamente com `git show 04d24c9:src/components/ClientsPage.tsx`: o overlay de histórico/detalhes também usa agora `z-[130]`. A observação anterior sobre `z-50` descreve apenas o estado intermediário e está superada por esta correção. Os callbacks de Escape que limpam a edição e delegam ao fechamento protegido da importação continuam presentes. A camada declarada dos três diálogos de Clientes fica acima do dock `z-[90]`; comportamento visual e regressão UX09 no navegador continuam pendentes com o agente principal. Esta confirmação é exclusivamente de fonte, sem alegação de resultado de teste.
