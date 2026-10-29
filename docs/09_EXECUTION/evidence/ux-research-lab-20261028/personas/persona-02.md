**Persona2 — AVALIAÇÃO SIMULADA.** Dono de empresa experiente com CRM, planilha e WhatsApp Business, buscando economizar tempo. Base `c289f78`; somente leitura, sem teste no navegador. O arquivo de Negócios encontrado foi `src/components/DealsPage.tsx`.

1. **Compreensão — HIPÓTESE:** Entenderia que Hoje organiza pendências, Negócios acompanha oportunidades e WIA prepara consultas e ações para revisão.

2. **Confusão — HIPÓTESE:** “Central de comando” sugere poder operacional amplo. A limitação de não cadastrar negócios ou clientes por comando livre aparece dentro de um detalhe fechado.

3. **Tarefa que conseguiria concluir — HIPÓTESE:** Cadastrar uma oportunidade com cliente, valor e previsão; localizar um negócio e mudar sua etapa, dependendo de resposta válida da API.

4. **Bloqueio — OBSERVADO POR LEITURA:** Não encontrei edição da próxima ação comercial. Ela aparece quando retornada, mas o formulário e o detalhe não oferecem campo para atualizá-la.

5. **Desnecessário — HIPÓTESE:** Referências ao servidor, contrato e API ocupam atenção que eu preferiria dedicar a cliente, prazo e ação necessária. São úteis para diagnóstico, mas poderiam ficar nos detalhes.

6. **Difícil — HIPÓTESE:** Saber qual pendência merece contato primeiro. Risco, proposta pendente e conversa não lida coexistem, mas a leitura não revela uma ordenação única por urgência comercial.

7. **Intuitivo — HIPÓTESE:** Busca por negócio ou cliente, etapas familiares, lista como padrão e alternativa de pipeline. “Aprovar e criar tarefa interna” esclarece o efeito da aprovação.

8. **Melhorar — HIPÓTESE:** Abrir diretamente a aprovação selecionada em Hoje e mostrar próxima ação com prazo na lista de Negócios.

9. **Uso diário — HIPÓTESE:** Usaria Hoje como ponto de partida se a fila fosse confiável e acionável. Sem registrar o próximo compromisso, continuaria recorrendo à planilha ou agenda.

10. **Única mudança mais impactante — HIPÓTESE:** Permitir registrar e concluir **próxima ação com data** no próprio negócio, exibindo vencidas em Hoje.

**Achados priorizados — OBSERVADOS POR LEITURA:**

- **P1 — Pendências podem desaparecer do resumo.** `src/product/screens/today-v2-page.tsx:105,121,184`: as ações são limitadas às cinco mais recentes antes de filtrar aprovações. Se cinco ações recentes concluídas antecederem uma aprovação antiga, ela não entra no contador; outras filas vazias podem produzir “Nada parado por aqui”.
- **P2 — Revisão exige reencontrar a ação.** `src/product/screens/today-v2-page.tsx:189` chama `onOpenWia()` sem identificação; `src/product/screens/wia-workspace.tsx:79` inicia em `request`. Ao selecionar “Revisar ação”, o destino não preserva o contexto da pendência.
- **P2 — Próximo passo sem manutenção na tela.** `src/components/DealsPage.tsx:313,332`: próxima ação é somente exibida; as alterações disponíveis se concentram em etapa e risco. Quando preciso agendar um retorno, não há controle correspondente nessa tela.

## Rodada 2 — revisão independente do diff atual contra c289f78

**AVALIAÇÃO SIMULADA**, mesma persona experiente. **OBSERVADO POR LEITURA:** revisão sintética do código e diff em 2026-10-29, sem navegador, teste de uso real ou validação de API. As conclusões abaixo não atribuem opinião a uma pessoa real.

1. **Compreensão — HIPÓTESE:** Continuaria entendendo Hoje como minha entrada para pendências e Negócios como acompanhamento comercial. A revisão contextual aproxima a promessa de “Revisar ação” do destino esperado.

2. **Confusão — HIPÓTESE:** “Central de comando” ainda sugere autonomia maior que a disponível. A explicação de que comandos livres não cadastram negócios continua recolhida em “Disponibilidade e integrações”.

3. **Tarefa que conseguiria concluir — HIPÓTESE:** Abrir uma pendência de aprovação em Hoje e chegar à seção Aprovações, com foco na ação correspondente quando ela ainda estiver presente na resposta da API. Isso reduz a busca manual, mas não foi executado no navegador.

4. **Bloqueio — OBSERVADO POR LEITURA:** Registrar ou editar a próxima ação com data permanece sem controle na tela de Negócios. Esse limite ainda me faria usar agenda ou planilha para combinar retornos.

5. **Desnecessário — HIPÓTESE:** Para minha rotina comercial, detalhes como execução, contrato e provedor continuariam secundários. Prefiro ler cliente, compromisso e prazo primeiro.

6. **Difícil — HIPÓTESE:** Determinar o primeiro contato do dia ainda exige julgamento entre categorias diferentes. O diff não introduz ordenação comercial única por prazo ou impacto.

7. **Intuitivo — OBSERVADO POR LEITURA / HIPÓTESE:** O identificador da ação agora percorre Hoje, App e WIA; esta inicia em Aprovações e procura o cartão para focá-lo. Como usuário simulado, esperaria essa continuidade ao selecionar “Revisar ação”.

8. **Melhorar — HIPÓTESE:** Se a aprovação mudou de estado entre abrir Hoje e carregar WIA, mostrar “Esta ação já foi atualizada” e um caminho para seu histórico evitaria procurar algo que desapareceu.

9. **Uso diário — HIPÓTESE:** A manutenção das aprovações antigas no conjunto carregado torna o resumo mais útil para minha conferência diária. Minha adoção continuaria condicionada à resposta real das filas e ao registro dos próximos compromissos.

10. **Única mudança mais impactante — HIPÓTESE:** Continua sendo editar próxima ação com data dentro do negócio e trazer os retornos vencidos para Hoje.

**Reavaliação dos achados — OBSERVADO POR LEITURA:**

- O corte local de cinco ações antes do filtro foi removido (`src/product/screens/today-v2-page.tsx:107`). Aprovações antigas retornadas pela API agora entram no contador. Isso não comprova completude de eventual paginação do servidor.
- O contexto da revisão está implementado (`src/App.tsx:1581`, `src/product/screens/wia-workspace.tsx:81,110-114`). Permanece uma hipótese de atrito quando o cartão não é encontrado; o efeito não informa esse caso.
- **P2 permanece:** próxima ação sem edição em `src/components/DealsPage.tsx:313,332`; condição: usuário precisa registrar ou reagendar o próximo contato. Sem nota automática de melhoria.
