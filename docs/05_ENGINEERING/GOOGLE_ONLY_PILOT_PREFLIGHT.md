# Piloto fechado Google-only — preflight de ativação

> **HISTÓRICO SUPERSEDIDO:** este preflight descreve o estado anterior à autorização e à limpeza controlada do staging. Seus números de 19 contas/41 migrations, toggles de Auth, hooks e configuração de admissão não são o estado atual. Consulte [execução Google-only de 14/10](GOOGLE_ONLY_PILOT_EXECUTION_2026-10-14.md) e [estado vigente](ORKTO_CURRENT_STATE.md). Preserve este registro como evidência histórica; não o use para decidir o estado atual.

**14/10/2026 · Proposta, não ativada · STAGING NO-GO.**

Baseline imutável: app `d693e2f8269759485713fba9c3c2b19f6e4fbc74`, deployment `dpl_6eWYnHtaNeU9Pph2g46FMBDSmw6o`, [Preview de referência](https://orkto-staging-da5dotdh0-peixoto-s-projects1.vercel.app/). Branch de preparação: `production-readiness/google-only-pilot-preflight`, baseada em `bff22b7` (documentação posterior; runtime idêntico ao app validado). Esta PR contém ferramenta offline, testes e documentação; não implementa nem ativa o login Google-only.

## Resultado e condição de parada

O pedido permite interromper a ativação quando não houver restrição segura por coorte que preserve contas legadas. Essa condição foi encontrada: o projeto usa email/senha globalmente e contém **19 contas com senha**, incluindo identidades com memberships privilegiadas. Nenhuma transição dessas contas foi aprovada. Desativar Email bloqueia seu login por senha; esconder a UI deixa as APIs disponíveis. Não desativamos Email, confirmação, recovery ou signup; não habilitamos Google, hooks ou linking.

Não foi comprovado um controle simples e suportado de Google-only por coorte que também preserve os fluxos de senha/recovery existentes. Isso não significa impossibilidade de engenharia: uma política composta exigiria implementação e validação próprias, inclusive nos endpoints gerenciados de Auth, que ainda não existem. Não substituímos essa prova por um hook parcial.

**TECHNICAL_READY=NO · PILOT_APPROVAL=PENDING · PRODUCTION_GO=NOT_AUTHORIZED · READY_FOR_PRODUCTION_CANDIDATE=NO.**

## Evidência atual e limites

| Item | Estado | Evidência / implicação |
| --- | --- | --- |
| Alvo inspecionado | PASS | Banco somente `ghrjongiodziasupakrk`; painel identifica `orkto-staging`, organização Free. Identidade do projeto Vercel de produção consultada read-only na checagem anterior ao push; nenhuma configuração ou dado de produção alterado. |
| Contas existentes | PASS (inventário) | SQL agregado: 19 usuários, 19 com senha, 0 identidades Google, 0 contas com múltiplos providers, 0 usuários com memberships ativas em múltiplos workspaces, 10 memberships owner/admin ativas. Memberships não equivalem a 10 usuários distintos. Nenhuma senha/hash/email/ID pessoal retornado. |
| Configuração Auth | PASS (inspeção) | Painel Providers: Email ON, Google OFF, signup ON, confirmação ON, anonymous OFF, manual linking OFF; nenhum custom provider. Auth Hooks mostra estado vazio. Nenhum formulário de credencial aberto. |
| Redirects Auth | PASS (inspeção) | Site URL e único Redirect URL = origem exata `https://orkto-staging-da5dotdh0-peixoto-s-projects1.vercel.app`; zero wildcard ou origem de produção. |
| Google-only por coorte | BLOCKED | Email global ON; sem política de coorte/hook, sem proibição comprovada de adicionar senha, login direto ou recovery para Google. |
| Admissão fechada | FAIL para ativação proposta | Triggers ativos `orkto_auth_provision_profile` → `orkto_profile_provision_workspace`: novo Auth user com email cria profile, workspace e owner ativo. Não há allowlist do piloto nesse caminho. Google continua OFF. Isso não prova acesso aos tenants existentes. |
| OAuth/PKCE no app atual | FAIL para requisito PKCE | `src/lib/supabase.ts` não configura flowType; SDK instalado usa default `implicit` em `@supabase/auth-js/src/GoTrueClient.ts`. `sign-in-flow-1.tsx` usa Google com redirectTo=origin e CTA condicionado ao provider habilitado. PKCE não foi implementado nesta PR. |
| Roles / tenant atuais | PASS baseline; política piloto PENDING | `backend/core-app.ts` valida JWT via getUser e membership ativa; Edge `orkto-core-mutations` também valida user, workspace e role. Onboarding exige owner real. Nenhum gate de admissão/provedor por coorte. |
| Convites existentes | REVIEW | `backend/operational-routes.ts`: owner/admin cria convite, admin só por owner; aceite requer sessão, email verificado correspondente, token/expiração e CAS. Não impede o trigger de criar workspace no cadastro anterior ao aceite; não é allowlist pré-cadastro. Team não foi validado para este piloto. |
| Account linking | PENDING teste | Manual OFF não desabilita automatic linking por email verificado. Zero contas vinculadas hoje não prova segurança de futuras vinculações com email de owner/admin. Não conceder role por email/domínio/user_metadata. |
| Ledger | PASS read-only | SQL atual: 41 migrations. Zero DDL/DML/configuração remota alterados nesta tarefa. |
| E2E original | PASS preservado | [5/5 no app d693e2f](evidence/auth-ab-d693e2f-pass.json); não comprova OAuth Google ou política nova. |
| E2E Google / legado após transição | NOT RUN / BLOCKED | Provider desativado, transição não escolhida, credenciais/consentimento Google não configurados. Não solicitamos repetição do launcher de senha como prova de Google-only. |
| Proteção de senhas vazadas / SMTP | BLOCKED legado | Google desativado e 19 contas com senha: proteção Free não é N/A; FINAL-STG-PASSWORD e FINAL-STG-SMTP permanecem abertos. Resend preservado para integração futura. |

### Reproduzir inspeção sem revelar credenciais

SQL, somente no projeto staging:

```sql
select
  (select count(*) from auth.users) as auth_users,
  (select count(*) from auth.users where coalesce(encrypted_password, '') <> '') as password_accounts,
  (select count(*) from auth.identities where provider = 'google') as google_identities,
  (select count(*) from (
    select user_id from auth.identities group by user_id having count(distinct provider) > 1
  ) x) as linked_accounts,
  (select count(*) from (
    select user_id from public.orkto_workspace_members where status = 'active'
    group by user_id having count(distinct workspace_id) > 1
  ) x) as multi_workspace_users,
  (select count(*) from public.orkto_workspace_members
    where status = 'active' and role in ('owner', 'admin')) as privileged_active_memberships;
```

Inventário sanitizado: [google-pilot-inventory-2026-10-14.json](evidence/google-pilot-inventory-2026-10-14.json). É fotografia datada; ferramenta não consulta plataformas e declara `OFFLINE_PREFLIGHT_ONLY`, nunca GO. Sem valores de secrets, PII ou acesso à `.env`.

```powershell
node --test scripts/tests/google-pilot-preflight.test.mjs
node scripts/readiness/google-pilot-preflight.mjs docs/05_ENGINEERING/evidence/google-pilot-inventory-2026-10-14.json
# Exit 2 esperado: BLOCKED. Mesmo inventário ideal exige revisão/evidência real.
```

## Por que os atalhos não satisfazem o requisito

- [Supabase identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking): Google pode vincular automaticamente email verificado existente; usuário OAuth pode adicionar senha por updateUser. Ocultar senha não fecha esse caminho.
- [Auth Hooks](https://supabase.com/docs/guides/auth/auth-hooks): Before User Created trata novas contas; Custom Access Token trata emissão de JWT, não demonstra bloqueio de escrita de senha ou envio de recovery. Password Verification exige Teams/Enterprise; nenhum custo autorizado.
- [Send Email Hook](https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook) substitui o envio padrão. Não presumir que rejeitar emails do piloto e retornar vazio para legado mantém o envio legado. Não ativar relay/Resend sem escopo e credenciais aprovados.
- [Google Audience](https://support.google.com/cloud/answer/15549945?hl=en): Testing/test users tem exceção para scopes básicos de identidade. **Não é a barreira de autorização da ORKTO.** Workspace Google também pode bloquear OAuth por política própria.

## Única decisão prévia necessária: transição de Auth

Nenhuma opção foi aprovada ou executada:

1. **Isolar o piloto em outro projeto Auth/Supabase**, preservando as 19 contas e o Preview atual. Só avançar após escolher destino e comprovar capacidade gratuita disponível; não criar terceiro projeto, pagar plano ou trocar refs automaticamente. Exige novo guard explícito de destino, replay de 41 migrations e novo Preview. Não copiar dados/credenciais de produção.
2. **Migrar explicitamente as contas de staging para Google**, com inventário privado de owners e contas de teste, vinculação verificada, acesso administrativo alternativo seguro e rollback; somente depois desativar Email no projeto. Altera o requisito de preservar login por senha do legado, portanto exige decisão do proprietário. Não excluir contas nem memberships.

Coexistência no mesmo projeto com hooks/coortes é alternativa de engenharia, não pronta: requer prova completa contra login/add-password/recovery, preservação do envio legado e revogação com JWT ainda válido em API/RLS/Edge. Não adotada como atalho. A escolha de ambiente/transição precede a entrada de qualquer secret Google.

## Checklist preciso de integração após a decisão

### Google Cloud — proprietário, em painel seguro

- Selecionar projeto de teste pertencente ao proprietário. Configurar Branding, email de suporte e contato; Audience External/Testing quando aplicável. Não publicar app nem aprovar termos em nome do proprietário.
- Scopes somente `openid`, `email`, `profile`; nenhum Gmail/Drive, offline access ou token Google persistido sem necessidade. Cadastrar test users quando aplicável, além da allowlist ORKTO obrigatória.
- Criar OAuth Client **Web application** de staging. Se mantido o projeto atual, Authorized redirect URI exato: `https://ghrjongiodziasupakrk.supabase.co/auth/v1/callback`. Se for escolhido projeto isolado, gerar URL a partir do ref aprovado, nunca reutilizar callback de outro projeto.
- JavaScript origins somente se exigidos pelo mecanismo escolhido: referência atual `https://orkto-staging-da5dotdh0-peixoto-s-projects1.vercel.app`, sem path; atualizar para origem exata do futuro candidato. Não adicionar curingas, produção ou hosts antigos.
- Client Secret somente Supabase staging → Authentication → Providers → Google; nunca app, Preview, chat, git ou logs. Client ID também deve ser configurado no painel previsto. Nenhuma compra de domínio agora; necessidades de branding/verificação devem ser conferidas, não presumidas dispensadas permanentemente. [Guia Supabase Google](https://supabase.com/docs/guides/auth/social-login/auth-google).

### Implementação — agente, após destino/transição aprovados

- Admissão no servidor/banco antes do provisionamento: reserva aprovada de identidade/convite, expiry, uso único, auditoria; bind a identidade Google verificada pelo Auth (issuer/subject) e auth user ID. Email verificado pode participar de convite inicial, **nunca é prova suficiente de role/ownership**. Não usar user_metadata ou domínio como concessão de privilégio.
- Novos usuários não autorizados não recebem profile/workspace/role; remover/revogar aprovação bloqueia tanto sessão existente quanto novos logins. Enforce em emissão de sessão, API, RLS e Edge; revogação de refresh isolada não invalida instantaneamente JWT já emitido. Memberships/roles seguem registros confiáveis e comandos autorizados.
- Configurar [PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow) no SDK com callback/exchange suportados, limpeza de erro/código da URL, redirects restritos. Supabase mantém state com Google; app comprova code verifier, callback e rejeição de replay/redirect adulterado. Não implementar OAuth próprio nem logar fragment/code/token.
- UI Google-only isolada por ambiente após enforcement: CTA acessível, pending, cancelamento/erro, sessão expirada e logout. Preservar UI e serviços legados onde requeridos. Expor política pública sem secrets, sem fallback para senha.
- Antes de habilitar Google, aplicar e testar barreira de admissão/passwordless; manter anonymous OFF e manual linking OFF. Revisar automatic linking com email de conta privilegiada antes de qualquer uso real.
- Site URL e Redirect URLs devem apontar só ao Preview exato escolhido. Referência atual: `https://orkto-staging-da5dotdh0-peixoto-s-projects1.vercel.app/`; nenhum wildcard amplo. OAuth Google callback e redirect do app são URLs diferentes.
- Chave pública + JWT + RLS no app; service-role somente Edge/runner administrativo seguro. Nenhum novo secret em Vercel Preview; WIA, billing, mensagens, integrações pagas e Resend não são alterados.

### Validação obrigatória — novo SHA/deployment

| Grupo | Critério de aprovação | Estado atual |
| --- | --- | --- |
| Admissão | Google autorizado entra; não autorizado não ganha usuário/workspace/role operacional; convite expirado/reutilizado negado; revogação nega API, RLS e Edge inclusive com JWT anterior | NOT RUN |
| Auth direto | Signup/password grant, add-password por SDK/PUT user, reset/recovery/OTP alternativos e refresh de sessão incompatível negados para piloto; nenhum email ORKTO necessário no caminho piloto | NOT RUN |
| Legado / linking | Login, confirmação/recovery e roles existentes preservados ou transição explicitamente aprovada; mesmo email privilegiado não gera escalonamento; manual/automatic linking testados | NOT RUN |
| OAuth | State incorreto, verifier ausente/errado, callback inválido/expirado/repetido, cancelamento e redirect estrangeiro negados sem tokens em logs; login posterior e expiração funcionam | NOT RUN |
| Sessão / tenant | Logout/revogação real, refresh reuse negado, A/B usuários Google reais em workspaces distintos, IDOR/roles/direct DML negados | NOT RUN |
| Regressão | Suites auth pertinentes, 5/5 E2E adaptado ao novo fluxo no SHA exato, lint/typecheck/builds/smoke/CI/secret scan; não reduzir assertions para reaproveitar runner de senha | NOT RUN |
| Segurança | Advisors depois de mudanças, revisão RLS/grants/allowlist/Edge/callback e erro/logs; risco Free corretamente classificado | NOT RUN após mudança; refresh read-only atual abaixo |

Contas Google e consentimento reais dependem de acesso do proprietário. Não automatizar desafios Google nem compartilhar credenciais no chat. Só classificar `BLOCKED_OWNER_CREDENTIALS` quando o destino, implementação e testes independentes estiverem prontos. Aqui o blocker anterior é **BLOCKED_LEGACY_AUTH_TRANSITION**, com implementação e OAuth E2E pendentes.

## Advisors e checkpoint desta preparação

Refresh read-only staging 14/10: security = 12 `rls_enabled_no_policy` INFO, 3 `authenticated_security_definer_function_executable` WARN, 1 `auth_leaked_password_protection` WARN. Performance = 80 `unindexed_foreign_keys` INFO, 1 `auth_rls_initplan` WARN, 28 `unused_index` INFO. Classificações históricas de tabelas service-only e helpers bool constam do [checkpoint vigente](SECURITY_AUDIT_CURRENT.md); não foram removidas políticas, índices ou grants para silenciar avisos. Esta consulta não substitui nova revisão após implementar piloto.

Remediações oficiais: [RLS sem policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [SECURITY DEFINER](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [senhas vazadas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), [FKs](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys), [RLS initplan](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan), [índices](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).

## Validação e rollback desta PR

20/20 testes focados PASS (8 preflight + 12 deploy boundary); teste CLI confirma rejeição sanitizada de JSON inválido e campos desconhecidos/credenciais. Sintaxe Node, secret scan (zero findings) e diff check PASS. Avaliação do inventário retorna BLOCKED/exit 2 esperado. A ferramenta não lê ambiente, não faz requests e não escreve em banco. Não é enforcement nem security checkpoint aprovado para Google-only.

Nenhum runtime, migration, dependência, UI, configuração Supabase/Vercel ou secret alterado. Sem novo Preview; builds/lint/E2E do app não repetidos e não reivindicados para um app Google novo. Baseline 5/5 preservado. Reverter esta PR remove somente ferramenta/testes/documentação, sem rollback de dados/contas. Uma futura ativação precisa plano próprio: revogar admissão piloto antes de desativar provider, preservar contas e sessões legadas conforme transição; nunca reabilitar senha como fallback silencioso do piloto.

Pilot comercial/jurídico permanece separado: sem cobranças, sem aprovação de Termos/Privacidade, sem go-live. Nada deste documento dispensa os gates do legado ou autoriza produção.
