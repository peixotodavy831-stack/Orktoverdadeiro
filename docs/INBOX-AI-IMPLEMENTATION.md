# Inbox assistida da ORKTO — estado da implementação

## Implementado localmente

- Inbox e detalhe de conversa em React.
- API autenticada de conversas, mensagens e tarefas de aprovação.
- HermesAdapter mockado como contrato único no backend.
- Policy Engine mockado para homologação.
- Sandbox de webhook separado do endpoint real.
- Health checks de ORKTO, Swarm e HermesAdapter.
- Migração canônica com RLS por usuário para conversas, mensagens, aprovações e auditoria.
- Build, typecheck, teste do adaptador e smoke test multiplataforma.

## Modos de operação

- `mock`: padrão de desenvolvimento e homologação; não envia mensagens externas.
- `remote`: reservado à integração real. Requer `HERMES_ADAPTER_MODE=remote` e `HERMES_API_URL`; ainda não está habilitado para produção.

O endpoint real de WhatsApp permanece fechado sem `WHATSAPP_WEBHOOK_SECRET`. A simulação usa exclusivamente `/api/orkto/whatsapp/webhook-sim`.

## Não implementado ou não liberado

- Envio e recebimento reais pelo WhatsApp/Evolution API.
- Chamada remota ao Hermes Agent em produção.
- Aplicação da migração no projeto Supabase remoto.
- Teste E2E com autenticação e banco reais.
- Deploy das mudanças deste workspace.

## Verificação local

```powershell
npm.cmd run lint
npm.cmd run test:adapter
npm.cmd run test:smoke
```

## Gates antes da produção

1. Aplicar a migração em ambiente de homologação e executar teste de isolamento entre dois usuários.
2. Configurar Hermes remoto e validar contrato, timeout, retry, custo e cancelamento.
3. Configurar assinatura do webhook e idempotência usando `external_event_id`.
4. Validar aprovação, rejeição e auditoria com sessão Supabase real.
5. Revisar segurança e publicar somente após aprovação humana.
