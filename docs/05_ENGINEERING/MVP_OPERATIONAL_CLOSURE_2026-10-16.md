# ORKTO — fechamento técnico e operacional do MVP — 2026-10-16

> Checkpoint histórico do runtime `ee3b3b3`. O incremento de planos, Pulso e billing está documentado em [fechamento operacional e billing](OPERATIONAL_BILLING_CLOSURE_2026-10-16.md), com 49 migrations no source e 48 no staging até a aplicação remota.

## Decisão atual

`READY_FOR_PRODUCTION_CANDIDATE=NO`

O candidato executável revisado é `ee3b3b3d45decb208d7ccf927bb25f429a64af04`, publicado como Preview no projeto Vercel `orkto-staging`:

- URL: `https://orkto-staging-nlwxxb8o0-peixoto-s-projects1.vercel.app/`
- deployment: `8NBPFoE284DdCkJNGiWWjdXomQZN`
- Supabase staging: `ghrjongiodziasupakrk`
- migrations reconciliadas no staging: 48

Produção não foi acessada nem alterada. Mensagens externas, cobranças e chamadas pagas de IA permanecem desativadas.

## Matriz dos gates obrigatórios

| Gate | Estado | Evidência e condição de fechamento |
| --- | --- | --- |
| Identidade do candidato | PASS | Dashboard Vercel mostrou Preview READY ligado ao commit completo `ee3b3b3d45decb208d7ccf927bb25f429a64af04`. |
| Regressão local | PASS | `npm run test:all` passou fora do sandbox: 244/244 testes da aplicação e 61/61 testes de readiness. A primeira execução restrita bloqueou conexões localhost; sua falha foi reproduzida como limitação da infraestrutura, não aceita como evidência do aplicativo. |
| Build, typecheck e secret scan | PASS | `npm run readiness:build` validou build, health, SPA, fronteira de Auth e proteção do source; `npm run lint` passou; secret scan examinou 447 arquivos com zero findings. |
| Replay PostgreSQL 17 | PASS | GitHub Actions `38911514048`: baseline e fixture legada, 48 migrations e assertions passaram. |
| Limite de deployment | PASS | GitHub Actions `38911514003`: staging permitido e produção recusada. |
| Ledger e migration 48 em staging | PASS | Ledger remoto contém 48 entradas. A migration `meta_whatsapp_performance_indexes` criou os índices de FKs e corrigiu o initplan da policy de sussurros sem ampliar grants. |
| Login Google-only na interface | PASS | O candidato não oferece senha e inicia OAuth Google com PKCE pelo projeto staging. O callback configurado é o callback Supabase de `ghrjongiodziasupakrk`. |
| Redirect do OAuth no candidato exato | PASS | Após confirmação do proprietário, Site URL e redirect exato `nlwxxb8o0` foram salvos e confirmados após recarga do dashboard. Login Google retornou ao candidato correto e abriu Hoje. |
| Sessão Google e logout | PASS_OWNER_SMOKE | Login real da conta aprovada, leitura de Hoje e Auditoria, sessão persistente após reload, logout e novo reload sem navegação autenticada passaram em `ee3b3b3`. |
| Expiração e revogação remota Google | BLOCKED_FULL_E2E | O smoke não aguardou expiração nem tentou reutilizar refresh token; a prova histórica de revogação não substitui esse teste no candidato atual. |
| Allowlist do piloto | PASS_STRUCTURE / BLOCKED_COHORT | Admissão é fail-closed e não cria owner/workspace automaticamente. A conta do proprietário foi autorizada por decisão registrada. Uma segunda identidade Google aprovada é necessária para o A/B real entre empresas. |
| Isolamento A/B de empresas | PASS_LOCAL_CI / BLOCKED_REAL_IDENTITIES | RLS, APIs e negativos de role passaram localmente e no CI. Falta repetir com duas identidades Google reais e autorizadas no candidato atual. |
| Supabase SECURITY DEFINER | PASS_REVIEW | Cinco helpers autenticados de membership/admissão retornam booleano, usam contexto autenticado e `search_path` fixo/vazio. São barreiras deliberadas, sem grants administrativos ao navegador. |
| RLS sem policies | PASS_INTENTIONAL | As tabelas apontadas são internas/service-only e usam RLS sem policy como negação total ao cliente. Não foram criadas policies permissivas para silenciar alertas. |
| Proteção contra senhas vazadas | INFO_GOOGLE_ONLY | O alerta continua ativo no projeto. O piloto não aceita senha; a correção não bloqueia o fluxo Google-only, mas deve ser habilitada antes de qualquer reintrodução de senha. |
| Alertas de desempenho | PASS_CURRENT_SCOPE / INFO_BACKLOG | FKs das novas tabelas Meta estão indexadas e o auth initplan foi corrigido. `Unused Index` é esperado logo após criação; FKs legadas não relacionadas permanecem backlog medido, sem relaxar segurança. |
| Logout `NETWORK_ERROR` histórico | PASS_NO_IMPACT_OBSERVED | O navegador abortava a requisição de logout durante a navegação. A prova funcional posterior confirmou refresh token revogado (`/auth/v1/token` 400) e sessão encerrada. Não houve continuidade autenticada nem exposição de token. |
| WhatsApp Meta — armazenamento e tenancy | PASS_STRUCTURE | Migration 47 cria conexão por workspace, token no Vault, inbox/outbox, deduplicação, auditoria, quotas e funções service-only. Eventos resolvem tenant por número/WABA confiável. |
| Webhook Meta | PASS_FAIL_CLOSED | GET sem verify token retorna 403; POST com assinatura inválida retorna 401. Assinatura usa corpo bruto e segredo somente no servidor. |
| Envio Meta real | BLOCKED_EXTERNAL | `ORKTO_EXTERNAL_MESSAGING_ENABLED=false`. Faltam App Meta, número de teste/WABA, App Review, secrets e aprovação comercial de tarifa. Nenhuma mensagem real foi enviada. |
| WIA Gemini provisória | PASS_STRUCTURE / BLOCKED_LIVE | Gateway usa allowlist de workspace, limite, auditoria, saída como rascunho para aprovação e falha fechada. Falta chave Gemini no secret store e allowlist explícita; nenhuma chamada paga foi feita. |
| Inbox e WIA | PASS_CONTRACT | Inbox separa aceitação, persistência e entrega; WIA não executa efeito irreversível sem aprovação e proveniência persistida. |
| Auditoria e observabilidade | PASS_STRUCTURE / PARTIAL_STAGING | Eventos sensíveis têm correlação e redaction estruturada. Webhook, OAuth, Hoje e leitura dos quatro eventos persistidos de Auditoria foram observados no candidato atual. Correlação completa de tráfego e E2E A/B continuam pendentes. |
| Segredos e ambiente | PASS | Staging está fixado por project ref e Vercel project id; service role não é exposta ao browser; secret scan não encontrou segredo conhecido. Produção é recusada pelos gates. |
| Backup e recuperação | BLOCKED_PLATFORM | Há checkpoint/contagem e plano de recuperação documentado. Restore completo e PITR não foram demonstrados no plano Free do staging. |
| Plano e cobrança | BLOCKED_PRODUCT_COMMERCIAL | A interface não inventa assinatura ativa e não realiza checkout. Faltam fornecedor, preços aprovados, webhooks, reconciliação e autorização de cobrança. |
| E2E histórico | PASS_HISTORICAL_ONLY | O E2E 5/5 em `d693e2f` e o Auth A/B anterior foram preservados. Eles não substituem Google E2E no SHA atual. |
| E2E obrigatório do candidato atual | BLOCKED_PARTIAL_PASS | Smoke Google do proprietário passou; E2E completo com escrita isolada, expiração/revogação e segunda identidade aprovada ainda é obrigatório. |

## Alterações concluídas

1. Autenticação exclusivamente Google na interface, PKCE e callbacks limitados ao projeto staging.
2. Admissão por allowlist, sem criação automática de owner ou workspace.
3. Base operacional Meta WhatsApp com isolamento por workspace, Vault, assinatura de webhook, idempotência, auditoria e envio desligado.
4. WIA Gemini provisória com allowlist, quotas, proveniência e aprovação humana; integração externa desligada sem segredo.
5. Índices de desempenho das tabelas Meta e correção da policy que reevaluava `auth.uid()` por linha.
6. Perfil, Equipe, Auditoria e Ajuda implementados; navegação, identidade visual, glass UI e landing atualizados.
7. Configurações gerais não exibem o bloco Asaas; cobrança permanece honesta e sem ativação fictícia.

## Evidências preservadas

- PR: `https://github.com/peixotodavy831-stack/Orktoverdadeiro/pull/2`
- CI PostgreSQL 17: `https://github.com/peixotodavy831-stack/Orktoverdadeiro/actions/runs/38911514048`
- CI limite de deployment: `https://github.com/peixotodavy831-stack/Orktoverdadeiro/actions/runs/38911514003`
- migration 47: `20261016030000_meta_whatsapp_business_foundation.sql`
- migration 48: `20261016050000_meta_whatsapp_performance_indexes.sql`
- documentos históricos continuam imutáveis como prova do estado anterior.

## Ações humanas restantes

Estas ações envolvem contas externas, credenciais ou decisão comercial e não devem ser simuladas:

1. Supabase Auth staging: configuração de Site URL/redirect e smoke Google do proprietário concluídos. Completar E2E Google com expiração/revogação e fixtures isoladas.
2. Aprovar uma segunda identidade Google do piloto e seu workspace para o teste A/B real.
3. Gemini: cadastrar a chave somente no secret store e autorizar explicitamente o workspace de teste.
4. Meta: criar/configurar App, Embedded Signup, WABA/número de teste, verify token, App Review e tarifas; manter envio OFF até aprovação.
5. Cobrança: aprovar fornecedor, preços e fluxo de reconciliação antes de qualquer checkout.
6. Recuperação: executar restore rehearsal em ambiente descartável ou plano que ofereça a capacidade necessária.

Nenhuma dessas pendências autoriza alteração de produção. A transição comercial pode preparar oferta, materiais e cohort, mas o piloto autenticado permanece bloqueado até o E2E Google atual e o teste A/B real passarem.
