# ORKTO — execução Google-only no staging (14/10/2026)

> **ESTADO: IMPLEMENTADO EM BRANCH / NÃO VALIDADO POR GOOGLE E2E / SEM GO DE PRODUÇÃO.** Esta nota sobrepõe estados históricos da pré-auditoria, mas não substitui a execução de testes finais.

## Evidência do candidato Preview — 14/10/2026

- O deployment solicitado na instrução, `dpl_3SSydodNz7mo35tREw5SNTctxAE7`, foi reaberto no painel: pertence a `orkto-staging`, está READY/Preview, mas usa o SHA `0adfd2ca3f57b6da428d0de5afb77ffb347540a4` e o painel o marca stale. Esse commit contém somente documentação; não é o candidato atual. O candidato de código é o `c9584fe` abaixo.
- `c9584feb52eca364100e95abcfef7037316c6147` está no Preview `dpl_5C2FZVYGJrgqixp5btBKKRh7XK9D`, projeto `orkto-staging` (`prj_KZm12jmZIKL3Tqnk2I9DBa9MabKc`), target Preview, READY. URL imutável: `https://orkto-staging-h62m3k3sf-peixoto-s-projects1.vercel.app/`.
- As atualizações documentais `e09ab2f` e `6a9ebf5` foram publicadas; o runtime executável continua no Preview `c9584fe`, sem deployment novo identificado para esses commits. No SHA `6a9ebf5`, PostgreSQL 17 passou com 44 migrations na fixture legacy e replay baseline-like com assertions; deploy boundary também passou ([run 38638531628](https://github.com/peixotodavy831-stack/Orktoverdadeiro/actions/runs/38638531628), [run 38638531565](https://github.com/peixotodavy831-stack/Orktoverdadeiro/actions/runs/38638531565)). PR #2 permanece aberta/draft. Seu corpo ainda aponta `ec6e34f` e nomeia incorretamente a migration pendente. A API GitHub retornou 403 e a página pública mostrou a sessão deslogada; nenhum contorno de autenticação foi tentado.
- A lista de variáveis Vercel do projeto correto mostra somente entradas Config em Preview; `VITE_ORKTO_AUTH_MODE` e `ORKTO_AUTH_MODE` estão limitadas à branch `production-readiness/google-only-pilot-preflight`. Não há nomes de service-role/admin, billing, messaging ou provider secret na lista. Valores não foram revelados. A tela não comprova o conteúdo de `APP_ENV`, `VITE_APP_ENV`, URL ou publishable key; logo o target Supabase efetivo do runtime permanece **NOT_VERIFIABLE** por essa inspeção.
- A landing e a tela de login deste SHA abriram. A tela mostra somente o caminho Google, sem campo de senha; o botão está desabilitado e informa configuração de autenticação necessária. Resultado: **GOOGLE_ONLY_FAIL_CLOSED_UI=PASS**; **GOOGLE_OAUTH_E2E=NOT_RUN**. No painel Supabase staging, Google está OFF e Email está OFF. Os hooks `before_user_created` e `access_token_hook` aparecem ENABLED. A configuração de URL/redirect não carregou por completo no dashboard, que exibia aviso de incidente; o callback exibido na página de Google é `https://ghrjongiodziasupakrk.supabase.co/auth/v1/callback`. Nenhuma credencial Google foi encontrada/configurada pelo agente.
- GET normal aos endpoints `/api/health` e `/api/ready` não contornou a proteção: o browser retornou `ERR_BLOCKED_BY_CLIENT` e o runner `HttpRequestException`. Esses endpoints são **NOT_VERIFIABLE** para este deployment. Não foi criado link `_vercel_share`.
- Nova query read-only no SQL Editor do projeto staging `ghrjongiodziasupakrk` retornou ledger **43**, última versão `20261014152518`. O repositório contém **44** migrations; a pendente é `20261014160000_google_pilot_gate_fails_closed.sql`, SHA-256 `20FFABFB627B8BD30BB36FB2F2E1F00BD862840F3E12FC8DD63BC47309E21D7D`. Ela passou no replay PostgreSQL 17 do CI para o candidato `c9584fe`, mas não foi aplicada remotamente. A CLI `supabase` não está instalada; não há runner autenticado suportado disponível. Não foi executado SQL de migration ou reparo manual do ledger. A consulta não verifica backup/restauração; a configuração efetiva de redirects permanece NOT_VERIFIABLE.
- CI no SHA `c9584fe`: PostgreSQL 17 run [38613833432](https://github.com/peixotodavy831-stack/Orktoverdadeiro/actions/runs/38613833432) e deploy boundary [38613833446](https://github.com/peixotodavy831-stack/Orktoverdadeiro/actions/runs/38613833446), ambos SUCCESS. Regressão local já executada no mesmo código: 213/213 aplicação + 57/57 readiness, lint/typecheck, builds/smoke e secret scan 387 arquivos/zero findings PASS. Nenhum código mudou para criar o Preview; as únicas alterações remotas posteriores foram flags de configuração Preview-only.
- Limpeza segue concluída para 18 contas sintéticas comprovadas; a conta de origem não confirmada permanece intacta. Produção não foi alterada. `READY_FOR_PRODUCTION_CANDIDATE=NO`, snapshot final NÃO GERADO.

## Estado pré-publicação — histórico, supersedido pela evidência acima

- A limpeza aprovada do staging terminou: 18 contas com marcador sintético confirmado foram removidas após checkpoint lógico tipado e verificado; uma conta sem proveniência comprovada foi preservada sem alteração. A identidade, sessões, direito de acesso e eventual vínculo legítimo dessa conta continuam **NOT_VERIFIABLE**. Não repetir a limpeza.
- Supabase staging `ghrjongiodziasupakrk`: 43/43 migrations. Gate privado de admissão permanece habilitado e vazio; Auth Hooks `before_user_created` e `access_token_hook` aparecem ENABLED; Edge `orkto-core-mutations` v24 ACTIVE com `verify_jwt=true` e 12/12 arquivos locais equivalentes. Nenhuma mutação de produção.
- A página de provedores Supabase não carregou além do skeleton nesta rechecagem. O último estado registrado foi Email OFF e Google OFF; toggles atuais são **NOT_VERIFIABLE**. Client ID/Secret OAuth e identidades Google aprovadas não foram fornecidos por um painel seguro; portanto não houve login Google real.
- A implantação `dpl_3SSydodNz7mo35tREw5SNTctxAE7` no projeto `orkto-staging` é READY Preview, SHA `0adfd2ca3f57b6da428d0de5afb77ffb347540a4`, e contém somente documentação — não o runtime Google-only. A árvore local inclui correção do teste do gate de admissão, modo `--google-pilot` estritamente staging do runner e documentação; esses arquivos precisam de commit e CI antes de novo Preview.
- Regressão local previamente registrada: 211/211 app + 56/56 tooling; lint/typecheck, builds isolados e smoke PASS. Testes focados do runner nesta continuação: 13/13 PASS e `--guard-only` confirmou `orkto-staging`/`ghrjongiodziasupakrk`. Atualização de contagens para o commit final depende da execução após estas alterações.
- Bloqueios externos: configuração do Google Web OAuth e aprovação dos participantes do piloto. A conta remanescente requer decisão privada do proprietário após identificação. O painel Free informa proteção de senha vazada desativada; isso exige uma decisão de risco/plano antes de liberar login de senha, mas Google-only não deve permitir caminho de senha.
- `READY_FOR_PRODUCTION_CANDIDATE=NO`; snapshot final não gerado. Produção permanece intocada.

## Baseline anterior à limpeza — histórico, não estado vigente

## Dados confirmados no preflight anterior (histórico)

- PR de trabalho: [#2](https://github.com/peixotodavy831-stack/Orktoverdadeiro/pull/2), branch `production-readiness/google-only-pilot-preflight`.
- SHA de referência antes desta nota: `9cc582e2c84933bab3602c8d3defb4ae853d2576`. O SHA candidato real deve ser obtido do head atualizado da PR após novos commits.
- Staging Supabase **`ghrjongiodziasupakrk`**: ledger de **43 migrations**, últimas `google_only_closed_pilot` e `restrict_pilot_recovery_to_synthetic_scope`.
- SQL read-only em 14/10: **1 conta total, 1 com senha, 0 identidades Google, 1 membership ativa, 2 triggers de provisionamento**. A conta que permaneceu tem origem sintética **não confirmada**. Ela **não deve ser excluída ou ter acesso afetado sem verificação/consentimento específico**.
- Implementação do Google-only está na branch: modificações de frontend, Supabase PKCE, API, Edge, migrations e testes. A presença de código/migrations **não comprova** configuração Google OAuth ou E2E real.
- CI da PR no commit `9cc582e2`: [PostgreSQL 17](https://github.com/peixotodavy831-stack/Orktoverdadeiro/actions/runs/38589681594) **success**; [Deploy boundary](https://github.com/peixotodavy831-stack/Orktoverdadeiro/actions/runs/38589681593) **success**. A regressão local **56/56 ferramentas PASS** foi relatada na execução do Codex, sem evidência de novo E2E Google.
- Vercel staging `prj_KZm12jmZIKL3Tqnk2I9DBa9MabKc`: último Preview conhecido antes desta nota `dpl_6eWYnHtaNeU9Pph2g46FMBDSmw6o` executa **`d693e2f...`**, e NÃO o novo código Google-only. Produção `orkto` NÃO foi alterada nesta sequência de ações.
- Google OAuth no staging: **desligado na última inspeção reportada**; sem cliente OAuth do proprietário nem participantes previamente autorizados confirmados. Não afirmar que esteja ligado até verificar via configuração real.
- E2E antigo **5/5 PASS** aplica-se apenas ao app **`d693e2f...`**, não ao Google-only.

## Bloqueios e sequência de fechamento

1. **Documentação/branch:** revisar docs antigas e publicar commit final da PR com estado consolidado; não marcar histórico como evidência atual.
2. **Preview exato:** publicar a SHA atual somente em **`orkto-staging`**, target **Preview**, verificar project ID, branch/SHA, READY, health, headers/CORS, build/logs/secret boundary e restrição de acesso. Não associar domínio de produção, não mudar Auth redirect para URL não autorizada.
3. **Account preserved:** verificar que a conta restante não é impactada por qualquer desativação global de Email. Se a conta puder pertencer a pessoa real, **não desabilitar Email globalmente de forma irreversível** sem alternativa de acesso/review. O objetivo Google-only não autoriza quebrar acesso de um usuário não identificado.
4. **Google Cloud:** configurar cliente OAuth **Web** com escopos mínimos `openid,email,profile` no projeto autorizado; callback de Supabase staging `https://ghrjongiodziasupakrk.supabase.co/auth/v1/callback`; redirecionamento de app estrito ao novo Preview. Só utilizar credenciais em painel seguro/segredo gerenciado.
5. **Admissão e proteção:** confirmar mecanismo real de allowlist por participante, bloqueios contra provisionamento privilegiado, ligação indevida de identidades, password add/signup/recovery e revogação em RLS, backend e Edge. Verificar efeitos da conta preservada.
6. **Google E2E real na SHA publicada:** usuários autorizados/não autorizados; callback PKCE/state, cancelamento, sessão/logout/refresh/revogação; APIs/RLS/Edge tenants A/B, role negatives, operações WIA/Inbox/propostas; CI/lint/typecheck/build/secret scan; cleanup e relatórios sanitizados.
7. **Critérios comerciais separados:** termos, privacidade, suporte, preço/duração do piloto e autorização do proprietário antes de uso por clientes.

## Estados e limites

- `STAGING_GOOGLE_PILOT=NO_GO` até OAuth real e E2E comprovados.
- `TECHNICAL_READY=NO` e `READY_FOR_PRODUCTION_CANDIDATE=NO`.
- `PRODUCTION_GO=NOT_AUTHORIZED`.
- Não criar conta Google nem simular login real com testes unitários; não falsificar PASS, não colocar segredos no git ou logs. Não contratar serviços, comprar domínio ou alterar produção.
- Uma dependência de credencial/consentimento inacessível deve ser documentada precisamente; **terminar todas as partes independentes**, em vez de interromper todo o desenvolvimento.
