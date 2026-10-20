# Fechamento dos bloqueios reais — continuação de 20/10/2026

**READY_FOR_PRODUCTION_CANDIDATE=NO. PR #2 draft, sem merge.** Complementa STAGING_CLOSURE_2026-10-20.md. Baseline documental d663e76; aplicação 837b5e57ed7706aa08a039b22efaa94a0797d8af; ferramentas 0c72508; Supabase staging ghrjongiodziasupakrk, core31/Meta2/billing2. Nenhum código executável ou migration alterado nesta rodada.

## 1. Transporte Vercel: causa observada e recuperação

O mesmo OIDC efêmero de development, mantido somente em memória, produziu 403 TRUSTED_SOURCES_ENVIRONMENT_MISMATCH no deployment dpl_5wye3rqTMK2CWscKrbPmv9HbWyke, cujo target REST é staging, e 200 no Preview histórico a2a3651 de target null. [Comparação inicial](evidence/oidc-environment-diagnosis-2026-10-20.json). Isso isola uma incompatibilidade de classificação de ambiente, não uma negação Auth/RLS da ORKTO.

Inspeção somente de leitura do projeto: nenhum custom environment disponível; Trusted Sources mantém regras padrão (mesmo ambiente e development→preview); Deployment Protection permanece ativa. A lista rotula o candidato antigo Preview, mas o diálogo Redeploy abriu com Production selecionado. Não se executou essa opção. Foi selecionado **Preview explicitamente** e republicado o mesmo código de 837b5e5 no mesmo projeto staging. Esse caminho elimina a ambiguidade de alvo que motivou a rejeição automática da tentativa REST anterior; não se repetiu a requisição ambígua nem se ampliaram permissões.

Novo deployment paralelo **dpl_7xdpLtbw3U76zMcRK4nBjKGecawM**, READY, target REST null / interface Preview, projeto prj_KZm12jmZIKL3Tqnk2I9DBa9MabKc, SHA837b5e5 confirmado por API autenticada. [Captura](evidence/vercel-preview-recovery-2026-10-20.png). URL imutável: https://orkto-staging-qabzbbu7z-peixoto-s-projects1.vercel.app/ . O deployment antigo e seu callback aprovado continuam existentes; nenhum redirect foi salvo novamente. O alias de branch foi reassociado pela plataforma ao Preview novo; nenhuma promoção de produção.

**Recuperação confirmada por HTTP real:** com OIDC development em memória, novo Preview200, candidato antigo ainda403 e histórico200 na mesma rodada. [Comparação final](evidence/oidc-preview-recovery-2026-10-20.json), 16:03:56Z. Health200/ok, ready200/ready/environment=staging e clients401 sem sessão de aplicação às16:04:35Z: [probes](evidence/preview-recovery-http-2026-10-20.json). Nenhum corpo de cliente ou token registrado. A primeira chamada CLI desta rodada falhou por fetch; repetição com NODE_USE_SYSTEM_CA=1 passou mantendo validação TLS. Não se usou vercel curl, bypass novo, env pull, arquivo de credencial ou alteração de Trusted Sources.

Referência da regra padrão: [Vercel Trusted Sources](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/trusted-sources). A recuperação vale para o novo deployment explicitado, não corrige retroativamente o target do antigo.

## 2. G01–G12: execução ainda bloqueada

Não foram repetidos Google A/B, redirects ou rollout. O executor PKCE já existe e possui dois contextos de memória; sua janela Chrome não está disponível na superfície controlável, que oferece apenas IAB/MCP Apps. As sessões normais já comprovadas no IAB não foram copiadas para o runner. Logo, nenhum caso autenticado novo foi contado como executado.

O motor e o adapter estão fixados na URL antiga por fronteira de segurança. Antes da rodada, é necessário revisar seu vínculo para o Preview recuperado e manter o callback já aprovado como origem OAuth separada, ou aprovar um callback diferente. Não trocar apenas o hostname ou remover a validação de projeto/SHA para fazer o runner passar. Essa adaptação deve ter testes das duas origens e exige um executor acessível antes de pedir logins novamente; não foi implementada como atalho nesta rodada documental.

G06 ainda requer fixtures sintéticas reversíveis e observador independente do estado; G08 requer política real de reuse e sessões distintas das de logout. Nenhuma fixture, conta, empresa, papel ou permissão foi criada. Expiração natural, refresh/reuse e replay continuam sem nova prova remota.

## 3. Asaas: customer separado preparado, sem submissão

Na sessão sandbox existente, preparado rascunho **ORKTO Homologação 2026-10-20**, sem CPF/CNPJ, e-mail, telefone ou endereço. Switch E-mail/SMS OFF. Não foi acionado Adicionar cliente; não existe customer ID novo nem vínculo aprovado. [Nome e campos](evidence/asaas-customer-draft-name-2026-10-20.png), [toggle](evidence/asaas-customer-draft-notifications-2026-10-20.png). Capturas limitadas ao modal para não divulgar dados do cadastro legado ao fundo.

O toggle do formulário **não comprova todos os canais do fornecedor**. Após aprovação/submissão do cadastro e workspace, exigir preflight GET-only completo de customer e notifications, todos os canais desativados; snapshot vazio/incompleto bloqueia. O legado e sua assinatura não foram modificados. A autorização para preparar não foi tratada como autorização financeira ou aprovação automática do customer.

Configuração já comprovada preservada: APP_ENV=staging, ASAAS_ENVIRONMENT=sandbox e ambas as flags billing/lifecycle OFF. Credenciais API/webhook continuam pendentes, sem criação/leitura de valores nesta rodada. B01–B13 não executados; não se forjaram eventos como confirmação financeira. [Passos seguros do proprietário](ASAAS_SANDBOX_OWNER_SETUP.md).

## 4. Playbooks 2027

Concluída [análise arquitetural inicial](ORKTO_PLAYBOOKS_2027_ARCHITECTURE.md), exclusivamente documental: contratos WIAOS, leituras T0, proveniência, Mutation Gateway, idempotência, aprovações, jobs e Pulso/Cost Governor como peças reutilizáveis. Define lacunas de delegação revogável, scheduler durável, leases/fencing, reconciliação e compensação. Não implementa executor, jobs, permissões ou integrações; não altera o candidato de staging nem aprova política comercial.

## 5. Matriz desta rodada

| Gate | Estado | Evidência / limitação |
| --- | --- | --- |
| Causa do mismatch no deployment antigo | PASS diagnóstico | Mesmo OIDC: antigo403, históricos e novo Preview200; target REST staging versus null. |
| Transporte seguro no Preview republicado | PASS | Mesmo SHA837b5e5, READY/Preview, health200, ready200/staging; proteção e TLS preservados. |
| API clients sem sessão | PASS limitado | HTTP401 real; não comprova isolamento A/B autenticado. |
| G01–G12 no novo deployment | NOT_TESTED | BLOCKED_EXTERNAL: executor Google isolado sem superfície controlável; vínculo de origens do motor precisa revisão antes da rodada. |
| Customer dedicado | NOT_TESTED no fornecedor | Rascunho sintético preparado; aprovação, submissão, ID e workspace pendentes. |
| Todos os canais Asaas OFF | NOT_TESTED no novo customer | Somente switch E-mail/SMS do rascunho OFF; exige snapshot completo GET-only. Legado com notificações ativas continua inelegível. |
| Secrets e vínculo billing | BLOCKED_EXTERNAL | API key/webhook secret/customer/workspace aprovados ainda necessários; billing OFF. |
| B01–B13 | NOT_TESTED | Prerequisitos e autorização da rodada controlada pendentes. |
| Playbooks 2027 | PASS documental | Análise da fonte e proposta, sem implementação ou homologação de runtime. |
| Google UI / rollout anterior | PASS histórico limitado | Preservados no relatório base, sem repetição nem promoção para G01–G12. |
| Política comercial / recuperação real | BLOCKED_EXTERNAL | Decisões e escopo aprovados ainda necessários, conforme relatório base. |

Não há novo FAIL funcional comprovado nesta rodada. A negação403 do deployment antigo permanece como limitação de transporte desse alvo, contornada por Preview explícito no mesmo projeto sem mudar controles.

## Intervenções realmente necessárias

1. Disponibilizar executor autorizado com interface para os dois contextos PKCE existentes. Não pedir nova conta/role nem extrair sessões IAB. Engenharia deve primeiro revisar binding de transporte/callback para a URL recuperada.
2. Aprovar o rascunho sintético e o workspace de billing. Completar a criação apenas nesse sandbox; se o fornecedor exigir identificador fiscal, usar mecanismo oficial de teste, nunca dado real/aleatório atribuído a pessoa.
3. Proprietário configura API key e webhook secret diretamente no secret store staging. Depois verificar todos os canais OFF, callback e escopo e obter autorização específica B01–B13 antes de habilitar flags.
4. Aprovar término de acesso, franquias/assentos/limites e recuperação de banco. Os cinco planos e preços existentes ficam preservados; nenhuma franquia/tarifa inventada.

## Verificação documental

Secret scan do diretório docs/05_ENGINEERING: PASS, 89 arquivos, zero findings/blockers ([log](evidence/real-blockers-secret-scan-2026-10-20.txt)). Não se repetiram regressões de aplicação sem alteração de código. O build remoto do redeploy terminou READY; isso não substitui a suíte autenticada.
