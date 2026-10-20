# Asaas sandbox — configuração pelo proprietário

## Atualização de 20/10/2026

Login sandbox confirmado. O agente já salvou no Edge staging `APP_ENV=staging`, `ASAAS_ENVIRONMENT=sandbox` e ambas as flags billing/lifecycle em `OFF`, com digests conferidos. Não repetir essas etapas nem pedir o login novamente. `ASAAS_API_KEY` e `ASAAS_WEBHOOK_SECRET` continuam ausentes. O cadastro nominal de teste encontrado tem notificações ativas e assinatura legada; não está aprovado para a rodada. [Matriz vigente e passos que ainda exigem aprovação](STAGING_CLOSURE_2026-10-20.md).

**Preparação, não execução financeira. READY_FOR_PRODUCTION_CANDIDATE=NO.** Aplicável ao runtime a2a3651 e Supabase staging `ghrjongiodziasupakrk`. Nenhuma etapa abaixo foi presumida concluída. O preflight existente continua GET-only.

## 1. Identificar a conta e o customer

1. Entre diretamente em [sandbox.asaas.com](https://sandbox.asaas.com/), usando a conta exclusivamente de homologação. Confirme o ambiente antes de gerar qualquer chave. Sandbox e produção usam contas/chaves separadas, conforme o [guia oficial](https://docs.asaas.com/docs/sandbox).
2. Reutilize customer de teste existente se houver. Caso precise criar, o proprietário deve aprovar esse customer sintético e o workspace staging ao qual será vinculado. Não usar os dados de um cliente real. Não se cria nova conta Google, workspace ou papel para o teste.
3. No cadastro de teste, deixe notificações de cobrança desativadas (`notificationDisabled=true` no contrato da [API de customers](https://docs.asaas.com/reference/create-new-customer)); não use contatos de terceiros. Não iniciar cobrança para descobrir se há notificações. O sandbox pode enviar mensagens.
4. Registre somente identificador da conta sandbox, customer `cus_...`, workspace aprovado e confirmação de origem sintética. Isso não inclui chave, senha, CPF/CNPJ ou dados de contato. Aprovação de B como owner não é aprovação automática para billing.
5. Antes da rodada, o operador autorizado executará `preflightAsaasSandbox` existente, em runtime seguro, com chave obtida diretamente do secret store em memória. Ele consulta apenas `GET /customers/{id}` e `GET /customers/{id}/notifications` no host `api-sandbox.asaas.com/v3`. Não passar a chave por argumento, arquivo local ou chat. Snapshot vazio/incompleto é bloqueio; todos os canais precisam estar comprovadamente inativos. O preflight não desliga canais por conta própria.

## 2. Cadastrar segredos diretamente no staging

1. Na conta sandbox, abra **Integrações → Chaves de API** e gere/reutilize chave exclusiva para esta homologação, conforme [instruções oficiais](https://docs.asaas.com/docs/chaves-de-api). Não gere chave em produção.
2. Abra o [secret store Edge staging](https://supabase.com/dashboard/project/ghrjongiodziasupakrk/functions/secrets). Confira o project ref no URL; não usar `qneqljlphgkptebsaonb`.
3. Cadastre `ASAAS_API_KEY` diretamente do fornecedor nesse painel. Nunca envie seu valor ao agente, copie para o repositório ou configure no frontend/Vercel Preview.
4. Gere no seu gerenciador seguro um segredo exclusivo de webhook, aleatório e com pelo menos 32 caracteres, distinto da API key. Cadastre-o como `ASAAS_WEBHOOK_SECRET` no mesmo painel. Use o mesmo valor apenas no campo de autenticação do webhook da conta sandbox; não incluir no URL.
5. Configure `APP_ENV=staging` e `ASAAS_ENVIRONMENT=sandbox` no Edge staging. `SUPABASE_URL` é reservado e já fornecido pelo Supabase; não recriar/substituir. Mantenha **`ORKTO_BILLING_SANDBOX_ENABLED=OFF`** e **`ORKTO_BILLING_SANDBOX_LIFECYCLE_ENABLED=OFF`** (ou ausentes). Não alterar outras integrações/secrets.

## 3. Preparar o callback sem gerar cobranças

No cadastro de Webhooks da conta **sandbox**, configure um callback dedicado:

- URL: `https://ghrjongiodziasupakrk.supabase.co/functions/v1/orkto-billing-webhook`.
- Token de autenticação: o mesmo segredo exclusivo acima. O contrato do handler usa o header `asaas-access-token`; não usar bearer Supabase ou a API key como token do webhook.
- Eventos necessários à matriz: pagamentos criados/atualizados/confirmados/recebidos/vencidos/excluídos/restaurados/reembolsados que o fornecedor disponibilizar, e `SUBSCRIPTION_CREATED`, `SUBSCRIPTION_UPDATED`, `SUBSCRIPTION_INACTIVATED`, `SUBSCRIPTION_DELETED`. Conferir o catálogo atual da conta e [eventos oficiais de assinatura](https://docs.asaas.com/docs/subscription-events); nome ausente/divergente deve ser resolvido antes de executar, não inventado.
- Não dispare cobrança ou evento financeiro de teste nessa preparação. O handler exige configuração e relê o fornecedor; entrega HTTP não é prova de reconciliação aprovada. Com flags OFF, CONFIGURATION_REQUIRED é esperado e não autoriza abrir o checkout.

## 4. Habilitação controlada posterior

Somente depois de identidade sandbox/customer, snapshot de notificações, callback e autorização da rodada conferidos:

1. Operador registra o vínculo aprovado em `orkto_billing_customers` usando os campos existentes `workspace_id`, `provider='asaas'`, `environment='sandbox'`, `customer_ref`, `approved_by`, com evidência/auditoria da aprovação real. Não inserir IDs inventados, grants ou papéis para fazer o gate passar. Não fornecemos um INSERT executável antes de conhecer/aprovar esses identificadores.
2. Revisar o escopo das assinaturas exclusivamente de teste. Só então habilitar flags de sandbox/lifecycle pelo período da rodada autorizada, mantendo checkout comercial e notificações fechados.
3. Executar B01–B13 do roteiro vigente; confirmação financeira deve vir do procedimento de teste do fornecedor, nunca de webhook forjado contado como financeiro real.
4. Cancelamento/inativação são observações técnicas; efeito no acesso depende da política comercial ainda pendente. Não publicar grace period/corte unilateral.
5. Ao terminar, fechar flags de execução, conferir o encerramento das assinaturas sintéticas e preservar auditoria/evidências sem chaves ou dados pessoais.

## Retorno mínimo ao agente

Informar somente: identificador da conta sandbox, customer `cus_...`, workspace aprovado, confirmação de configuração no secret store e de notificações inativas, e autorização explícita da rodada controlada. **Não enviar chaves, segredo do webhook, senhas ou tokens.** Esse retorno será verificado; não promove automaticamente nenhum caso B a PASS.
