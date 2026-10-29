# Persona 7 — avaliação inicial independente

Base: `c289f78`. Perspectiva sintética de usuário de iPhone que quer navegar, digitar e consultar confortavelmente. Fontes: leitura por `git show c289f78:<path>` e inspeção das imagens baseline `simplicity-r1-20261027/after-mobile-320-dark.png` e `after-mobile-430-light.png`. As imagens são fixtures anteriores preservadas no commit; não comprovam execução atual. Nenhum teste humano, físico iOS, navegação real ou envio foi realizado. Hipóteses abaixo não são relatos de participantes. Produto atualizado e outras personas não foram revisados.

1. **Compreendi — simulação:** “Hoje” resume o trabalho; “Conversas” leva ao atendimento; “Mais” reúne clientes, propostas e configurações.
2. **Confusão — hipótese:** “WIA” não explica sua função para quem acaba de entrar. “Clientes” fica em “Mais”, embora pareça parte frequente do trabalho.
3. **Tarefa que conseguiria — simulação:** encontraria Clientes pela busca do menu e iniciaria uma proposta pelo botão destacado. O formulário informa o passo atual e os campos obrigatórios.
4. **Bloqueio — hipótese:** cadastrar um cliente com o teclado aberto pode esconder o final do modal. Não confirmei que conseguiria chegar a “Salvar Registro” nessa situação.
5. **Desnecessário — simulação:** “Outras criações” acrescenta uma decisão quando quero apenas cadastrar um cliente; seu conteúdo não fica claro antes de abrir.
6. **Difícil — observação/hipótese:** os campos de telefone usam texto comum. No iPhone, isso provavelmente exigirá trocar o teclado para números.
7. **Intuitivo — observação:** nas imagens, “Nova proposta” domina corretamente a hierarquia; busca, grupos de módulos e fechar são reconhecíveis. O CSS prevê alvos de 44px, campos de 16px e espaço para a área inferior segura.
8. **Melhorar — hipótese:** tornar a composição de mensagens compatível com escrever parágrafos usando o teclado do celular, sem exigir Shift.
9. **Uso diário — simulação:** usaria para consultar clientes e acompanhar conversas. Minha confiança para cadastrar e escrever textos longos dependeria de validar teclado, rolagem e retorno à lista no aparelho.
10. **Única mudança valiosa — hipótese:** garantir que o cadastro de cliente continue inteiramente acessível quando o teclado estiver aberto.

## Achados iniciais

- **P1, hipótese — modal pode impedir concluir cadastro.** `src/components/ClientsPage.tsx:827` aplica `overflow-hidden`, sem rolagem interna; `src/product/design/mobile-operations.css:141` limita o diálogo a `100dvh`. **Condição:** altura disponível menor que o formulário, especialmente com teclado aberto. Validar em iPhone antes de afirmar reprodução.
- **P2, observação — telefone sem teclado adequado.** `src/components/ClientsPage.tsx:856` e `src/components/CreateQuote.tsx:483` usam `type="text"`, sem `inputMode`. **Condição:** preencher telefone pelo teclado virtual.
- **P2, observação com impacto hipotético — Enter solicita envio.** `src/components/inbox/ConversationView.tsx:768` intercepta Enter sem Shift; a explicação em `:778` fica apenas para leitores de tela. **Condição:** tentar inserir uma quebra de linha pelo teclado virtual.

## Rodada 2 — revisão independente por fonte, 2026-10-29

Comparação do produto atual com `c289f78`, limitada a navegação móvel, ClientsPage, CreateQuote, ConversationView, CSS móvel e hook de foco. Respostas sintéticas: não houve participante humano, navegador, teste físico iOS ou envio. Não consultei outras personas nem relatórios agregados. Nenhuma nota de usabilidade é inferida das correções.

1. **Compreendi — simulação:** continuaria usando Hoje para me situar, Conversas para atender e Mais para localizar clientes e propostas. As alterações não mudaram esse mapa.
2. **Confusão — hipótese:** WIA continua sem significado imediato para um iniciante; Clientes continua exigindo abrir Mais. Não vi resolução desses pontos no diff examinado.
3. **Tarefa que conseguiria — simulação:** tentaria cadastrar um cliente, informar seu telefone e avançar na criação de proposta. O teclado telefônico agora está solicitado explicitamente nos campos relevantes; conclusão real não foi testada.
4. **Bloqueio — hipótese reavaliada:** a ausência de rolagem do novo cliente foi tratada no CSS. Não considero comprovado o acesso a Salvar com o teclado real aberto: `100dvh` sozinho não demonstra a geometria do viewport visual no Safari.
5. **Desnecessário — simulação:** Outras criações ainda me faria abrir outra camada para descobrir suas opções. Nenhuma mudança observada elimina essa hesitação inicial.
6. **Difícil — hipótese:** escrever notas longas e alcançar ações no cadastro ainda depende da combinação de foco, teclado e rolagem. O novo foco automático no nome pode abrir o teclado logo ao entrar; seu efeito prático permanece desconhecido.
7. **Intuitivo — observação por fonte:** telefone no cadastro/edição usa `type="tel"`, `inputMode="tel"` e preenchimento automático. Na proposta, `inputMode="tel"` foi acrescentado mesmo mantendo `type="text"`; a intenção de teclado está presente.
8. **Melhorar — hipótese:** validar em iPhone o ciclo abrir cadastro → digitar notas → salvar e o ciclo conversa → escrever dois parágrafos → enviar pelo botão.
9. **Uso diário — simulação:** consulta e atendimento continuam plausíveis; os ajustes tornam a digitação mais coerente por leitura. Não posso converter isso em confiança observada ou ganho medido de uso diário.
10. **Única mudança valiosa — hipótese:** confirmar que o cadastro permanece acessível durante todo o uso do teclado real e ajustar a altura ao viewport visual se houver encobrimento.

Reavaliação dos achados: o P1 inicial recebeu mitigação em `src/product/design/mobile-operations.css:160` (`overflow-y:auto`, altura limitada); reprodução física continua pendente. O P2 de telefone foi tratado por atributos de entrada (`ClientsPage.tsx:866` e `:1059`; `CreateQuote.tsx:482`). O P2 de Enter foi tratado em `ConversationView.tsx:773`: ponteiro coarse e composição não disparam envio por Enter. Essa classificação descreve o ponteiro principal, não o teclado conectado; comportamento com acessórios permanece hipótese. A instrução atualizada em `:783` continua visualmente oculta. Não atribuo resolução física nem novos defeitos reproduzidos a esses limites.
