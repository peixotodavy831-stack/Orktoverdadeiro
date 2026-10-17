## Atualização vigente — G06/G08 implementados em 40fcfdc

**READY_FOR_PRODUCTION_CANDIDATE=NO.** [Engenharia e matriz por ambiente](G06_G08_ENGINEERING_2026-10-17.md): G06 (escritas cruzadas com observação independente) e G08 (reuse fora das exceções) implementados no motor existente, source `40fcfdcc6effb6d2bd32f875e39e4e81b30b1e29`. **39/39 testes de ferramentas + 22/22 deploy boundary PASS**, lint/sintaxe/build isolado/secret scan e CI PostgreSQL17/deploy boundary PASS. As menções abaixo à cobertura ausente são históricas e foram superadas nesta engenharia. G01–G12 reais continuam NOT_TESTED, executor PKCE BLOCKED_EXTERNAL; Asaas configuração BLOCKED_EXTERNAL e B01–B13 NOT_TESTED. [Configuração exata pelo proprietário](ASAAS_SANDBOX_OWNER_SETUP.md). Runtime a2a3651 preservado, sem deploy, mudança cloud ou produção.

# Gates reais — inspeção de 17/10/2026

**READY_FOR_PRODUCTION_CANDIDATE=NO.** PR #2 permanece sem merge. Esta rodada consultou somente staging; não executou G01–G12 nem B01–B13.

## Referências e provas

- Runtime confirmado pela API Vercel: `a2a3651319196ffc56813992f705692d368ef967`, deployment `dpl_56dgXZ3um4wFAVsQZjUdyTUzHvLn`, projeto `orkto-staging`, target `null`, READY, [Preview exato](https://orkto-staging-az36qohmo-peixoto-s-projects1.vercel.app/).
- Ferramentas preservadas: `c40fba9789206b0206902d966cdd1ed8c6593e71`. Comparação Git dos dois motores contra esse commit não apresentou diferenças. HEAD inspecionado: `eeb1a2a5f1c42600b1ef6d8f43f95611d60d1c84`.
- Consulta SQL administrativa em `ghrjongiodziasupakrk`, `2026-10-17T15:34:43.308682Z`: zero customers Asaas sandbox cadastrados, bindings, comandos e eventos de lifecycle; zero políticas Pulso e tarifas de modelo.
- Painel Edge Secrets recarregado: **No custom secrets created**. [Captura atual](evidence/staging-no-custom-secrets-2026-10-17.png). Nenhum segredo foi revelado.
- [Registro estruturado](evidence/real-gates-checkpoint-2026-10-17.json). Os PASS históricos permanecem na [matriz canônica](STAGING_HOMOLOGATION_A2A3651_2026-10-16.md); não foram repetidos nem transferidos para novos testes.

## Matriz desta rodada

| Gate / verificação | Estado | Prova ou impedimento |
| --- | --- | --- |
| Identidade do Preview | PASS | API Vercel retornou runtime, projeto e deployment esperados; isso não certifica o E2E. |
| Preservação dos motores c40fba9 | PASS | Comparação Git sem diferenças; nenhum framework novo. |
| Executor Google PKCE para dois contextos | BLOCKED_EXTERNAL | O motor exige `acquireContexts`; não há adaptador real disponibilizado no checkout ou nas capacidades conectadas. IAB oferece controle de abas, sem aquisição de sessões em memória para esse motor e sem criação de dois contextos isolados. Não se extraiu token/cookie/storage. |
| G01–G05: identidade e leitura bidirecional | NOT_TESTED | Sem executor; login histórico B não substitui HTTP A/B. |
| G06: escrita cruzada | NOT_TESTED | Além do executor ausente, o motor atual registra `CROSS_TENANT_WRITES=NOT_TESTED`; essa cobertura ainda precisa ser integrada ao motor existente. Não é só uma configuração externa. |
| G07: refresh e rotação | NOT_TESTED | Não foram adquiridas sessões reais. |
| G08: reutilização fora das exceções | NOT_TESTED | Além do executor, falta cobertura no motor atual; não confundir rotação com replay fora da janela/parent exception. |
| G09–G11: expiração natural, logout e revogação | NOT_TESTED | Nenhuma sessão revogada, TTL alterado ou relógio simulado. Validade criptográfica do JWT não equivale a autorização sensível. |
| G12: encerramento da rodada autenticada | NOT_TESTED | Rodada não iniciada; nenhuma fixture criada, sessão exportada ou dado de negócio modificado nesta inspeção. |
| Asaas: credenciais e customer aprovados | BLOCKED_EXTERNAL | Zero custom Edge secrets e zero customers sandbox no banco. O “sim” anterior não identifica conta/customer nem comprova configuração segura. |
| Preflight real GET-only / notificações | NOT_TESTED | Sem customer/credencial aprovados; não houve requisição Asaas. Não presumir notificações desativadas. |
| B01–B13: ciclo financeiro real | NOT_TESTED | Pré-requisitos ausentes; nenhuma assinatura criada, alterada ou cancelada. B05/B07 também dependem da política comercial. |
| Política de término de acesso | BLOCKED_EXTERNAL | Aprovação comercial ainda pendente; guarda existente preservada. |
| FAIL nesta rodada | — | Nenhum teste real foi iniciado; ausência de FAIL não significa aprovação. |

## Continuação mínima

1. Disponibilizar executor normal Google PKCE compatível com o contrato de `runGoogleAbTransport`, com dois contextos independentes e sessões exclusivamente em memória. Se exigir login/2FA humano, executar somente essa etapa interativa. A/B, workspaces e papéis já aprovados devem ser reutilizados. Não compartilhar tokens, cookies ou arquivos de sessão.
2. No mesmo motor, completar G06 e G08 antes de declarar cobertura integral. Só executar escritas em recursos sintéticos conhecidos e reversíveis, com verificação posterior de ausência de alteração cruzada. Não ampliar grants ou criar identidades para conseguir PASS.
3. Identificar conta sandbox, customer `cus_...` exclusivamente sintético e workspace aprovado; configurar API key e segredo de webhook diretamente no secret store staging. Conferir notificações pelo preflight existente, sem alterá-las automaticamente. Habilitação e rodada financeira somente após essas provas e autorização de execução.
4. Aprovar efeito comercial de término de acesso. Manter Gemini, Meta e recuperação real bloqueados conforme o [roteiro restante](FINAL_SECURITY_BILLING_EXECUTION_A2A3651.md).

Cinco planos preservados: Start R$79,90; Pro R$149,90; Business R$299,90; Scale R$599,90; Enterprise sob consulta. Nenhuma franquia, assento, tarifa ou direito contratual inventado. Pulso, Cost Governor e Central Econômica preservados.

Não houve alteração de código de runtime, deployment, migration, redirect, usuário, workspace, papel, flag ou configuração cloud. Sem produção, merge, cobrança, mensagem externa ou inferência paga. Nenhum novo resultado de teste local/CI é alegado nesta rodada documental.
