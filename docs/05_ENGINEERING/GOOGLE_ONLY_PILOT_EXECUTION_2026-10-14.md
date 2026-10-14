# ORKTO — execução Google-only no staging (14/10/2026)

> **ESTADO: IMPLEMENTADO EM BRANCH / NÃO VALIDADO POR GOOGLE E2E / SEM GO DE PRODUÇÃO.** Esta nota sobrepõe estados históricos da pré-auditoria, mas não substitui a execução de testes finais.

## Dados confirmados em leitura direta

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
