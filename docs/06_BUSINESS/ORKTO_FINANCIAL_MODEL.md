# ORKTO — modelo financeiro interno (POK)

**Atualizado:** 26/09/2026 · **Estado:** primeira implementação local; migration ainda precisa ser aplicada/validada no Supabase antes do uso operacional.

## Escopo e honestidade

O painel é interno e acessível somente a perfis com `profiles.is_founder = true`, validado novamente pelo servidor em cada chamada. `POK` foi mantido como rótulo pedido pelo produto; a sigla e sua definição oficial não constam nos prompts/documentos encontrados e precisam de confirmação. “POK Caixa” usa fluxo de caixa; “POK Econômico” compara receita recorrente projetada a COGS técnico. Esses nomes não são relatórios contábeis.

## Definições

- **MRR observado:** última cobrança confirmada no período recente por usuário, apenas registros sem `quote_id` e sem o prefixo sintético `checkout:`; pagamento anual é dividido por 12. Cobertura de pagamentos é comparada aos perfis com plano pago. Como o checkout atual cria assinatura recorrente mensal mas grava o evento `CHECKOUT_PAID` como `checkout:<id>`, novos assinantes podem ficar fora do MRR observado até chegar uma cobrança recorrente identificável.
- **ARR:** MRR observado × 12 (run-rate, não receita reconhecida no ano).
- **ARPA:** MRR observado ÷ assinantes com pagamento reconciliado.
- **COGS técnico observado:** infraestrutura, IA, processador e `other` lançados como `actual`; canais são mantidos fora deste denominador e mostrados separadamente. Pessoas e impostos não entram no COGS técnico, mas despesas pagas dessas categorias permanecem no fluxo de caixa. O lançamento `other` ainda requer disciplina de classificação.
- **Margem econômica:** MRR/projeção − COGS técnico. Não é lucro líquido: não inclui canais, impostos, equipe nem custos corporativos que não tenham sido lançados.
- **Resultado após canais:** margem econômica − custo de canal. Ainda não representa lucro contábil.
- **Fluxo de caixa do mês:** receitas de assinatura confirmadas mais outras receitas internas realizadas, menos despesas internas marcadas pagas. Valores previstos/normalizados não alteram o realizado.
- **Base normalizada:** despesas marcadas `normalized` têm COGS, percentual sobre MRR, margem econômica e resultado após canais separados da base `actual`. Essa visão continua gerencial e não substitui fatura ou conciliação.
- **POK Caixa final estimado:** caixa de abertura (premissa editável) + fluxo realizado observado.
- **Ponto de equilíbrio da simulação:** custos fixos técnicos ÷ contribuição mensal por workspace; não é calculado se contribuição for zero ou negativa.

## Premissas e fontes

`backend/finance/finance-model.ts` centraliza os defaults e fórmulas determinísticas. A migration cria configuração JSONB versionada e lançamentos financeiros com RLS habilitada, sem grants às roles de navegador; as rotas server-side usam service role somente após confirmar o papel fundador.

O seed é `draft`, não uma decisão comercial: preços Starter R$ 79,90, Pro R$ 149,90, Business R$ 299,90, Scale R$ 599,90 e Enterprise R$ 1.499,90; mix de clientes 60/25/10/4/1; multiplicadores POK/Base/Favorável 0,7/1/1,3 para receita e 1,2/1/0,9 para custos. Os preços Starter–Scale vieram da diretiva com estado “em validação”; Enterprise e mix são hipóteses operacionais iniciais e devem ser substituídos. Todos são editáveis e cada salvamento cria uma versão rascunho. A página pública de planos e os checkouts continuam separados e não foram alterados.

Valores de custo começam zerados porque nenhuma fonte confiável informa custo normalizado de Gemini, infra, canal ou processador. A aplicação registra manualmente valor, atual/normalizado, pago/previsto, categoria e associação opcional a workspace/provider/model/feature. O custo por IA é estimado a partir de tokens somente quando existe rate card e câmbio configurados/versionados; não é uma fatura e não entra no COGS reconciliado. A identificação do custo por workspace usa o `user_id` atual como proxy, pois o schema do produto ainda não tem entidade Workspace persistida. Enquanto faltarem custos e tarifas reais, o painel avisa que margem e equilíbrio não são confiáveis.

## Segurança e limites

- Tabelas internas não concedem acesso Data API a `anon`/`authenticated`; a leitura/escrita ocorre só via servidor.
- O usuário é autenticado por Supabase Auth, e o perfil fundador é validado no banco em cada endpoint; ocultar menu não é a proteção.
- `workspace_id` é opcional e aponta para usuário/workspace atual; tenancy multiusuário ainda não existe.
- Lançamentos não são apagados pela UI. Correções devem ser aditivas, com nota e referência.
- O endpoint não altera cobrança, preços de checkout, planos de clientes, nem secrets.

## Pendências para oficializar

1. Definir o significado formal de POK e quais bases de caixa/econômica devem compor cada relatório.
2. Aprovar preços, Enterprise, composição de planos, mix, premissas fiscais e fatores dos cenários.
3. Importar custos reais de Gemini por modelo/feature e custos de infraestrutura/canais após definir suas fontes e moeda.
4. Aplicar a migration no banco autorizado, validar role fundadora e testar isolamento no ambiente integrado.
5. Resolver a reconciliação/deduplicação de `CHECKOUT_PAID` versus cobranças recorrentes Asaas. Hoje `checkout:*` é deliberadamente excluído do MRR e das entradas de caixa para evitar possível contagem dupla; isso subconta o primeiro pagamento de assinaturas novas. Não remover a exclusão até haver chave de vínculo confiável entre checkout e payment.
6. Reconciliar pagamentos Asaas, estornos, inadimplência e mensal/anual com os registros de assinatura antes de chamar MRR de financeiro oficial.
7. Integrar custos por workspace real depois de introduzir a entidade Workspace; hoje o vínculo é ao usuário proprietário.
