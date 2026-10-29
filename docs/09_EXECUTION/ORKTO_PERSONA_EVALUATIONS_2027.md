# ORKTO — dez avaliações independentes

29/10/2026. **AVALIAÇÕES SIMULADAS**, produzidas por dez agentes com perfis distintos. Nenhuma entrevista, depoimento, teste físico ou medição de satisfação de cliente ocorreu.

Cada agente leu o produto congelado em c289f78 sem receber conclusões dos outros. Todos responderam às mesmas dez perguntas: compreensão, confusão, tarefa viável, bloqueio, excesso, dificuldade, intuição, melhoria, uso diário e mudança mais valiosa. As respostas completas iniciais estão preservadas nos arquivos abaixo. Após as correções, cada agente fez nova leitura independente das diferenças e respondeu novamente, sem copiar uma nota agregada. Adendos identificam correções posteriores específicas.

## Resultados individuais

| Persona | Perfil | Avaliação inicial | Reavaliação sintética |
|---|---|---|---|
| [P01](evidence/ux-research-lab-20261028/personas/persona-01.md) | Empresário iniciante | Personalização antes da primeira tarefa; WIA e Pulsos não explicados | Definições visíveis ajudam por leitura; onboarding ainda precisa de teste humano |
| [P02](evidence/ux-research-lab-20261028/personas/persona-02.md) | Empresário experiente | Aprovação antiga ocultada e revisão sem contexto | Correções reconhecidas; próxima ação do negócio ainda pouco editável |
| [P03](evidence/ux-research-lab-20261028/personas/persona-03.md) | Vendedor | Retorno pós-proposta e frequência de Clientes/Propostas | Suspeita de salvamento descartada por teste D; navegação e links continuam hipóteses |
| [P04](evidence/ux-research-lab-20261028/personas/persona-04.md) | Atendente | Trocar de conversa perde rascunho; identificação de colegas por ID | Rascunhos tratados na Inbox montada; identificação e filas permanecem abertas |
| [P05](evidence/ux-research-lab-20261028/personas/persona-05.md) | Gestor | Pendências antigas; responsável e visão de carga | Revisão contextual e aprovação visível; distribuição de carga ainda não resolvida |
| [P06](evidence/ux-research-lab-20261028/personas/persona-06.md) | Usuário Android | Cadastro em viewport curto; teclado de telefone | Rolagem e tel tratados por fonte; teclado físico/virtual real não testado |
| [P07](evidence/ux-research-lab-20261028/personas/persona-07.md) | Usuário iPhone | Cadastro com teclado; Enter ao escrever parágrafos | Enter touch e telefone tratados; iOS real e área segura precisam validação |
| [P08](evidence/ux-research-lab-20261028/personas/persona-08.md) | Baixa familiaridade digital | Termos técnicos e bloqueios sem instrução humana suficiente | Definições WIA/Pulsos melhores; fornecedor e custo por ação continuam confusos |
| [P09](evidence/ux-research-lab-20261028/personas/persona-09.md) | CRM e automações avançados | Radar incompleto; motivo de rejeição e histórico limitados | Radar expansível; rejeição e histórico seguem abertos |
| [P10](evidence/ux-research-lab-20261028/personas/persona-10.md) | Especialista em acessibilidade | Foco e rótulos inconsistentes | Hook e labels tratados; encontrou regressão de Escape, corrigida e retestada localmente |

## Crítica estruturada após as avaliações independentes

Convergência: personas 6, 7 e 10 apontaram problemas no cadastro; 2 e 5 identificaram aprovação antiga perdida pelo resumo; 1, 8 e 9 questionaram a amplitude percebida da WIA. Os problemas funcionais foram confirmados por interações automatizadas, não pela quantidade de agentes que os mencionou. Os testes UX01–UX08 distinguem reprodução de suspeita.

Divergência útil: o iniciante quer orientação e menos decisões; o operador avançado quer toda a fila e mais rastreabilidade. Expandir sinais do Radar atende ao segundo sem aumentar permanentemente os itens na navegação do primeiro. Não houve consenso artificial sobre transformar Clientes/Propostas em itens fixos; essa decisão permanece hipótese para pesquisa real.

Contradição resolvida: a persona3 suspeitou que salvar proposta não abria detalhe. O App já fazia a transição; a fixture inicial estava incompleta. O teste D confirmou o fluxo. A reavaliação3 corrigiu a interpretação, preservando o relato inicial na cronologia.

Qualidade da revisão: a persona10 encontrou dois efeitos adversos na primeira correção de Escape: edição preservada ao trocar de cliente e fechamento de importação ignorando a proteção durante operação. Ambos foram corrigidos. UX09 testa o primeiro; o segundo reutiliza o fechamento existente e foi revisto em fonte, sem simular uma importação financeira real.

## O que esta comparação não prova

Não mede adoção, conversão, facilidade humana, confiança de clientes, desempenho em aparelhos reais ou conformidade assistiva. Não transforma expectativa da persona em comportamento observado. O contador de Pulsos não define equivalência com mensagens/tokens nem franquia contratual. As duas rodadas de leitura são revisão sintética; as interações Chromium são testes reais da interface **local com doubles**, sem autenticação ou fornecedor reais.

A escolha de prioridades e o que permanece aberto estão em [matriz de problemas](ORKTO_USABILITY_ISSUES_2027.md). O teste com pessoas reais deve seguir [protocolo próprio](ORKTO_REAL_USER_TEST_PROTOCOL.md).

READY_FOR_PRODUCTION_CANDIDATE=NO
