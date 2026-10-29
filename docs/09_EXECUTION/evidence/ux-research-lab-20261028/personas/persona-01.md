# Persona 01 — avaliação inicial independente

**Persona1 — empresário iniciante, pouco familiarizado com tecnologia. AVALIAÇÃO SIMULADA**, baseada exclusivamente na leitura do commit `c289f78`. Nenhuma interação no navegador ou participação de usuário real.

1. **Compreensão imediata:** entendo que posso organizar clientes, acompanhar vendas e criar propostas. “Criar proposta” oferece um começo concreto. **RESULTADO OBSERVADO POR LEITURA:** esse botão aparece no início de Hoje.

2. **Confusão:** não entendo imediatamente WIA, Pulsos e workspace. Também fico inseguro sobre quando uma oportunidade deve virar “negócio” ou “proposta”. **HIPÓTESE:** precisaria de explicações antes de explorar essas áreas.

3. **Tarefa que conseguiria concluir:** provavelmente conseguiria preencher os dados da empresa e iniciar o primeiro orçamento, pois existem exemplos e etapas numeradas. **HIPÓTESE:** conclusão e salvamento não foram testados.

4. **Bloqueio:** se a Inbox exigir configuração, encontrarei “Abrir configurações”, mas não saberei necessariamente qual configuração resolver. **RESULTADO OBSERVADO POR LEITURA:** existe encaminhamento genérico; **HIPÓTESE:** dependeria de ajuda.

5. **Desnecessário:** escolher tom de comunicação, slogan e paleta antes do primeiro orçamento parece trabalho antecipado. Quero primeiro descobrir se consigo atender meu cliente.

6. **Difícil:** entender os estados técnicos quando algo falha. “Contrato necessário”, “ambiente”, “servidor” e “ações persistidas” descrevem o sistema, mas não esclarecem meu próximo passo.

7. **Intuitivo:** “Precisa de você”, “Abrir conversa”, “Abrir proposta” e os exemplos nos campos aproximam a interface do meu trabalho. A busca em Mais aceitar “orçamento” para localizar Propostas ajuda.

8. **Melhorar:** oferecer um percurso curto: cadastrar cliente → montar orçamento → revisar. Explicar termos no ponto em que aparecem, usando consequências concretas para meu negócio.

9. **Uso diário:** **HIPÓTESE:** usaria Hoje para abrir conversas e acompanhar propostas pendentes, depois de aprender a operação. No primeiro acesso, a quantidade de conceitos concorrentes reduz minha segurança.

10. **Única mudança de maior impacto:** acrescentar um início guiado, centrado na primeira proposta, com opções prontas de estilo e explicação do que falta para trabalhar.

**Achados da minha perspectiva:**

- **P2 — Personalização antecede a primeira entrega.** `src/App.tsx:1334–1410`. Condição: perfil com onboarding incompleto, após preencher nome e telefone. O passo seguinte exige atravessar a personalização antes de chegar ao primeiro orçamento. **Observado:** sequência; **hipótese:** abandono por esforço.
- **P2 — WIA sem definição local.** `src/product/screens/today-v2-page.tsx:148–155`. Condição: abrir Hoje sem conhecer o produto. Há convite e exemplo, mas nenhuma explicação direta de quem é WIA. **Hipótese:** hesitação.
- **P2 — Unidade de consumo sem significado operacional.** `src/product/screens/pulso-counter.tsx:39–45`. Condição: contador exibido no primeiro acesso. Mostra saldo/franquia sem explicar o que consome Pulsos. **Hipótese:** receio de custo ao agir.

## Rodada 2 — revisão independente do diff atual contra c289f78

**AVALIAÇÃO SIMULADA — 2026-10-29.** Revisão sintética de código, sem navegador, usuário real, execução de tarefas ou validação de provedores. Somente minha perspectiva de empresário iniciante; nenhuma pontuação automática de melhoria.

1. **Compreensão imediata:** continuo entendendo propostas e conversas como atividades centrais. **RESULTADO OBSERVADO POR LEITURA:** a apresentação inicial de Hoje e as explicações de WIA/Pulsos permanecem iguais. **HIPÓTESE:** a compreensão inicial continua limitada pelos mesmos termos.

2. **Confusão:** ainda não sei definir WIA ou prever o consumo de Pulsos. O direcionamento para uma aprovação específica reduz a necessidade de procurar a ação, mas não explica o conceito de assistente.

3. **Tarefa que conseguiria concluir:** **HIPÓTESE:** conseguiria cadastrar um cliente com menos esforço no celular, pois o telefone solicita teclado apropriado. “Revisar ação” agora encaminha o identificador para a aba de aprovações e tenta focar o registro. A conclusão dessas tarefas não foi observada.

4. **Bloqueio:** a necessidade de configurar uma integração continua exigindo conhecimento que não tenho. O diff não acrescenta um passo a passo para o primeiro uso ou uma recuperação específica para esse caso.

5. **Desnecessário:** continuo preferindo adiar slogan, paleta e tom de comunicação. **RESULTADO OBSERVADO POR LEITURA:** o onboarding não recebeu mudanças nesse trecho.

6. **Difícil:** diferenciar revisão, tarefa interna e envio ao cliente ainda pede atenção. O texto da aprovação esclarece que cria uma tarefa interna, mas permanecem termos como API, execução e servidor.

7. **Intuitivo:** “Ver mais” no Radar oferece uma ação concreta para descobrir os demais sinais. **RESULTADO OBSERVADO POR LEITURA:** substitui o aviso de apenas seis itens por expansão. Preservar o rascunho ao alternar conversas também combina com minha expectativa, enquanto a Inbox permanece montada.

8. **Melhorar:** explicar WIA como ajuda para consultar e preparar ações, apresentar o significado de Pulsos e oferecer um caminho curto até a primeira proposta. São necessidades ainda presentes.

9. **Uso diário:** **HIPÓTESE:** alternar conversas sem perder o texto e abrir diretamente uma aprovação pode facilitar minha rotina após aprender o produto. Não há evidência nesta revisão de maior facilidade no primeiro acesso.

10. **Única mudança de maior impacto:** mantenho o início guiado até a primeira proposta, com personalização opcional. As correções atuais ajudam tarefas específicas; minha principal dúvida continua sendo por onde começar e o que preciso configurar.

**Achados preservados, condicionais e reproduzíveis por inspeção:** P2 — personalização antes do primeiro orçamento (`src/App.tsx:1334–1410`, perfil com onboarding incompleto); P2 — WIA sem definição local (`src/product/screens/today-v2-page.tsx:150–157`, primeiro acesso a Hoje); P2 — Pulsos sem explicação de consumo (`src/product/screens/pulso-counter.tsx:39–45`, contador exibido). A presença dos textos e da sequência é observada por leitura; hesitação e abandono continuam hipóteses.

## Adendo final — clareza no commit 04d24c9

**AVALIAÇÃO SIMULADA, por leitura de fonte em 2026-10-29.** Sem teste no navegador, usuário real ou confirmação de conclusão de tarefas.

**RESULTADO OBSERVADO POR LEITURA:** `src/product/screens/wia-workspace.tsx:179` agora apresenta junto ao campo de pedido a explicação antes recolhida em “Disponibilidade e integrações”: WIA prepara análises e rascunhos e ainda não cadastra clientes ou negócios por comando livre. **Minha interpretação:** ao chegar à WIA, tenho uma referência concreta para decidir o que pedir; a limitação fica mais fácil de descobrir. **HIPÓTESE:** isso reduz tentativas de cadastrar clientes pela conversa. O nome WIA e o convite de Hoje continuam sem uma definição equivalente naquele ponto inicial; não considero toda a dúvida resolvida.

**RESULTADO OBSERVADO POR LEITURA:** `src/product/screens/pulso-counter.tsx:40` acrescenta “Unidade de consumo da ORKTO.” **Minha interpretação:** agora entendo a categoria do saldo. Ainda não consigo prever quais ações gastam Pulsos ou quanto consumiriam. Portanto, atualizo o achado anterior de ausência de significado para explicação operacional ainda parcial. Nenhum preço ou franquia foi acrescentado por esse texto.

O obstáculo de onboarding permanece: escolher estilo, tom e paleta antes da primeira proposta. Minha prioridade continua sendo um caminho inicial curto até uma proposta revisável. As duas mudanças esclarecem expectativas; sua eficácia para um iniciante continua uma hipótese a validar.
