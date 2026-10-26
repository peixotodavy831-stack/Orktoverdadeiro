# WhatsApp E2E — auditoria inicial, 26/10/2026

Branch isolada `codex/orkto-whatsapp-e2e`, base `1c2bf8972fd63c6f530f5940a7e56a5e81db5a4b`. PR #2 e demais checkouts preservados. Auditoria executada antes de alterar implementação.

## Mapa da implementação

| Parte | Local | Classificação inicial |
|---|---|---|
| Embedded Signup e binding WABA/telefone | `meta-connection.ts`, gateway Edge e integrations-page | PARCIAL: verificação no provedor implementada, sem conexão real no staging. |
| Tokens no servidor | Vault, RPC restrita `orkto_read_meta_token` | PARCIAL: contrato implementado; não há token/conta conectada para provar operação. |
| Webhook oficial | `supabase/functions/orkto-meta-webhook` | PARCIAL: HMAC, limite de bytes, claim e persistência; faltam provas externas e há ACK indevido em decisões não confirmadas. |
| Texto recebido e conversa | `orkto_ingest_meta_text_message`, migration 51 local | PARCIAL: implementado; correção de associação única testada localmente, sem implantação nesta missão. |
| Mídia | webhook ignora mensagens não textuais | NÃO IMPLEMENTADA para baixar/exibir/transcrever mídia; não confundir com texto operacional. |
| Envio oficial | `meta-send.ts`, SEND_WHATSAPP_MESSAGE e ledger | PARCIAL: reserva, limites, tarifa, janela de 24h e persistência de aceite; sem envio externo comprovado. |
| Status | webhook → ledger de entrega | PARCIAL: faltava comparar destinatário do recibo com a conversa do send request. |
| WIA contextual | assistance determinística no Inbox; WIA request/WIAOS | PARCIAL: persistência oficial não aciona preparação WIA; rota legada é separada. Sem autonomia de envio autorizada. |
| Interface | integrations-page | PARCIAL: confunde status salvo com conexão atual e não oferece recuperação completa. |
| Revogação/desconexão | nenhum endpoint específico | NÃO IMPLEMENTADA como fluxo completo de revogação no fornecedor. Não revogar credencial compartilhada de outras empresas. |

## Provas reais somente leitura

Supabase exato `ghrjongiodziasupakrk`: **zero conexões**, **zero eventos webhook persistidos**, **zero send requests Meta** na consulta agregada desta rodada. Logs unificados na janela disponível: fontes auth/edge/Postgres existentes; a busca por referência textual do webhook/core nos edge_logs não encontrou ocorrências. Essa busca não prova ausência histórica de tráfego nem sucesso/falha do handler.

Readback do webhook remoto: versão 3, verify_jwt=false e HMAC próprio. Não equivale a comprovação de assinatura recebida da Meta. Advisors atuais: 19 tabelas RLS sem políticas, cinco helpers SECURITY DEFINER autenticados e proteção contra senhas vazadas OFF; a revisão R4 de ACL permanece histórica e não é substituída por esta contagem.

Nenhum segredo foi lido, exportado ou exibido. Não foram criados usuários, permissões, tarifas ou mensagens reais. As variáveis esperadas foram localizadas no código, sem abrir arquivos .env.

## Defeitos comprovados na fonte e escopo de correção

- Webhook responde 200 para IN_PROGRESS e não interpreta a decisão do ingest, podendo confirmar um processamento ainda não concluído.
- Recibos não comparam recipient_id antes de atualizar o ledger da conversa.
- Send classifica token expirado retornado pela Meta como HTTP 400 genérico e aceita timestamp de entrada no futuro como janela aberta.
- Estado connected na UI vem apenas do registro salvo; é necessário distinguir verificação anterior de disponibilidade atual.
- O componente de assistência preservava o rascunho anterior em nova consulta e não invalidava o resultado pela sessão. O Inbox **já** usava key por conversa e passava accessToken também no drawer móvel; não registrar token ausente ou vazamento entre conversas do Inbox como defeito comprovado. Corrigir a atualização e a invalidação por sessão do componente.

## Limites de aceitação

OPERACIONAL permanece proibido até número/WABA aprovados, callback validado pela Meta, mensagem real recebida/persistida, envio ao destinatário de teste expressamente autorizado, aceite e recibo real, WIA/autorizações e isolamento comprovados. Não enviar mensagem para número escolhido pelo agente. Não habilitar IA paga, tarifa ou modo automático para produzir uma evidência.

Documentação Meta oficial consultada retornou 429 nesta rodada; não substituir as regras atuais por artigos de terceiros ou SDK arquivado. Usar contratos existentes e registrar a limitação de documentação até acesso ao fornecedor.
