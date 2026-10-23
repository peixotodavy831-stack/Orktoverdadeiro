# ORKTO Launch 2027 — plano financeiro mestre

**Consulta:** 22/10/2026  
**Estado do produto:** `READY_FOR_PRODUCTION_CANDIDATE=NO`  
**Natureza dos números:** preços públicos conferidos, cenários ilustrativos e custos ainda não verificáveis estão marcados separadamente.

## Respostas executivas

| Pergunta | Resposta nesta data |
|---|---|
| Quanto custa começar? | O piso público conhecido para um ambiente é **US$45/mês (R$226,72)** em Vercel Pro + Supabase Pro. Isso não é custo total de lançamento: domínio, suporte, contabilidade, WhatsApp, tributos, IA real e custos de conta ainda faltam. |
| Quanto reservar para o primeiro mês? | **US$54 (R$272,07)** para o cenário ultr econômico após 20% de margem sobre o subtotal de software conhecido. A margem não cobre os itens sem preço. |
| Qual o menor caixa inicial prudente? | Três meses do piso conhecido mais 20%: **US$162 (R$816,20)**. É um piso parcial, sem itens desconhecidos nem remuneração. |
| Quantas contas para equilíbrio? | Com o mix ilustrativo atual, taxa Pix pública de R$1,99, hipótese fiscal de 6%, IA ilustrativa de R$3,15 por conta e apenas R$226,72 de custo fixo conhecido, o ponto de equilíbrio matemático é **2 empresas**. Para também separar 40% da receita bruta para reserva, o cenário precisa de **4 empresas**. Custos reais desconhecidos elevam ambos os números. |
| Pode entrar receita no primeiro mês? | Durante preparação, cobrança continua bloqueada. No primeiro mês depois de autorização, é possível captar assinantes; dois planos Start renderiam R$159,80 de MRR bruto, mas deixariam resultado estimado de **−R$86,79** nas hipóteses indicadas. Receita não é garantida. |
| Qual plano tem melhor margem? | Scale tem maior contribuição absoluta no modelo de custos fixos por conta. A escolha comercial de melhor valor segue **indeterminada** porque limites, Pulso, suporte, canal e custo de uso não foram homologados. |
| Como adquirir clientes? | Validar um único público inicial: empresas de serviços que emitem orçamentos e fazem acompanhamento pelo WhatsApp. Começar com entrevistas consentidas, demonstrações e indicação; ainda não há prova de demanda da ORKTO. |
| Internacionalizar agora? | Não vender fora do Brasil no primeiro lançamento. Preparar formatos e estudar Portugal sem ativar pagamento ou operação estrangeira. |
| Mercado externo para estudar primeiro? | Portugal é o menor salto de idioma, mas demanda, preço, meios de recebimento, IVA e suporte ainda precisam de validação. É hipótese de descoberta, não decisão de expansão. |
| Remuneração do fundador? | Definir pró-labore bruto só após validação societária, tributária e contábil. Receita empresarial não é saldo pessoal; não transferir valores com base neste plano. |

## Estado que limita o lançamento

Esta branch isolada integra trabalho de engenharia; a PR #2 segue como trilha de homologação. Na última leitura remota registrada, a PR #2 estava aberta e em rascunho, G01–G12 e Asaas B01–B13 continuavam sem validação remota, e cobranças, flags e mensagens externas permaneciam desligadas. Esta missão não alterou PR, ambiente publicado, credenciais ou configuração de billing.

`PASS_LOCAL` cobre somente os testes e a checagem de tipos executados nesta branch. Isso não converte qualquer gate externo em `PASS_REMOTE`, não confirma contrato com fornecedores e não autoriza cobrança.

## Base de preços e câmbio

O catálogo comercial verificado no código preserva Start R$79,90, Pro R$149,90, Business R$299,90, Scale R$599,90 e Enterprise sob consulta. Esses valores não incluem limites ou recursos ainda pendentes de aprovação.

Para converter os preços de provedores, foi usada a PTAX de venda do Banco Central consultada em 22/10/2026: **US$1 = R$5,0383**. É referência de comparação; faturamento, cartão, IOF e variação cambial podem produzir outro valor. [Consulta PTAX do BCB](https://ptax.bcb.gov.br/ptax_internet/consultarUltimaCotacaoDolar.do)

## Custo mínimo conhecido

| Linha | Preço público | Condição relevante | Tratamento no modelo |
|---|---:|---|---|
| Vercel Pro | US$20/mês | Inclui um assento e crédito de uso mensal de US$20; uso excedente depende do consumo e dos limites da conta. | Fixo conhecido de um workspace pago; consumo excedente ainda não medido. |
| Supabase Pro | US$25/mês | Inclui crédito de computação de US$10 e um projeto Micro. O segundo projeto pago começa em US$10/mês no mesmo grupo de faturamento, sujeito a computação/uso. | Fixo conhecido de um projeto; segundo ambiente é hipótese separada. |
| Resend Free | US$0/mês | Até 3 mil e-mails/mês, limite diário e retenção conforme plano publicado. | Opção do cenário A/B, adequada apenas ao volume dentro do limite. |
| Resend Pro | US$20/mês | 50 mil e-mails incluídos; excedente publicado por mil mensagens. | Adicionado apenas ao cenário C. |

Fontes oficiais: [Vercel Pro](https://vercel.com/docs/plans/pro-plan), [Supabase](https://supabase.com/pricing) e [Resend](https://resend.com/pricing). Os valores são preços públicos; nenhum contrato ou conta de faturamento foi inspecionado.

### Itens que impedem um total all-in

- Domínio e renovação DNS: o site usa `orkto.co` no endereço de contato, mas titularidade, registrador, renovação e preço não foram verificados.
- WhatsApp: a política oficial exige templates aprovados para iniciar conversas e define condições para respostas. A página pública de preço da Meta respondeu com bloqueio HTTP 429 durante a consulta; o rate card aplicável, a moeda da WABA, a cobrança vigente desde outubro de 2026 e eventual taxa do BSP estão **NOT_VERIFIED**. Não assumir mensagens gratuitas. [Política oficial](https://business.whatsapp.com/policy/preview?lang=pt_BR) · [preços oficiais](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing)
- Asaas: preço público padrão consultado de R$1,99 por Pix recebido e cartão de R$0,49 + 2,99% por recebimento. Promoções não foram usadas. O contrato da conta, chargebacks, antecipação, estornos, calendário de liquidação e custo internacional não foram verificados. [Tabela oficial](https://www.asaas.com/precos-e-taxas)
- IA: preços por token existem, mas volume por tarefa e custo por Pulso não foram medidos. O Pulso não foi convertido em token. Nenhuma inferência paga foi executada nesta pesquisa.
- Monitoramento, ferramenta de suporte, contabilidade, segurança contratada, implantação, atendimento, impostos e horas do fundador: sem valor confirmado nesta rodada.

## Primeiro mês e capital de giro

As três composições completas e seus itens excluídos estão em [ORKTO_FIRST_MONTH_BUDGET_2027.md](ORKTO_FIRST_MONTH_BUDGET_2027.md). O resumo é:

| Cenário | Software público conhecido por mês | Margem sobre subtotal | Primeiro mês conhecido | Reserva de 3 meses conhecida |
|---|---:|---:|---:|---:|
| A — demonstração ultr econômica | US$45 / R$226,72 | 20% | **US$54 / R$272,07** | **US$162 / R$816,20** |
| B — piloto profissional enxuto | US$55 / R$277,11 | 20% | **US$66 / R$332,53** | **US$198 / R$997,58** |
| C — operação comercial inicial | US$75 / R$377,87 | 20% | **US$90 / R$453,45** | **US$270 / R$1.360,34** |

Os valores são **subtotal público + margem**, não orçamento total de lançamento. Domínio, licenças já contratadas, implantação, equipe, contabilidade, tarifas variáveis e custo de aquisição permanecem separados ou desconhecidos. “Configuração inicial = US$0” não foi assumido: não há preço público único para trabalho de implantação.

## Economia unitária e tributos

O mix de referência editável é 60% Start, 25% Pro, 10% Business e 5% Scale. Isso produz ARPA modelado de R$145,40. O modelo inclui R$1,99 de taxa Pix por conta e R$3,15 de IA ilustrativa por conta/mês, além da infraestrutura fixa conhecida de R$226,72/mês. Canais e demais despesas aparecem como pendências, nunca como custo confirmado de zero.

As alíquotas de 6% e 15,5% representam somente cenários iniciais dos Anexos III e V do Simples Nacional na primeira faixa legal. A atividade, CNAE, receita acumulada, fator R, regime e efeitos da reforma precisam de contador. Não são alíquotas atribuídas à ORKTO. [LC 123/2006, texto oficial](https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp123.htm)

Com os custos de hipótese, contribuição por conta do mix é R$131,54 (taxa fiscal 6%) ou R$117,72 (15,5%). O equilíbrio de custos conhecidos fica em 2 contas nos dois casos. A reserva de 40% da receita bruta é uma meta administrativa preservada: no mix atual, três contas não cobrem custo conhecido e 40% de retenção; quatro cobrem dentro das hipóteses. Nenhum desses números inclui WhatsApp, domínio, suporte, operação não precificada, custo real de tokens, churn ou atraso de recebimento.

## Recomendação de aquisição

Posicionamento de trabalho: **ORKTO — Da conversa à execução comercial.** Começar com prestadores de serviços que enviam orçamentos e perdem continuidade no acompanhamento. A prioridade é uma hipótese de produto: o fluxo cliente → negócio → proposta está próximo da experiência existente. Não há tamanho de mercado ou taxa de conversão confirmada para a ORKTO. Sebrae descreve WhatsApp como canal útil de relacionamento, venda e acompanhamento, mas isso não mede disposição para pagar pelo produto. [Sebrae — estratégias de vendas com WhatsApp](https://meuatendimento.sebrae.com.br/sites/PortalSebrae/ufs/ba/artigos/venda-mais-com-o-whatsapp-estrategias-para-empresas-em-expansao,760f83b8a65a0910VgnVCM1000001b00320aRCRD)

Os cenários de aquisição, texto de contato e calendário ficam em [ORKTO_GROWTH_MARKETING_2027.md](ORKTO_GROWTH_MARKETING_2027.md). No cenário moderado, 80 contatos individualizados → 8 demonstrações → 2 novos planos Start é matemática declarada, não benchmark nem previsão. MRR bruto seria R$159,80, abaixo do piso público de infraestrutura antes de taxas, tributos e operação.

## Internacionalização

Brasil é o primeiro mercado comercial. Portugal fica como primeiro mercado de descoberta sem cobrança. Eurostat registra uso de CRM em 28,51% das empresas europeias em 2025, mas a amostra abrange empresas com 10 ou mais pessoas ocupadas; não mede o público brasileiro de microempresas. [Eurostat 2025 — e-business integration](https://ec.europa.eu/eurostat/statistics-explained/SEPDF/cache/22286.pdf)

A comparação entre Brasil, América Latina hispânica, Portugal, Espanha, EUA e opções asiáticas está em [ORKTO_INTERNATIONALIZATION_2027.md](ORKTO_INTERNATIONALIZATION_2027.md). Para a etapa futura, considerar LGPD e mecanismos válidos de transferência internacional, além de GDPR e IVA OSS onde aplicável. A análise não é parecer jurídico. [ANPD — transferência internacional](https://www.gov.br/anpd/pt-br/assuntos/assuntos-internacionais/transferencia-internacional-de-dados) · [Comissão Europeia — GDPR para empresas](https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/application-gdpr_en) · [Comissão Europeia — notas de IVA OSS](https://vat-one-stop-shop.ec.europa.eu/system/files/2021-07/vatecommerceexplanatory_notes_28102020_en.pdf)

## Remuneração do fundador

Separar caixa, aportes, despesas e valores a receber da empresa; salário bruto, tributos pessoais, reservas e investimentos pessoais ficam fora do ledger corporativo. A premissa de pró-labore no simulador afeta apenas o resultado projetado e não inicia pagamento. Distribuição de resultados requer lucro apurado e validação societária/contábil. Regras de capacidade e representação para eventual fundador menor devem ser validadas com profissional habilitado, sem presumir idade ou forma societária. [Planejamento do fundador](ORKTO_FOUNDER_FINANCES_2027.md) · [FAQ JUCEMAT — capacidade empresarial](https://www.jucemat.mt.gov.br/faqs/6)

## Priorização de melhorias

Critério aplicado: valor comercial, risco de criar expectativa ou dado falso, custo de manutenção, esforço e evidência disponível no produto/faturas/testes.

| Melhoria | Valor | Risco | Custo | Esforço | Evidência disponível | Decisão |
|---|---|---|---|---|---|---|
| Ampliar a Central Econômica existente para taxas, tributos hipotéticos, clientes atendidos, pró-labore e reserva | Alto | Médio, reduzido por rótulos de hipótese e separação do ledger | Baixo em fornecedor; médio em manutenção | Médio | Módulo existente, catálogo de planos e lacunas documentadas | Implementada como projeção local; sem efeito em cobrança/caixa real |
| Corrigir copy da landing e adicionar casos de uso/FAQ com disponibilidade condicionada | Alto | Baixo | Baixo | Baixo | Recursos verificáveis no repositório e estados de homologação conhecidos | Implementada sem declarar checkout, WIA ou mensagens como prontos |
| Adicionar formatos de número, data e moeda para pt-BR, en-US e es-419 | Médio | Baixo | Baixo | Baixo | Intl e necessidade de preparar uma base técnica; traduções integrais não revisadas | Implementada como fundação, sem traduzir jornadas inteiras |
| Ativar pagamentos, mensagens WhatsApp ou venda internacional | Alto potencial | Alto | Indeterminado | Alto | Preço Meta, contratos, impostos, suporte e gates externos ausentes | Adiada até confirmação contratual, jurídica e homologação |

## Melhorias implementadas nesta rodada

- A Central Econômica existente recebeu seleção de 0, 1, 5, 10, 25, 50, 100, 250, 500 e 1.000 empresas, mantendo separada a hipótese de clientes atendidos.
- Projeções passaram a mostrar taxa fixa/percentual de pagamento, tributo parametrizado, custo por atendimento, despesa operacional, pró-labore, resultado, caixa final estimado e diferença para a meta de reserva de 40%.
- A tela mostra economia unitária dos quatro planos com preço fixo; Enterprise continua sem preço projetado.
- A tela de planejamento pessoal calcula a reserva indicada no navegador e não grava despesas pessoais no ledger corporativo.
- Compatibilidade de premissas financeiras antigas recebe defaults de planejamento. Zero em campo de hipótese não se torna valor observado.
- Adicionada base de formatos para pt-BR, inglês e espanhol, sem alegar que toda a interface ou mensagens da WIA foram traduzidas.
- Landing page ganhou caso de uso, FAQ e descrição de WIA condicionada à homologação. Checkout continua sem cobrança; mensagens externas permanecem desativadas.
- A planilha formula as hipóteses de orçamento, preço, mix, tributo, taxa, IA, reserva e escala.

## Oportunidades de redução de custos

1. **Adiar Resend Pro:** manter o plano Free enquanto volume, limite diário, retenção e termos comerciais forem adequados. O preço público consultado cai de US$20 para US$0 por mês, economia potencial de US$20/mês; migrar antes de ultrapassar a cota ou afetar entrega de e-mail.
2. **Evitar consumo excedente sem telemetria:** definir alertas e revisar computação, armazenamento, egress, logs, backups e arquivos em Vercel/Supabase. A fatura real não foi consultada; não há redução observada a declarar.
3. **IA por tarefa:** preferir regras determinísticas quando cobrirem o caso, limitar contexto, output e retries e testar cache. A economia não pode ser quantificada sem ledger de tokens por workspace. Nenhuma chamada paga ou alteração de roteamento foi feita.
4. **Aquisição orgânica:** usar entrevistas, indicação, conteúdo útil e demonstrações autorizadas. Mídia paga fica fora do primeiro cenário; o CAC em caixa modelado pode ser zero, mas as horas do fundador têm custo e precisam ser registradas.
5. **Dimensionar ferramentas depois de medir:** não adicionar assentos, projetos, provedores ou planos premium antes de uma necessidade registrada. Manter staging se a validação exigir isolamento; não remover controle de segurança apenas para reduzir a mensalidade.

Essas opções não incluem retirar suporte, backup, segurança, obrigação fiscal ou capacidade necessária para a homologação. A economia depende de preço e conta reais, que continuam **NOT_VERIFIED**.

## Próxima tarefa prioritária

Antes de decidir preço, reserva ou abertura comercial, confirmar com contador a estrutura e o regime tributário, auditar faturas/contratos de infraestrutura e Asaas, obter o rate card Meta aplicável e cotar domínio, suporte e implantação. Em paralelo, o maior bloqueio técnico de lançamento segue sendo resolver associação ambígua de cliente/telefone no ingest Meta com mudança aditiva e replay PostgreSQL 17 descartável. Nenhuma cobrança, mensagem ou lançamento deve ocorrer até os gates correspondentes fecharem.

## Fontes e revisão

Os preços e leis acima foram consultados em 22/10/2026. Atualizar preço, rate card, câmbio e legislação antes de contratar ou vender. A pesquisa de mercado não encontrou dado oficial comparável de intenção de compra pelo segmento alvo no Brasil nem taxa de uso de WhatsApp por microempresa que sustentasse um TAM ou previsão de receita. Não foram criados clientes, depoimentos, faturas ou contratos fictícios.

## R2 — consolidação executiva em 23/10/2026

Entrega quantitativa vigente: ORKTO_FIRST_MONTH_BUDGET_2027.md, ORKTO_UNIT_ECONOMICS_2027.md e evidence/launch-r2/ORKTO_LAUNCH_R2_BUDGET_2027.xlsx. Preços consultados nesta data; 2027 continua horizonte, não garantia de tarifa.

Recomendação: preparar o cenário A, orçar B antes de operar profissionalmente e liberar venda somente após os gates técnicos e comerciais. Capital modelado de B: R$5.847,60 para três meses, implantação e contingência; fixo R$1.414,33/mês. Meta de equilíbrio no mix hipotético: 13 empresas, ou 27 para sustentar também reserva de 40% da receita. Cinco empresas não sustentam B nesta hipótese.

Workbook R2 tem controle de cenário, recebimento no mês e premissas, projeções de 1/5/10/25/50/100/200 contas, contribuições por plano e fontes. Enterprise não ganha preço inventado. Os três cenários foram recalculados, exportados e reimportados, sem erros de fórmula. Fontes, drivers não cotados e exclusões são explícitos. Resultado operacional simplificado não é lucro líquido; caixa e reserva têm colunas separadas. A reserva se limita ao caixa disponível, sem prometer transferência.

Central Econômica reaproveitada, sem criar dashboard financeiro duplicado. Agora inclui 200 empresas, custos operacionais, remuneração planejada, taxas fixa/percentual, tributo de sensibilidade e lacuna da reserva. Correção R2: stress de taxa usa a mesma regra no caixa e no equilíbrio. Adicionado simulador local de operações/Pulso com pesos técnicos do Cost Governor: não aprova franquia, não converte Pulso em reais, não persiste hipótese nem altera ledger. A visualização autenticada desta Central não foi homologada remotamente.

Pesquisa de crescimento tem calendário de 30 dias, três roteiros de demonstração, processo manual de descoberta e plano dos cinco primeiros clientes. Demanda, CAC, conversão e retenção continuam não comprovados. A recomendação de segmento é hipótese para entrevistar, não resultado de pesquisa de usuários. Nenhuma campanha, contato ou cobrança foi executada.

Internacionalização: Brasil primeiro; Portugal somente como descoberta posterior. Comparação de cinco regiões e três estratégias foi atualizada. A camada Intl é formatação, não produto traduzido nem cobrança internacional habilitada. Custos jurídicos/contábeis fora dos envelopes, revisão de 2027 e rate card Meta continuam pendentes.

READY_FOR_PRODUCTION_CANDIDATE=NO.
