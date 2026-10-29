# ORKTO — matriz de problemas de usabilidade

29/10/2026 · branch feat/orkto-ux-research-lab-2027 · baseline de produto c289f78 · correções 04d24c9. Escopo: frontend local, fixtures sintéticas. Frequência abaixo é recorrência nas avaliações artificiais, não prevalência entre clientes.

## Problemas reproduzidos e corrigidos

| ID / prioridade | Evidência anterior | Consequência | Correção / limite |
|---|---|---|---|
| UX01 / P1 | Foco fora do diálogo no Chromium; Escape não fecha | Teclado opera atrás da sobreposição | Hook compartilhado: foco inicial, Tab, Escape e retorno ao acionador; não certifica leitor de tela |
| UX02 / P1 | Formulário 568px dentro de área de 428px com overflow hidden | Final do cadastro inacessível em tela curta | Rolagem interna limitada a 100dvh − 32px; overlay z130 acima do dock z90; viewport reduzido, não teclado iOS físico |
| UX03 / P1 | Campos de edição sem associação label/control | Edição sem nomes acessíveis | IDs e htmlFor associados; rótulos usam token de texto existente; contraste global ainda não certificado |
| UX04 / P1 | Cinco ações executadas recentes ocultam uma aprovação antiga | Hoje sugere ausência de pendência apesar de dados retornados | Removido corte antes de filtrar aprovações; atividade continua resumida; não amplia limite de consulta backend |
| UX05 / P2 | “Revisar ação” abre Pedido em vez de Aprovações | Usuário perde a decisão selecionada | ID percorre Hoje → App → WIA; abre seção e foca artigo correspondente; não aprova automaticamente |
| UX06 / P1 | Trocar Marina → Caio → Marina apaga o rascunho | Perda de trabalho durante atendimento | Rascunhos por conversa em memória da Inbox montada; limpam na troca de sessão/desmontagem; sem storage ou sincronização |
| UX07 / P2 | Nove sinais retornados, somente seis acessíveis | Parte da fila fica escondida | Ver mais/Mostrar menos mantém ordem e ressalva de cobertura parcial; engine permanece somente leitura |
| UX08 / P1 | Enter em contexto touch dispara uma tentativa de envio à fixture | Envio involuntário ao escrever parágrafos | Enter cria linha em pointer coarse; desktop mantém Enter e Shift+Enter; composição IME não envia |
| UX09 / P1 | Revisão de fonte encontrou novo caminho Escape sem limpar isEditing | Edição anterior pode reaparecer em outro cliente | Escape limpa edição; importação usa fechamento existente com busy guard; teste novo verifica A editado sem salvar → B preservado |
| UX10 / P2 | Telefones usam teclado genérico; limitação WIA escondida; Pulsos indefinido | Esforço e expectativa errada | Campos tel/inputMode; limitação existente visível junto ao pedido; definição básica de Pulsos sem inventar franquia |

UX09 foi encontrado na revisão da primeira implementação e corrigido antes da entrega. Não era um defeito comprovado do baseline anterior. Um teste adicional protege respostas assíncronas antigas de apagar rascunhos da sessão atual.

## Hipóteses e melhorias ainda abertas

| Prioridade | Achado / origem | Estado / próxima evidência necessária |
|---|---|---|
| P2 | Onboarding de estilo antes da primeira tarefa; iniciante quer exemplo guiado | Hipótese de personas 1/8. Testar primeiro uso com pessoas antes de redesenhar o fluxo |
| P2 | Responsável aparece como ID em contextos privados; ausência de visão por carga | Leitura de personas 4/5. Depende de contrato de nomes/papéis; não inventar membros nem permissões |
| P2 | Próxima ação de negócio não editável na interface atual | Leitura de persona 2. Especificar contrato e validação antes de expandir mutações |
| P2 | Rejeição WIA envia motivo vazio e histórico mostra 12 ações sem continuação | Leitura de persona 9. Definir navegação/auditoria e motivo opcional; permanece aberto |
| P2 | Texto de bloqueio WhatsApp menciona SDK/Embedded Signup e termos técnicos | Leitura de persona 8. Validar linguagem de recuperação com operador real e estado oficial do fornecedor |
| P2 | Metadados de 8–10px, contraste em outras telas e sugestões sem padrão combobox completo | Leitura de persona 10. Necessita auditoria assistiva e medidas renderizadas; esta rodada não declara WCAG |
| P2 | Propostas/clientes sob Mais podem exigir passos frequentes; dois controles de link na proposta | Hipóteses de persona 3; comparar tarefas reais antes de acrescentar itens fixos à navegação |
| P2 | Aprovação pode mudar de estado entre Hoje e WIA | Hipótese de persona 5. A fila não executa nada ao abrir; falta validar mensagem para alvo não retornado |
| P2 | Custo por ação/Pulsos ainda pouco claro | Não inventar equivalência com tokens, mensagens ou chamadas. Política comercial requer aprovação |

Não confirmado: a suspeita de proposta salva sem abrir detalhe foi rejeitada pelo teste D e pela leitura do App. O adaptador visual inicial tinha ligação incompleta; corrigir a fixture não é correção de produto.

## Priorização e divergências

Corrigimos primeiro perda de trabalho, aprovação oculta, envio involuntário e conclusão do cadastro. São comportamentos demonstráveis, com impacto maior que preferências visuais. Iniciantes desejam menos decisões; avançados pedem acesso integral ao histórico. A solução deste ciclo mantém a camada principal e oferece expansão do Radar, sem esconder evidências nem transformar a navegação em uma lista maior. Rejeição com justificativa e filtros de equipe não foram implementados sem contrato revisado.

READY_FOR_PRODUCTION_CANDIDATE=NO
