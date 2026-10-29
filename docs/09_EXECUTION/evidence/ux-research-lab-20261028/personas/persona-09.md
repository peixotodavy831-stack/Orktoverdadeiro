# Persona 9 — avaliação inicial independente

Base: `c289f78`.
Perfil sintético: usuário avançado de HubSpot/Salesforce e automações, interessado em eficiência e controle.
Método: somente leitura do código da base via `git show`. Nenhuma interação real, integração, provedor, estatística ou consenso validado. As expectativas pessoais são hipóteses da persona; o percurso descrito é simulado mentalmente. Esta avaliação preserva a rodada inicial, sem revisão do produto atualizado.

1. **Compreensão:** Entendo o ORKTO como operação comercial com Negócios, Radar para priorização e WIA para consulta e preparação supervisionada. A aprovação cria tarefa interna; não significa contato externo.

2. **Confusão:** “O que vamos organizar?” sugere uma amplitude maior que a capacidade declarada de analisar registros e preparar rascunhos. Descobrir a limitação de comandos livres exige abrir “Disponibilidade e integrações” — observado por leitura.

3. **Tarefa que conseguiria:** Em percurso **simulado mentalmente**, partir de uma proposta no Radar, abrir o rascunho na WIA, enviar o pedido e revisar a aprovação. Também localizaria um negócio por cliente e mudaria sua etapa. Não executei essas tarefas.

4. **Bloqueio:** Para minha rotina hipotética, faltaria conseguir percorrer toda a fila do Radar quando houver mais de seis sinais. Também não encontrei controle de custo junto ao envio do pedido WIA.

5. **Desnecessário:** “R1”, IDs de execução e nomes de ferramentas não precisam ocupar a camada principal de decisão. A rastreabilidade é útil, mas deve continuar nos detalhes técnicos.

6. **Difícil:** Rejeitar uma sugestão sem registrar motivo dificulta ajustar a operação e entender decisões depois. O código envia `reason: ''`; a interface oferece apenas o botão.

7. **Intuitivo:** Separar Pedido, Aprovações e Histórico; explicitar “Aprovar e criar tarefa interna”; apresentar evidências do Radar; alternar Lista/Pipeline; buscar “pulsos” em Mais para encontrar cobrança. São affordances observadas no código, sem validação de usabilidade.

8. **Melhorar:** Tornar o Radar uma fila navegável; permitir motivo de rejeição; mostrar capacidade e consumo da WIA no contexto do pedido. Hipótese: isso aproxima a experiência do controle esperado em automações de CRM.

9. **Uso diário:** Eu o consideraria para triagem e acompanhamento supervisionado. Para substituir meu CRM principal, precisaria verificar eficiência em volume, configuração operacional e rastreabilidade completa — esta leitura não comprova esses resultados.

10. **Única mudança:** Permitir acessar todos os sinais do Radar mantendo prioridade e contexto.

## Achados da base inicial

- **P2 — Fila do Radar incompleta:** `src/product/screens/today-radar-panel.tsx:67,91`. Quando retornam mais de seis sinais, renderiza somente seis e informa o total, sem paginação ou expansão no componente. Recomendo acesso ao restante.
- **P2 — Rejeição sem justificativa:** `src/product/screens/wia-workspace.tsx:140,202`. Ao rejeitar, envia motivo vazio e não oferece campo. Recomendo justificativa opcional persistida e consultável.
- **P2 — Histórico restrito sem continuação:** `src/product/screens/wia-workspace.tsx:159,212`. Quando existem mais de 12 ações não pendentes carregadas, a interface mostra apenas 12, sem continuação ou busca. Recomendo navegação pelo histórico para auditoria operacional.
## Rodada 2 — revisão independente do código atual (2026-10-29)

Comparação do worktree atual com `c289f78`. Persona sintética; leitura de fontes e diff, sem teste humano, navegador, execução funcional ou validação de provedores. A rodada inicial acima permanece preservada. Nenhuma outra persona ou relatório agregado foi consultado. Não atribuo melhora global ou nota por existência de alterações.

1. **Compreensão:** Continuo entendendo WIA como assistência supervisionada. O novo caminho de Hoje para uma aprovação específica torna mais explícita a relação entre pendência e decisão — observado no código.
2. **Confusão:** O convite amplo para organizar pedidos e a capacidade limitada descrita nos detalhes continuam iguais. Pulso permanece separado do envio do pedido no diff examinado; o custo contextual ainda é uma dúvida da persona.
3. **Tarefa que conseguiria:** Em percurso mental simulado, expandiria o Radar para examinar os demais sinais retornados e abriria uma aprovação indicada em Hoje, com foco no cartão correspondente. Não confirmei funcionamento em execução.
4. **Bloqueio:** O corte visual de seis sinais foi removido por expansão. Isso não recupera registros excluídos por consulta parcial. Auditar ações anteriores às 12 exibidas ainda fica bloqueado neste componente.
5. **Desnecessário:** Continuo preferindo detalhes técnicos recolhidos. A mudança não introduz controles supérfluos evidentes para esta persona; “Mostrar menos” tem propósito claro.
6. **Difícil:** Registrar por que rejeitei e consultar decisões antigas continuam difíceis. A ligação contextual da aprovação reduz a procura pelo cartão quando ele ainda existe na fila carregada; não vi tratamento específico para alvo ausente.
7. **Intuitivo:** “Ver mais · N sinais retornados” e “Mostrar menos” descrevem o efeito. O callback de Hoje leva o ID à WIA, que inicia em Aprovações e tenta focar/rolar até o cartão — observado por leitura.
8. **Melhorar:** Priorizar histórico pesquisável/navegável e justificativa opcional de rejeição. Depois, tornar capacidade e consumo visíveis junto ao pedido. São recomendações da persona, sem alegação de consenso.
9. **Uso diário:** A expansão atende uma necessidade concreta de triagem, mas não comprova eficiência em volume. Minha disposição hipotética continua sendo uso supervisionado; substituição do CRM principal permanece não demonstrada.
10. **Única mudança:** Agora escolheria permitir navegação completa pelo histórico da WIA, para conferir decisões anteriores sem depender das últimas 12 ações.

### Reavaliação dos achados

- **Radar — resolvido no código para os sinais retornados:** `src/product/screens/today-radar-panel.tsx:62,68,92` adiciona expansão/recolhimento. A ressalva de cobertura parcial permanece na linha 65. Interação e desempenho não verificados.
- **P2 mantido — rejeição sem justificativa:** `src/product/screens/wia-workspace.tsx:146,208`; rejeitar ainda envia `reason: ''`, sem campo de motivo.
- **P2 mantido — histórico truncado:** `src/product/screens/wia-workspace.tsx:165,218`; acima de 12 ações não pendentes carregadas, as demais continuam sem acesso neste histórico.

Contexto da aprovação: mudança observada em `src/product/screens/today-v2-page.tsx`, `src/App.tsx` e `src/product/screens/wia-workspace.tsx:81-82,110-114,208`. Benefício esperado condicionado à ação estar retornada e aguardando aprovação; não é evidência de teste funcional.