# WhatsApp + WIA — resultado da missão, 26/10/2026

**Status final: PARCIAL / BLOQUEADA POR CONFIGURAÇÃO EXTERNA.**

**READY_FOR_PRODUCTION_CANDIDATE=NO**. Não houve deploy, push, merge, alteração de produção, configuração financeira, conta real nova ou mensagem externa.

Código local validado: `4e2787037e4a6df256b3cfc7e3d9ca9d334de2c1`, branch `codex/orkto-whatsapp-e2e`, worktree exclusivo `Orktoverdeiro-whatsapp-e2e`. Base preservada: `1c2bf8972fd63c6f530f5940a7e56a5e81db5a4b`.

## Causa-raiz e evidências reais

1. **Meta não configurada no secret store Edge do staging**: foram observados somente quatro nomes de ambiente/billing, sem META_APP_ID, META_APP_SECRET, configuração Embedded Signup, versão Graph ou verify token. Nenhum valor foi aberto. [Nomes apenas](evidence/whatsapp-e2e-20261026/secret-names-only.json).
2. **Canal nunca comprovado nesta rodada**: consulta agregada encontrou zero conexões Meta, eventos e send requests, além de zero tarifas de serviço aprovadas. [Consulta real e probes](evidence/whatsapp-e2e-20261026/staging-readonly.json). Ausência de registro não prova ausência de toda tentativa histórica.
3. **Caminhos desconectados**: o webhook oficial persiste texto; a rota legada de sugestão WIA é distinta. Conectado o Inbox ao pedido determinístico da WIA com revisão explícita, sem reutilizar o webhook legado como substituto do oficial.
4. **ACK e recibos**: fonte anterior confirmava processamento em andamento/ingest não confirmado; não comparava destinatário do recibo à conversa. Corrigidos localmente, ainda não no runtime remoto v3.
5. **Conexão visual**: status salvo era exibido como conexão atual. Agora há verificação explícita no provedor, validade de cinco minutos e estados de atenção/autenticação/desconexão.
6. **Atualização de contexto**: rascunho era preservado em nova consulta e o resultado não era invalidado por sessão. Corrigidos ambos. O Inbox já passava o token no móvel e já tinha key por conversa; essa hipótese inicial foi descartada, não é causa-raiz.

O webhook HTTPS real rejeitou GET com verificação inválida: **403**, e POST sem assinatura: **401 SIGNATURE_INVALID**. São provas negativas reais, não prova de handshake válido, recepção de cliente ou integração de negócio.

## Fluxo operacional implementado nesta fatia

Cliente → Meta → webhook oficial/HMAC → resolução WABA/telefone → claim/idempotência → texto persistido → Inbox → **operador solicita** preparação WIA → WIAOS/T0 com fontes do workspace → aprovação persistida → **tarefa interna** → operador revisa e solicita envio pelo Inbox → gateway de envio/limites/janela → API Meta → recibo autenticado/destinatário validado → ledger.

Não existe dispatch automático de IA ou resposta a partir do webhook. Isso evita assumir identidade do proprietário, consumir inferência sem autorização ou enviar mensagens sem política aprovada. O rascunho determinístico é uma pergunta inicial de qualificação, não interpretação semântica avançada nem promessa comercial. Preparar, aprovar e enviar são atos distintos.

## Correções entregues

- Ingest só confirma APPLIED/DUPLICATE com IDs persistidos; IN_PROGRESS pede retry. Finalização booleana false/erro não vira ACK falso.
- Recibos validam o telefone persistido e o workspace antes de atualizar entrega. Conflitos permanecem falhas auditáveis.
- Janela de serviço rejeita data ausente, inválida, futura e limite exato de 24h. Token inválido no erro Graph 190 é classificado como autenticação.
- Binding de telefone/WABA reutilizado entre onboarding e health. Requests limitados por timeout global; nenhum POST em health, segredo ou token retornado ao frontend.
- SDK é preparado antes do segundo clique **Continuar na Meta**, preservando o gesto de abertura de popup. Timeout e erro parcial não afirmam que nenhuma ativação ocorreu. O popup real ainda não foi homologado.
- Interface mostra número salvo, verificação pontual, erro e reconexão; não promete entrega. Mídias/templates/automação indisponíveis são explicitados.
- Desconexão **local** exige confirmação e owner/admin, pausa atendimento, bloqueia leitura do token e audita uma vez. Recusa envios pendentes/incertos; não deleta segredo nem revoga permissões compartilhadas no fornecedor.
- WIA recebe somente o UUID canônico da conversa. Consulta tenant-scoped, sem echo de instruções do cliente, preço inventado, inferência, Pulso ou envio. Reutiliza claim/finish, quotas, decisão e auditoria existentes.
- Branch isolada com Git deployment OFF. Nova RPC só service_role, search_path vazio; mantidos os verificadores de ACL/RLS e ajustado o inventário explícito para 49 rotinas.

## Estado por funcionalidade

| Funcionalidade | Estado final | Evidência/limite |
|---|---|---|
| Conexão oficial / Embedded Signup | BLOQUEADA POR CONFIGURAÇÃO EXTERNA | Contrato e correções locais; sem aplicativo/configuração Meta no runtime. |
| Binding WABA/telefone e Vault | PARCIAL | Verificadores locais e SQL; nenhum token/conta real conectado. |
| Callback público e rejeição de assinatura | FUNCIONAL para negativos reais | HTTPS 403/401; assinatura Meta válida e handshake não testados. |
| Recepção/persistência de texto | PARCIAL | Handler testado e PostgreSQL real de fixture; zero mensagem real. |
| Envio oficial | BLOQUEADA POR CONFIGURAÇÃO EXTERNA | Implementado e testado com doubles; falta ativo autorizado, tarifa/limites e rodada controlada. |
| Status/entrega e destinatário | PARCIAL | Handler/ledger locais; nenhum recibo real. |
| WIA contextual determinística | PARCIAL | UI, código e aprovação SQL comprovados localmente; não em tenant real. |
| Interpretação conversacional avançada | BLOQUEADA POR CONFIGURAÇÃO EXTERNA / PARCIAL | Provedor existente gated; nenhuma inferência paga habilitada. |
| Aprovação/idempotência/isolamento | FUNCIONAL em fixtures locais | PostgreSQL e HTTP local; não substitui A/B autenticado remoto. |
| Reconexão/estado visual | PARCIAL | Seis verificações de layout/interação; Meta real pendente. |
| Desconexão ORKTO | FUNCIONAL em PostgreSQL local | ACL, pausa, replay, pendência e leitura de token bloqueada; não implantada. |
| Revogação global no fornecedor | NÃO IMPLEMENTADA como automação | Procedimento pelo proprietário; não revogar concessões de outras empresas. |
| Mídias/templates e follow-up externo automático | NÃO IMPLEMENTADA | Texto é a fatia atual; tipos não textuais continuam sem processamento de conteúdo. |

## Testes e falhas resolvidas

- **389/389 aplicação +108/108 ferramentas**, `test:all`, exit 0. Inclui handler HTTP com assinatura sintética, retry, ingest, recibos, API roles, T0/WIA, replay e UI. Doubles não foram classificados como Meta real.
- Lint e typecheck Edge PASS; Edge compilado com shim, não Deno remoto.
- Build/smoke isolado PASS: frontend, metadados, servidor, health, SPA, auth boundary e proteção de fonte; dist preservado.
- PostgreSQL 17.11: replay novo **52/52**, upgrade sanitizado **45/45**; asserts de segurança, associação única, desconexão e recuperação existentes passaram.
- Asserção nova WIA WhatsApp em ambos os bancos: aprovação persistida, B recusado, uma tarefa após replay, nenhum envio ou consumo Pulso. Transações de fixture revertidas.
- QA local: 390×844, 768×1024, 1280×900; seis medidas sem overflow. Conversa → pedido WIA canônico em desktop/mobile; confirmação de desconexão aberta/cancelada sem chamar operação. [Medidas](evidence/whatsapp-e2e-20261026/visual-checks.json).
- Scan sem achados/bloqueios; contagem e hashes no manifesto final. Não equivale a auditoria de infraestrutura/dependências completa.
- Primeiras rodadas detectaram erros de tipagem do refactor e expectativas antigas de inventário/deployment; corrigidos e reexecutados. Não houve supressão de ACL, RLS ou controles de publicação.
- CI remoto e runtime novo: **NOT_TESTED**, sem push/deploy. Fonte remota consultada: core32, Meta3, billing3, preservadas.

## Segurança e riscos residuais

Uma mensagem aceita pela Meta pode não ser entregue; timeout pode deixar resultado desconhecido. Não reenviar cegamente, não liberar custo sem preço e não desconectar enquanto houver pendência. Health confirma somente conta/número e não prova webhook ou entrega. A expiração da indicação é explícita; não é monitoramento contínuo.

A desconexão deixa o segredo cifrado no Vault, inacessível à RPC de leitura enquanto revoked; não é revogação da credencial na Meta. Isso é intencional e precisa ser concluído pelo proprietário caso o acesso externo também deva terminar.

Não houve teste físico de dispositivo, OAuth Meta real, HMAC válido do fornecedor, mídia, template, carga ou E2E A/B autenticado. Não apresentar esses itens como aprovados. Google OAuth, billing, cinco planos, Cost Governor e políticas de permissão foram preservados.

## Intervenções humanas mínimas

[Roteiro exato de configuração e homologação](WHATSAPP_META_OWNER_SETUP_2026-10-26.md): identificar aplicativo/WABA/número e destinatário autorizados; cadastrar secrets no painel seguro; validar callback e OAuth no Preview staging aprovado; aprovar custos/limites sem inventar valores; autorizar a rodada com mensagem real. Não enviar credenciais em conversa.

Preservação do checkout original: **106/106**, seis modificados e 100 não rastreados intactos. Launch permaneceu clean no HEAD 1c2bf89 e PR #2 local em 78497da5bfd52166c6852aa14c06ebbf84fa1248.

## Arquivos da implementação (commit 4e27870)

- .github/workflows/validate-migrations-postgres17.yml
- backend/core-mutation-client.ts
- backend/operational-routes.ts
- scripts/tests/deploy-staging.test.mjs
- src/App.tsx
- src/product/screens/inbox-workspace.tsx
- src/product/screens/integrations-page.tsx
- src/product/screens/whatsapp-connection-panel.tsx
- src/product/screens/wia-workspace.tsx
- src/product/ui/conversation-assistance.tsx
- src/product/whatsapp-connection-state.ts
- src/product/whatsapp-reply-draft.ts
- supabase/functions/orkto-core-mutations/_shared/meta-connection.ts
- supabase/functions/orkto-core-mutations/_shared/meta-send.ts
- supabase/functions/orkto-core-mutations/_shared/meta-status.ts
- supabase/functions/orkto-core-mutations/_shared/whatsapp-reply.ts
- supabase/functions/orkto-core-mutations/_shared/wia-t0.ts
- supabase/functions/orkto-core-mutations/_shared/wia-trusted.ts
- supabase/functions/orkto-core-mutations/index.ts
- supabase/functions/orkto-meta-webhook/event-boundary.ts
- supabase/functions/orkto-meta-webhook/index.ts
- supabase/migrations/20261026164542_meta_disconnect_guard.sql
- supabase/tests/assert_meta_disconnect.sql
- supabase/tests/assert_readiness.sql
- supabase/tests/assert_whatsapp_reply_approval.sql
- tests/core-http-tenant-integration.test.ts
- tests/meta-connection.test.ts
- tests/meta-send.test.ts
- tests/meta-status.test.ts
- tests/meta-webhook-handler.test.ts
- tests/visual/fixtures.ts
- tests/visual/harness.tsx
- tests/whatsapp-connection-ui.test.ts
- tests/whatsapp-reply.test.ts
- vercel.json
