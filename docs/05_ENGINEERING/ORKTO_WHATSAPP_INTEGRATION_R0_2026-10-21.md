# WhatsApp R0 — contrato assistido e gates

Fonte local: `c5861c86da19784098767b02208a4d7662787d7f`. Ambiente de testes: local, dados sintéticos.
`READY_FOR_PRODUCTION_CANDIDATE=NO`. Nenhuma publicação Edge, migration ou alteração cloud nesta rodada.

## Contrato novo efetivamente implementado

`GET /api/conversations/:conversationId/assistance`:

1. Autenticação existente, UUID e membership ativo. `workspaceContext(..., false)` proíbe provisionamento automático.
2. Usa cliente Supabase vinculado ao JWT da requisição quando disponível; todas as consultas incluem workspace.
3. Conversa fora do workspace retorna 404; workspace sem vínculo retorna 403; sem sessão 401; falha de persistência 503 sem imprimir dados privados.
4. Consulta até 501 clientes ativos, 20 mensagens recebidas (somente ID/direção/data) e 10 negócios abertos diretamente vinculados à conversa. Não consulta texto privado, propostas ou tarefas para este primeiro incremento.
5. Telefone normalizado apenas removendo formatação. Não adivinha país, nono dígito ou correspondência parcial. Catálogo no limite resulta incomplete; duplicidade resulta ambiguous; desconhecido resulta unmatched. Nenhum desses estados cria/vincula cliente.
6. Produz identificação revisável, próximo passo genérico, fontes e rascunho de esclarecimento. O texto da mensagem não é analisado e não controla instruções, preço, permissões ou IDs.
7. Sem writes, RPC de mutação, envio, LLM, consumo de Pulso ou provisão de usuários. Cache private/no-store.

O rascunho é local e não salvo. Não é uma análise Gemini, não cria negócio/proposta/tarefa e não preenche o compositor externo. Fontes são proveniência para revisão, não registro durável de auditoria de uma ação executada. Essa etapa futura deve usar aprovação e Mutation Gateway, sem autoaprovação.

Desempenho: duas leituras de membership/workspace, uma conversa e três consultas limitadas em paralelo. Não carrega histórico completo nem texto das mensagens. O teste de catálogo com 501 clientes comprova estado incompleto conservador, não escalabilidade do banco. EXPLAIN, latência p95, índices efetivamente aplicados e RLS com dados reais permanecem NOT_TESTED; normalização de telefone em coluna indexada requer desenho/migration futuros antes de remover o limite.

## Infraestrutura oficial reutilizada, não recriada

| Componente existente | Evidência estática local |
| --- | --- |
| HMAC sobre bytes reais + limite 1 MiB | `supabase/functions/orkto-meta-webhook/index.ts`, `event-boundary.ts` |
| Binding número/WABA/workspace, claim durável, fingerprint | migration `20261016030000_meta_whatsapp_connections.sql`, funções claim/ingest |
| Vault e RPCs restritos a service_role, RLS | Mesma migration, grants e políticas |
| Embedded Signup e troca server-side | `_shared/meta-connection.ts`, `integrations-page.tsx` |
| Envio com janela, preço revisado, reserva e idempotência | core mutations e `_shared/meta-send.ts` |
| Aceite diferente de entrega; timeout desconhecido | delivery ledger e testes existentes |

Nenhum QR, biblioteca de WhatsApp Web, extração de sessão ou integração não oficial foi adicionado.

## Gaps reais encontrados — não resolvidos por esta UI

| Estado | Achado | Evidência / ação necessária |
| --- | --- | --- |
| FAIL (auditoria estática) | Ingest oficial escolhe cliente mais antigo por telefone, sem exigir unicidade | Migration citada, SELECT clients LIMIT 1 (~369). Corrigir em nova migration e replay PostgreSQL antes de homologar binding comercial. Novo GET ignora esse vínculo e calcula unicidade conservadoramente. |
| FAIL (auditoria estática) | Conexão valida telefone e assina WABA separadamente, sem comprovar relação telefone→WABA | `_shared/meta-connection.ts` (~56–67). Exigir prova oficial da relação antes de marcar conexão verificada. |
| FAIL (auditoria estática) | Webhook de recibos não interpreta todas as decisões retornadas pelo ledger | Edge webhook (~100–106). Tratar conflitos de referência/evento antes de finalizar processamento. |
| NOT_TESTED remoto | Modos assisted/controlled não executam todo fluxo comercial | Webhook oficial persiste, não chama WIA. Caminho legado difere; não encaminhar evento oficial ao legado para contornar controles. |
| BLOCKED_EXTERNAL | Coexistência elegível/configuração real da conta | Estado recebido do frontend não comprova elegibilidade do fornecedor. |

Não foi demonstrado vazamento entre empresas no ambiente real. Os achados acima não devem ser descritos como exploração remota comprovada.

## Meta e custos — documentação oficial consultada em 2026-10-21

[Preço oficial](https://whatsappbusiness.com/products/platform-pricing/): cobrança depende de entrega, mercado e categoria. A página descreve serviço na janela de 24h sem tarifa Meta; isso não torna toda operação gratuita. Tarifas, BSP/infraestrutura e condições aplicáveis à conta ainda precisam de verificação antes de envio. Nenhum valor de tarifa foi inventado ou ativado.

[Embedded Signup oficial Meta no Postman](https://www.postman.com/meta/whatsapp-business-platform/documentation/du6gzjv/embedded-signup): configurar aplicativo, Facebook Login/SDK, permissões e revisão aplicáveis; conferir WABA/número e inscrição do app. A coleção contém também fluxos de parceiros/crédito, que não foram ativados e não são autorização para assumir cobranças. Páginas developers específicas retornaram erro/limitação de acesso; documentação de coexistência permanece pendente de verificação na conta.

### Intervenção externa mínima futura

1. Identificar Business/App/WABA/número de teste já autorizados e confirmar elegibilidade de Embedded Signup/coexistência, papéis e App Review.
2. Operador cadastra segredos somente no secret store Edge; nunca no chat, repositório, browser storage exportado ou relatório. Configurar verify token e app secret pelos canais seguros existentes.
3. Revisar/corrigir os três gaps de engenharia acima com testes e replay SQL; confirmar callback HTTPS e vínculo oficial número/WABA.
4. Autorizar rodada controlada com participantes/números e orçamento explícitos antes de enviar mensagem ou chamar inferência paga. Até lá, usar fixtures locais.

## Matriz dos 12 cenários solicitados

| Caso | Resultado local | Evidência | Resultado remoto |
| --- | --- | --- | --- |
| Evento sintético válido autorizado | PASS | meta-webhook.test.ts + meta-edge-boundary.test.ts | NOT_TESTED |
| Assinatura inválida | PASS | Mesmos testes de bytes/HMAC | NOT_TESTED |
| Evento duplicado | PASS (adapter/boundary) | meta-webhook.test.ts; dedup persistente apenas auditado em SQL | NOT_TESTED |
| Workspace correto | PASS | assistance HTTP em radar.test.ts, contexto request-bound | NOT_TESTED |
| Acesso cruzado | PASS (fixtures HTTP) | A→B/B→A 404; workspace estrangeiro 403 | NOT_TESTED |
| Cliente existente | PASS | normalização e resultado único; ambiguidade não escolhe cliente | NOT_TESTED |
| Cliente desconhecido | PASS | unmatched/incomplete; sem inserts | NOT_TESTED |
| Rascunho sem envio | PASS | engine + navegador; compositor externo vazio | NOT_TESTED |
| Ausência de chamada paga | PASS no novo caminho | somente SELECT; engine pura e teste de operações | NOT_TESTED para conta Meta/Gemini |
| Erros de integração | PASS local | 503 sanitizado + estado visual de erro | NOT_TESTED falhas reais de fornecedor |
| Mobile/tablet/desktop | PASS no recorte | capturas e jornada no relatório UX | NOT_TESTED staging |
| Ausência de vazamento privado | PASS nos testes | IDs/fontes mínimos; notas e texto bruto ausentes; cross-tenant negativo | NOT_TESTED remoto |

PASS local não é PASS de RLS real, webhook durável remoto, OAuth A/B ou homologação de fornecedor. CI PostgreSQL novo não foi executado nesta rodada; não há alteração SQL.
