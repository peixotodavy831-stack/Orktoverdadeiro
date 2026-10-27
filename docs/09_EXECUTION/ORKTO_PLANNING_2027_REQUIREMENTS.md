# ORKTO — inventário rastreável do planejamento2027

Data27/10/2026. 40 requisitos: 29 administrativos e 11 comerciais. Nenhuma seção privada foi copiada para telas de clientes.

## Fonte e limites

O Sites confirmou projeto existente ativo, versão2 e URL exata. A leitura web não acessou o conteúdo; o navegador foi bloqueado pela revisão automática de origem. **BLOCKED_SOURCE para comparação da publicação**, sem tentar contornar. Foi lido o HTML local original (188813bytes), seus seis capítulos embutidos,19fontes e quatro módulos de origem. SHA256 do HTML: a7a127c3b3dedd89e0a339fd25f09c0970f6554b8dfd9ba94417f40015090cde. Não presumir que edições no navegador de outro dispositivo estejam nesse arquivo.

Os capítulos locais atuais do repositório também foram comparados como continuação, sem tratá-los como transcrição da publicação. Não se considera a lista sugerida da missão como conteúdo encontrado no documento. Recursos comerciais citados são rastreados até os fluxos/demo/gates da fonte.

## Contagem e classificação

- PLANNER_LOCAL: 18
- PARTIAL: 11
- BLOCKED_EXTERNAL: 8
- IMPLEMENTED_LOCAL: 3

PLANNER_LOCAL significa que a função existe no planejador offline original, preservado; não significa implantação na plataforma autenticada. IMPLEMENTED_LOCAL identifica código no app/servidor, sujeito aos testes desta rodada. PARTIAL e BLOCKED_EXTERNAL conservam pendências de UX, dados reais ou homologação. Nenhuma dessas contagens é PASSremoto. A nota de execução registra testes realmente rodados, sem contar uma função como testada apenas por existir.

## Requisitos

### A01 — Orçamento A/B/C e margem de contingência

- Descrição: Orçamento A/B/C e margem de contingência.
- Fonte/seção: finance;budget; model.calculate.
- Público/classificação: Fundador autorizado; nunca painel cliente / ADMIN_FOUNDER.
- Entradas: setup e custos USD/BRL.
- Saídas: subtotal, margem e capital de giro.
- Regras: software × FX; margem explícita.
- Dependências: Contratos existentes e validação local; remoto separado.
- Estado: **PLANNER_LOCAL**.
- Arquivos responsáveis: model.js calculate; backend/finance/finance-model.ts.
- Testes necessários: Validação de entradas, cálculo, separação de observado e simulado; autorização founder.
- Aceitação: Alterar custo recalcula cenário; desconhecido permanece identificado.

### A02 — Custos fixos, variáveis e lacunas

- Descrição: Custos fixos, variáveis e lacunas.
- Fonte/seção: budget; model.NULLABLE.
- Público/classificação: Fundador autorizado; nunca painel cliente / ADMIN_FOUNDER.
- Entradas: infra, suporte, domínio, WhatsApp, contador.
- Saídas: custos conhecidos e itens sem preço.
- Regras: somar conhecidos; não converter ausência em custo gratuito.
- Dependências: Contratos existentes e validação local; remoto separado.
- Estado: **PLANNER_LOCAL**.
- Arquivos responsáveis: model.js NULLABLE; src/components/internal/FinanceDashboard.tsx.
- Testes necessários: Validação de entradas, cálculo, separação de observado e simulado; autorização founder.
- Aceitação: Campo ausente aparece como pendência.

### A03 — Receita por plano e mix

- Descrição: Receita por plano e mix.
- Fonte/seção: unit; model.PLANS/calculate.
- Público/classificação: Fundador autorizado; nunca painel cliente / ADMIN_FOUNDER.
- Entradas: quantidades ou mix dos quatro preços fixos.
- Saídas: MRR, ARR e ARPA.
- Regras: MRR soma preço×quantidade; mix deve somar100%.
- Dependências: Contratos existentes e validação local; remoto separado.
- Estado: **PLANNER_LOCAL**.
- Arquivos responsáveis: model.js; backend/finance/finance-model.ts.
- Testes necessários: Validação de entradas, cálculo, separação de observado e simulado; autorização founder.
- Aceitação: Mix inválido recusado e contratos inteiros.

### A04 — Contribuição e equilíbrio

- Descrição: Contribuição e equilíbrio.
- Fonte/seção: unit; model.calculate.
- Público/classificação: Fundador autorizado; nunca painel cliente / ADMIN_FOUNDER.
- Entradas: preços, taxas, tributos, custos por empresa.
- Saídas: contribuição e empresas de equilíbrio.
- Regras: ceil(fixo/contribuição); denominador não positivo indisponível.
- Dependências: Contratos existentes e validação local; remoto separado.
- Estado: **PLANNER_LOCAL**.
- Arquivos responsáveis: backend/finance/finance-model.ts.
- Testes necessários: Validação de entradas, cálculo, separação de observado e simulado; autorização founder.
- Aceitação: Não apresentar equilíbrio quando faltam custos.

### A05 — Reserva empresarial planejada

- Descrição: Reserva empresarial planejada.
- Fonte/seção: finance;founder; model.calculate.
- Público/classificação: Fundador autorizado; nunca painel cliente / ADMIN_FOUNDER.
- Entradas: receita e caixa disponível.
- Saídas: meta40%, capacidade e desvio.
- Regras: meta do planner sobre receita; fluxo novo explicita base recebida.
- Dependências: Contratos existentes e validação local; remoto separado.
- Estado: **PARTIAL**.
- Arquivos responsáveis: model.js; FinanceDashboard.tsx; backend/finance/launch-planning.ts.
- Testes necessários: Validação de entradas, cálculo, separação de observado e simulado; autorização founder.
- Aceitação: Base de cada meta visível; sem transferência ou dupla despesa.

### A06 — Receita versus recebimento e capital inicial

- Descrição: Receita versus recebimento e capital inicial.
- Fonte/seção: budget; model.calculate.
- Público/classificação: Fundador autorizado; nunca painel cliente / ADMIN_FOUNDER.
- Entradas: percentual recebido, abertura e setup.
- Saídas: caixa e capital necessário.
- Regras: abertura+recebido-saídas-setup.
- Dependências: Contratos existentes e validação local; remoto separado.
- Estado: **PLANNER_LOCAL**.
- Arquivos responsáveis: model.js; backend/finance/launch-planning.ts.
- Testes necessários: Validação de entradas, cálculo, separação de observado e simulado; autorização founder.
- Aceitação: Recebimento muda caixa sem alterar MRR.

### A07 — Custo de IA e medição por workspace

- Descrição: Custo de IA e medição por workspace.
- Fonte/seção: unit; model.calculate; roadmap costs.
- Público/classificação: Fundador autorizado; nunca painel cliente / ADMIN_FOUNDER.
- Entradas: tokens, modelo, rate e FX.
- Saídas: custo simulado ou observado identificado.
- Regras: tokens×tarifa/M × FX.
- Dependências: Contratos existentes e validação local; remoto separado.
- Estado: **PARTIAL**.
- Arquivos responsáveis: backend/finance/finance-model.ts; FinanceDashboard.tsx.
- Testes necessários: Validação de entradas, cálculo, separação de observado e simulado; autorização founder.
- Aceitação: Não confundir simulação com chamadas pagas ou Pulso.

### A08 — Custo de WhatsApp por categoria

- Descrição: Custo de WhatsApp por categoria.
- Fonte/seção: unit; budget; sources.meta.
- Público/classificação: Fundador autorizado; nunca painel cliente / ADMIN_FOUNDER.
- Entradas: mercado, categoria, moeda, rate aprovado.
- Saídas: custo ou sem preço.
- Regras: rate específico; sem tarifa não estimar custo gratuito.
- Dependências: Aprovação/configuração ou dados externos descritos no critério.
- Estado: **BLOCKED_EXTERNAL**.
- Arquivos responsáveis: FinanceDashboard.tsx; orkto_whatsapp_rate_cards.
- Testes necessários: Validação de entradas, cálculo, separação de observado e simulado; autorização founder.
- Aceitação: Proprietário aprova tarifa aplicável; custo e uso reais conciliados.

### A09 — FX e infraestrutura editáveis

- Descrição: FX e infraestrutura editáveis.
- Fonte/seção: budget; model.DEFAULTS/inputs.
- Público/classificação: Fundador autorizado; nunca painel cliente / ADMIN_FOUNDER.
- Entradas: câmbio e preços de infraestrutura.
- Saídas: subtotal em BRL.
- Regras: USD×FX; referência histórica sinalizada.
- Dependências: Contratos existentes e validação local; remoto separado.
- Estado: **PLANNER_LOCAL**.
- Arquivos responsáveis: model.js; FinanceDashboard.tsx.
- Testes necessários: Validação de entradas, cálculo, separação de observado e simulado; autorização founder.
- Aceitação: Não tratar referência22/10 como cotação atual.

### A10 — Taxas de pagamento e sensibilidade fiscal

- Descrição: Taxas de pagamento e sensibilidade fiscal.
- Fonte/seção: budget;unit; model.calculate.
- Público/classificação: Fundador autorizado; nunca painel cliente / ADMIN_FOUNDER.
- Entradas: mixPix/cartão, tarifa, alíquota.
- Saídas: taxas e tributos simulados.
- Regras: fixa+percentual sobre receita; fiscal sensibilidade.
- Dependências: Contratos existentes e validação local; remoto separado.
- Estado: **PLANNER_LOCAL**.
- Arquivos responsáveis: model.js; backend/finance/finance-model.ts.
- Testes necessários: Validação de entradas, cálculo, separação de observado e simulado; autorização founder.
- Aceitação: Sem definir regime fiscal ou contrato do provedor.

### A11 — Pró-labore e despesas operacionais

- Descrição: Pró-labore e despesas operacionais.
- Fonte/seção: founder; model.calculate.
- Público/classificação: Fundador autorizado; nunca painel cliente / ADMIN_FOUNDER.
- Entradas: remuneração, OPEX, receita.
- Saídas: resultado e equilíbrio.
- Regras: dedução separada de OPEX e pró-labore.
- Dependências: Contratos existentes e validação local; remoto separado.
- Estado: **PLANNER_LOCAL**.
- Arquivos responsáveis: model.js; FinanceDashboard.tsx.
- Testes necessários: Validação de entradas, cálculo, separação de observado e simulado; autorização founder.
- Aceitação: Não classificar gastos pessoais como custo corporativo.

### A12 — Reserva pessoal e separação patrimonial

- Descrição: Reserva pessoal e separação patrimonial.
- Fonte/seção: founder; model.calculate.
- Público/classificação: Fundador autorizado; nunca painel cliente / ADMIN_FOUNDER.
- Entradas: despesa pessoal e meses de reserva.
- Saídas: meta pessoal e diferença.
- Regras: despesa×meses; fora do ledger empresarial.
- Dependências: Contratos existentes e validação local; remoto separado.
- Estado: **PLANNER_LOCAL**.
- Arquivos responsáveis: model.js; FinanceDashboard.tsx.
- Testes necessários: Validação de entradas, cálculo, separação de observado e simulado; autorização founder.
- Aceitação: Não persistir despesa pessoal no ledger.

### A13 — Cenários editáveis e comparação

- Descrição: Cenários editáveis e comparação.
- Fonte/seção: app.handleAction save/apply-scenario.
- Público/classificação: Fundador autorizado; nunca painel cliente / ADMIN_FOUNDER.
- Entradas: premissas e nome de cenário.
- Saídas: cenário salvo/restaurado.
- Regras: até12cenários; validação model.inputs.
- Dependências: Contratos existentes e validação local; remoto separado.
- Estado: **PLANNER_LOCAL**.
- Arquivos responsáveis: app.js; model.normalizeState.
- Testes necessários: Validação de entradas, cálculo, separação de observado e simulado; autorização founder.
- Aceitação: Round-trip conserva valores e rejeita inválidos.

### A14 — Backup e restauração entre dispositivos

- Descrição: Backup e restauração entre dispositivos.
- Fonte/seção: app.exportDialog/normalizeState.
- Público/classificação: Fundador autorizado; nunca painel cliente / ADMIN_FOUNDER.
- Entradas: JSON do próprio planner.
- Saídas: plano restaurado.
- Regras: schema orkto-planning/1; edição local sem sync.
- Dependências: Contratos existentes e validação local; remoto separado.
- Estado: **PLANNER_LOCAL**.
- Arquivos responsáveis: app.js; model.js.
- Testes necessários: Validação de entradas, cálculo, separação de observado e simulado; autorização founder.
- Aceitação: Backup conserva notas, capítulos, tarefas e cenários.

### A15 — Exportação HTML offline

- Descrição: Exportação HTML offline.
- Fonte/seção: app.exportHtml.
- Público/classificação: Fundador autorizado; nunca painel cliente / ADMIN_FOUNDER.
- Entradas: estado editado.
- Saídas: HTML independente.
- Regras: JSON escapado no user-plan.
- Dependências: Contratos existentes e validação local; remoto separado.
- Estado: **PLANNER_LOCAL**.
- Arquivos responsáveis: app.js; verify-artifact.mjs.
- Testes necessários: Validação de entradas, cálculo, separação de observado e simulado; autorização founder.
- Aceitação: HTML abre sem dependências de rede.

### A16 — Biblioteca editável de seis capítulos

- Descrição: Biblioteca editável de seis capítulos.
- Fonte/seção: ui.library; original.documents.
- Público/classificação: Fundador autorizado; nunca painel cliente / ADMIN_FOUNDER.
- Entradas: texto de capítulo.
- Saídas: texto salvo localmente.
- Regras: markdown restrito; escape de HTML e URLs.
- Dependências: Contratos existentes e validação local; remoto separado.
- Estado: **PLANNER_LOCAL**.
- Arquivos responsáveis: ui.js; app.js.
- Testes necessários: Validação de entradas, cálculo, separação de observado e simulado; autorização founder.
- Aceitação: HTML e javascript: não executam como conteúdo.

### A17 — Fontes e anotações de evidência

- Descrição: Fontes e anotações de evidência.
- Fonte/seção: ui.sources; original.sources.
- Público/classificação: Fundador autorizado; nunca painel cliente / ADMIN_FOUNDER.
- Entradas: fonte, limite e anotação.
- Saídas: referência e revisão local.
- Regras: anotação não promove verificação automaticamente.
- Dependências: Contratos existentes e validação local; remoto separado.
- Estado: **PLANNER_LOCAL**.
- Arquivos responsáveis: content.mjs; app.js showSource.
- Testes necessários: Validação de entradas, cálculo, separação de observado e simulado; autorização founder.
- Aceitação: 19fontes com limites; preços datados.

### A18 — Roadmap30/60/90 e tarefas

- Descrição: Roadmap30/60/90 e tarefas.
- Fonte/seção: ui.roadmap; original.tasks.
- Público/classificação: Fundador autorizado; nunca painel cliente / ADMIN_FOUNDER.
- Entradas: status e nota da etapa.
- Saídas: checklist local.
- Regras: status todo/doing/done.
- Dependências: Contratos existentes e validação local; remoto separado.
- Estado: **PLANNER_LOCAL**.
- Arquivos responsáveis: app.js; model.normalizeState.
- Testes necessários: Validação de entradas, cálculo, separação de observado e simulado; autorização founder.
- Aceitação: Concluir tarefa não fecha gates do produto.

### A19 — Adicionar etapas próprias

- Descrição: Adicionar etapas próprias.
- Fonte/seção: app.handleAction add/create-task.
- Público/classificação: Fundador autorizado; nunca painel cliente / ADMIN_FOUNDER.
- Entradas: título, critério e fase.
- Saídas: tarefa local.
- Regras: até60tarefas; fases30/60/90.
- Dependências: Contratos existentes e validação local; remoto separado.
- Estado: **PLANNER_LOCAL**.
- Arquivos responsáveis: app.js; model.normalizeState.
- Testes necessários: Validação de entradas, cálculo, separação de observado e simulado; autorização founder.
- Aceitação: Limites e fases preservados em backup.

### A20 — Funil e CAC de aquisição

- Descrição: Funil e CAC de aquisição.
- Fonte/seção: growth; ui.growthResults.
- Público/classificação: Fundador autorizado; nunca painel cliente / ADMIN_FOUNDER.
- Entradas: contatos, demo%, contrato%, gasto e horas.
- Saídas: demos, contratos e CACsimulado.
- Regras: piso por etapa; custo/contratos; tempo opcional.
- Dependências: Contratos existentes e validação local; remoto separado.
- Estado: **IMPLEMENTED_LOCAL**.
- Arquivos responsáveis: backend/finance/launch-planning.ts; LaunchPlanningPanel.tsx.
- Testes necessários: Validação de entradas, cálculo, separação de observado e simulado; autorização founder.
- Aceitação: Denominador zero indisponível; sem conversão inventada.

### A21 — Caixa acumulado30/60/90

- Descrição: Caixa acumulado30/60/90.
- Fonte/seção: budget;founder; ui.simulator.
- Público/classificação: Fundador autorizado; nunca painel cliente / ADMIN_FOUNDER.
- Entradas: empresas/mês, recebimento, extras e setup.
- Saídas: saldo e reserva acumulados.
- Regras: abertura anterior+recebido-saídas; reserva segregada.
- Dependências: Contratos existentes e validação local; remoto separado.
- Estado: **IMPLEMENTED_LOCAL**.
- Arquivos responsáveis: backend/finance/launch-planning.ts; LaunchPlanningPanel.tsx.
- Testes necessários: Validação de entradas, cálculo, separação de observado e simulado; autorização founder.
- Aceitação: Acumular uma vez; tabelas pequenas sem overflow.

### A22 — Comparar mercados e barreiras

- Descrição: Comparar mercados e barreiras.
- Fonte/seção: global; original.markets.
- Público/classificação: Fundador autorizado; nunca painel cliente / ADMIN_FOUNDER.
- Entradas: país e evidência qualitativa.
- Saídas: decisão de descoberta.
- Regras: sem score de demanda inventado.
- Dependências: Contratos existentes e validação local; remoto separado.
- Estado: **PLANNER_LOCAL**.
- Arquivos responsáveis: content.mjs markets; ui.globalView.
- Testes necessários: Validação de entradas, cálculo, separação de observado e simulado; autorização founder.
- Aceitação: Brasil prioritário; demais sem venda presumida.

### A23 — Custos e preços internacionais simulados

- Descrição: Custos e preços internacionais simulados.
- Fonte/seção: global Obrigações; model FX.
- Público/classificação: Fundador autorizado; nunca painel cliente / ADMIN_FOUNDER.
- Entradas: moeda e custos locais aprovados.
- Saídas: estimativa ou indeterminado.
- Regras: FX não substitui cotação, impostos e custo local.
- Dependências: Aprovação/configuração ou dados externos descritos no critério.
- Estado: **BLOCKED_EXTERNAL**.
- Arquivos responsáveis: ORKTO_INTERNATIONALIZATION_2027.md; src/lib/localization.ts.
- Testes necessários: Validação de entradas, cálculo, separação de observado e simulado; autorização founder.
- Aceitação: Não publicar oferta estrangeira sem validação.

### A24 — Revisão legal, consentimento e contratos

- Descrição: Revisão legal, consentimento e contratos.
- Fonte/seção: global;founder; roadmap terms.
- Público/classificação: Fundador autorizado; nunca painel cliente / ADMIN_FOUNDER.
- Entradas: revisão profissional e entidade.
- Saídas: decisão documentada.
- Regras: revisão externa obrigatória; sem inferência legal.
- Dependências: Aprovação/configuração ou dados externos descritos no critério.
- Estado: **BLOCKED_EXTERNAL**.
- Arquivos responsáveis: ORKTO_INTERNATIONALIZATION_2027.md; ORKTO_FOUNDER_FINANCES_2027.md.
- Testes necessários: Validação de entradas, cálculo, separação de observado e simulado; autorização founder.
- Aceitação: Não marcar conclusão jurídica por nota ou código.

### A25 — Calendário e copy por canal

- Descrição: Calendário e copy por canal.
- Fonte/seção: growth Mensagem por canal/Calendário.
- Público/classificação: Fundador autorizado; nunca painel cliente / ADMIN_FOUNDER.
- Entradas: pauta, CTA e autorização.
- Saídas: conteúdo preparado para revisão.
- Regras: nenhum agendamento ou publicação automática.
- Dependências: Contratos existentes e validação local; remoto separado.
- Estado: **PLANNER_LOCAL**.
- Arquivos responsáveis: ORKTO_GROWTH_MARKETING_2027.md; ui.library.
- Testes necessários: Validação de entradas, cálculo, separação de observado e simulado; autorização founder.
- Aceitação: Fixtures identificadas; canais não inventados.

### A26 — Métricas observadas de aquisição e retenção

- Descrição: Métricas observadas de aquisição e retenção.
- Fonte/seção: growth Funil; roadmap funnel.
- Público/classificação: Fundador autorizado; nunca painel cliente / ADMIN_FOUNDER.
- Entradas: coortes e receitas conciliadas.
- Saídas: CAC/churn/NRR/payback observados.
- Regras: denominadores e períodos reais.
- Dependências: Aprovação/configuração ou dados externos descritos no critério.
- Estado: **BLOCKED_EXTERNAL**.
- Arquivos responsáveis: FinanceDashboard.tsx.
- Testes necessários: Validação de entradas, cálculo, separação de observado e simulado; autorização founder.
- Aceitação: Ausência de dados não vira métrica0.

### A27 — Piloto e gates de prontidão

- Descrição: Piloto e gates de prontidão.
- Fonte/seção: original.launchFlow; roadmap release/pilot.
- Público/classificação: Fundador autorizado; nunca painel cliente / ADMIN_FOUNDER.
- Entradas: evidências G/B e autorização.
- Saídas: matriz de gates.
- Regras: checklist não é autorização operacional.
- Dependências: Aprovação/configuração ou dados externos descritos no critério.
- Estado: **BLOCKED_EXTERNAL**.
- Arquivos responsáveis: ORKTO_LAUNCH_2027_MASTER.md.
- Testes necessários: Validação de entradas, cálculo, separação de observado e simulado; autorização founder.
- Aceitação: NO até homologação e aprovação.

### A28 — Ledger interno, realizado e previsto

- Descrição: Ledger interno, realizado e previsto.
- Fonte/seção: finance;founder fechamento.
- Público/classificação: Fundador autorizado; nunca painel cliente / ADMIN_FOUNDER.
- Entradas: lançamentos e comprovantes.
- Saídas: dashboard e forecast13semanas.
- Regras: reconciliação por período e base.
- Dependências: Contratos existentes e validação local; remoto separado.
- Estado: **PARTIAL**.
- Arquivos responsáveis: backend/core-app.ts internal/finance; FinanceDashboard.tsx.
- Testes necessários: Validação de entradas, cálculo, separação de observado e simulado; autorização founder.
- Aceitação: Founder no servidor; sem receita sem comprovante.

### A29 — Acesso privado do fundador

- Descrição: Acesso privado do fundador.
- Fonte/seção: founder Separação; requisito missão11.
- Público/classificação: Fundador autorizado; nunca painel cliente / ADMIN_FOUNDER.
- Entradas: sessão founder validada.
- Saídas: ferramentas administrativas internas.
- Regras: gate is_founder servidor, UI lazily loaded.
- Dependências: Contratos existentes e validação local; remoto separado.
- Estado: **IMPLEMENTED_LOCAL**.
- Arquivos responsáveis: backend/core-app.ts; src/App.tsx.
- Testes necessários: Validação de entradas, cálculo, separação de observado e simulado; autorização founder.
- Aceitação: Não-founder recebe403; nenhum capítulo privado em painel comercial.

### C01 — Cliente→negócio→proposta→próximo passo

- Descrição: Cliente→negócio→proposta→próximo passo.
- Fonte/seção: original.commercialFlow; growth demo.
- Público/classificação: Membro autorizado do workspace conforme papel / COMMERCIAL_PRODUCT.
- Entradas: dados de empresa autorizada.
- Saídas: registros comerciais persistidos.
- Regras: workspace autenticado.
- Dependências: Contratos existentes e validação local; remoto separado.
- Estado: **PARTIAL**.
- Arquivos responsáveis: backend/operational-routes.ts; src/product/screens.
- Testes necessários: Isolamento RLS/API/Edge, erros, idempotência e jornada autorizada.
- Aceitação: Repetir journey remoto após publicação aprovada.

### C02 — Propostas e orçamento revisáveis

- Descrição: Propostas e orçamento revisáveis.
- Fonte/seção: growth Posicionamento/demo.
- Público/classificação: Membro autorizado do workspace conforme papel / COMMERCIAL_PRODUCT.
- Entradas: itens, preço e cliente.
- Saídas: proposta e estados.
- Regras: contrato atual e aprovação.
- Dependências: Contratos existentes e validação local; remoto separado.
- Estado: **PARTIAL**.
- Arquivos responsáveis: src/components/CreateQuote.tsx; backend/core-app.ts.
- Testes necessários: Isolamento RLS/API/Edge, erros, idempotência e jornada autorizada.
- Aceitação: Sem preço inventado; escopo por workspace.

### C03 — Radar e recuperação assistida

- Descrição: Radar e recuperação assistida.
- Fonte/seção: growth demo; launch master.
- Público/classificação: Membro autorizado do workspace conforme papel / COMMERCIAL_PRODUCT.
- Entradas: registros e evidências de prazo.
- Saídas: recomendação e preparação.
- Regras: engine determinística somente leitura.
- Dependências: Contratos existentes e validação local; remoto separado.
- Estado: **PARTIAL**.
- Arquivos responsáveis: backend/orkto-core/radar.ts; today-v2-page.tsx.
- Testes necessários: Isolamento RLS/API/Edge, erros, idempotência e jornada autorizada.
- Aceitação: Leituras não criam tarefa ou envio.

### C04 — WIA com contexto e aprovação

- Descrição: WIA com contexto e aprovação.
- Fonte/seção: growth demo; commercialFlow.
- Público/classificação: Membro autorizado do workspace conforme papel / COMMERCIAL_PRODUCT.
- Entradas: pedido humano e fontes autorizadas.
- Saídas: rascunho/ação para aprovação.
- Regras: Mutation Gateway/WIAOS; fonte não é comando.
- Dependências: Contratos existentes e validação local; remoto separado.
- Estado: **PARTIAL**.
- Arquivos responsáveis: _shared/whatsapp-reply.ts; wia-workspace.tsx.
- Testes necessários: Isolamento RLS/API/Edge, erros, idempotência e jornada autorizada.
- Aceitação: Sem modelo ou envio externo automático.

### C05 — WhatsApp oficial integrado

- Descrição: WhatsApp oficial integrado.
- Fonte/seção: unit custoCanal; missãoP0.
- Público/classificação: Membro autorizado do workspace conforme papel / COMMERCIAL_PRODUCT.
- Entradas: App/WABA/número/token autorizado.
- Saídas: mensagem persistida e recibo.
- Regras: Graph oficial e HMAC; nunca WhatsAppWeb.
- Dependências: Aprovação/configuração ou dados externos descritos no critério.
- Estado: **BLOCKED_EXTERNAL**.
- Arquivos responsáveis: orkto-meta-webhook; _shared/meta-send.ts; ConversationView.tsx.
- Testes necessários: Isolamento RLS/API/Edge, erros, idempotência e jornada autorizada.
- Aceitação: Rodada remota autorizada entrada→resposta→recibo.

### C06 — Cinco planos e Enterprise sob consulta

- Descrição: Cinco planos e Enterprise sob consulta.
- Fonte/seção: unit; original model.PLANS e documentos.
- Público/classificação: Membro autorizado do workspace conforme papel / COMMERCIAL_PRODUCT.
- Entradas: versão de catálogo comercial.
- Saídas: Start79.90/Pro149.90/Business299.90/Scale599.90/Enterpriseconsulta.
- Regras: sem novos planos ou franquias.
- Dependências: Contratos existentes e validação local; remoto separado.
- Estado: **PARTIAL**.
- Arquivos responsáveis: BillingPage.tsx; supabase/functions/orkto-core-mutations/_shared/subscription-policy.ts.
- Testes necessários: Isolamento RLS/API/Edge, erros, idempotência e jornada autorizada.
- Aceitação: Preservar catálogo; não publicar políticas pendentes.

### C07 — Pulso e Cost Governor

- Descrição: Pulso e Cost Governor.
- Fonte/seção: unit Pulso; roadmap costs.
- Público/classificação: Membro autorizado do workspace conforme papel / COMMERCIAL_PRODUCT.
- Entradas: classe operacional e quota aprovada.
- Saídas: ledger e bloqueio de custo.
- Regras: Pulso não é token ou dinheiro.
- Dependências: Contratos existentes e validação local; remoto separado.
- Estado: **PARTIAL**.
- Arquivos responsáveis: _shared/cost-governor.ts; PulsoScenario.tsx.
- Testes necessários: Isolamento RLS/API/Edge, erros, idempotência e jornada autorizada.
- Aceitação: Franquias dependem de aprovação.

### C08 — Assinatura e conciliação

- Descrição: Assinatura e conciliação.
- Fonte/seção: original.launchFlow;commercialFlow pagamento.
- Público/classificação: Membro autorizado do workspace conforme papel / COMMERCIAL_PRODUCT.
- Entradas: customer sandbox e webhook autenticado.
- Saídas: assinatura/recebimento confirmado.
- Regras: B01-B13 antes de cobrar.
- Dependências: Aprovação/configuração ou dados externos descritos no critério.
- Estado: **BLOCKED_EXTERNAL**.
- Arquivos responsáveis: _shared/billing; BillingPage.tsx.
- Testes necessários: Isolamento RLS/API/Edge, erros, idempotência e jornada autorizada.
- Aceitação: Sem cobrança real nesta missão.

### C09 — Onboarding, suporte e privacidade

- Descrição: Onboarding, suporte e privacidade.
- Fonte/seção: roadmap landing/support; growth antes de abrir.
- Público/classificação: Membro autorizado do workspace conforme papel / COMMERCIAL_PRODUCT.
- Entradas: perfil, termos e suporte aprovados.
- Saídas: onboarding e conteúdo de ajuda.
- Regras: fluxo honesto sem contato falso.
- Dependências: Contratos existentes e validação local; remoto separado.
- Estado: **PARTIAL**.
- Arquivos responsáveis: src/App.tsx (onboarding existente); management-page.tsx.
- Testes necessários: Isolamento RLS/API/Edge, erros, idempotência e jornada autorizada.
- Aceitação: Acesso e coleta consentidos; revisão de suporte pendente.

### C10 — Google-only, papéis e isolamento

- Descrição: Google-only, papéis e isolamento.
- Fonte/seção: original.launchFlow Homologar; launch master.
- Público/classificação: Membro autorizado do workspace conforme papel / COMMERCIAL_PRODUCT.
- Entradas: identidades autorizadas.
- Saídas: sessão/workspace.
- Regras: RLS/API/Edge com negação cruzada.
- Dependências: Aprovação/configuração ou dados externos descritos no critério.
- Estado: **BLOCKED_EXTERNAL**.
- Arquivos responsáveis: pilot-access.mjs; tenant-context; G01-G12.
- Testes necessários: Isolamento RLS/API/Edge, erros, idempotência e jornada autorizada.
- Aceitação: Não recriar A/B nem promover teste local.

### C11 — Web/mobile e localização

- Descrição: Web/mobile e localização.
- Fonte/seção: global Preparação técnica; roadmap landing.
- Público/classificação: Membro autorizado do workspace conforme papel / COMMERCIAL_PRODUCT.
- Entradas: viewport e locale.
- Saídas: navegação/formatação.
- Regras: pt-BR/BRL; tradução integral não implementada.
- Dependências: Contratos existentes e validação local; remoto separado.
- Estado: **PARTIAL**.
- Arquivos responsáveis: src/lib/localization.ts; src/product/navigation.
- Testes necessários: Isolamento RLS/API/Edge, erros, idempotência e jornada autorizada.
- Aceitação: Browser QA não equivale a Android/iPhone físicos.

## Preservação e limites operacionais

Preços: Start R$79,90; Pro R$149,90; Business R$299,90; Scale R$599,90; Enterprise sob consulta. As quatro entradas numéricas do planner não constituem um catálogo com somente quatro ofertas; Enterprise permanece sem preço fixo. Não foram criados planos adicionais, tarifas, franquias, campanhas, usuários ou permissões. O gate founder continua no servidor.

Internacionalização mantém comparação qualitativa e formatação; revisão jurídica, tradução integral e oferta estrangeira não foram fabricadas. O calendário é pauta editável, não publicação/agendamento executado. Dados de aquisição e retenção observados aguardam coortes e conciliação.

READY_FOR_PRODUCTION_CANDIDATE=NO

## Cobertura local desta rodada

25 requisitos têm ao menos uma asserção local ou interação de fixture relacionada. Isso NÃO significa que todos os critérios de aceitação desses requisitos passaram. A evidência por ID consta do JSON acompanhante; fonte publicada, dados reais, decisões comerciais e jornadas remotas permanecem separadas. Os 12 testes originais e a verificação do artefato foram executados novamente sem editar o planner original.
