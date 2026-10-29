# Persona 08 — avaliação inicial independente

Base: `c289f78`. Persona simulada: baixa familiaridade digital, não entende expressões técnicas ou configurações.

**Simulação baseada na leitura do código; sem usuários ou interação reais.** Nenhum produto atualizado foi revisado para este registro.

1. **Compreensão — simulação:** entenderia que posso consultar propostas e vendas, preparar um orçamento e revisar algo antes de aprovar.

2. **Confusão — observado:** aparecem “workspace”, “modelo de linguagem”, “consultas determinísticas”, “Embedded Signup”, “owner/admin” e “provedor”. **Hipótese:** eu pensaria que preciso conhecer informática para continuar.

3. **Tarefa que conseguiria — simulação:** preencher nome da empresa e celular; selecionar “Propostas pendentes” e enviar a consulta. Os exemplos dos campos e o aviso de que o atalho apenas preenche o pedido ajudam.

4. **Bloqueio — observado:** a conexão do WhatsApp pode ficar desabilitada enquanto o texto pede configuração no servidor. **Hipótese:** eu não saberia quem procurar nem como solicitar ajuda.

5. **Desnecessário — simulação:** nomes de modelo, provedor e execução não me ajudariam a organizar minhas vendas. Esses detalhes caberiam em uma área para quem presta suporte.

6. **Difícil — observado:** o contador informa Pulsos “utilizados ou reservados” e “na franquia”, sem explicar sua utilidade nessa peça. **Hipótese:** eu não saberia quantas consultas ainda posso fazer nem se estou gastando dinheiro.

7. **Intuitivo — simulação:** “Pedido”, “Aprovações”, “Histórico”, “Voltar” e “Conectar meu WhatsApp” têm intenção reconhecível. A mensagem “Preencha o nome do negócio e o WhatsApp” aponta uma correção concreta.

8. **Melhorar — simulação:** explicar cada impedimento com “O que aconteceu” e “O que fazer agora”. “Concilie os envios” e “validação pendente” não indicam uma tarefa que eu consiga executar.

9. **Uso diário — hipótese:** usaria consultas prontas se recebessem respostas simples. Dependeria de ajuda para configurar canais, entender consumo e resolver falhas.

10. **Única mudança — simulação:** substituir mensagens de configuração por instruções práticas, com uma ação como “Pedir ajuda ao responsável da empresa”.

## Achados observados por leitura

- **P1 — `src/product/screens/whatsapp-connection-panel.tsx:23–26`.** Quando falta configuração, exige “Embedded Signup no servidor” e desabilita conectar. Não oferece encaminhamento acionável para esta persona. Hipótese: abandono na configuração.
- **P2 — `src/product/screens/pulso-counter.tsx:39–43`.** Quando há saldo, informa quantidade e franquia sem explicar o que um Pulso permite fazer. Hipótese: insegurança sobre custo e capacidade restante.
- **P2 — `src/product/screens/whatsapp-connection-panel.tsx:33`.** Quando existe conexão, oferece “Manual”, “Assistido” e “Controlado” sem descrever diferenças ou consequências. Hipótese: escolha por tentativa ou evitação da configuração.

## Rodada 2 — revisão independente do diff atual contra c289f78

Revisão sintética por leitura do diff e dos arquivos pertinentes em 2026-10-29. Não houve interação com navegador, usuários, provedores ou dados reais. A avaliação inicial acima permanece intacta. Sem pontuação automática de melhoria.

1. **Compreensão — simulação:** ainda entenderia que posso consultar registros e revisar uma ação. O botão “Aprovar e criar tarefa interna” informa uma consequência concreta, mas eu precisaria saber onde encontrar essa tarefa depois.

2. **Confusão — observado:** os textos de configuração continuam usando “workspace”, “modelo”, “Embedded Signup”, “provedor” e “owner/admin”. **Hipótese:** eu continuaria sem entender se preciso agir ou esperar ajuda.

3. **Tarefa que conseguiria — simulação:** partir de “Revisar ação” na página Hoje para a aprovação correspondente. **Observado:** o diff passa o identificador, inicia a seção de aprovações e tenta focar o cartão carregado. A conclusão depende de a ação estar presente; o percurso não foi executado.

4. **Bloqueio — observado:** a configuração ausente do WhatsApp ainda desabilita conectar, com instrução técnica e sem ação para pedir ajuda. **Hipótese:** permaneceria dependente de outra pessoa.

5. **Desnecessário — simulação:** identificadores de execução, nome do modelo e informação de provedor continuariam sem utilidade para minha rotina. Manter esses detalhes recolhidos ajuda, mas não explica a disponibilidade em linguagem cotidiana.

6. **Difícil — observado:** Pulsos continuam sem definição no contador; “utilizados ou reservados” e “limite aprovado” não explicam o que ainda posso fazer. Os três modos de atendimento seguem sem descrição de seus efeitos.

7. **Intuitivo — simulação:** “Ver mais” sugere como encontrar outros itens. **Observado:** o diff permite expandir os sinais do Radar; no celular, Enter passa a inserir linha na mensagem, e campos de telefone recebem configuração de entrada telefônica. Efeitos visuais e facilidade real não foram testados.

8. **Melhorar — simulação:** explicar “o que posso fazer agora” junto aos impedimentos. Na WIA, dizer em termos diretos que consultar e preparar rascunhos estão disponíveis, e que aprovar cria uma tarefa dentro da ORKTO sem enviar a mensagem ao cliente.

9. **Uso diário — hipótese:** o caminho direto para revisão pode reduzir minha procura pela ação. Ainda pediria ajuda para começar a usar WhatsApp, escolher atendimento e interpretar saldo. Preservar rascunhos ao alternar conversas pode ajudar, mas o código limita isso ao Inbox montado; não deduzo recuperação após sair ou recarregar.

10. **Única mudança — simulação:** tornar todo bloqueio de configuração uma orientação curta com responsável e próximo passo, por exemplo “O WhatsApp precisa ser preparado pelo responsável da empresa. Peça ajuda para conectar sua conta”.

### Achados remanescentes por leitura

- **P1 — `src/product/screens/whatsapp-connection-panel.tsx:23–26`.** Configuração ausente: ação desabilitada e instrução técnica sem encaminhamento. Hipótese: a persona não consegue concluir a conexão sozinha.
- **P2 — `src/product/screens/pulso-counter.tsx:39–43`.** Saldo exibido: a unidade não explica capacidades ou relação com consumo. Hipótese: insegurança sobre uso e gasto.
- **P2 — `src/product/screens/whatsapp-connection-panel.tsx:33`.** Conexão existente e verificada: modos Manual/Assistido/Controlado sem descrição. Hipótese: escolha sem compreensão do efeito.

## Adendo final — commit 04d24c9

Revisão sintética somente por leitura do commit, em 2026-10-29; sem teste de interação nem participação de usuários reais.

**Observado:** `src/product/screens/wia-workspace.tsx:179` apresenta a limitação existente junto ao campo de pedido: a WIA prepara análises e rascunhos e ainda não cadastra clientes ou negócios por comando livre. O aviso deixa de depender da abertura de “Disponibilidade e integrações”. `src/product/screens/pulso-counter.tsx:40` define Pulsos como “Unidade de consumo da ORKTO”, sem atribuir preço, franquia ou equivalência a consultas.

**Interpretação simulada:** eu teria uma pista visível para não esperar que escrever “cadastre meu cliente” conclua o cadastro. Entenderia que Pulsos medem uso, mas ainda não conseguiria prever quanto uma ação consome. Isso reduz uma ambiguidade textual específica; não comprova entendimento ou facilidade de uso.

**Lacuna preservada:** “linguagem livre”, “modelo”, “configuração” e “limites aprovados” continuam exigindo interpretação. O commit não resolve os termos de fornecedores/configuração do WhatsApp (“Embedded Signup”, “provedor”, “owner/admin”) nem explica os modos de atendimento. Os achados anteriores devem ser lidos com esta atualização: a unidade Pulsos agora tem definição geral, porém sua relação prática com ações continua sem explicação no contador.

