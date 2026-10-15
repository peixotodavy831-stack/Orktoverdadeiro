# Google-only — fechamento técnico de staging — 15/10/2026

**STATUS=BLOCKED_EXTERNAL_OWNER_ACCESS · FINALIZADO=NO · READY_FOR_PRODUCTION_CANDIDATE=NO.**

Esta é a evidência vigente. Os documentos de 14/10 e o E2E histórico 5/5 permanecem históricos. Nenhuma migration foi reaplicada, nenhum ledger foi editado e produção não foi alterada.

## Código, Preview e CI

- Branch: production-readiness/google-only-pilot-preflight; PR [#2](https://github.com/peixotodavy831-stack/Orktoverdadeiro/pull/2), aberta/draft, sem merge.
- Código executável mantido: **c9584feb52eca364100e95abcfef7037316c6147**. Preview **dpl_5C2FZVYGJrgqixp5btBKKRh7XK9D**, READY/Preview, projeto orkto-staging / prj_KZm12jmZIKL3Tqnk2I9DBa9MabKc.
- [Preview exato](https://orkto-staging-h62m3k3sf-peixoto-s-projects1.vercel.app/). Os commits 1c3f20d e 91e6041, e as correções desta sessão, alteram tooling/documentação, não runtime. Nenhum novo deploy é necessário para essas alterações.
- CI confirmado no **91e60418e5ea30327f7888dfb1bb43421c59a45a**: [PostgreSQL 17 / 38771357969](https://github.com/peixotodavy831-stack/Orktoverdadeiro/actions/runs/38771357969) SUCCESS, legacy 44/44 e baseline-like com assertions/security/Google adversarial; [deploy boundary / 38771358250](https://github.com/peixotodavy831-stack/Orktoverdadeiro/actions/runs/38771358250) SUCCESS. SQL adversarial usa banco descartável; não equivale ao Google E2E real.

## Migration 44 reconciliada — PASS

SQL SELECT no dashboard autenticado de **ghrjongiodziasupakrk**: 44 entradas, 44 versões distintas, zero nomes lógicos duplicados, uma ocorrência de google_pilot_gate_fails_closed. Versão remota **20261015163447** corresponde ao arquivo local **20261014160000_google_pilot_gate_fails_closed.sql**. Não reaplicar ou reparar o ledger.

- SHA-256 do arquivo: 20ffabfb627b8bd30bb36fb2f2e1f00bd862840f3e12fc8dd63bc47309e21d7d.
- MD5 do SQL normalizado: local=remoto **45107aaf5da65c9cc3c737d06631748a**. Normalização remove CR, comentários de linha, whitespace e delimitadores de statements; por isso também foram comparados os corpos exatos das funções.
- Corpo exato de orkto_pilot_session_allowed: local=remoto **60b921aec407f8914749939e2d2d6d28**.
- Corpo exato de orkto_google_pilot_session_allowed: local=remoto **21881a0afc877905cc5f63f6530732f7**.
- Ambas SECURITY DEFINER, STABLE, search_path vazio; EXECUTE anon/PUBLIC negado, authenticated/service_role permitido. São funções sem argumentos, somente boolean, vinculadas a auth.uid/JWT/session e admissão privada; não recebem tenant/role/SQL arbitrário. RPC estrita sem JWT retornou false. O grant autenticado é intencional, não uma vulnerabilidade provada pelo alerta isolado.
- Schema privado sem USAGE para anon/authenticated. As cinco tabelas privadas (admissions, audit, configuration, recovery_checkpoints, recovery_rows) têm RLS, zero policies e zero grants de dados para anon/authenticated. RLS sem policy em tabela privada é default-deny; não adicionar políticas/grants para ocultar alerta. A revisão não representa nova prova de todo o schema ou de isolamento com Google A/B.

## Estado real e alterações de staging

- Gate privado habilitado; admissões 0; Auth users 1 preservado; Google identities 0; sessões 0; refresh tokens 0. Nenhuma identidade pessoal, senha/hash ou payload de recuperação exportado. Não é possível provar alterações históricas de terceiros só com essa leitura.
- Recuperação: 1 checkpoint marcado verificado, 57 recovery_rows protegidas. Isso comprova a presença do checkpoint da limpeza anterior; **disaster restore atual NOT RUN**, sem promessa de PITR/RPO/RTO administrado no plano Free.
- Auth: Google OFF, Email OFF, anonymous OFF, manual linking OFF, signup ON e confirmação ON. Não foi alterado provider, credencial ou conta nesta sessão.
- **Corrigido** Site URL para https://orkto-staging-h62m3k3sf-peixoto-s-projects1.vercel.app/ e adicionado esse redirect exato. Persistência confirmada após reload. O redirect exato anterior de staging da5dotdh0 foi preservado para não afetar a conta de origem desconhecida; não foram adicionados wildcard/origem de produção. Callback Google: https://ghrjongiodziasupakrk.supabase.co/auth/v1/callback.
- Navegador normal abriu a landing e login Google-only sem senha, CTA desabilitado/configuração necessária: **PASS_FAIL_CLOSED_UI**. Inventário de recursos observou /auth/v1/settings em **ghrjongiodziasupakrk.supabase.co**, confirmando o alvo do frontend sem ler chave pública ou segredo. APP_ENV e demais valores comuns não foram abertos; não inferir seus valores pelos nomes.
- Vercel env ls preview: **12 nomes**, sem nome de admin/service-role/billing/messaging/paid-provider secret. Flags de modo limitadas a Preview da branch do piloto; nenhuma descriptografia/env pull.
- HTTP sem sessão para /, /api/health, /api/ready e /api/clients recebe **302** da camada Vercel. Navegação normal aos endpoints foi bloqueada. Isso não é resposta da aplicação e não aprova health/CORS/headers/observabilidade. Nenhum link SSO/bypass/cookie foi extraído.

## Correções e validação local desta sessão

1. staging-preflight ainda exigia 43 apesar do migration gate exigir 44. Agora ambos usam TARGET_MIGRATION_COUNT; teste integrado aceita o ledger de 44 com timestamp remoto gerado e bloqueia 43.
2. Runner histórico de senha agora checa Auth settings antes de qualquer lookup administrativo/criação sintética: Google pilot, Email OFF ou settings desconhecido recusam execução. Não existe modo real --google-pilot nesse launcher; a menção no registro histórico de 14/10 estava incorreta. Não pedir execução desse launcher como prova de Google.
3. Consulta somente leitura reproduzível e evidências sanitizadas adicionadas. Não há alteração de frontend/backend/Edge/migrations nesta sessão.

**PASS:** readiness-tools 24/24; testes Google do app 3/3; preflight afetado 4/4. A regressão completa c9584fe (213 app + 57 readiness, lint/typecheck/builds/smoke e secret scan) permanece datada e histórica para esse mesmo runtime; não foi repetida para gerar contagem nova. Secret scan final: 392 arquivos, zero findings/blockers, PASS; git diff --check PASS; node --check dos três scripts alterados PASS. Comparação git c9584fe→árvore atual não apresenta diferenças em src/backend/api/Edge/migrations/vercel.json/index.html. Uma invocação exploratória do replay sem --target foi recusada no REPOSITORY_PREFLIGHT antes de conexão; nenhum replay local novo foi executado. A prova PostgreSQL17 atual é o CI dos dois cenários acima.

## Matriz de fechamento

| Gate | Estado | Evidência / condição |
| --- | --- | --- |
| Ledger 44 / conteúdo migration 44 / duas funções | PASS | SELECT e hashes acima; [evidência agregada](evidence/google-pilot-staging-2026-10-15.json). Não reaplicada. |
| CI 91e6041 / tooling corrigido | PASS | Dois runs SUCCESS; 24/24 ferramentas e 3/3 Google local. |
| Redirect atual / frontend Supabase target | PASS no escopo observado | URL exata persistida; request Auth settings para staging. |
| Preview secret boundary | PASS_METADATA | 12 nomes Preview sem credenciais privilegiadas; não prova aliases/valores arbitrários ou bundle completo nesta sessão. |
| Fail-closed login / RPC sem JWT | PASS | UI desabilitada; RPC false. Não é login Google. |
| Google OAuth operacional | BLOCKED_EXTERNAL_OWNER_ACCESS | Console Google autenticado seleciona orkto-502600, mas falha ao carregar clientes OAuth/API e não abre criação. Não inferir que não existam clientes. Supabase Google OFF. |
| Identidades/coorte/roles aprovadas | BLOCKED_OWNER_APPROVAL | Allowlist vazia; agente não pode escolher participantes/roles. |
| Google A/B, PKCE, sessão, refresh/logout/revogação, linking e core E2E | NOT RUN | Dependem dos dois itens acima; não reutilizar E2E senha nem simular Google. |
| Security release checkpoint / isolamento Google | BLOCKED | Checks estruturais/locais passaram; falta evidência autenticada atual e tráfego da aplicação. |
| Health/readiness, headers/CORS e observabilidade de aplicação | BLOCKED_AUTHENTICATED_PREVIEW_ACCESS | 302 externo; navegador bloqueia endpoints. Root via sessão normal abre; proteção permanece. |
| Recuperação | PASS_PRESENCE / NOT RUN_RESTORE | 1 verificado / 57 linhas; não foi feito restore ou alteração da conta preservada. |
| PR body/title | BLOCKED_GITHUB_WRITE_PERMISSION | Atualização via integração retornou 403 Resource not accessible by integration; navegador GitHub deslogado. Conteúdo correto preparado em GOOGLE_ONLY_PR2_UPDATE.md. |
| Snapshot / readiness | BLOCKED | Não gerar até E2E e checkpoint; READY_FOR_PRODUCTION_CANDIDATE=NO. |
| Produção | PASS_UNTOUCHED | Nenhuma mutação/deploy/migration/segredo/cobrança/mensagem/provider pago. |

## Uma única intervenção externa — SESSION_1_FINAL_STAGING

1. Abrir o Google Cloud no projeto autorizado orkto-502600 e resolver o carregamento/permissão do console. Criar/selecionar OAuth Client **Web** de staging, consentimento/audience e participantes aprovados; scopes somente openid email profile. Registrar redirect URI **https://ghrjongiodziasupakrk.supabase.co/auth/v1/callback**. Se o formulário pedir origins JavaScript, usar somente a origem HTTPS exata do Preview. Não adicionar domínio de produção.
2. Inserir Client ID/Secret pessoalmente no painel **Supabase staging → Auth → Providers → Google** e habilitar Google mantendo demais providers/linking/anonymous OFF. A regra de handoff do computer-use exige que o proprietário complete entrada e submissão de novas credenciais; nenhum valor deve ir ao chat, git, Preview, logs ou artifacts.
3. Aprovar privadamente identidades Google A/B em empresas distintas e uma identidade negativa, com roles/workspaces mínimos. Identificar/dispor a conta preservada sem a apagar, resetar ou vincular por suposição. Somente então preparar admissões pelos comandos privados existentes e executar login/consentimento normal, sem automatizar MFA/desafios.
4. Disponibilizar sessão/autorização normal que permita verificar os endpoints do Preview protegido, sem desabilitar SSO, e permissão de edição da PR #2 (ou aplicar o texto preparado). Não pedir service-role no Vercel.

Depois disso o agente deve executar no mesmo runtime c9584fe os testes Google reais, autorização/tenant/core/WIA/Inbox e revogação, correlacionar logs, fechar segurança e snapshot apenas se todos passarem. Se runtime mudar, novo Preview staging e revalidação no SHA novo. Aprovação comercial/jurídica e go-live são posteriores e separados; não há lançamento autorizado.

## Artefatos

- [Estado SQL agregado e hashes](evidence/google-pilot-staging-2026-10-15.json)
- [HTTP público sem sessão/bypass](evidence/google-pilot-public-2026-10-15.json)
- [SQL de inspeção reproduzível](../../supabase/tests/inspect_google_pilot_staging_readonly.sql)
- [Texto pronto para PR #2](GOOGLE_ONLY_PR2_UPDATE.md)
