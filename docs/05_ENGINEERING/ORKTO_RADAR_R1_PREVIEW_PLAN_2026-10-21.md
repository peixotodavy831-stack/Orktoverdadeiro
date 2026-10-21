# Radar R1 — Preview isolado preparado, não publicado

21/10/2026. Fonte candidata fixa: **6be27794923d2ec3c57075acef689275bd93de28**, branch feat/orkto-radar-2027. Preserva5738f52 e2cd2844. **READY_FOR_PRODUCTION_CANDIDATE=NO.**

## Ambiente confirmado somente por leitura

Projeto **orkto-staging**, ID prj_KZm12jmZIKL3Tqnk2I9DBa9MabKc, equipe team_7mNnmcZNv9miOp7pl7otO6wE. Deployment Protection/SSO ativa para todos exceto custom domains; usar URL imutável vercel.app, sem novo domínio. Último deployment existente continua dpl_7xdpLtbw3U76zMcRK4nBjKGecawM, targetnull/Preview, sem republicação. Node configurado no fornecedor24.x; testes locais Node22.23.2, portanto runtime24 remoto ainda não verificado. [Metadados sanitizados](evidence/radar-r1-final-2026-10-21/preview-project-identity.json).

Pré-checagem `vercel env run -e preview --git-branch feat/orkto-radar-2027` consumiu variáveis apenas em memória no processo e emitiu somente predicados, sem env pull ou arquivo de credenciais. APP_ENV/VITE_APP_ENV staging, URL Supabase ghrjongiodziasupakrk, chave pública com papel apropriado e ausência dos campos de chave elevada checados: PASS limitado. **ORKTO_AUTH_MODE e VITE_ORKTO_AUTH_MODE ausentes nessa branch Preview.** [Resultado](evidence/radar-r1-final-2026-10-21/preview-env-preflight.json). Não concluir que a aplicação já implantada da PR #2 perdeu Google-only: esta consulta foi do ambiente da branch nova, não um teste de Auth no deployment histórico.

**Bloqueio atual: BLOCKED_CONFIGURATION + BLOCKED_AUTHORIZATION.** Não publicar nesse estado. Nenhuma variável cloud foi alterada.

## Pacote reviewável

Arquivo local `.tmp-radar-validation/radar-preview-6be2779.zip`, produzido com git archive do commit fixo; bytes/hash no [manifest](evidence/radar-r1-final-2026-10-21/preview-package.json). Inclui somente arquivos versionados do SHA; não inclui node_modules, .vercel, env local nem mudanças não commitadas. Não foi enviado ao fornecedor.

O build de readiness é isolado e usa configuração/chave placeholder; serve como prova de compilação/smoke e **não é um dist para publicar**. O build de Preview autorizado deve usar configuração staging validada e gerar seu próprio artefato. Documentação posterior ao SHA não deve ser confundida com mudança no runtime candidato.

Trava adicionada apenas na branch Radar: vercel.json.git.deploymentEnabled['feat/orkto-radar-2027']=false. A trava production-readiness/* permanece false. [Teste local](evidence/radar-r1-final-2026-10-21/preview-guard-test.txt). Não foi feito push; se houver push autorizado, confirmar que a plataforma respeita a trava antes de qualquer execução manual. Não mudar main/master, políticas globais ou projeto de produção.

## Aprovação mínima solicitada depois da preparação

1. Configurar **somente Preview e somente feat/orkto-radar-2027**: ORKTO_AUTH_MODE=google_pilot e VITE_ORKTO_AUTH_MODE=google_pilot, mantendo variáveis dos outros ambientes/branches e secrets existentes intactos.
2. Reexecutar o preflight em memória. Somente com todos os predicados esperados PASS, autorizar a publicação manual do **SHA6be27794923d2ec3c57075acef689275bd93de28** no projeto staging acima, com ambiente **Preview explicitamente selecionado**, mantendo Deployment Protection/TLS. Sem promoção, custom domain, merge ou mutação de banco/Edge.
3. Publicação por fluxo da plataforma que permita provar Preview. Não repetir target REST ambíguo ou usar target=staging como sinônimo de Preview; não alterar autoria/permissões para contornar rejeição. Se CLI/Git author ou a política da plataforma impedir, registrar bloqueio. Não usar vercel curl, que anteriormente gerou automation bypass automaticamente; OIDC legítimo efêmero em memória é o transporte a validar.

Essa aprovação ainda não foi concedida nesta missão. Sem criação de contas, workspaces ou permissões, sem cobranças, mensagens ou chamadas pagas.

## Validação real após publicação autorizada — ainda NOT_TESTED

1. Inspecionar ID/equipe/projeto/READY/SHA/target do deployment novo pela plataforma; registrar URL imutável exata, sem segredo. Não transferir evidência do deployment da PR #2.
2. Via transporte protegido legítimo: health200 e ready200/environment=staging. Negação da proteção Vercel não conta como resultado de Auth/RLS da ORKTO.
3. GET /api/radar sem sessão de aplicação deve retornar401, com transporte Vercel correto. Em identidades Google A/B já autorizadas e contextos isolados: próprio workspace200/envelopeR1, header estrangeiro403 ou negação equivalente do middleware, ausência de membership negada. Não extrair cookies/tokens/storage para arquivos ou logs.
4. Novo host pode precisar de callback Google exato ou adapter PKCE com callback já aprovado separado do transporte. Não adicionar wildcard/redirect nem repetir logins comprovados sem necessidade; qualquer ampliação de callbacks fica para confirmação específica quando a URL existir. O executor atual de homologação é fixado em outro host: não trocar constante silenciosamente nem chamar fixture de E2E remoto.
5. Observador autorizado de leitura compara fingerprints/contagens antes/depois nas tabelas relevantes e memberships/auth.users, sem registrar dados pessoais. Repetir GET não cria usuário/workspace/task/deal/evento de negócio; não escrever massa remota para provocar sinais nesta rodada sem aprovação.
6. Validar UI no novo host com dataset autorizado; três regras já possuem provas locais sintéticas, que não passam a ser remotas. Qualquer categoria sem dados permanece NOT_TESTED remota.
7. Medir SQL/RLS/URL de IN e tempos conforme ORKTO_RADAR_R1_QUERY_REVIEW_2026-10-21.md; sem afirmação de p95 pela amostra local. Novo Preview Node24 precisa smoke real.
8. Manter checkout/billing/mensagens/inferência pagos OFF e todos os gates de readiness anteriores abertos. Não fazer merge na PR #2.
