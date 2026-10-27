# Referência vigente do produto: funcionalidades consolidadas

## Correção de fonte pelo proprietário

Em27/10/2026, o proprietário identificou **ORKTO: Funcionalidades Consolidadas — Documento de Referência v1.0** como a fonte pretendida para as funcionalidades do produto. O planejador financeiro não é sua substituição. Esta referência prevalece para a comparação de escopo comercial; os relatórios financeiros anteriores são preservados como trabalho administrativo separado.

Arquivo original lido integralmente: `C:/Users/sobooa7iqytvqheo/Downloads/ORKTO_ Funcionalidades Consolidadas.pdf`.

-10páginas,134330bytes.
-SHA256: `2c6fafdbfb1ee44ffb1697b0ae5eecae66b9db2a10e87c54253dfd766b6ba0c4`.
-Extração de todas as páginas e renderização de10/10 páginas realizadas. O arquivo original não foi alterado nem incluído no bundle do cliente.
-15funcionalidades numeradas:13 APROVADAS no documento e2 PENDENTES. Mais3configurações internas e5blocos de infraestrutura, um deles contendo4comportamentos de acabamento.

**APROVADA no PDF é classificação de produto, não PASS técnico, validação de eficácia ou autorização de operação externa.** A matriz abaixo é comparação inicial por leitura do código em `d57cff0`, sem novos testes remotos. PARTIAL não promete funcionamento completo.

## Funcionalidades numeradas

| ID | Funcionalidade / páginas | Status da fonte | Código existente inspecionado | Lacuna a validar ou implementar |
|---|---|---|---|---|
|F01|Assinatura discreta nos artefatos transacionais /1|APROVADA|Componentes QuoteDetail/LiveQuoteView, marca compartilhada|Cobertura uniforme de símbolo+wordmark em orçamento, cartão e vitrine; render/export e direitos de marca não auditados nesta comparação|
|F02|ORKTO Wrapped /2|APROVADA|`/api/wrapped/*`, WrappedPublicView, full-operational|Recap e compartilhamento existentes são parciais; benchmark setorial não deve ser inventado. Homologar métricas/período/consentimento e export|
|F03|Case de sucesso autogerado /2|APROVADA|`/api/case-studies/*`, geração, revisão e opt-in|Comprovar antes/depois após30dias, amostra, consentimento, anonimização e apresentação; geração local não prova resultado comercial|
|F04|Recuperação de orçamento abandonado /2–3|APROVADA|Playbook proposal_recovery, recovery scheduler, engine full-operational|D+1/4/10/30/90 existe como base; envio autônomo, templates, consentimento e eficácia permanecem abertos. Reaproveitar gateway; não ativar contatos ilimitados|
|F05|Replay das melhores conversas /3|APROVADA|`/api/replay/*`, aggregateReplay/identifyReplayCandidate|Padrão observado não é causalidade; propagação automática de pesos e eficácia não comprovadas. Separar recomendação de alteração ativa de estratégia|
|F06|Reativação por ciclo de recompra /3–4|PENDENTE, precisão|estimateRepurchaseWindow, repurchase-scheduler, rotas de automação|Preservar pendência; medir timing/opt-out/engajamento com dados consentidos, sem prior populacional inventado ou envio automático|
|F07|Score de risco de calote /4|APROVADA|assessOperationalRisk e `/api/customers/:customerRef/risk/assess`|Engine atual é risco operacional explicável, não modelo validado de inadimplência. Manter revisão humana e não bloquear crédito/venda autonomamente|
|F08|Central de cobrança Collection Analyst /4–5|APROVADA|CollectionPage, `/api/collections/*`, preparação de contato|Fila/estados existem; segundo número, negociação, meta e envio real não homologados. Tom atual cordial/standard/firm não foi trocado por agressividade|
|F09|Detecção de cliente fantasma /5|PENDENTE, precisão>90%|compareCustomers/classifyImportDuplicates e revisão de duplicatas|Não há prova>90%; não habilitar merge automático por nome/CEP. Preservar histórico e decisão humana até validação específica|
|F10|Triagem por prioridade real /6|APROVADA|rankConversation, sinais, override manual, Central de Conversas|Ranking determinístico existe; calibração/aprendizado de pesos por negócio não comprovados. Integração oficial Meta prevalece sobre menção legada Evolution|
|F11|Central de relatórios automáticos /6–7|APROVADA|`/api/reports/*`, AnalyticsPage, tipos diário/semanal/mensal/anual|Agendamento, estoque, baselines e síntese real dependem de fontes/configuração. Não pressupor n8n nem pagar inferência para cumprir diagrama legado|
|F12|ORKTO Swarm — Mixture-of-Experts /7|APROVADA|routeSwarmAgent, WIA/WIAOS, PREPARE_WIA_REQUEST e Mutation Gateway|Roteamento por especialista não significa treinamento MoE ou ganho medido de precisão. Reutilizar orquestração e governança; inferência real permanece gated|
|F13|Mood Rings /7|APROVADA|deriveMoodRing, sinais e apresentação de conversas|Estados são sinais operacionais, não diagnóstico emocional; conferir anel/pulso, acessibilidade e atualização baseada em dados reais|
|F14|ORKTO Browser (Graph) /7–8|APROVADA|GraphPage, commercial-graph, `/api/graph`|Grafo não comprova clustering autônomo, canvas infinito ou export seguro. Verificar preview→conversa e ocultação de dados na imagem compartilhada|
|F15|Anotação em tempo real (Sussurro) /8|APROVADA|Sussurros privados, rotas por conversa, audiência/expiração/leitura|Entrega atual inclui polling; não anunciar realtime estrito. Conferir ocultação após leitura e sugestão automática governada. Nunca enviar instrução privada ao cliente|

## Configuração interna e infraestrutura

Os itens abaixo não viram ofertas ou módulos comerciais independentes apenas por constarem da especificação.

| ID | Fonte | Correspondência / limite |
|---|---|---|
|I01|Auditoria de preço em tempo real /8–9|auditProposalPrice e caminhos de publicação; comprovar aplicação obrigatória da tabela/limites antes de qualquer orçamento externo, sem bypass|
|I02|Extração automática para contabilidade /9|accounting-adapter e `/api/accounting/exports/from-quote/:quoteId`; adaptador local não comprova integração externa/receipt. Sem export real não autorizado|
|I03|Dial de confiança /9|Trust/governança WIAOS e parâmetros existentes; autonomia não pode dispensar gates ou aprovação comercial de descontos|
|S01|Orçamento Vivo /9|LiveQuoteView e publicação comandada; retenção e atualização controladas. Não prometer link eterno/preço alterado silenciosamente contra contratos vigentes|
|S02|A Grande Transfusão /9|Importação CSV/histórico existente não equivale a acesso a2anos de WhatsApp. Disponibilidade depende de fornecedor, exportação autorizada e consentimento; não inventar API de histórico nem ler conversa pessoal|
|S03|Régua de Ansiedade /9|scoreOperationalAnxiety e sinais; não diagnóstico. Read receipts, áudio e sinais não disponíveis devem permanecer ausentes, nunca imputados como observação|
|S04|Acabamento do agente /9–10|Pipeline de resposta e tom, correção e preparação; registrar separadamente espelho de tom, rascunho fantasma, correção silenciosa e pré-carregamento de objeção. Texto digitado/apagado no WhatsApp do cliente não é observável por suposição; correções mantêm auditoria|
|S05|Memória comercial coletiva /10|Rotas collective-memory, consentimento/retração e agregação; isolamento, coorte mínima e anonimização precisam de evidências. Não compartilhar texto bruto ou dados identificáveis entre empresas|

## Regras de interpretação e conflitos

1. Os percentuais de conversão, redução de perda e impressões no PDF são cenários/argumentos do documento. Não são resultados da ORKTO nem benchmarks revalidados. Não serão usados como promessa pública sem fonte, amostra e medição.
2. PENDENTE continua pendente para F06/F09 até a prova de precisão pedida na própria fonte. Código determinístico e testes de fixture não fecham essa prova.
3. Meta Cloud API oficial, HMAC, Vault, tenant, WIAOS e Mutation Gateway preservados. A menção histórica a Evolution API não autoriza WhatsApp Web nem troca do fornecedor.
4. Aprovação de escopo do documento não libera envio real, desconto, cobrança, contratação, inferência paga ou acesso a dados pessoais. As autorizações operacionais anteriores permanecem.
5. Automação deve respeitar consentimento, opt-out, janela, limites de custo e controles. Não implementar a expressão “nunca desistir” como contatos sem limite ou contra regras do canal.
6. Não criar novas permissões/usuários, não mesclar identidades, não habilitar aprendizagem entre tenants nem expor dados do fundador por ler esta fonte.
7. O inventário anterior de40requisitos do planejador permanece histórico administrativo. Ele não deve aparecer como contagem de implementação destas15funcionalidades. Esta matriz não reclassifica nenhuma delas como concluída remotamente.

## Próxima execução

Prioridade operacional continua WhatsApp oficial: concluir configuração/rodada autorizada e evidências reais antes de anunciar operação. Em paralelo, usar F01–F15/I01–I03/S01–S05 como backlog rastreável de produto, fechando requisitos por evidência e reutilizando o código existente. Não abrir novamente o site de planejamento financeiro para definir essas funcionalidades.

**READY_FOR_PRODUCTION_CANDIDATE=NO.** Esta rodada corrige a fonte e a rastreabilidade; não altera código executável, dados, produção, PR#2 ou implantação.
