## Execução autônoma vigente — 19/10/2026

**READY_FOR_PRODUCTION_CANDIDATE=NO.** [Relatório e dependências atuais](AUTONOMOUS_HOMOLOGATION_2026-10-19.md): source601e519 integra Playwright/SDK Google PKCE ao motor existente, com contextos Chrome isolados reais e callback aprovado. Tentativa chegou a login humano A; G01–G12 NOT_TESTED. Não repetir o diagnóstico antigo de adaptador inexistente. 289 app + 105 readiness, 26 provider focados, lint/build/scan e CI PostgreSQL17/restore PASS. Correções Gemini/Meta implementadas e testadas na PR, **não implantadas**; runtime a2a3651 preservado durante a rodada fixada. Asaas exige login; B01–B13 NOT_TESTED. Histórico abaixo preservado e sujeito a este estado mais recente.

## Atualização vigente — G06/G08 implementados em 40fcfdc

**READY_FOR_PRODUCTION_CANDIDATE=NO.** [Engenharia e matriz por ambiente](G06_G08_ENGINEERING_2026-10-17.md): G06 (escritas cruzadas com observação independente) e G08 (reuse fora das exceções) implementados no motor existente, source `40fcfdcc6effb6d2bd32f875e39e4e81b30b1e29`. **39/39 testes de ferramentas + 22/22 deploy boundary PASS**, lint/sintaxe/build isolado/secret scan e CI PostgreSQL17/deploy boundary PASS. As menções abaixo à cobertura ausente são históricas e foram superadas nesta engenharia. G01–G12 reais continuam NOT_TESTED, executor PKCE BLOCKED_EXTERNAL; Asaas configuração BLOCKED_EXTERNAL e B01–B13 NOT_TESTED. [Configuração exata pelo proprietário](ASAAS_SANDBOX_OWNER_SETUP.md). Runtime a2a3651 preservado, sem deploy, mudança cloud ou produção.

## Inspeção vigente — 17/10/2026

**READY_FOR_PRODUCTION_CANDIDATE=NO.** [Matriz e evidências atuais](REAL_GATES_CHECKPOINT_2026-10-17.md): runtime a2a3651 confirmado READY, motores c40fba9 preservados; zero custom secrets e customers sandbox. Executor Google isolado BLOCKED_EXTERNAL; G01–G12 e B01–B13 NOT_TESTED. G06/G08 também têm cobertura ainda ausente no motor, além do impedimento externo. Nenhum teste real, fornecedor, deploy ou alteração cloud nesta rodada. PASS anteriores preservados.

# ORKTO — continuação da homologação, 16/10/2026

**READY_FOR_PRODUCTION_CANDIDATE=NO.** PR #2 permanece aberta, sem merge. Somente staging foi alterado. Esta matriz substitui o estado corrente do [relatório 4506803](STAGING_HOMOLOGATION_4506803_2026-10-16.md), cujas evidências históricas permanecem preservadas.

## Identidade das evidências

- Código executável: `a2a3651319196ffc56813992f705692d368ef967`.
- [Preview novo](https://orkto-staging-az36qohmo-peixoto-s-projects1.vercel.app/), deployment `dpl_56dgXZ3um4wFAVsQZjUdyTUzHvLn`, projeto `orkto-staging`, target `null`/Preview, estado READY.
- Supabase exclusivamente `ghrjongiodziasupakrk`: 50 migrations, core Edge v30/JWT obrigatório, billing webhook v2/segredo dedicado. O JWT desativado no webhook é a configuração anterior, necessária ao callback do fornecedor; o segredo continua obrigatório antes de persistir qualquer evento.
- Migration local `20261016182215_billing_native_lifecycle`, versão remota `20261016183159`; SHA256 `1D54697BADE8FBF0A04B039F41A10B0ED86DC85EFCA684CF99EA0ACAC344701A`.
- Google B foi comprovado inicialmente no Preview **4506803**, antes da implantação Edge v30/migration 50. Após nova confirmação do proprietário, o redirect de a2a3651 foi salvo e um novo login Google B, callback e reload foram efetivamente executados em **a2a3651 / DB50 / core30**. São provas distintas. O Preview antigo agora compartilha o banco e Edge atualizados; sua evidência histórica descreve a configuração vigente no momento do teste.
- [Registro estruturado e advisors](evidence/staging-homologation-a2a3651.json), [regressão completa](evidence/regression-a2a3651.log), [billing focado](evidence/billing-focused-a2a3651.log), [build](evidence/build-a2a3651.log), [probe público](evidence/public-preview-a2a3651.json).

## Matriz de gates

### Avanço autônomo — ferramentas sem credenciais

**Versão final das ferramentas: c40fba9789206b0206902d966cdd1ed8c6593e71 — 25/25 testes offline PASS**, com verificação da membership aprovada antes de acessar qualquer API de workspace. [Estado vigente das ferramentas e CI](HOMOLOGATION_TOOLS_CURRENT.md). A versão-base 1c4f4a9 abaixo preserva seus 24 testes históricos; não é o total final. Aquisição Google/execuções reais/Asaas continuam bloqueados ou NOT_TESTED, sem novo deployment.

Source das ferramentas `1c4f4a93c86301c2fe0bb25f49f0cb00b1f2806e`; runtime de referência a2a3651 preservado. Implementados motor HTTP Google A/B em memória e preflight Asaas GET-only, com **24 testes offline PASS**, lint/sintaxe e saída sanitizada. CLI sem adaptadores retorna BLOCKED_EXTERNAL/exit2, sem rede. [Detalhes e limites](HOMOLOGATION_TOOLS_1C4F4A9.md).

| Gate | Estado | SHA / evidência |
| --- | --- | --- |
| Motor HTTP A/B + preflight Asaas read-only | PASS | Source 1c4f4a9, fixtures locais; [24 testes](evidence/homologation-tools-1c4f4a9.txt). Não certifica fornecedores reais. |
| CI das ferramentas | PASS | Source 1c4f4a9; [deploy boundary + 24 fixtures](https://github.com/peixotodavy831-stack/Orktoverdadeiro/actions/runs/38986371314). |
| Fechamento sem credenciais/adaptadores | PASS | Source 1c4f4a9; [CLI exit2](evidence/homologation-tools-cli-1c4f4a9.jsonl), zero requisições de rede. |
| Aquisição Google PKCE em dois contextos | BLOCKED_EXTERNAL | Adaptador real não disponível. O motor pronto não extrai tokens de abas, não cria usuários nem implementa isolamento por mera flag. |
| Execução real A/B/tokens | NOT_TESTED | Alvo a2a3651; ações de escrita cruzada e reuse fora das exceções também continuam explicitamente NOT_TESTED. |
| Customer/credenciais e notificações Asaas reais | BLOCKED_EXTERNAL | Customer exclusivamente de teste e configuração segura ainda não informados; preflight preparado não faz chamadas sem esses dados. |

Nenhuma nova migration, mudança de API/Edge, implantação ou política comercial foi feita. Código de src/backend/Supabase/package permanece idêntico ao runtime a2a3651; não foi criado outro Preview/redirect. **READY_FOR_PRODUCTION_CANDIDATE=NO.**

### Rodada final de pré-requisitos — 16/10/2026, 22:11 UTC

Inspeção de código e consultas administrativas somente de leitura, com runtime de referência a2a3651 e source documental b06b29c. Não houve novo login, migration, deploy, chamada de fornecedor nem repetição dos testes aprovados. [Evidência desta rodada](evidence/final-security-billing-prerequisites-a2a3651.json) e [roteiro dos casos ainda não executados](FINAL_SECURITY_BILLING_EXECUTION_A2A3651.md).

| Gate restante / inspeção | Estado | Ambiente / SHA | Evidência atual |
| --- | --- | --- | --- |
| Executor Google A/B compatível | BLOCKED_EXTERNAL | Source b06b29c, runtime alvo a2a3651 | Launcher existente usa senha e possui guarda contra Google-only. IAB disponível não fornece executor de transporte em dois contextos Google isolados. Launcher legado não executado. Não criadas outras contas/workspaces. |
| A/B HTTP bidirecional, RLS/API/Edge/PostgREST | NOT_TESTED | Alvo a2a3651; não executado | Depende do executor acima; provas SQL e login/reload anteriores preservados, sem simulação HTTP. |
| Refresh/rotação, expiração natural, revogação e replay | NOT_TESTED | Alvo a2a3651; não executado | Nenhum JWT/refresh token extraído ou guardado. Não se alterou TTL nem relógio. |
| Configuração Asaas real sandbox | BLOCKED_EXTERNAL | Supabase staging ghrjongiodziasupakrk | Consulta atual: zero customers aprovados/bindings/comandos/eventos. Painel confirma zero secrets personalizados. Nenhuma flag habilitada. |
| Notificações Asaas externas desativadas | NOT_TESTED | Conta/customer externos não disponibilizados | Não foi possível conferir no fornecedor; ausência de credencial não prova notificações OFF. |
| Casos reais de assinatura/pagamento/webhook | NOT_TESTED | Alvo a2a3651; nenhum request Asaas | Casos B01–B13 no roteiro. Fixtures e CI anteriores não substituem processamento sandbox real. |
| Política comercial de término de acesso | BLOCKED_EXTERNAL | a2a3651 preservado | Aprovação comercial ainda pendente; nenhuma política semeada ou timing inventado. |
| Catálogo comercial remoto | PASS | Consulta SQL staging 22:11 UTC, vinculada ao alvo a2a3651 | Exatamente cinco ofertas: Start7990/Pro14990/Business29990/Scale59990 centavos BRL, Enterprise sem valor fixo. |
| Gemini/Meta/Pulso reais | BLOCKED_EXTERNAL | Configuração staging | Zero secrets personalizados, políticas Pulso e tarifas. Provider/tier/permissões ainda não verificados; nenhuma inferência/mensagem executada. |
| Recuperação real | BLOCKED_EXTERNAL | Escopo externo preservado | Destino privado, credencial, RPO/RTO e restore isolado pendentes. Prova CI anterior preservada; recursos gerenciados não reensaiados. |

Nenhum FAIL novo constatado; os casos bloqueados/não executados não foram aprovados. **READY_FOR_PRODUCTION_CANDIDATE=NO.** A intervenção Asaas solicitada restringe-se a identificar conta/customer de teste, conferir notificações e cadastrar credenciais diretamente no secret store, nunca no chat. Aprovações de B, workspace e redirect continuam resolvidas.

### Resultados anteriores preservados por SHA

PASS qualifica somente o escopo descrito. Não significa aprovação de toda a fase. `NOT_TESTED` significa que a execução não ocorreu; não existe aprovação por inferência.

| Gate | Estado | SHA / ambiente realmente executado | Evidência e limite |
| --- | --- | --- | --- |
| Redirect, Google A, persistência, logout e Enterprise anteriores | PASS | 4506803, DB49/core29 | Herdado do relatório anterior; não repetido nem transferido ao novo candidato. |
| Google B real | PASS | 4506803, DB49/core29 | Conta B com identidade Google, sessão ativa e workspace próprio; [captura](evidence/google-b-4506803.png). Onboarding mantido sem dados inventados. |
| Google B real e persistência no novo candidato | PASS | a2a3651, DB50/core30 | Seleção da conta Google B, retorno ao host exato, callback consumido e UI autenticada após reload. [Login](evidence/google-b-a2a3651.png), [reload](evidence/google-b-a2a3651-reload.png). Consulta administrativa confirmou identidade Google, sessão ativa, uma membership owner no workspace B e zero memberships estrangeiras. Nenhum dado de onboarding inventado. |
| Papel B e isolamento de vínculos | PASS | Banco staging antes da migration50 | Owner somente no workspace B, conforme autorização explícita de 30 dias; nenhuma membership na empresa A. A conta não foi criada com senha. |
| RLS B → A, contexto SQL | PASS | Banco staging, DB49 | Papel `authenticated`, claims configuradas no SQL usando identidade/sessão real B: workspace próprio permitido; membership/admin da empresa A negados; clients/contacts/members de A não visíveis. Não é teste HTTP com JWT. |
| Guarda de sessão ausente | PASS | Banco staging, DB49 | Helper nega contexto de claims sem linha correspondente em auth.sessions. Não substitui replay de JWT/refresh token. |
| A/B bidirecional por HTTP em API, Edge e PostgREST | NOT_TESTED | Nenhum SHA certificado | Não houve captura nem replay de tokens reais. A sessão A estava encerrada. Superfície de navegador disponível não fornece executor com dois contextos autenticados e transporte controlado. |
| Refresh, expiração natural e replay de credenciais revogadas | NOT_TESTED | Nenhum SHA certificado | Expiração natural não foi observada; não se alterou relógio/TTL nem se fabricou JWT. Revogação do teste anterior não prova replay. |
| Adaptador/ciclo nativo Asaas e cenários adversariais | PASS | a2a3651, fixtures locais | 19/19 testes focados: PUT/DELETE, flag obrigatória, estado autoritativo, replay, conflito/negação, indisponibilidade e deleção com 404. Nenhuma requisição ao fornecedor real. |
| Regressão aplicação/readiness | PASS | a2a3651, local isolado | 285/285 aplicação + 61/61 ferramentas. Lint, typecheck Edge e build aprovados. Primeira execução detectou duas expectativas antigas de contagem 49; fixtures atualizadas para 50 e regressão inteira repetida com sucesso. |
| Replay, upgrade, SQL lifecycle, segurança e restore sintético | PASS | a2a3651, PostgreSQL17 descartável | [CI 38947818611](https://github.com/peixotodavy831-stack/Orktoverdadeiro/actions/runs/38947818611). Não comprova restore real do staging/Auth/Storage. |
| Fronteira de deploy | PASS | a2a3651, CI | [CI 38947818388](https://github.com/peixotodavy831-stack/Orktoverdadeiro/actions/runs/38947818388). |
| Migration e Edge publicados | PASS | a2a3651, staging DB50/core30/webhook2 | Ledger/versão, RLS e ausência de grants de navegador confirmados. Zero customers autorizados, bindings, comandos e eventos de lifecycle no staging. |
| Probe público | PASS | a2a3651, Preview novo | Health/ready 200, acesso privado anônimo 401, origem estrangeira 403, headers/correlação, metadados, teclado, nomes acessíveis, responsividade 390/768/1440 e zero erros de console. Medida de desempenho é baseline, sem SLO aprovado. |
| Novos endpoints sem autenticação | PASS | a2a3651, Preview novo | PUT e DELETE de assinatura retornam 401; nenhuma chamada ao fornecedor. Core Edge sem JWT retorna 401. |
| Webhook fechado sem configuração | PASS | a2a3651, webhook2 | POST vazio retorna 503 CONFIGURATION_REQUIRED. Não constitui processamento real de evento Asaas. |
| Secret scan | PASS | a2a3651, código/evidências locais | 481 arquivos na primeira varredura, zero findings/blockers. Segredos não foram impressos, copiados para docs ou configurados no Preview. |
| Redirect exato do novo Preview | PASS | a2a3651, Supabase staging | Proprietário confirmou especificamente esta inclusão. Save URLs concluído; lista 16→17, mesma Site URL e demais URLs preservadas. [Prova salva](evidence/redirect-a2a3651-saved.png). Callback real retornou ao novo host. |
| E2E autenticado completo no novo candidato | NOT_TESTED | a2a3651 | Redirect e login/reload B resolvidos. Ainda falta a sequência completa com dois contextos Google e transporte controlado; provas parciais e E2E histórico 5/5 não substituem esta execução. |
| Ciclo Asaas com fornecedor real sandbox | BLOCKED_EXTERNAL | a2a3651 | Falta conta/customer de teste autorizados, API key, segredo de webhook e conferência de notificações OFF. Sem cobranças ou chamadas ao fornecedor. |
| Término de acesso/cancelamento comercial | BLOCKED_EXTERNAL | a2a3651 | Timing de acesso, inadimplência, cancelamento/refund e alterações de plano ainda sem aprovação comercial. Nenhuma política foi semeada. |
| Gemini, Meta, franquias Pulso e recuperação real | BLOCKED_EXTERNAL | Pendências preservadas | Configurações e aprovações listadas abaixo e no relatório anterior; nenhuma chamada paga, mensagem externa ou compra. |

Não há FAIL remanescente nas verificações executadas desta entrega. Os gates não executados/bloqueados continuam obrigatórios; readiness permanece NO.

## Ciclo nativo de assinatura implementado

1. API administrativa autenticada: `PUT /api/billing/sandbox/subscriptions/:bindingId` para status ACTIVE/INACTIVE e data futura; `DELETE` para cancelar. Edge repete validação e membership, exige owner/admin e a flag adicional `ORKTO_BILLING_SANDBOX_LIFECYCLE_ENABLED=ON`. A flag não foi ativada nesta entrega.
2. SQL reserva comando antes da rede, com vínculo servidor/tenant e chave idempotente. Mesma chave com outro payload conflita. Índice único parcial impede dois comandos pendentes no mesmo binding. Resultado ambíguo permanece `unknown`, bloqueando novos comandos e reenvio automático.
3. Antes da operação, o fornecedor é relido e customer, externalReference e preço são comparados ao binding. PUT não muda preço/customer/ciclo e envia `updatePendingPayments:false`. ACTIVE exige nextDueDate válida. Troca de plano/preço e alterações de cobranças existentes não são expostas sem regras comerciais aprovadas.
4. DELETE exige resposta autoritativa com mesmo ID e `deleted:true`; depois registra a observação e conclusão auditada. Na semântica Asaas, DELETE também elimina pagamentos pendentes/vencidos; portanto não é sinônimo de suspensão temporária. A operação real continua bloqueada nesta homologação.
5. Webhook aceita também SUBSCRIPTION_CREATED/UPDATED/INACTIVATED/DELETED. Corpo não é prova de estado: o adaptador relê o fornecedor, usa claim durável e conclui somente após persistência. Token inválido, conflito de fingerprint, replay e falha continuam tratados.
6. GET de assinatura excluída retornando 404 **não** confirma exclusão: evento fica `failed`/reconciliation-required e callback retorna 503. Operador deve verificar o objeto no sandbox; nunca converter ausência/timeout em liberação ou corte de acesso.
7. Estado do fornecedor tem journal próprio. Eventos nativos nunca ativam acesso. Pagamento somente pode ativar/estender se confirmado, valor/período/vínculo válidos e assinatura autoritativa ACTIVE. INACTIVE/DELETED, estado desconhecido ou evento financeiro não confirmado são registrados como `RECORDED_POLICY_REQUIRED`, sem decidir término de acesso ainda não aprovado. Um binding excluído não pode ressurgir ACTIVE.
8. Duas tabelas novas com RLS e zero grants anon/authenticated. RPCs são invoker, service-only e search_path vazio; nenhuma nova função SECURITY DEFINER. Não se ampliaram permissões do navegador.

### Reconciliação operacional de resultado desconhecido

Manter a flag de lifecycle OFF. Inspecionar comando e binding pelo acesso administrativo autorizado; reler assinatura/customer/referência/valor no sandbox e conferir recibo/evento. Se a operação ocorreu, registrar a observação comprovada e a resolução auditada mediante procedimento administrativo revisado; não reenviar o comando incerto. Se o fornecedor não comprovar o resultado (inclusive 404), manter bloqueio. Nenhum endpoint libera `unknown` arbitrariamente. Uma futura automação de recuperação exigirá a mesma prova autoritativa; o teste real desta rotina continua pendente de credenciais.

## Alertas reais após a migration

- **19 RLS sem políticas (INFO):** incluem as duas tabelas novas, intencionalmente exclusivas de servidor. RLS + ausência de grants são o fechamento esperado; não criar política permissiva para silenciar o advisor. [Referência](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
- **5 funções SECURITY DEFINER executáveis por authenticated (WARN):** helpers booleanos anteriores de identidade/membership/sessão; nenhuma criada nesta entrega. A revisão anterior e as provas SQL permanecem de escopo limitado; o A/B HTTP continua aberto. [Referência](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
- **Proteção de senha vazada (WARN):** permanece pendente de disponibilidade/configuração externa. Google-only bloqueia métodos antigos conforme evidência anterior; não equivale a habilitar proteção de senha do fornecedor. [Referência](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- **80 FKs sem índice (INFO), 38 índices sem uso (INFO):** inventário atual preservado no JSON. Nenhuma FK das novas tabelas foi sinalizada; índice novo de actor aparece sem uso com tabelas vazias, o que não comprova inutilidade. Não removê-lo nem criar dezenas de índices sem workload/EXPLAIN. Homologação de desempenho sob carga permanece NOT_TESTED. [FKs](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys), [índices sem uso](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).

## Sessões: semântica e provas ainda necessárias

Conforme o [guia oficial de sessões Supabase](https://supabase.com/docs/guides/auth/sessions), logout/revogação de refresh token não implica invalidar imediatamente a assinatura criptográfica do JWT já emitido. Exigir que operações sensíveis consultem a sessão/admissão, mesmo antes de exp. A guarda SQL atual verifica session_id e not_after; backend e Edge invocam a mesma política. A prova real deve:

1. Autenticar A e B em contextos separados e autorizados. Guardar tokens somente em memória do executor, sem traces, headers, arquivos ou screenshots com credenciais.
2. Confirmar leituras próprias e negar acesso cruzado em API/Edge/PostgREST; usar IDs de recursos de teste autorizados e registrar somente códigos/decisões sanitizados.
3. Renovar sessão e conferir rotação, respeitando a janela legítima de reutilização/recuperação de refresh token; não classificar reutilização dentro dessa janela como vulnerabilidade.
4. Registrar exp em memória, observar expiração natural e tentar o JWT antigo depois de exp. Não mudar TTL/relógio para fabricar prova.
5. Revogar/logout no contexto testado; tentar o refresh token revogado depois da janela aplicável e o JWT ainda não expirado em operações sensíveis. Exigir negação nessas operações; distinguir validação criptográfica de sessão autorizada.

Essa sequência **não foi executada** nesta entrega. O navegador atual permitiu login/UI, mas não oferece transporte de teste com credenciais em memória; não foram extraídas credenciais do estado interno para contornar essa limitação.

## Configurações/aprovações externas mínimas

1. **Novo redirect — CONCLUÍDO:** proprietário confirmou a URL exata `https://orkto-staging-az36qohmo-peixoto-s-projects1.vercel.app/`; salvamento e novo login/reload B executados. Nenhuma nova aprovação de redirect está pendente para este candidato.
2. **Executor Google A/B:** disponibilizar execução segura com dois contextos reais; eventuais senha/2FA são inseridos pelo proprietário diretamente no Google, nunca no chat. B já existe e está aprovado; não pedir recriação de conta/workspace/permissões.
3. **Asaas:** identificar conta e customer exclusivamente de teste; cadastrar ASAAS_API_KEY e ASAAS_WEBHOOK_SECRET (>=32 caracteres) somente no secret store Edge. APP_ENV=staging e ASAAS_ENVIRONMENT=sandbox; habilitar ORKTO_BILLING_SANDBOX_ENABLED e a flag adicional de lifecycle apenas após conferir customer e notificações do fornecedor OFF. Registrar callback staging e eventos PAYMENT_* e os quatro eventos nativos. Não habilitar checkout comercial nem notificações reais. Ensaiar atualização, inativação, exclusão, pagamento confirmado, falha, renovação, replay, reconciliação e expiração com recursos de teste autorizados.
4. **Política comercial:** manter exatamente Start R$79,90, Pro R$149,90, Business R$299,90, Scale R$599,90 e Enterprise sob consulta. Aprovar assentos, limites operacionais, franquias/validade/taxas Pulso, overage, termos e momento de término de acesso/cancelamento/refund. Nenhum número foi inventado nem plano adicional criado.
5. **Gemini:** projeto/chave de teste em secret store, modelo/quota disponíveis, workspace autorizado, orçamento/tier e tarifa versionada, política Pulso. WIA_STAGING_GEMINI_TESTS permanece OFF; nenhuma inferência paga autorizada.
6. **Meta:** App/WABA/número de teste autorizados, credenciais e config Embedded Signup, versão Graph/callback, assinatura/challenge e tokens no Vault. Envio permanece OFF. Não presumir coexistência nem migrar número real.
7. **Recuperação:** organização Free continua sem backup gerenciado/PITR conforme prova anterior. Definir destino privado/off-site e secret store para dump lógico, checksum, Auth/config/Storage e restore isolado; aprovar RPO/RTO. CI sintético não substitui esse ensaio. Nenhuma contratação automática.

## Segurança da alteração e recuperação do código

Antes de aplicar a migration: ledger49, zero bindings e zero customers autorizados. Nenhuma conta/dado existente foi excluído. Migration validada em CI antes da aplicação remota. A migration anterior e o código 4506803 foram preservados no Git.

Se surgir defeito: manter flags de billing/lifecycle OFF, preservar journals e evidências, corrigir aditivamente e revalidar. Não fazer down migration destrutiva nem restaurar sobre staging ativo. A função anterior está versionada na migration49 para revisão, mas não deve ser reativada sem considerar a perda da guarda de estado nativo. Não houve intervenção em produção, merge, cobrança, mensagem externa ou chamada paga de IA.

Referências de semântica implementada: [Asaas update](https://docs.asaas.com/reference/update-existing-subscription), [Asaas delete](https://docs.asaas.com/reference/remove-subscription), [eventos nativos](https://docs.asaas.com/docs/subscription-events), consultadas em 16/10/2026.
