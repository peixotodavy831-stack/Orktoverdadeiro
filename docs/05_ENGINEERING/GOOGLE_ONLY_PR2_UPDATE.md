# Texto preparado para PR #2

A integração retornou 403 em 15/10/2026; navegador GitHub deslogado. Este arquivo é conteúdo preparado, não confirmação de edição remota.

Título sugerido: Google-only piloto fechado: migration 44 reconciliada; OAuth real bloqueado

---

# ORKTO — piloto Google-only / evidência de 15/10/2026

**BLOCKED_EXTERNAL_OWNER_ACCESS · FINALIZADO=NO · READY_FOR_PRODUCTION_CANDIDATE=NO.** Manter draft; sem merge/go-live.

## Runtime e ambiente

- Código executável: c9584feb52eca364100e95abcfef7037316c6147.
- Preview dpl_5C2FZVYGJrgqixp5btBKKRh7XK9D, READY/Preview, somente orkto-staging / prj_KZm12jmZIKL3Tqnk2I9DBa9MabKc.
- https://orkto-staging-h62m3k3sf-peixoto-s-projects1.vercel.app/
- Frontend observado consultando Auth settings em ghrjongiodziasupakrk.supabase.co; Google-only UI fail-closed, sem senha.
- Site URL/current exact redirect corrigidos. Redirect antigo exato de staging mantido; nenhum wildcard/produção adicionado.
- 12 nomes de env Preview inspecionados sem valores, nenhum nome de credencial privilegiada.

## Migration 44 — aplicada e reconciliada

44 entradas / 44 versões únicas, nenhum nome lógico duplicado. Nome google_pilot_gate_fails_closed; remoto 20261015163447 corresponde a supabase/migrations/20261014160000_google_pilot_gate_fails_closed.sql. SHA-256 local 20ffabfb627b8bd30bb36fb2f2e1f00bd862840f3e12fc8dd63bc47309e21d7d. SQL normalizado e corpos exatos das duas funções coincidem por hash. Anon/PUBLIC EXECUTE negado; authenticated/service_role permitido; search_path vazio. RPC estrita sem JWT false. Não reaplicar nem editar ledger.

Gate enabled; admissions 0; Google identities 0; um usuário de origem desconhecida preservado; sessões/refresh tokens 0. Checkpoint 1 verificado / 57 linhas privadas; isso não é teste de disaster restore. Cinco tabelas privadas com RLS, zero policies e zero browser data grants: default-deny intencional.

## Correções / testes

- Preflight centraliza TARGET_MIGRATION_COUNT=44, removendo conflito com target 43; regressão integrada do ledger com timestamp remoto gerado.
- Runner legado de senha recusa Google-only, Email OFF ou settings desconhecido antes de lookup/criação administrativa. Não é runner de Google E2E.
- Readiness-tools 24/24 e Google app local 3/3 PASS; sem alteração de runtime/migration/Edge.
- CI 91e6041 PostgreSQL17 https://github.com/peixotodavy831-stack/Orktoverdadeiro/actions/runs/38771357969 SUCCESS (legacy44, baseline-like e Google adversarial SQL descartável); deploy boundary https://github.com/peixotodavy831-stack/Orktoverdadeiro/actions/runs/38771358250 SUCCESS.
- Regressão integral c9584fe 213 app +57 tooling/lint/build/smoke permanece evidência datada para o mesmo runtime. E2E antigo5/5 é histórico.

## Gates externos

Google OFF/Email OFF, linking/anonymous OFF. Console Google autenticado seleciona orkto-502600 mas falha ao carregar clientes OAuth/formulário. Proprietário precisa completar cliente Web/consentimento e entrada segura de credenciais no Supabase staging (callback https://ghrjongiodziasupakrk.supabase.co/auth/v1/callback; scopes openid email profile), aprovar identidades/roles A/B e uma negativa e revisar a conta preservada. Não enviar segredos em chat/PR.

OAuth real, PKCE/sessão/revogação/linking, tenant A/B e core E2E atuais NOT RUN. Health/ready/headers/CORS/observabilidade de app não aprovados: probes sem sessão302 e navegação aos endpoints bloqueada; nenhum bypassSSO criado.

[Estado curto](docs/ORKTO_CURRENT_STATE.md) · [matriz/evidência](docs/05_ENGINEERING/GOOGLE_ONLY_PILOT_CLOSURE_2026-10-15.md).

Produção intocada; nenhuma cobrança/mensagem real/provider pago/compra. Snapshot final não gerado. Aprovação comercial/jurídica e go-live permanecem separados.
