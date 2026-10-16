## Estado vigente — continuação da homologação, 16/10/2026

**READY_FOR_PRODUCTION_CANDIDATE=NO.** [Matriz vigente](STAGING_HOMOLOGATION_A2A3651_2026-10-16.md): runtime a2a3651319196ffc56813992f705692d368ef967 / Preview az36qohmo READY; staging DB50/core Edge30/webhook2. Google B real e persistência após reload comprovados também no candidato a2a3651; contexto RLS SQL aprovado, transporte A/B e replay/expiração natural ainda não executados. Lifecycle nativo Asaas implementado e validado com fixtures/CI; fornecedor real e política de término de acesso bloqueados externamente. Regressão 285/285 + 61/61, billing focado19/19, lint/Edge/build/CI/secret scan PASS. Redirect exato salvo após confirmação específica; lista 16→17 e Site URL preservada. Produção intocada e PR #2 sem merge.

Revisão final de pré-requisitos em 16/10/2026 22:11 UTC: executor Google A/B incompatível/indisponível (BLOCKED_EXTERNAL); testes HTTP e tokens NOT_TESTED. Consulta staging confirmou zero customers sandbox aprovados e zero secrets personalizados. Asaas real permanece BLOCKED_EXTERNAL; notificações do fornecedor NOT_TESTED. Nenhum código, permissão, flag ou configuração cloud alterado nesta rodada. Roteiro restante na matriz vigente; os PASS abaixo são históricos e não foram repetidos.

## Checkpoints anteriores — históricos
# ORKTO — fechamento operacional, economia e billing

Estado: `READY_FOR_PRODUCTION_CANDIDATE=NO`. PR #2 permanece draft. Nenhum merge, deploy de produção, cobrança, envio real ou chamada paga de IA foi realizado.

**Homologação posterior no mesmo runtime 4506803:** [matriz atual por fase e procedimentos externos](STAGING_HOMOLOGATION_4506803_2026-10-16.md). Redirect, Google A real, reload, logout/remoção de sessões e Enterprise persistido/idempotência/quota/auditoria passaram. Identidade B/workspace owner por 30 dias foram explicitamente aprovados; falta login direto. Secrets customizados ausentes e backup gerenciado indisponível no Free confirmados. Ciclo nativo de cancelamento Asaas também exige implementação/política; não é somente credencial ausente. A matriz posterior prevalece sobre as limitações históricas abaixo.

## Escopo e estado real

A auditoria partiu do HEAD `d3946bcafb339d0a315cae2ba9834b7ed41da649`, com checks PostgreSQL 17 e boundary aprovados. O Preview anteriormente validado continua sendo `ee3b3b3d45decb208d7ccf927bb25f429a64af04` em `https://orkto-staging-nlwxxb8o0-peixoto-s-projects1.vercel.app/`. O smoke Google nesse Preview é evidência histórica preservada.

Migration 49 aplicada no staging em 16/10/2026 via conector: ledger remoto 49, nome lógico `commercial_billing_pulso` exatamente uma vez, versão remota `20261016154435`. Gateway Edge v29 e webhook de billing v1 ativos. Os sete objetos novos têm RLS e zero grants de dados para anon/authenticated; não há políticas Pulso ou tarifas de modelo provisionadas. [Evidência sanitizada](evidence/billing-staging-2026-10-16.json).

## Cinco planos aprovados

| Plano | Mensalidade | Categoria | Meta COGS técnico | Teto de planejamento |
| --- | --- | --- | --- | --- |
| Start | R$ 79,90 | Pequenos negócios e empresas em crescimento | R$ 11,99 | R$ 15,98 |
| Pro | R$ 149,90 | Pequenos negócios e empresas em crescimento | R$ 22,49 | R$ 29,98 |
| Business | R$ 299,90 | Pequenos negócios e empresas em crescimento | R$ 44,99 | R$ 59,98 |
| Scale | R$ 599,90 | Operações avançadas e grandes empresas | R$ 89,99 | R$ 119,98 |
| Enterprise | Sob consulta | Operações avançadas e grandes empresas | Conforme contrato | Conforme contrato |

O identificador interno histórico `starter` permanece estável, com nome comercial **Start**. Founders e Legacy Standard continuam apenas como registros históricos e compatibilidade de acesso; não são ofertas novas nem aparecem na área pública de planos. Enterprise não possui checkout com preço fictício. O seed financeiro antigo de R$ 1.499,90 foi excluído da projeção; sua participação sem contrato negociado é recusada. Os quatro preços fixos não podem ser editados na Central Econômica.

Preços ficam na versão 2, com histórico imutável. Não foram inventadas franquias de usuários ou Pulso. Os recursos e limites técnicos anteriores foram preservados; as condições comerciais definitivas continuam explicitamente pendentes.

## Implementação e proteção de billing

- O webhook legado não altera mais `profiles.active_plan` a partir de `CHECKOUT_PAID`, `payment.subscription` ou cancelamento recebido. Eventos de assinatura exigem reconciliação; o fluxo existente de pagamentos de propostas permanece separado.
- `SubscriptionProcessor` permite outro processador no futuro. O adaptador atual implementa apenas Asaas **sandbox**, com host fixo, prazo de resposta, segredo de servidor e rejeição de produção.
- `/api/billing/sandbox/subscriptions` exige sessão, workspace e papel owner/admin. O gateway Edge exige flags de sandbox, staging exato e um customer previamente vinculado à empresa por operador autorizado.
- Uma reserva durável precede a chamada ao processador. Assinatura pendente não substitui o acesso atual. Resposta incerta exige reconciliação e não produz uma segunda cobrança automaticamente.
- `orkto-billing-webhook` valida o token dedicado antes de persistir. Eventos duplicados usam claim durável e fingerprint; a assinatura e o pagamento são relidos no fornecedor. Workspace, customer, referência interna, assinatura, versão, moeda e valor precisam corresponder.
- Somente a RPC service-only de reconciliação altera o direito de acesso. Retorno do navegador e assinatura Asaas com status ACTIVE não comprovam pagamento.
- Períodos antigos não substituem uma renovação mais recente. Inadimplência, cancelamento/refund e expiração têm estados distintos de pagamento confirmado. Pagamento de período futuro não libera acesso antecipado.
- O checkout real permanece indisponível. Operações de alteração/cancelamento no fornecedor e o fluxo completo com eventos reais de sandbox ainda precisam de homologação antes de serem oferecidos ao cliente.

## Pulso e Cost Governor

Pulso mede consumo generativo e agentic, não número de mensagens. Valores são inteiros em milésimos de Pulso. A referência 0,25 / 0,5 / 1 / 2–4 permanece hipótese comercial; nenhuma franquia foi provisionada em staging.

Uma política aprovada precisa informar workspace, plano, versão, validade, aprovador, motivo, franquia e tarifas por classe. Ausência de aprovação ou divergência de plano bloqueia inferência. Ajustes de política exigem versão crescente e geram auditoria. A reserva serializada impede corrida por saldo; estados consumido, reservado e desconhecido contam contra o limite. Falhas incertas não devolvem saldo silenciosamente.

A WIA determinística não reserva Pulso nem chama modelo. O caminho generativo atual é classificado no servidor como normal; classes simples, leve e complexa estão preparadas para tarifas aprovadas futuras. Não há pacotes de compra ativos.

O modelo Gemini é configurável por `WIA_GEMINI_MODEL`, limitado à família e host oficiais. Uso registra tokens, fornecedor, modelo e proveniência. Tarifas de modelo são versionadas com validade; custo sem tarifa permanece desconhecido. Custo estimado em microunidades de USD não é tratado como fatura paga nem convertido sem taxa aprovada.

## Central Econômica

Recebimentos e lançamentos realizados continuam separados de projeções e telemetria. Pagamentos antigos fora do período não sustentam MRR indefinidamente. ARR é run rate; não é receita recebida. Custos de infraestrutura e IA compõem o COGS técnico; gateway, tributos, canal, suporte, equipe, marketing, administrativo e extraordinário ficam em categorias separadas. Infraestrutura compartilhada é registrada uma vez no ledger; alocações de telemetria não são somadas novamente.

A meta de reserva é 40% da receita recebida: runway/segurança 20%, expansão 10%, tesouraria 7%, oportunidades 3%. A interface mostra meta, capacidade de caixa, desvio e reserva constituída desconhecida enquanto não houver conciliação. Nenhuma transferência é executada. A projeção de 13 semanas usa apenas lançamentos previstos registrados; ausência de lançamentos não comprova custos zero. Burn rate e runway são derivados do fluxo registrado, com cobertura limitada.

CAC, conversão, churn, retenção, expansão, NRR e payback permanecem sem valor quando faltam coortes/receitas/aquisição conciliadas. O acesso interno mantém a autorização administrativa existente; nenhuma permissão financeira foi concedida a clientes ou membros comuns.

## Recuperação

Foi executado backup custom PostgreSQL 17, checksum, restauração em `orkto_restore_rehearsal`, comparação exata de contagens, verificação de FKs, RLS, grants, negação entre tenants e assertions de billing/Pulso no banco restaurado. Todos os dados eram fixtures sintéticas do CI. O destino era uma base recém-criada no container descartável; não houve sobrescrita de banco existente.

Evidência do run `38924197339`: status PASS, perda de linhas do snapshot 0, duração do restore e validação 2 segundos. Checksum do dump: `e8e77ff6b9fbe6577358adc398092f052ed007af0cadb4c26097d2eaf5b2f750`. O dump sintético foi removido ao terminar; checksum, contagens e resultado foram preservados como artifact do workflow.

Isso **não** é recuperação de dados reais, identidades Google ou projeto Supabase completo. Managed restore/PITR no staging Free continua não demonstrado. RPO pretendido proposto: até 24 horas; RTO pretendido proposto: até 4 horas, ambos dependentes de estratégia operacional aprovada. O resultado de 2 segundos no CI não comprova esses objetivos em um incidente real.

## Matriz de evidências

Regressão final: **275/275 aplicação; 61/61 readiness**, sem skips ou falhas. `npm run lint`, `npm run lint:edge` e `npm run readiness:build` passaram. O build executou health, SPA, fronteira de autenticação e proteção do source sem credenciais externas. O handler real do webhook passou cinco testes negativos com acesso externo proibido, incluindo token inválido, configuração ausente, JSON inválido/nulo/array, corpo excedente e ambiente de produção. Typecheck Edge cobre os dois entrypoints; não substitui deployment Deno.

Revisão visual local: cinco planos visíveis, desktop e mobile 390×844, sem overflow horizontal. Solicitação Enterprise após autenticação ainda exige prova no novo Preview. O warning preexistente de chunk WebGL grande permanece; não foi tratado como falha de build nem como prova de desempenho online.

CI mais recente para a migration final: [run 38924771423](https://github.com/peixotodavy831-stack/Orktoverdadeiro/actions/runs/38924771423), ambos os replays e restore aprovados. Restore sintético: **1 segundo**, zero perda de linhas do snapshot; checksum `27dcc4e741f90f2ea7c6266a2a3c8e7dd45895ffec321b52b002cbe9c80c053f`. Evidência anterior acima permanece histórica. SHA-256 da migration 49: `AABA842E2303947F47F2AC0CB6AD1F264DCA0B90BECBD4A8F0248244B9EBB093`.

| Item | Estado | Escopo da evidência |
| --- | --- | --- |
| Auditoria do HEAD e draft | PASS | HEAD inicial e checks consultados no GitHub; PR mantida draft. |
| Cinco planos/preços/categorias | PASS | Contrato compartilhado, migration versionada e testes locais. |
| Enterprise sem preço fixo | PASS | Interface e política rejeitam ativação com valor fictício. |
| Solicitação Enterprise persistida | PASS | RPC testada em PostgreSQL; role, quota diária, idempotência e auditoria. UI local encaminha para login e formulário autenticado. |
| Solicitação Enterprise no novo Preview | PASS | Fluxo autenticado real, repetição sem duplicação, cinco registros/eventos e sexta tentativa negada; relatório posterior vincula evidências. |
| Pulso, saldo e bloqueio | PASS | Testes unitários e SQL, reserva atômica e vínculo ao plano. Nenhuma franquia real aprovada. |
| Custos e tarifas | PASS | Testes locais de fornecedor, tokens, versão, validade e custo desconhecido. |
| Central Econômica | PASS | Cálculos/contratos locais e tipos. Valores financeiros reais não foram inventados. |
| Dados financeiros comerciais reais | BLOCKED_EXTERNAL | Sem recebimentos/contabilidade/coortes conciliados do novo billing. |
| Asaas adaptador/reconciliação | PASS | Fixtures locais; PostgreSQL comprova reserva pendente, ativação, replay e rejeição de preço incorreto. |
| Asaas sandbox real | BLOCKED_EXTERNAL | Faltam credencial sandbox, customer aprovado e webhook; nenhuma chamada ao fornecedor foi feita. |
| Asaas cobrança real | BLOCKED_EXTERNAL | Ativação comercial e jurídica não autorizada; checkout OFF. |
| Google do proprietário | PASS_SCOPE | No 4506803: login/callback, Hoje/billing, reload, logout e remoção de sessões. Refresh/expiração/replay ainda não testados. |
| Google A/B completo | BLOCKED_EXTERNAL | Segunda identidade e owner em workspace novo isolado por 30 dias aprovados; login Google B ainda requer participação direta. |
| Expiração/refresh/revogação Google no novo código | NOT_TESTED | Obrigatório no novo candidato; evidência antiga não substitui. |
| Gemini estrutural | PASS | Limites, allowlist, erros, proveniência, Pulso e modelo configurável testados com fixtures. |
| Gemini real | BLOCKED_EXTERNAL | Sem chave/allowlist/franquia/tarifa aprovadas e sem autorização de chamada paga. |
| Meta estrutural | PASS | Fundação anterior preservada; nenhuma alteração de permissões ou envio. |
| Meta real/coexistência/tarifas | BLOCKED_EXTERNAL | Dependem de App/WABA, elegibilidade, número de teste, App Review, secrets e aprovação. Consulta à documentação Meta recebeu HTTP 429; não se presumiu elegibilidade. |
| Restore PostgreSQL descartável | PASS | Artifact do CI com checksum, contagens, FK, RLS e billing. |
| Restore gerenciado de staging/PITR | BLOCKED_EXTERNAL | Sem capacidade/backup de staging demonstrado; não contratar plano automaticamente. |
| Migration 49 no Supabase staging | PASS | Ledger 49, versão remota 20261016154435, cinco preços v2 corretos, sete tabelas RLS, zero browser grants. |
| Edge staging | PASS_DEPLOY / PARTIAL_RUNTIME | Core v29 JWT obrigatório: sem token 401. Billing v1 token dedicado: sem configuração 503. Billing sandbox real continua bloqueado. |
| Novo Preview | PASS_PUBLIC | 45068033a3b41f7fb170ca174408dc5fd1ba53fa READY em orkto-staging; health, API, headers, CORS, teclado, responsividade, planos e entrada Google passaram. E2E autenticado continua aberto. |
| Produção | PASS | Preservada; `READY_FOR_PRODUCTION_CANDIDATE=NO`. |

## Configuração externa necessária

1. Migration 49 já aplicada no projeto **ghrjongiodziasupakrk**. Não removeu usuários ou registros existentes; catálogo aprovado e tabelas internas reconciliados.
2. `orkto-core-mutations` v29 e `orkto-billing-webhook` v1 já publicados. O JWT do webhook é desativado **somente porque o fornecedor usa token dedicado**; sem segredo/configuração ele retorna 503 antes de persistir. Manter billing fechado até preparar credencial e customer sandbox.
3. Novo Preview publicado: `https://orkto-staging-g8jxnq6ye-peixoto-s-projects1.vercel.app/`. No Supabase staging, adicionar esse redirect exato em Authentication → URL Configuration → Redirect URLs, preservando os redirects aprovados existentes. Repetir Google proprietário nesse candidato; para A/B, aprovar a segunda identidade, workspace e papel. Não usar o launcher de senhas: ele recusa Google-only deliberadamente.
4. Asaas: conta e chave **sandbox** somente no secret store, `ASAAS_ENVIRONMENT=sandbox`, `APP_ENV=staging`, token dedicado de webhook com ao menos 32 caracteres, URL `https://ghrjongiodziasupakrk.supabase.co/functions/v1/orkto-billing-webhook`. Configurar apenas eventos de pagamento tratados. Aprovar customer de teste vinculado ao workspace, sem dados de terceiros nem notificações não autorizadas. Só então habilitar o flag de sandbox e homologar.
5. Gemini: cadastrar segredo, workspace de teste, flag explícito, modelo, tarifa e política Pulso aprovada. Teste pago exige autorização específica; não enviar segredos por chat.
6. Meta: concluir App/WABA/Embedded Signup/App Review, número de teste e tarifas com o proprietário. Coexistência depende da elegibilidade confirmada da conta. Manter mensagens reais OFF.
7. Aprovar franquias, usuários, suporte, termos/SLA e política de cancelamento antes de contratação real. Os cinco planos e quatro preços já estão decididos e não precisam ser aprovados novamente.

## Candidato final publicado e limites atuais

SHA executável **45068033a3b41f7fb170ca174408dc5fd1ba53fa**, deployment `dpl_4Np4vbkDNQWSxLAtVLvHzxzeXf5e`, projeto `orkto-staging`, target `null` (Preview), READY. URL: https://orkto-staging-g8jxnq6ye-peixoto-s-projects1.vercel.app/. A PR continua draft; commits posteriores de documentação não mudam esse runtime.

- [Probe público](evidence/billing-preview-public-4506803.json): health/readiness 200, correlação, headers, API privada 401, origem estrangeira 403, metadados staging, controles nomeados, teclado, console zero erros e larguras 390/768/1440 PASS. Medida única de carregamento não é teste de carga ou SLO.
- [Entrada Google e planos](evidence/billing-google-entry-4506803.json): cinco ofertas, quatro preços, checkout fechado, Enterprise conserva intenção de proposta, zero campos de senha, configuração Google-only real e PKCE S256 com callback exato PASS. Password grant retorna 422 `email_provider_disabled`. Navegação OAuth foi interceptada antes do fornecedor: **não é login, refresh, logout ou E2E autenticado aprovado**.
- Banco real: piloto ligado, uma admissão/identidade Google, zero identidades email, zero customer bindings e zero solicitações Enterprise; schema privado sem USAGE para authenticated. Não foi criada uma segunda conta ou franquia implicitamente.
- CI do SHA: [PostgreSQL 17 / restore](https://github.com/peixotodavy831-stack/Orktoverdadeiro/actions/runs/38926604141) e [boundary](https://github.com/peixotodavy831-stack/Orktoverdadeiro/actions/runs/38926604047) PASS. Secret scan final: 470 arquivos, zero achados/blockers.
- Tentativa CLI 7Aj9AT6yjHGeqRtWeYeJBZSiPMX4 BLOCKED por colaboração, sem mudar controle de acesso. Tentativa API por SHA 6acj8KY7Rk3F3iZNw9VAbcnWd192 cancelada para preservar variáveis específicas da branch. Deployment dcad0voyg (target staging) não é o candidato entregue: OIDC development recusado por Trusted Sources, sem ampliar a regra. Candidato g8jxnq6ye é Preview e passou com OIDC do mesmo projeto.

**Conclusão:** implementação disponível para revisão e homologação controlada. Prontidão comercial e de produção **não concluída**. Gates obrigatórios ainda abertos: Google A/B e ciclo de sessão no candidato atual, persistência Enterprise autenticada, homologação real de billing sandbox, validações externas Gemini/Meta, recuperação gerenciada e condições comerciais ainda não aprovadas. Nenhuma evidência histórica foi apagada ou convertida em aprovação nova.

## Fontes oficiais consultadas

- [Asaas — criação de assinatura](https://docs.asaas.com/reference/create-new-subscription): criar assinatura não confirma pagamento.
- [Asaas — receber eventos](https://docs.asaas.com/docs/receive-asaas-events-at-your-webhook-endpoint): validação do token dedicado e processamento de eventos.
- [Asaas — sandbox](https://docs.asaas.com/docs/sandbox-2): ambiente separado; notificações de teste também exigem contatos autorizados.
- [Gemini — generateContent](https://ai.google.dev/api/generate-content): modelo e parâmetros da API, sem autorização implícita de consumo pago.

Fontes consultadas em 16/10/2026. Nenhum resultado simulado foi apresentado como homologação real desses serviços.
