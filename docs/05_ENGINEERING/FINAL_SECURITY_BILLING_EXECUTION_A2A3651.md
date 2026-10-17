# ORKTO — execução restante de segurança e billing

Referência executável: `a2a3651319196ffc56813992f705692d368ef967`, [Preview autorizado](https://orkto-staging-az36qohmo-peixoto-s-projects1.vercel.app/), Supabase `ghrjongiodziasupakrk`. **READY_FOR_PRODUCTION_CANDIDATE=NO.** Este documento é um roteiro de execução ainda pendente, não evidência de testes aprovados.

## Diagnóstico atual — 16/10/2026, 22:11 UTC

- Inspeção de código: `run-staging-auth-secure.ps1` e `validate-staging-auth.mjs` alimentam o E2E histórico por senha. `validatePasswordRunnerMode`, em `staging-e2e-config.mjs`, bloqueia Google-only com `PASSWORD_RUNNER_INCOMPATIBLE_WITH_AUTH_MODE`. O launcher não foi executado; não foram criados usuários, senhas ou workspaces.
- A superfície IAB disponível controla abas, sem executor de transporte HTTP em dois contextos Google isolados. Não converter duas abas da mesma origem em prova de duas sessões isoladas. Não extrair tokens do estado interno do navegador.
- SQL administrativo somente de leitura: zero customers sandbox aprovados, bindings, comandos de fornecedor, eventos de lifecycle, políticas Pulso e tarifas de modelo. Isso demonstra falta de pré-requisitos, não aprovação do ciclo financeiro.
- Painel Edge Secrets: **No custom secrets created**. Nenhum valor reservado foi revelado, copiado ou alterado. [Captura](evidence/staging-no-custom-secrets-final-2026-10-16.png).
- Catálogo remoto: exatamente Start 7990, Pro 14990, Business 29990, Scale 59990 centavos BRL, Enterprise sem preço fixo. Sem mudança de ofertas, franquias ou direitos.
- Nenhum código de runtime, migration, deployment, configuração cloud ou assinatura foi alterado nesta rodada. Os PASS históricos permanecem no relatório canônico.

## Gate G-EXEC — BLOCKED_EXTERNAL

O [motor HTTP e os preflights foram implementados autonomamente](HOMOLOGATION_TOOLS_CURRENT.md), source c40fba9, com 25 testes offline aprovados. Ainda falta o adaptador que obtenha sessões pelo fluxo Google PKCE em dois contextos realmente isolados, além da integração e execução reais. O plano abaixo permanece NOT_TESTED até essa aquisição existir; não é necessário recriar a conta B nem ampliar seus papéis. A implementação local não remove o bloqueio externo.

Contrato mínimo do executor:

1. Fixar e verificar SHA, host Preview e projeto staging antes da autenticação. Conservar os workspaces A/B aprovados, sem criar memberships/roles.
2. Contextos A/B separados, sem compartilhamento de cookies/storage/token. Google/PKCE real; senha/2FA somente pelo proprietário no Google, quando necessário. Não reativar Auth por senha para reutilizar o launcher histórico.
3. Tokens obtidos pelo fluxo normal do executor ficam exclusivamente em memória, necessários ao HTTP; nunca exportar storageState, cookies, HAR, trace, payload de Auth, Authorization/apikey, URL com code, arquivo de sessão ou credenciais. Não usar extração interna do navegador como atalho.
4. OIDC de proteção Vercel separado do bearer Supabase e restrito ao host Preview. Nunca encaminhar OIDC Vercel ao Google/Supabase/Asaas; nunca encaminhar bearer de usuário ao Asaas.
5. Relatório com IDs de caso, contexto A/B, rota parametrizada, status HTTP, decisão/assertion, UTC, runtime SHA e versão Edge. Não registrar conteúdo de clientes, cabeçalhos ou corpos brutos.
6. Usar recursos sintéticos identificáveis em cada workspace para os testes de leitura/escrita. Banco vazio ou simples contagem zero não comprova isolamento. Não tocar dados reais da empresa. Se faltar recurso adequado, preparar fixture de negócio reversível dentro do workspace já autorizado; não criar outra identidade/workspace.

| Caso planejado | Estado | Execução e critério de aceitação |
| --- | --- | --- |
| G01 — identidade/tenant antes do HTTP | NOT_TESTED | Confirmar subject Google e workspace do contexto; A/B precisam ser distintos. O login B já aprovado não será repetido só para renovar uma evidência histórica. |
| G02 — A lê A por API, Edge e PostgREST | NOT_TESTED | Recurso próprio conhecido deve ser acessível conforme contrato/permissões; não basta HTTP200 sem conferir ownership do resultado em memória. |
| G03 — B lê B nos três transportes | NOT_TESTED | Mesmo critério, no contexto B, sem recurso de A. |
| G04 — A tenta recursos B | NOT_TESTED | API/Edge devem negar sem divulgar dados; PostgREST deve negar ou retornar conjunto vazio conforme grants/RLS. Registrar decisão, não conteúdo. |
| G05 — B tenta recursos A | NOT_TESTED | Mesmo critério na direção inversa. |
| G06 — tentativas de escrita cruzada | NOT_TESTED | Nenhuma mudança persistida, mesmo forçando workspace/id de outro tenant; validar por leitura administrativa sanitizada posterior. Não alterar roles/grants. |
| G07 — refresh/rotação | NOT_TESTED | Renovação válida entrega sessão do mesmo sujeito/tenant; concorrência controlada, sem auto-refresh do SDK disputar com o teste. Registrar somente booleanos, nunca tokens ou seus hashes. |
| G08 — reutilização de refresh | NOT_TESTED | Respeitar a janela configurada e a exceção do parent do token ativo; não classificar esses comportamentos legítimos como falha. Usar caso que realmente esteja fora das exceções. |
| G09 — expiração natural | NOT_TESTED | Reter JWT antigo apenas em memória, esperar seu exp real sem mudar TTL/relógio; negar esse JWT expirado em API/Edge/PostgREST. Não confundir JWT expirado com sessão renovada válida. |
| G10 — logout/revogação | NOT_TESTED | Revogar somente sessões de teste autorizadas, conferir encerramento e rejeitar refresh revogado respeitando semântica do fornecedor. Provar que não derrubou indevidamente o outro contexto. |
| G11 — JWT ainda não expirado após logout | NOT_TESTED | A assinatura pode continuar criptograficamente válida até exp. Operações sensíveis devem negar por sessão/admissão ausente, inclusive API e Edge; conferir RLS aplicável. Não considerar aprovação criptográfica isolada como autorização. |
| G12 — evidência e limpeza | NOT_TESTED | Nenhum token/trace/storage exportado; arquivar apenas fixtures da rodada, preservar dados e histórico existentes e registrar escopo realmente executado. |

Semântica conferida no [guia Supabase de sessões](https://supabase.com/docs/guides/auth/sessions): há exceções legítimas de reutilização de refresh; a negação sensível após logout deve considerar session_id, além da validade do JWT. Não modificar essas configurações para encurtar o ensaio.

## Gate B-CONFIG — BLOCKED_EXTERNAL

Antes de qualquer criação de assinatura, precisam estar concluídos:

- Proprietário identifica **conta Asaas sandbox e customer `cus_...` exclusivamente de teste**. Atualmente não há vínculo aprovado no banco; informar um ID no chat não cria automaticamente esse vínculo.
- Conferir notificações do customer no fornecedor; nenhum canal externo deve estar habilitado. No momento essa verificação está **NOT_TESTED**, pois não há credencial/customer aprovados. [Endpoint oficial de consulta](https://docs.asaas.com/reference/retrieve-notifications-from-a-customer).
- ASAAS_API_KEY e ASAAS_WEBHOOK_SECRET dedicados são cadastrados diretamente no secret store Edge staging. Nenhuma chave pelo chat, repositório, arquivo local, argumento de linha de comando ou Preview. O webhook exige segredo com pelo menos 32 caracteres, distinto da API key.
- Configurar APP_ENV=staging e ASAAS_ENVIRONMENT=sandbox no Edge. Manter ORKTO_BILLING_SANDBOX_ENABLED e ORKTO_BILLING_SANDBOX_LIFECYCLE_ENABLED ausentes/OFF até customer, notificações, callback e autorização de teste estarem conferidos. Não mudar essas flags nesta rodada.
- Callback exclusivo: `https://ghrjongiodziasupakrk.supabase.co/functions/v1/orkto-billing-webhook`. Selecionar os eventos de pagamento exigidos e os quatro [eventos nativos de assinatura](https://docs.asaas.com/docs/subscription-events); o endpoint relê o fornecedor e não confia no estado alegado pelo corpo do webhook.
- Vincular o customer ao workspace de teste previamente aprovado, com aprovação/auditoria. Não usar customer de produção nem inserir uma aprovação fictícia para desbloquear o ensaio.

### Casos do fornecedor — todos NOT_TESTED

| Caso | Execução preparada / evidência exigida |
| --- | --- |
| B01 — criação | Reserva durável, fornecedor sandbox, binding/customer/preço corretos; assinatura pendente não libera acesso. Sem cliente ou notificação real. |
| B02 — pagamento pendente | Relido no fornecedor; estado financeiro persistido sem ativação/alongamento indevido. |
| B03 — pagamento confirmado | Confirmação real de teste + assinatura ACTIVE + valor/período/referência correspondentes; só então ativação conforme contrato existente. Nunca forjar um webhook confirmado. |
| B04 — renovação | Novo pagamento/período de teste confirmado no fornecedor; monotonicidade e reconciliação, sem estender acesso com evento antigo. |
| B05 — inadimplência | Estado financeiro observado e auditado. Não inventar corte/grace period; efeito comercial permanece bloqueado até aprovação. |
| B06 — atualização/inativação | PUT sandbox, estado relido, cobranças existentes preservadas por updatePendingPayments=false; preço/plano não alterados unilateralmente. |
| B07 — cancelamento nativo | DELETE somente da assinatura de teste identificada; recibo confirmado com mesmo ID/deleted. Provar journal/auditoria; término de acesso segue política ainda pendente. |
| B08 — repetição | Repetir evento real de teste sem novos efeitos, sem recriar cobrança ou duplicar acesso. Mesmo ID com corpo conflitante não pode ser aceito como replay válido. |
| B09 — eventos antigos/conflitantes | Nenhuma regressão de período ou ressurreição de binding excluído; conflito auditado/negado. |
| B10 — reconciliação | Relitura autoritativa de pagamento e assinatura; customer, valor, referência e tenant correspondentes antes de aplicar estado. |
| B11 — falha/timeout | Estado unknown/failed quando não houver prova do resultado; nenhum reenvio cego ou confirmação inventada. Não provocar falha no fornecedor global nem alterar rede/segurança. |
| B12 — exclusão com GET404 | Não assumir prova de cancelamento pela ausência; manter reconciliation-required, sem liberação/corte de acesso sem evidência e política. |
| B13 — encerramento | Flags de testes fechadas, checkout comercial e notificações externas inativos; revisar fixtures e preservar trilha histórica. |

Os cenários equivalentes em fixtures/CI já aprovados **não foram repetidos**, nem promovidos a prova do fornecedor. Não houve chamada Asaas nesta rodada.

## Decisão comercial independente — BLOCKED_EXTERNAL

Definir o efeito sobre acesso de cancelamento, inativação, atraso, refund, renovação e término do período. Aprovar momento efetivo e qualquer tolerância antes de publicar política. Enquanto isso, o lifecycle registra observações e preserva a guarda RECORDED_POLICY_REQUIRED; não se semeou aprovação.

Preservados Pulso, Cost Governor, Central Econômica e os cinco planos. Zero políticas Pulso e tarifas semeadas não equivalem a franquia infinita ou custo zero. Assentos/franquias/limites/termos continuam aguardando decisão comercial, sem números inventados.

## Demais dependências preservadas

| Dependência | Estado | Intervenção externa necessária |
| --- | --- | --- |
| Gemini | BLOCKED_EXTERNAL | Projeto/modelo/quota disponíveis, chave no secret store, orçamento/tier de teste e tarifa/política Pulso aprovados. Nada de inferência paga até autorização. |
| WhatsApp Meta | BLOCKED_EXTERNAL | App/WABA/número de teste autorizados, credenciais/config Embedded Signup e callback, versão/permissões válidas e tokens no Vault. Não enviar mensagens reais. |
| Recuperação real | BLOCKED_EXTERNAL | Destino privado/off-site, credencial de exportação no secret store, escopo Auth/Storage/config, RPO/RTO e restore isolado aprovados. Ensaio sintético aprovado não comprova recuperação gerenciada do Free; não contratar plano/add-on. |

## Intervenções mínimas

1. Disponibilizar/identificar executor Google A/B compatível com o contrato acima; logins Google/2FA interativos somente se exigidos por esse executor. Não compartilhar tokens nem fornecer senhas ao agente.
2. Identificar conta/customer sandbox, conferir notificações e cadastrar os dois secrets diretamente no staging. Depois autorizar a rodada controlada e revisar flags/vínculo antes de habilitar.
3. Aprovar política de término e condições comerciais; configurar Gemini/Meta e recuperação quando disponíveis, mantendo as restrições atuais.

Não voltar a pedir aprovação de B, workspace B ou redirect já resolvidos. Ausência de resposta não habilita fornecedor nem política. Nenhum gate obrigatório muda para PASS por existir este roteiro.
