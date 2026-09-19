# ORKTO - Plano de Preparacao das Funcionalidades Aprovadas

**Status:** plano de produto e engenharia para refinamento  
**Base analisada:** `Orktoverdeiro` + documento "Funcionalidades Consolidadas v1.0"  
**Escopo:** 13 funcionalidades aprovadas, configuracoes internas e infraestrutura silenciosa necessaria  
**Fora do lancamento inicial:** Reativacao por Ciclo de Recompra e Deteccao de Cliente Fantasma, que permanecem como experimentos pendentes

## 1. Resultado esperado

Evoluir a ORKTO de um gerador e gestor de propostas para a camada de inteligencia que opera o ciclo comercial dentro do WhatsApp Business, no qual:

- **A ORKTO** entende quem e o cliente, o momento da compra, as regras comerciais e a proxima acao.
- **Hermes Agent**, como motor interno, recebe contexto, decide qual especialista deve atuar e coordena a execucao.
- **Bots especialistas** executam tarefas limitadas por papel, politica e nivel de autonomia.
- **Humanos** mantem visibilidade, aprovacao e capacidade de interromper qualquer automacao relevante.
- **Supabase** concentra identidade, dados transacionais, eventos, filas e atualizacoes em tempo real.
- **O site publico** explica o novo produto sem prometer funcoes ainda nao liberadas.

O produto deve parecer uma operacao acontecendo, nao uma colecao de ferramentas que o empresario ainda precisa operar. Hermes Agent e os bots sao infraestrutura interna; a experiencia e a comunicacao pertencem a marca ORKTO.

### Tese central de produto

O WhatsApp da empresa nao precisa de outra IA ao lado. Precisa de uma inteligencia operando o atendimento. A ORKTO nao e sidebar, botao de gerar resposta ou chatbot isolado: ela administra o ciclo comercial da primeira mensagem ao fechamento e depois dele.

O resultado ideal ao abrir a ORKTO pela manha nao e encontrar uma caixa de entrada acumulada. E receber um briefing operacional: clientes atendidos, oportunidades avancadas, orcamentos recuperados, decisoes humanas pendentes, pagamentos que precisam de atencao e prioridades do dia.

## 2. Principios do produto

1. **Automacao visivel:** toda acao automatica mostra motivo, estado, horario e responsavel digital.
2. **Humano no controle:** risco, desconto, cobranca sensivel e mudanca de estrategia possuem limites e escalonamento.
3. **Uma fonte de verdade:** mensagens, propostas, pagamentos e eventos comerciais usam o mesmo contato e a mesma linha do tempo.
4. **Sem numeros inventados:** Wrapped, cases e relatorios so exibem metricas calculadas a partir de eventos auditaveis.
5. **Privacidade por arquitetura:** dados brutos de uma empresa nunca alimentam diretamente outra empresa.
6. **Idempotencia:** webhook, envio, cobranca e follow-up repetidos nao podem duplicar efeitos.
7. **Liberacao progressiva:** cada bot inicia em modo observacao, passa para sugestao e so depois recebe autonomia limitada.

## 3. Estado atual e lacunas

### O que ja existe

- React/Vite, Express e Supabase.
- Autenticacao, perfis, clientes, servicos e propostas.
- Link publico de proposta, visualizacao, aprovacao, rejeicao e PIX.
- Dashboard, analytics basico/avancado e follow-up manual por link do WhatsApp.
- Identidade visual consolidada: laranja `#FF9F1C`, preto `#111111`, cinza `#2B2B2B`, Plus Jakarta Sans e JetBrains Mono.
- Retencao de propostas com Postgres Cron.

### O que ainda nao existe

- Conexao bidirecional com WhatsApp Business/Evolution API.
- Modelo persistente de conversas e mensagens.
- Integracao remota do workspace com o Hermes Agent e codigo dos bots de negocio da ORKTO. O `HermesAdapter` mockado, o `Policy Engine`, a Inbox e os contratos da primeira fatia ja existem localmente; o gateway real ainda nao esta conectado ao produto.
- Orquestracao, filas duraveis, playbooks, aprovacao humana e trilha de auditoria dos agentes.
- Estados de sentimento/urgencia, risco, cobranca, replay de estrategias ou memoria coletiva.
- UX de inbox, central de bots, central de cobranca, grafo e sussurro.

### Gate obrigatorio: validacao do Hermes Agent

**Baseline local validado em 18/09/2026:**

- Hermes Agent `v0.21.3` (`2026.9.14`), instalado via Git em `C:\Users\sobooa7iqytvqheo\AppData\Local\hermes\hermes-agent`;
- Python `3.11.16`, OpenAI SDK `2.24.0` e versao de configuracao `v45` consistentes;
- autenticacao do Nous Portal ativa, chave ou endpoint de inferencia configurado e memoria interna disponivel;
- quatro perfis locais encontrados (`gueguel`, `kaka`, `merces` e `xoto`), todos com gateway em execucao e modelo `upstage/solar-pro4:free`;
- comandos nativos disponiveis para WhatsApp, WhatsApp Cloud, gateway, perfis, comunicacao entre agentes, MCP, dashboard, cron e kanban;
- `hermes doctor` concluiu sem alerta de seguranca ativo e sem comando MCP suspeito;
- `hermes status` confirmou o gateway manual ativo para os quatro perfis e o WhatsApp configurado por plugin; o conector nativo de WhatsApp permanece sem configuracao;
- smoke test de inferencia em modo seguro, sem ferramentas e sem envio externo, retornou `HERMES_OK`;
- a conta Nous Portal nao possui creditos pagos utilizaveis para as ferramentas gerenciadas de web, imagem, voz e browser; isso nao impediu o smoke test com o modelo gratuito, mas deve entrar no calculo de custo e capacidade da homologacao;
- pendencias do ambiente: Playwright Chromium ausente, provedores opcionais nao autenticados e alertas `npm` nas dependencias de browser/web. Essas pendencias devem ser tratadas antes dos testes E2E correspondentes, sem usar `doctor --fix` automaticamente em producao.

Essa instalacao serve como ambiente de referencia e desenvolvimento. Ela nao autoriza o site a depender diretamente do diretorio local nem transforma os perfis existentes em bots de producao.

Antes de implementar qualquer agente, registrar:

- versao instalada do `NousResearch/hermes-agent` e politica de atualizacao;
- protocolo de entrada e saida;
- modelos e provedores usados;
- suporte a ferramentas, memoria, streaming, retries e cancelamento;
- formato de trace e correlacao;
- limites de latencia, custo e concorrencia;
- mecanismo atual de bots e como um bot declara capacidades;
- ambientes, responsaveis e processo de deploy.

**Saida do gate:** um `HermesAdapter` versionado e testes de contrato. Nenhuma tela deve chamar Hermes diretamente.

## 4. Arquitetura de referencia

```text
WhatsApp/Evolution API
        |
        v
Webhook Gateway -> Normalizador -> conversation_events -> Fila duravel
                                                    |
                                                    v
                                              HermesAdapter
                                                    |
                         +--------------------------+-------------------------+
                         |              |              |                     |
                      Hunter          Farmer      Collection Bot       Risk/Report Bots
                         |              |              |                     |
                         +--------------------------+-------------------------+
                                                    |
                                                    v
                                      Policy Engine + Dial de Confianca
                                                    |
                              +---------------------+-------------------+
                              |                                         |
                       approval_tasks                              action_outbox
                              |                                         |
                         Humano aprova                         WhatsApp/CRM/relatorio
                              +---------------------+-------------------+
                                                    |
                                             audit_log + metricas
```

### Componentes

- **Webhook Gateway:** valida assinatura, limita tamanho, gera `event_id` e rejeita replay.
- **Normalizador:** converte mensagens, anexos, status e contatos para eventos internos estaveis.
- **Fila duravel:** desacopla recebimento de processamento e permite retry com dead-letter queue.
- **HermesAdapter:** unico ponto de contato da ORKTO com Hermes.
- **Policy Engine:** aplica plano, horario, consentimento, limite de desconto, tom e nivel de autonomia.
- **Action Outbox:** garante envio unico e rastreavel para WhatsApp, e-mail, CRM ou contabilidade.
- **Realtime:** atualiza inbox, tarefas, sussurros, humor, cobrancas e execucoes sem polling.
- **Observabilidade:** correlaciona `workspace_id`, `conversation_id`, `agent_run_id` e `action_id`.

### Uso planejado do Supabase

- Postgres como fonte de verdade.
- RLS por `workspace_id` em toda tabela exposta.
- Realtime Broadcast privado para eventos de UI e Presence para estado online de operadores.
- Cron para varreduras agendadas e geracao de relatorios.
- Queues/PGMQ para follow-ups, cobrancas, geracao de artefatos e retries.
- Storage para anexos, cards do Wrapped e cases exportados.
- Edge Function ou worker Express para consumidores de fila e webhooks externos.

## 5. Modelo de bots

### Hermes Agent - Motor interno de orquestracao

Responsabilidades:

- classificar intencao, contexto e risco;
- selecionar apenas o bot necessario;
- montar contexto minimo da conversa;
- consultar politicas antes de executar;
- produzir plano curto e rastreavel;
- pedir aprovacao humana quando necessario;
- encerrar ou transferir para humano.

Hermes Agent nao e uma submarca apresentada como produto principal. Na arquitetura, ele nao deve enviar mensagem, conceder desconto ou alterar dados diretamente. Ele solicita ferramentas governadas pelo Policy Engine; na interface, a acao aparece como uma decisao operacional da ORKTO, com o especialista responsavel e a justificativa.

### Bots especialistas

| Bot | Funcao | Pode executar sozinho | Sempre exige aprovacao |
|---|---|---|---|
| Hunter | Primeiro contato, qualificacao e objecoes | Respostas dentro do playbook | Desconto fora do limite, promessa nao cadastrada |
| Farmer | Relacionamento, pos-venda e upsell | Follow-up consentido e contextual | Oferta sensivel ou alteracao contratual |
| Recovery Bot | Recuperar proposta parada | Sequencia aprovada e opt-out | Incentivo financeiro novo |
| Collection Analyst | Identificar motivo do atraso e negociar | Lembretes dentro da regua | Ameaca, negativacao, desconto de divida, caso excepcional |
| Risk Analyst | Calcular e explicar sinais de risco | Criar tarefa e recomendar garantia | Bloquear venda ou acusar cliente |
| Report Analyst | Sintetizar metricas e gerar recomendacoes | Relatorios internos | Compartilhamento externo |
| Growth Studio | Wrapped e case de sucesso | Criar rascunho | Publicar ou compartilhar |
| Price Auditor | Conferir tabela, desconto e margem | Bloquear erro deterministico | Excecao comercial |

### Niveis do Dial de Confianca

1. **Observando:** registra o que faria; nenhuma sugestao aparece ao cliente.
2. **Sugerindo:** cria rascunho para aprovacao humana.
3. **Autonomia limitada:** executa playbooks pre-aprovados dentro de limites.
4. **Autonomia ampliada:** somente apos volume minimo, qualidade comprovada e rollback testado.

O nivel e definido por bot e por tipo de acao, nunca como uma permissao global irrestrita.

## 6. Arquitetura de informacao e UX/UI do aplicativo

### Navegacao desktop proposta

1. **Hoje** - comando operacional e prioridades.
2. **Conversas** - inbox comercial ordenado pelo Hermes.
3. **Orcamentos** - criacao, envio, proposta viva e recuperacao.
4. **Clientes** - lista, historico e visualizacao em grafo.
5. **Cobrancas** - fila do Collection Analyst.
6. **Relatorios** - operacional, tatico, estrategico e Wrapped.
7. **Bots** - capacidades, playbooks, autonomia e historico.
8. **Configuracoes** - empresa, equipe, canais, integracoes e governanca.

### Navegacao mobile proposta

- Hoje
- Conversas
- Acao central `+`
- Clientes
- Mais

### Telas essenciais

#### A. Hoje - Command Center

- cabecalho com saude dos canais e status do Hermes;
- fila "Precisa de voce";
- oportunidades priorizadas;
- cobrancas em risco;
- propostas paradas;
- resumo do dia em linguagem natural;
- atividade recente dos bots.

Cada card deve responder: **o que aconteceu, por que importa, o que o bot recomenda e qual e a proxima acao**.

#### B. Conversas

- coluna de filtros e segmentos;
- lista priorizada com avatar, Mood Ring, motivo da prioridade, valor potencial e tempo de espera;
- conversa central;
- painel lateral com cliente, proposta, risco, tarefas e historico;
- barra de Sussurro acima do compositor;
- alternancia `Humano`, `Copiloto` e `Bot ativo`.

#### B.1 WIA e entrada inteligente

A **WIA** e a inteligencia artificial conversacional da ORKTO. Ela sera conectada ao DeepSeek em uma fase futura, com contrato, custos e limites proprios, e nao depende do Hermes.

- entrada expansivel para texto, voz transcrita e imagens;
- escolha entre atuacao humana e bots especialistas (`Hunter`, `Orca`, `Recupera` e `Cobra`);
- nivel de esforco `Rapido`, `Equilibrado` ou `Profundo` como dica de processamento;
- visualizacao e remocao de anexos antes do envio;
- estado visivel de gravacao, envio, sucesso e erro;
- `Enter` envia e `Shift+Enter` cria nova linha.

Fluxo alvo: `WIA -> API ORKTO -> DeepSeekAdapter -> regras da WIA -> resposta/acao aprovada`. A chave do provedor fica somente no servidor; limites de custo, auditoria e aprovacoes serao definidos antes da ativacao.

Estado atual: o componente visual esta integrado a Inbox. A conexao real com DeepSeek, voz persistida, imagens e metadados ainda precisam do contrato de backend, armazenamento seguro, validacao de MIME/tamanho e auditoria antes de producao.

**Criterios de aceite:** navegacao por teclado, foco visivel, permissao explicita de microfone, encerramento do stream ao parar/sair, limite de anexos, validacao de arquivo, feedback de falha e preservacao do rascunho quando o backend rejeitar o envio.

#### C. Central de bots

- cards por bot com estado: ativo, pausado, observando ou com erro;
- Dial de Confianca por capacidade;
- playbooks e limites;
- ultima acao e taxa de sucesso;
- botao de pausa global;
- feed auditavel com filtros.

#### D. Cobrancas

- colunas `Novo`, `Contato iniciado`, `Negociando`, `Promessa`, `Pago`, `Escalar`;
- valor, dias em atraso, motivo provável e proxima acao;
- regua de tom Cordial -> Padrao -> Firme -> Agressivo;
- meta e progresso;
- historico separado da conversa comercial principal.

#### E. Clientes e Orkto Browser

- alternancia Lista/Grafo;
- clusters explicados por legenda;
- busca, zoom, filtros e periodo;
- preview no primeiro clique e conversa completa no segundo;
- versao em lista acessivel para teclado e leitores de tela;
- acao de exportar imagem com ocultacao opcional de nomes.

#### F. Relatorios

- abas `Hoje`, `Semana`, `Mes`, `Ano`;
- numeros com fonte e periodo;
- resumo "O que mudou";
- recomendacoes acionaveis;
- confianca/qualidade dos dados;
- Wrapped e Case como produtos derivados, nunca como o relatorio principal.

### Sistema visual

Manter o DNA atual:

- laranja `#FF9F1C` apenas para foco, acao primaria e identidade;
- superficies escuras `#111111` e `#2B2B2B`;
- verde para sucesso, amarelo para atencao, vermelho para bloqueio e azul para fidelidade;
- Plus Jakarta Sans para UI, Space Grotesk para destaques e JetBrains Mono para valores, IDs e horarios;
- cantos entre 12 e 24 px, borda sutil e sombra curta;
- animacao apenas para mudanca de estado, chegada de evento e feedback de execucao.

Nao usar a cor do Mood Ring como unico sinal. Sempre acompanhar com texto ou icone.

### Padrao visual das automacoes

Toda acao de bot usa o mesmo componente:

- nome e avatar do bot;
- estado;
- motivo em uma frase;
- fonte dos sinais;
- acao proposta ou executada;
- horario;
- `Aprovar`, `Editar`, `Pausar` ou `Desfazer`, quando aplicavel.

## 7. Especificacao das 13 funcionalidades aprovadas

### 1. Assinatura Discreta nos Artefatos

**Experiencia:** selo pequeno "Feito com ORKTO" em proposta publica, PDF, card compartilhavel e e-mail. Nunca competir com a marca do cliente.

**Preparacao:** criar componente unico de assinatura, regra por plano/canal, tracking de impressao e configuracao de contraste.

**Aceite:** 100% dos artefatos elegiveis recebem assinatura; nenhuma sobreposicao em mobile/PDF; clique usa URL com campanha; plano que permite remocao respeita a regra comercial definida.

### 2. Orkto Wrapped

**Experiencia:** historia mensal em 5-7 telas: volume, velocidade, conversao, melhor categoria, destaque e proximo objetivo. Preview privado antes de compartilhar.

**Preparacao:** snapshots mensais imutaveis, comparadores setoriais somente com coorte suficiente, gerador de imagem e consentimento de compartilhamento.

**Aceite:** cada numero abre sua definicao; meses incompletos sao identificados; nenhum benchmark aparece com amostra insuficiente; exportacao funciona em formatos de status e feed.

### 3. Case de Sucesso Auto-Gerado

**Experiencia:** rascunho de uma pagina com periodo, antes/depois, metricas, narrativa, logo e CTA. Dono revisa e aprova.

**Preparacao:** definir baseline, janela de comparacao, regras de atribuicao, editor leve, historico de versoes e opt-in.

**Aceite:** somente dados verificaveis; fonte e periodo visiveis; publicacao nunca automatica; exportacao PDF/imagem/link acessivel.

### 4. Recuperacao de Orcamento Abandonado

**Experiencia:** timeline da sequencia, proximo contato, mensagem preparada e motivo de pausa. Cliente pode responder ou pedir parada.

**Preparacao:** maquina de estados, passos D+1/D+4/D+10/D+30/D+90 configuraveis, idempotencia, janelas de horario, opt-out, link de Orcamento Vivo e metricas por passo.

**Aceite:** resposta/aprovacao/recusa/opt-out interrompe a sequencia; nenhum envio duplicado; incentivo respeita limite; cada tentativa aparece no audit log.

### 5. Replay das Melhores Conversas

**Experiencia:** painel mostra objecao, variantes, amostra, conversao e estrategia recomendada. Mudanca passa por aprovacao e pode ser revertida.

**Preparacao:** taxonomia de objecoes, atribuicao de resultado, normalizacao por segmento, tamanho minimo de amostra, versionamento de playbook e teste controlado.

**Aceite:** nenhuma estrategia vence com amostra abaixo do limite; resultado controla vies de canal/periodo; rollout gradual; rollback em um clique.

### 7. Score de Risco de Calote

**Experiencia:** faixa de risco, sinais observados e recomendacao. Nunca mostrar acusacao ao cliente e nunca bloquear sozinho.

**Preparacao:** sinais permitidos, pesos versionados, calibracao, fila humana, captura de falso positivo/negativo e monitoramento de grupos.

**Aceite:** score explicavel; decisao humana registrada; nenhum atributo sensivel como proxy; limiar configuravel; metricas de precisao e impacto disponiveis.

### 8. Central de Cobranca - Collection Analyst

**Experiencia:** area separada da venda, segundo canal/persona, kanban, regua de postura, meta e checklist compartilhado.

**Preparacao:** contas de canal separadas, casos de cobranca, estados, promessas de pagamento, anexos, templates, horarios, escalonamento e conciliacao.

**Aceite:** pagamento encerra contatos; promessa suspende regua ate a data; caso sensivel escala; tom e frequencia respeitam configuracao; vendedor principal ve progresso sem assumir a persona.

### 10. Triagem por Prioridade Real

**Experiencia:** inbox ordenado por score com explicacao `Alto valor`, `Urgente`, `Sem resposta ha 2h`, `Cliente recorrente`. Reordenacao manual sempre disponivel.

**Preparacao:** sinais normalizados, pesos por workspace, feedback de reordenacao e protecao contra envelhecimento infinito.

**Aceite:** ordenacao deterministica e reproduzivel; motivo visivel; conversa nunca some; SLA e espera entram no score; ajuste manual alimenta calibracao sem alterar pesos imediatamente.

### 11. Central de Relatorios Automaticos

**Experiencia:** tres niveis: operacional diario, tatico semanal e estrategico mensal/anual. Cada insight termina com uma acao.

**Preparacao:** metricas canonicas, jobs idempotentes, snapshots, deteccao de anomalia, qualidade dos dados e Report Analyst.

**Aceite:** numeros reconciliam com dados brutos; relatorio identifica periodo e ultima atualizacao; recomendacao distingue fato de inferencia; falha de job gera alerta.

### 12. Orkto Swarm - Mixture of Experts

**Experiencia:** usuario ve "Hermes acionou Recovery Bot" e pode abrir o motivo; nao precisa compreender a arquitetura interna.

**Preparacao:** registro de capacidades, contrato de bot, roteador, fallback, timeout, orcamento de custo, traces, avaliacao offline e politica de ferramentas.

**Aceite:** apenas especialistas necessarios executam; timeout nao duplica acao; fallback transfere para humano; toda execucao tem trace e custo; ferramentas sao autorizadas no servidor.

### 13. Mood Rings

**Experiencia:** anel verde, amarelo, vermelho ou azul com label textual e explicacao ao passar/clicar.

**Preparacao:** definir estados observaveis sem afirmar emocao; combinar latencia, palavras, leitura, historico e resultado; registrar confianca e mudancas.

**Aceite:** cor sempre possui texto; baixa confianca aparece como neutro; usuario pode corrigir; atualizacao em tempo real; cor nao dispara acao sensivel sozinha.

### 14. Orkto Browser - Graph

**Experiencia:** grafo de clientes com clusters, preview leve e expansao para historico. Alternativa em lista para acessibilidade e telas pequenas.

**Preparacao:** modelo de arestas, embeddings/atributos permitidos, layout persistido, filtros, virtualizacao e exportacao segura.

**Aceite:** 1.000 nos continuam navegaveis no alvo definido; clusters explicaveis; nenhum dado sensivel aparece na exportacao padrao; teclado e lista alternativa funcionam.

### 15. Anotacao em Tempo Real - Sussurro

**Experiencia:** faixa privada acima do compositor, com autor, expiracao e confirmacao de leitura. Cliente nunca recebe o conteudo.

**Preparacao:** papeis de equipe, canal Realtime privado, mensagens efemeras/auditaveis, notificacao, expiracao e sugestoes automaticas separadas das humanas.

**Aceite:** somente membros autorizados veem; payload nunca entra na mensagem ao cliente; leitura confirmada; expiracao funciona; desconexao/reconexao nao vaza instrucao antiga.

## 8. Configuracoes internas e infraestrutura silenciosa

### Auditoria de Preco

- regras versionadas de tabela, desconto, margem e validade;
- validacao no servidor antes do envio;
- mensagem de bloqueio explica campo e regra;
- excecao exige permissao e justificativa.

### Extracao para Contabilidade/CRM

- adaptadores por provedor;
- outbox e retries;
- mapeamento configuravel;
- reconciliacao e tela de erros;
- nenhum segredo de integracao no navegador.

### Dial de Confianca

- configuracao por bot e capacidade;
- limites comerciais explicitos;
- historico de alteracao;
- pausa global e rollback.

### Orcamento Vivo

- slug opaco, expiracao e revogacao;
- tracking de eventos, nao apenas `viewed_at`;
- preco atualizado com registro de versao;
- cliente ve quando e por que o valor mudou.

### Grande Transfusao

- importacao assistida, nao acesso irrestrito;
- preview, consentimento, deduplicacao e possibilidade de desfazer;
- processamento em lotes;
- retencao e descarte do arquivo original definidos antes do piloto.

### Regua de Ansiedade

- renomear na UI para **Sinais de Urgencia**, evitando diagnostico emocional;
- sinais, pesos, confianca e explicacao;
- uso somente como apoio a priorizacao, Mood Ring e risco.

### Acabamento do Agente

- espelho de tom limitado pela marca;
- rascunho antecipado somente interno;
- correcao com transparencia na trilha de auditoria;
- pre-carregamento de objecao sem envio automatico prematuro.

### Memoria Comercial Coletiva

- compartilhar apenas padroes agregados;
- nunca expor mensagem, identidade ou estatistica de empresa individual;
- coorte minima e revisao de privacidade;
- opt-out por workspace;
- versao e origem de cada recomendacao.

## 9. Modelo de dados proposto

Tabelas novas, todas com `workspace_id`, timestamps, indices e RLS:

- `workspaces`, `workspace_members`, `roles`, `permissions`;
- `channel_accounts`, `channel_webhook_events`, `channel_delivery_events`;
- `contacts`, `contact_identities`, `contact_consents`;
- `conversations`, `conversation_participants`, `messages`, `message_attachments`;
- `conversation_signals`, `priority_scores`, `mood_states`, `risk_scores`;
- `agent_definitions`, `agent_configs`, `agent_runs`, `agent_actions`, `agent_feedback`;
- `playbooks`, `playbook_versions`, `playbook_experiments`;
- `approval_tasks`, `action_outbox`, `dead_letter_events`, `audit_log`;
- `followup_sequences`, `followup_enrollments`, `followup_attempts`;
- `collection_cases`, `collection_events`, `payment_promises`;
- `metric_definitions`, `metric_snapshots`, `generated_reports`;
- `wrapped_snapshots`, `success_cases`, `share_artifacts`;
- `customer_graph_edges`, `cluster_snapshots`;
- `integration_connections`, `integration_sync_runs`.

Alteracoes nas tabelas existentes:

- `quotes`: `workspace_id`, `current_version`, `source_conversation_id` e eventos detalhados;
- `clients`: migrar para `contacts` ou manter como view de compatibilidade;
- `profiles`: separar usuario, workspace e configuracao de empresa;
- `proposals`: adicionar versao do preco, origem e eventos de abertura.

## 10. Seguranca, privacidade e governanca

- RLS de propriedade por workspace, incluindo `USING` e `WITH CHECK` para update.
- Realtime privado com autorizacao por membro do workspace.
- Service/secret key somente no servidor.
- Migrar chaves legadas para o modelo atual de publishable/secret keys durante a fundacao.
- Segredos de WhatsApp, CRM e contabilidade em cofre/variaveis de servidor.
- Assinatura e idempotencia em todo webhook.
- Criptografia e expiracao para anexos.
- Exportacao e exclusao de dados por workspace/contato.
- Audit log append-only para acoes de bots e humanos.
- Politica explicita de retencao de mensagens, anexos e traces.
- Revisao juridica antes de cobranca agressiva, importacao de historico e memoria coletiva.

## 11. Site publico e comunicacao

### Novo posicionamento

**Seu WhatsApp nao precisa de mais uma IA ao lado. Ele precisa de uma IA operando o atendimento.**

**ORKTO: Atendimento que entende. Inteligencia que decide. Operacao que acontece.**

Promessa complementar: **Da primeira mensagem ao fechamento - e depois dele.**

Evitar vender "IA que faz tudo", uma sidebar, um chatbot ou um gerador de respostas. Vender reducao da dependencia operacional do dono, velocidade, consistencia, recuperacao de receita e controle humano. Hermes Agent permanece como tecnologia interna; o cliente compra e reconhece a ORKTO.

### Estrutura da home

1. Hero com resultado e CTA.
2. Demonstracao curta: mensagem -> ORKTO entende -> especialista atua -> operacao avanca.
3. Secao "A conversa entra. A ORKTO entende o que precisa acontecer".
4. Secao ORKTO Swarm e especialistas, explicada por resultados e nao por tecnologia.
5. Fluxo completo da venda a cobranca.
6. Prova de controle humano e seguranca.
7. Funcionalidades agrupadas em Crescimento, Operacao e Inteligencia.
8. Wrapped/cases como prova compartilhavel.
9. Planos com limites de canais, bots, usuarios e automacoes.
10. FAQ e CTA final.

### Paginas recomendadas

- `/produto/como-a-orkto-opera`
- `/produto/orkto-swarm`
- `/produto/conversas`
- `/produto/recuperacao-de-orcamentos`
- `/produto/cobrancas`
- `/produto/relatorios`
- `/produto/clientes`
- `/integracoes/whatsapp`
- `/seguranca-e-controle`
- `/demo`

### Regra de comunicacao por disponibilidade

- **Disponivel:** linguagem no presente e CTA de uso.
- **Beta:** selo beta, limites e formulario de interesse.
- **Em breve:** explicacao sem promessa de data.
- **Conceito:** nao entra na navegacao comercial.

Nenhuma funcionalidade do PDF deve ser publicada como disponivel antes de passar pelo criterio de aceite e pelo rollout correspondente.

## 12. Plano de entrega

Estimativa para uma equipe de 5-7 pessoas: **20 a 28 semanas**, com liberacoes parciais desde a fase 1.

### Fase 0 - Descoberta e contratos (1-2 semanas)

- inventario Hermes/bots;
- mapa do WhatsApp/Evolution;
- contratos de eventos e ferramentas;
- definicoes de metricas;
- arquitetura de tenancy/workspaces;
- wireflows das telas essenciais;
- feature flags e plano de observabilidade.

**Gate:** simulador recebe mensagem, Hermes escolhe bot ficticio e nenhuma acao externa e executada.

### Fase 1 - Fundacao operacional (4-5 semanas)

- workspaces, membros e papeis;
- canal WhatsApp e ingestao de mensagens;
- inbox e linha do tempo unica;
- filas, outbox, retries e audit log;
- HermesAdapter e Policy Engine;
- Central de Bots e Dial de Confianca;
- Orcamento Vivo v2 e Auditoria de Preco.

**Gate:** conversa real entra, aparece na inbox e gera sugestao segura em modo observacao.

### Fase 2 - Receita e risco (4-5 semanas)

- Triagem por Prioridade Real;
- Recuperacao de Orcamento Abandonado;
- Collection Analyst;
- Score de Risco com revisao humana;
- conciliacao e conectores iniciais.

**Gate:** piloto interno sem duplicidade, opt-out validado e rollback testado.

### Fase 3 - Inteligencia comercial (4-5 semanas)

- Replay das Melhores Conversas;
- Relatorios automaticos;
- Sinais de Urgencia;
- Mood Rings;
- experimentos de playbook.

**Gate:** metricas reconciliadas e estrategia so muda com amostra/controle definidos.

### Fase 4 - Crescimento compartilhavel (3-4 semanas)

- Assinatura Discreta;
- Orkto Wrapped;
- Case de Sucesso Auto-Gerado;
- paginas publicas correspondentes.

**Gate:** todo numero tem fonte, compartilhamento e opt-in.

### Fase 5 - Colaboracao e visualizacao (4-5 semanas)

- Sussurro;
- Orkto Browser/Graph;
- Memoria Comercial Coletiva agregada;
- refinamento de acessibilidade e performance.

**Gate:** autorizacao Realtime validada, teste de vazamento entre tenants aprovado e grafo performatico.

### Fase 6 - Lancamento e escala (2 semanas)

- site, onboarding e pricing;
- migracao gradual de clientes;
- runbooks, alertas e suporte;
- rollout 5% -> 25% -> 50% -> 100%;
- revisao de custos, latencia e capacidade.

## 13. Estrategia de testes

### Piramide

- **Unitarios:** scores, regras, maquinas de estado, limites e formatacao.
- **Contrato:** Hermes, cada bot, WhatsApp, Asaas, CRM e contabilidade.
- **Integracao:** webhook -> fila -> agente -> policy -> outbox -> evento de entrega.
- **E2E:** venda, recuperacao, aprovacao, cobranca, relatorio e opt-out.
- **Seguranca:** RLS, isolamento de tenant, webhook replay, autorizacao Realtime e secrets.
- **Avaliacao de agentes:** conjunto fixo de conversas, respostas esperadas, tool calls permitidas e casos adversariais.
- **Carga:** rajadas de webhook, 1.000 nos no grafo e relatorios simultaneos.
- **UX/acessibilidade:** teclado, leitor de tela, mobile, estados vazios, erro, atraso e reconexao.

### Casos obrigatorios

- webhook duplicado nao duplica mensagem nem envio;
- cliente responde durante um follow-up agendado;
- pagamento chega durante tentativa de cobranca;
- Hermes fica indisponivel;
- bot excede timeout;
- humano edita ou cancela sugestao;
- usuario perde permissao durante canal Realtime;
- dois operadores atuam na mesma conversa;
- proposta muda de preco apos abertura;
- opt-out e recebido em linguagem livre;
- relatorio roda com dados incompletos;
- workspace A nunca observa dados do workspace B.

## 14. Metricas de sucesso

### Produto

- tempo ate primeira resposta;
- conversao por etapa;
- recuperacao de propostas;
- valor recuperado em cobranca;
- horas administrativas evitadas;
- taxa de intervencao humana;
- taxa de sugestao aceita/editada/recusada;
- opt-out, bloqueio e reclamacao;
- falso positivo de risco;
- precisao/estabilidade de prioridade.

### Plataforma

- latencia de webhook ate UI;
- latencia de Hermes e bots;
- custo por conversa e por venda;
- retries e dead letters;
- duplicidade de envio;
- falha de job;
- conexoes Realtime e join rate;
- incidentes de autorizacao ou isolamento.

## 15. Definition of Ready e Definition of Done

### Ready

- problema e publico definidos;
- evento de entrada e resultado esperado definidos;
- politica de autonomia definida;
- telas e estados mapeados;
- schema e RLS revisados;
- metricas e experimento definidos;
- fallback humano definido;
- textos do site classificados como Disponivel/Beta/Em breve.

### Done

- criterios de aceite automatizados quando possivel;
- testes unitarios, integracao e E2E aprovados;
- RLS e isolamento validados;
- logs, metricas e alertas ativos;
- UX responsiva e acessivel;
- documentacao e runbook atualizados;
- feature flag e rollback testados;
- copy do site corresponde ao estado real;
- piloto medido antes da liberacao geral.

## 16. Decisoes que precisam ser tomadas antes da Fase 1

1. Os quatro perfis locais atuais serao apenas referencia de desenvolvimento ou algum deles sera promovido? Qual modelo, provedor, perfil e modo de execucao serao usados em homologacao e producao?
2. Quais bots ja existem e quais ferramentas cada um possui?
3. Evolution API continua sendo o adaptador oficial do WhatsApp?
4. A cobranca usa um segundo numero por empresa ou um canal central?
5. Qual modelo de equipe e permissoes sera vendido por plano?
6. Qual dado pode participar da Memoria Comercial Coletiva?
7. Quais limites de autonomia e desconto valem por plano?
8. Qual janela de retencao vale para mensagens, anexos e traces?
9. Quais funcionalidades entram primeiro em beta fechado?
10. Qual equipe e capacidade real definem o cronograma final?

## 17. Ordem recomendada de prioridade

1. WhatsApp + eventos + inbox + audit log.
2. HermesAdapter + Policy Engine + Central de Bots.
3. Triagem, Orcamento Vivo e Recuperacao.
4. Collection Analyst e Auditoria de Preco.
5. Relatorios e Replay.
6. Mood Rings e Sussurro.
7. Assinatura, Wrapped e Cases.
8. Graph e Memoria Coletiva.

Essa ordem entrega valor operacional cedo e evita construir telas inteligentes sobre uma base de conversas que ainda nao existe.

## Referencias tecnicas

- Supabase Realtime: https://supabase.com/docs/guides/realtime
- Autorizacao Realtime: https://supabase.com/docs/guides/realtime/authorization
- Supabase Cron: https://supabase.com/docs/guides/cron
- Supabase Queues: https://supabase.com/docs/guides/queues
- Changelog Supabase: https://supabase.com/changelog?types=breaking-change
