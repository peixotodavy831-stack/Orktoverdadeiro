Persona 3 — vendedor que busca rapidez. Avaliação independente, somente leitura do commit `c289f78` e das capturas `before-desktop-rail.png` e `before-mobile-menu.png`. Simulação de perspectiva profissional; nenhuma interação executada ou participação de usuário real. As capturas históricas não reproduzem integralmente a navegação do commit.

1. **Compreensão imediata — observação:** clientes, propostas e negócios correspondem às minhas tarefas. “Criar proposta” tem destaque na captura inicial; a lista de negócios apresenta cliente, valor e etapa.

2. **Confusão — observação e hipótese:** aparecem “proposta”, “orçamento” e “Orçamento Vivo”, com duas ações para gerar links no detalhe. Eu precisaria descobrir qual link entregar ao cliente.

3. **Tarefa que conseguiria concluir — simulação:** localizar cliente pela busca e consultar seu histórico; preencher uma proposta seguindo cliente → itens → condições. A conclusão depende das respostas de persistência, não verificadas.

4. **Bloqueio — observação:** ao terminar a proposta, recebo instrução para abrir o detalhe, mas a conclusão oferece retorno ao Dashboard. Eu teria de reencontrar o documento para continuar.

5. **Desnecessário — hipótese:** escolher “tom do orçamento” e aprimorar texto durante a montagem pode interromper uma cotação simples. Preferiria acessar isso quando necessário.

6. **Difícil — hipótese:** distinguir salvar, publicar link, criar nova versão e compartilhar enquanto o cliente aguarda. Os textos explicam condições, mas exigem leitura em vários pontos.

7. **Intuitivo — observação:** reaproveitar cliente cadastrado, importar item do Catálogo, visualizar totais e mover negócio por seletor. A alternativa ao arrastar beneficia minha rotina no celular.

8. **Melhorar — hipótese:** terminar cada etapa com a próxima ação comercial explícita: abrir proposta salva, revisar link e compartilhar.

9. **Uso diário — hipótese:** usaria buscas, histórico e lista de negócios. A navegação do commit coloca Clientes e Propostas dentro de “Mais”; isso acrescenta uma procura recorrente para minha função.

10. **Única mudança mais valiosa — hipótese:** botão **“Abrir proposta salva”** imediatamente após gerar, levando diretamente ao detalhe correto.

Achados priorizados, todos sustentados por leitura:

- **P2 — Continuidade interrompida.** `src/components/CreateQuote.tsx:841–855`: quando a proposta foi salva, o texto manda abrir o detalhe, mas o botão disponível chama `onCancel` e diz “Ir para o Dashboard”. Condição: finalização bem-sucedida. Consequência provável: procura e cliques adicionais.

- **P2 — Duas publicações concorrentes na compreensão.** `src/components/QuoteDetail.tsx:483` e `529–543`: “Gerar Link da Proposta” e “Criar nova versão do link” coexistem em áreas distintas. Condição: usuário quer compartilhar uma proposta. Não confirmei equivalência funcional; a ambiguidade está na apresentação.

- **P2 — Rotas frequentes escondidas.** `src/product/navigation/desktop-sidebar.tsx:58–68`, `navigation-config.ts:29–34`: Clientes e Propostas ficam no diretório aberto por “Mais”. Condição: vendedor acessa essas áreas repetidamente. Impacto temporal é hipótese, sem medição.

## Rodada 2 — revisão independente do diff atual contra c289f78

Revisão de fonte em 2026-10-29, sem interação, humanos ou consulta às outras personas. Inclui o novo `use-modal-focus.ts`. Evidência sintética compartilhada: baseline `D-proposal-save-review` passou. Correção da rodada inicial: o callback de `App.tsx` já abre `quote_detail` ao salvar; a antiga fixture não reproduzia essa ligação. Retiro o achado de continuidade interrompida como defeito do produto. O registro inicial acima permanece como histórico, não como conclusão vigente.

1. **Compreensão imediata — observação:** a estrutura comercial continua compreensível. O diff melhora entrada de dados e modais; não altera a organização de Clientes, Propostas e Negócios.

2. **Confusão — observação e hipótese:** permanecem dois controles de publicação no detalhe: “Gerar Link da Proposta” e “Criar nova versão do link”. Ainda precisaria entender qual usar antes de atender o cliente.

3. **Tarefa que conseguiria concluir — simulação:** cadastrar cliente e montar proposta, chegando ao detalhe após persistência confirmada. O callback observado sustenta essa sequência; não executei gravações.

4. **Bloqueio — correção:** não considero o retorno ao Dashboard um bloqueio do fluxo integrado de salvamento. Não identifiquei novo bloqueio impeditivo na leitura; publicação e entrega reais continuam não verificadas.

5. **Desnecessário — hipótese:** opções de tom e aprimoramento durante uma cotação simples continuam dispensáveis para minha rotina de velocidade. O diff não muda isso.

6. **Difícil — hipótese:** a escolha entre links e versões permanece mais trabalhosa que o preenchimento. Não atribuo tempo medido a essa dificuldade.

7. **Intuitivo — observação:** nome recebe foco inicial no cadastro; telefone ganha indicação de teclado e preenchimento telefônico. O novo hook prevê Tab contido, Escape e retorno do foco. Benefício de execução é hipótese nesta revisão.

8. **Melhorar — hipótese:** apresentar uma ação principal para publicar/compartilhar e explicar a versão dentro desse mesmo fluxo. Preservar validação de preço e confirmação de persistência.

9. **Uso diário — hipótese:** cadastro tende a ficar mais confortável no celular: formulário passa a ter altura limitada e rolagem. Clientes e Propostas continuam sob “Mais” no desktop, custo recorrente para mim.

10. **Única mudança mais valiosa — hipótese:** unificar a escolha do link a compartilhar. A antiga sugestão de botão pós-salvamento perde prioridade porque a navegação integrada já acontece.

Achados vigentes (linhas atuais):

- **P2 — Publicação ambígua, preservado.** `src/components/QuoteDetail.tsx:483,529–543`, sem alteração no diff. Condição: vendedor precisa escolher o link para compartilhar. Ambiguidade de apresentação; equivalência funcional não confirmada.
- **P2 — Acesso recorrente por “Mais”, preservado.** `src/product/navigation/desktop-sidebar.tsx:58–68` e `src/product/navigation/navigation-config.ts:29–34`, sem alteração no diff. Condição: uso frequente de Clientes/Propostas no desktop. Impacto em rapidez é hipótese.
- **Retirado — continuidade interrompida.** `src/App.tsx:1641–1665` seleciona a proposta persistida e abre `quote_detail`. Evidência sintética compartilhada confirma o baseline; não é uma correção nova atribuída ao diff.
