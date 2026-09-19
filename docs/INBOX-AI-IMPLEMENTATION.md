# Inbox assistida da ORKTO — estado da implementação

## Implementado localmente

- Inbox e detalhe de conversa em React.
- Rotas mockadas de conversas, mensagens e tarefas de aprovação; autenticação e persistência real ainda não estão ligadas a essas rotas.
- HermesAdapter mockado como contrato único no backend.
- Policy Engine mockado para homologação.
- Sandbox de webhook separado do endpoint real.
- Health checks de ORKTO, Swarm e HermesAdapter.
- Migração local `20260918_orkto_conversations_and_messages.sql` com RLS por usuário para conversas, mensagens, aprovações e auditoria; ainda não aplicada remotamente.
- Compositor inteligente WIA nas duas experiencias de conversa, com texto expansivel, selecao de operador/bot, nivel de esforco, imagens locais e captura de voz no navegador.
- Build, typecheck, teste do adaptador e smoke test multiplataforma.

## WIA — papel e limites atuais

A WIA e a interface conversacional da ORKTO. Ela recebe a intencao do usuario e prepara o contexto para o Hermes e os bots; nao e um bot independente e nao contorna o Policy Engine.

Hoje, somente o texto e encaminhado ao endpoint simulado existente. Imagens ficam em pre-visualizacao local, a voz usa a transcricao disponivel no navegador e a escolha de bot/esforco ainda nao e persistida. Esses controles ja definem a UX, mas so poderao comandar o Hermes quando o `PromptEnvelope` e o armazenamento de anexos forem implementados no backend.

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
- Upload e envio de anexos, persistencia da transcricao e roteamento real por bot/esforco da WIA.
- Autenticação/autorização das rotas Express da Inbox e persistência das operações no Supabase.

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
