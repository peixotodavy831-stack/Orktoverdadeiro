# Persona 5 — gestor comercial

Avaliação inicial independente da base `c289f78`, somente por leitura. Nenhum teste de interface, autenticação ou provedor foi realizado. “Conseguiria” descreve simulação mental; impactos são hipóteses. Objetivo: acompanhar negócios/equipe e decidir prioridades.

1. **Entendi:** Hoje reúne pendências; Radar explica recomendações; Negócios acompanha oportunidades por etapa; Equipe consulta vínculos e acessos. Pulsos representa consumo disponível.

2. **Confusão:** Radar e “Precisa de você” parecem duas filas de prioridade, com critérios distintos. Como gestor, ficaria incerto sobre qual fila orientar na reunião diária. Hipótese decorrente da organização no código.

3. **Tarefa que conseguiria:** Simularia localizar uma oportunidade por cliente, abrir seu detalhe, consultar valor/previsão/histórico e mover sua etapa. Os controles correspondentes estão definidos; execução real não verificada.

4. **Bloqueio:** Não conseguiria identificar colegas pelo nome em Equipe: outras pessoas aparecem como “Pessoa” seguida de parte do identificador. Isso prejudicaria associar prioridades a pessoas conhecidas.

5. **Desnecessário:** Para minha primeira decisão do dia, a entrada ampla de comando WIA parece menos necessária que uma fila com responsável e prazo. É preferência desta persona, não evidência de inutilidade.

6. **Difícil:** Comparar a carga de trabalho da equipe. Negócios oferece filtros por etapa e presença de avaliação de risco, mas não por responsável. Responsável e próxima ação aparecem apenas condicionalmente no detalhe.

7. **Intuitivo:** Busca por cliente, etapas comerciais traduzidas, alternância Lista/Pipeline e botões “Abrir negócio”. Também considero clara a distinção entre preparar um rascunho e executar uma ação.

8. **Melhorar:** Expor responsável, próxima ação e prazo na lista, com filtros, para permitir decidir sem abrir cada oportunidade.

9. **Uso diário:** Usaria Radar como ponto inicial de acompanhamento, condicionado a dados disponíveis. Para distribuição de trabalho e cobrança de equipe, ainda dependeria de informação complementar. Hipótese de uso.

10. **Única mudança de maior impacto:** Uma fila comercial consolidada, filtrável por responsável, com motivo da prioridade, próxima ação e vencimento.

Achados observados por leitura:

- **P2 — Identificação da equipe:** `src/product/screens/management-page.tsx:53,67`. Quando o membro não é a conta atual, sua identificação visual usa UUID parcial; a busca também não considera seu nome. Dificulta encontrar o colega responsável.
- **P2 — Gestão por responsável ausente na lista:** `src/components/DealsPage.tsx:273,313`. Com várias oportunidades distribuídas, não há filtro por responsável; nome e próxima ação ficam condicionados ao detalhe. A revisão de carga exige inspeção individual.
- **P2 — Aprovações antigas podem desaparecer do resumo:** `src/product/screens/today-v2-page.tsx:105`. Após ordenar ações de quatro estados por data, apenas cinco são mantidas; se cinco ações mais recentes não aguardam aprovação, uma aprovação anterior fica fora da contagem. O texto limita o escopo à lista carregada, mas a pendência pode passar despercebida.

## Rodada 2 — revisão independente do diff atual contra c289f78

Revisão sintética e por código em 2026-10-29. Sem browser, teste funcional, autenticação ou provedor; sem consulta às outras personas. As conclusões abaixo distinguem comportamento definido no código de expectativa de uso. A avaliação inicial acima permanece histórica.

1. **Entendi:** Hoje mantém seu papel de triagem; agora uma aprovação pode levar à ação específica na WIA. O Radar permite expandir os sinais retornados além dos seis iniciais. Observado por leitura.

2. **Confusão:** Continuam Radar e “Precisa de você” com agrupamentos distintos. Hipótese: eu ainda precisaria definir qual fila usar como pauta da reunião, sobretudo quando o mesmo negócio exige acompanhamento por mais de um motivo.

3. **Tarefa que conseguiria:** Na simulação mental, abriria “Revisar ação”, chegaria a Aprovações e localizaria o cartão correspondente por foco e rolagem. Isso depende de a ação continuar retornada como pendente. Não executei aprovação.

4. **Bloqueio:** Distribuir prioridades por colega continua bloqueado nesta interface: Equipe não identifica os outros membros pelo nome e Negócios não oferece filtro por responsável. Os arquivos dessas telas não apresentam mudança no diff consultado.

5. **Desnecessário:** Para esta persona, a entrada genérica da WIA ainda é secundária à fila comercial. A revisão contextual tem utilidade mais direta porque preserva o objeto da decisão. Preferência simulada.

6. **Difícil:** Comparar carga, vencimentos e próximas ações entre pessoas. Expandir Radar disponibiliza mais sinais, mas não estabelece uma visão de capacidade ou responsabilidade.

7. **Intuitivo:** “Ver mais” oferece continuidade à lista do Radar. “Revisar ação” agora transmite o identificador até a WIA, alinhando o destino à intenção do botão. Evidência por leitura, sem validação visual.

8. **Melhorar:** Tratar explicitamente a chegada a uma ação que deixou de estar pendente: mostrar seu estado atual ou explicar sua ausência. O efeito de foco atual depende de encontrar o cartão; não vejo tratamento específico para alvo ausente.

9. **Uso diário:** Simularia usar Hoje para triagem e WIA para decisões específicas. Ainda usaria informação complementar para acompanhar distribuição de trabalho. Não atribuo frequência real nem pontuação de melhoria.

10. **Única mudança de maior impacto:** Permanece a fila comercial filtrável por responsável, com próxima ação e vencimento. A navegação contextual resolve localização de uma aprovação, mas não substitui a visão da equipe.

Reavaliação dos achados:

- **Achado anterior de aprovações: causa removida por leitura.** `src/product/screens/today-v2-page.tsx:107,123,189`: o corte global das cinco ações foi retirado antes de filtrar aprovações. A contagem passa a considerar todas as ações retornadas; Hoje ainda mostra até três cartões. Não comprova completude da API.
- **P2 — Gestão da equipe permanece:** `src/product/screens/management-page.tsx:53,67` e `src/components/DealsPage.tsx:273,313`. Com vários colegas/oportunidades, persistem identificação por UUID e ausência de filtro por responsável, dificultando distribuição de carga.
- **P3 — Destino contextual pode desaparecer:** `src/product/screens/wia-workspace.tsx:110-114`. Se a ação muda de estado entre Hoje e WIA, o cartão pendente pode não existir; não há retorno específico sobre o alvo ausente. Impacto é hipótese; cenário não executado.
