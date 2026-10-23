> Revisão vigente: seção R2 de 23/10/2026 e planilha em evidence/launch-r2. Os trechos de 22/10 preservam o histórico e não substituem a revisão R2.

# ORKTO — economia unitária 2027

**Consulta:** 22/10/2026 · BRL nominal · todos os volumes abaixo são hipóteses, sem clientes ativos presumidos.

## Preços preservados

| Plano | Mensalidade | Status de escopo |
|---|---:|---|
| Start | R$79,90 | preço aprovado; franquias e limites comerciais pendentes |
| Pro | R$149,90 | preço aprovado; franquias e limites comerciais pendentes |
| Business | R$299,90 | preço aprovado; franquias e limites comerciais pendentes |
| Scale | R$599,90 | preço aprovado; franquias e limites comerciais pendentes |
| Enterprise | Sob consulta | não incluído no cálculo sem proposta negociada |

## Hipóteses editáveis de referência

- Mix: 60% Start, 25% Pro, 10% Business e 5% Scale. Não é dado de vendas.
- ARPA do mix: R$145,40 por empresa ao mês.
- Infraestrutura fixa pública de um ambiente: US$45 × PTAX 5,0383 = R$226,72/mês.
- IA: uma carga ilustrativa de 1 milhão de tokens de entrada e 250 mil de saída por conta/mês; Gemini 3.1 Flash-Lite Standard a US$0,25/M entrada e US$1,50/M saída resulta em R$3,15 na PTAX indicada.
- Recebimento: uma cobrança Pix por mês por empresa, R$1,99 por Pix recebido segundo preço público Asaas.
- Tributo: cenários de 6% e 15,5% da receita bruta somente para sensibilidade. Não são enquadramento da ORKTO.
- Despesa operacional adicional, custo de WhatsApp, custo direto por atendimento, churn, reembolso, inadimplência e pró-labore: sem tarifa/dado medido nesta rodada. Os números abaixo os excluem.
- A projeção presume cobrança integral no mês, sem desconto, atraso, churn, parcelamento ou ajuste de receita. Caixa não equivale a saldo bancário real.

## Contribuição de uma conta

Fórmula: preço bruto − taxa de pagamento − tributo do cenário − custo variável de IA ilustrativo. O custo fixo mensal de R$226,72 é usado para calcular apenas o equilíbrio de software conhecido.

| Plano | Pix + IA/mês | Contribuição a 6% fiscal | Margem a 6% | Contas para cobrir R$226,72 | Contribuição a 15,5% fiscal | Margem a 15,5% | Contas para cobrir R$226,72 |
|---|---:|---:|---:|---:|---:|---:|---:|
| Start | R$5,14 | R$69,97 | 87,6% | 4 | R$62,38 | 78,1% | 4 |
| Pro | R$5,14 | R$135,77 | 90,6% | 2 | R$121,53 | 81,1% | 2 |
| Business | R$5,14 | R$276,77 | 92,3% | 1 | R$248,28 | 82,8% | 1 |
| Scale | R$5,14 | R$558,77 | 93,1% | 1 | R$501,78 | 83,6% | 1 |

O “ponto de equilíbrio por plano” cobre apenas o custo fixo público de software. Ele não cobre operação, domínio, suporte, contabilidade, WhatsApp, impostos fora dos cenários, inadimplência, devoluções, salários ou custo de aquisição.

No mix padrão, a contribuição é R$131,54/conta com 6% de tributo hipotético ou R$117,72 com 15,5%. O equilíbrio matemático dos R$226,72 de software fica em **2 contas**. O resultado não representa margem/lucro contábil.

## Reserva corporativa de 40%

A regra interna preservada separa uma meta igual a 40% da receita bruta mensal. O restante de 60% paga operação, tributos, infraestrutura e outras obrigações. O cálculo da reserva é feito depois de identificar se o caixa projetado consegue suportá-la; não significa lucro, retirada ou transferência.

| Mix padrão | Receita bruta | Caixa operacional após itens modelados | Meta de reserva (40%) | Resultado da capacidade |
|---|---:|---:|---:|---|
| 2 empresas | R$290,80 | R$36,35 | R$116,32 | não cabe; falta R$79,97 |
| 3 empresas | R$436,20 | R$167,89 | R$174,48 | não cabe; falta R$6,59 |
| 4 empresas | R$581,60 | R$299,42 | R$232,64 | cabe com R$66,78 de folga |

Caixa operacional estimado = receita − 6% de tributo hipotético − Pix − IA ilustrativa − R$226,72 de software fixo. Com caixa de abertura zero, a diferença negativa para a reserva também representa capital adicional necessário para alcançar essa meta; não é saldo bancário confirmado.

O cenário acima é útil para testar a regra, mas não decide se a reserva fica juridicamente ou contabilmente segregada. Obrigações vencidas não podem ser adiadas para cumprir a meta. Se custos reais impedirem a reserva, apresentar a lacuna e solicitar decisão para alterar a política.

## IA e custo por conta

| Provedor/modelo listado oficialmente | Entrada por 1 M | Saída por 1 M | Custo da carga ilustrativa por mês |
|---|---:|---:|---:|
| Google Gemini 3.1 Flash-Lite Standard | US$0,25 | US$1,50 | US$0,625 ≈ R$3,15 |
| Xiaomi MiMo V2.6 Flash | US$0,14 | US$0,28 | US$0,21 ≈ R$1,06 |
| DeepSeek V4.1 Flash fora do pico | US$0,15 | US$0,60 | US$0,30 ≈ R$1,51 |
| DeepSeek V4.1 Flash no pico | US$0,30 | US$1,20 | US$0,60 ≈ R$3,02 |

O preço do token não informa a adequação do modelo, latência, região, cota gratuita ou custo total por operação da ORKTO. Carga não é observação. Nenhum desses custos foi chamado à API nesta missão. A cota gratuita pode ter limites e termos diferentes, e não foi usada para projetar operação permanente.

Fontes oficiais: [Gemini](https://ai.google.dev/gemini-api/docs/pricing), [DeepSeek](https://api-docs.deepseek.com/quick_start/pricing/?model_version=DeepSeek-V4-Pro-0813), [MiMo](https://mimo.mi.com/docs/pricing). Revisar tabelas antes de habilitar qualquer modelo pago.

## Pulso

Pulso é unidade comercial da ORKTO. Não há evidência de equivalência fixa entre Pulso e tokens, chamadas, mensagens ou segundos de modelo. Não atribuir franquias aos planos. A futura avaliação deve medir por tarefa: regra determinística, modelo, input, cache, output, tentativas, mensagem, suporte humano e alocação de infraestrutura; só depois testar franquias hipotéticas.

## Qual plano tem melhor relação entre preço e custo?

Com custo fixo por conta e o mesmo consumo de IA/Pix por plano, Scale tem a maior contribuição monetária e percentual calculada. Essa conclusão depende de uma hipótese simplificadora: recursos, suporte, tokens, canais e uso não crescem com o valor do plano. Como limites comerciais ainda não estão definidos e custo por atendimento não está medido, a escolha de plano com melhor relação preço/valor fica **NOT_VERIFIED**. Antes de publicar limites, medir consumo por workspace e testar cenários de uso alto.

## Concorrentes como referência de preço

- Agendor publica CRM Pro a R$59, Performance a R$83 e Corporativo a R$156 por usuário/mês; mínimo de 10 usuários no Corporativo. Agendor Chat custa a partir de R$312/mês para até 3 usuários e sincronização de WhatsApp é precificada na contratação. São produtos e unidades diferentes, não um comparativo direto de pacote. [Preços oficiais Agendor](https://www.agendor.com.br/planos-precos)
- Pipedrive Lite publica US$14 por assento/mês com cobrança anual; Growth US$39, Premium US$59 e Ultimate US$79 por assento/mês no preço listado. Não inclui conversão cambial, tributos e condições regionais. [Preços oficiais Pipedrive](https://www.pipedrive.com/en/pricing?department=sales)
- HubSpot Sales Hub Starter tem valores por assento diferentes para contratação anual e mensal; a página pública consultada exibiu US$7/assento/mês na opção anual e US$20/mês na mensal, sujeito a região e oferta. [Página oficial HubSpot](https://www.hubspot.com/pricing/sales?tab=tab-billing)

Essas referências mostram opções de CRM mais baratas por usuário e planos superiores com automação, propostas ou mensagens. Não provam a demanda pelo posicionamento da ORKTO nem autorizam alterar preços ou limites aprovados.

## R2 — equilíbrio com operação enxuta completa

Consulta 23/10/2026. Na planilha R2, B tem fixo R$1.414,33 e variável estimado R$12,315 por empresa: Pix R$1,99 + IA R$0,325 + envelope Meta R$10. A tributação de sensibilidade é 15,5%. Não são custos observados, franquias ou direitos comerciais.

| Plano | Preço preservado | Contribuição mensal estimada | Empresas para equilíbrio B |
|---|---:|---:|---:|
| Start | R$79,90 | R$55,20 | 26 |
| Pro | R$149,90 | R$114,35 | 13 |
| Business | R$299,90 | R$241,10 | 6 |
| Scale | R$599,90 | R$494,60 | 3 |
| Enterprise | Sob consulta | depende da proposta e custo de atendimento | não calculável sem preço; N = teto(1.414,33 / (0,845 × P − 12,315)) se contribuição positiva |

A hipótese de consumo igual entre planos favorece Scale. Não comprova a margem real do Scale: suporte, uso, retenção e escopo podem crescer. Não publicar limites com base nesta tabela. Mix ilustrativo com ARPA R$145,40 cobre custos em 13 empresas; para sustentar também reserva de 40% da receita são 27, com recebimento integral e custos dentro do modelo.

As projeções de 1, 5, 10, 25, 50, 100 e 200 empresas estão na aba Projecoes e no JSON de cálculos, separando receita, resultado operacional, recebimento, caixa e reserva possível. Enterprise permanece fora do mix até uma proposta ser informada. Valor mensal de cada plano público não foi alterado.

Na Central Econômica, a R2 consolidou os drivers existentes, adicionou a escala de 200 e corrigiu o stress das taxas no ponto de equilíbrio e economia por plano para coincidir com o fluxo de caixa. Teste de regressão confirma que o número calculado cobre os custos e que uma empresa a menos não cobre, sob as hipóteses testadas. Nenhum ledger ou billing real foi alterado.

