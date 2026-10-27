# ORKTO — configuração e prova real do WhatsApp

Atualizado em **27/10/2026**. Somente staging `ghrjongiodziasupakrk`. **READY_FOR_PRODUCTION_CANDIDATE=NO**.

## Estado comprovado

- Implementação local na branch `codex/orkto-whatsapp-e2e`, sobre `07d2f00`; não foi publicada. A fonte de lançamento continua preservada em `feat/orkto-launch-2027` e a PR #2 não foi alterada.
- Consulta agregada somente leitura em 27/10: **0 conexões Meta, 0 eventos de webhook, 0 envios Meta, 0 tarifas aprovadas**. Isso não prova configuração nem operação positiva.
- A inspeção de nomes do secret store de **26/10** não encontrou variáveis `META_*`. Os valores nunca foram abertos. A existência de secrets não foi reinspecionada em 27/10; não presumir que o proprietário já os cadastrou.
- As rejeições HTTPS 403 de verify token inválido e 401 de POST sem assinatura são evidências de 26/10, preservadas. Não comprovam handshake válido, entrada, envio ou entrega.
- Migrations locais 51, 52 e 53 e novo código de funções ainda não foram implantados. Não testar a UI local esperando que o runtime remoto já contenha essas mudanças.

## Ativos que precisam ser identificados pelo proprietário

Escolher no [painel oficial Meta](https://developers.facebook.com/apps/) o **aplicativo existente**, Business Portfolio, WABA e número de teste Cloud API autorizados. Não criar ativos, aceitar termos ou reivindicar números de clientes por inferência.

Informar apenas identificadores não secretos: App ID, Embedded Signup Config ID, WABA ID, Phone Number ID, workspace autorizado e destinatário de teste consentido. Segredos ficam exclusivamente nos formulários seguros do fornecedor/Supabase. Nunca colar token, PIN, Client Secret ou OAuth code em chat, logs, screenshots ou código.

O registro/elegibilidade do número, eventuais verificações empresariais e Coexistence precisam ser confirmados no fornecedor. O código valida vínculo WABA/número; isso isoladamente não certifica registro, aprovação de aplicativo, Coexistence ou capacidade de envio. Coexistence não foi homologado.

## Configuração segura do staging

No [secret store Edge do staging](https://supabase.com/dashboard/project/ghrjongiodziasupakrk/functions/secrets), cadastrar os nomes exigidos sem alterar os secrets de billing:

| Variável | Uso |
|---|---|
| `META_APP_ID` | Aplicativo aprovado |
| `META_APP_SECRET` | HMAC e troca OAuth somente no servidor |
| `META_EMBEDDED_SIGNUP_CONFIG_ID` | Configuração oficial Embedded Signup / Login for Business |
| `META_GRAPH_API_VERSION` | Versão suportada e aprovada para o aplicativo; não presumir uma versão global |
| `META_EMBEDDED_SIGNUP_REDIRECT_URI` | URI HTTPS exata quando exigida pela configuração OAuth |
| `META_WEBHOOK_VERIFY_TOKEN` | Mesmo segredo escolhido no handshake do callback |

O código de conexão exige `whatsapp_business_management` e `whatsapp_business_messaging`; verificar concessão e nível de acesso efetivos no aplicativo e no fluxo oficial. Não conceder permissões adicionais desnecessárias. O token obtido pelo OAuth é trocado no servidor e armazenado cifrado no Vault; não há campo cliente para um token permanente.

No servidor Node do **Preview staging aprovado**, verificar a flag `ORKTO_EXTERNAL_MESSAGING_ENABLED` somente depois da autorização da rodada de teste e dos controles de custo. Não habilitar globalmente ou em produção. Não usar variáveis `VITE_*` para secrets Meta.

## Callback, inscrição e conexão

Callback exato:

`https://ghrjongiodziasupakrk.supabase.co/functions/v1/orkto-meta-webhook`

1. Configurar o callback no aplicativo Meta com o verify token guardado no staging; concluir o challenge real no fornecedor. Manter `X-Hub-Signature-256` sobre os bytes originais do POST.
2. Confirmar inscrição do aplicativo na WABA para `messages`, incluindo notificações de status. O fluxo existente usa `POST /{waba-id}/subscribed_apps`; conferir a inscrição existente com **GET** no fornecedor, sem imprimir o token.
3. Antes de publicar, revisar o diff, confirmar o projeto Vercel staging, URL exata e compatibilidade das migrations/funções com a homologação atual. Não fazer push automático, merge ou deploy de produção. Não substituir o core compartilhado sem validar o plano de rollout.
4. Após publicação autorizada do SHA e funções corretos, no workspace aprovado, como owner/admin: **Conectar → aguardar preparação → Continuar na Meta → concluir autenticação → Verificar conexão**.
5. Confirmar WABA/número/workspace e ausência de vínculo com outra empresa. A verificação de conexão não prova webhook ou entrega.

A [coleção oficial Meta no Postman](https://www.postman.com/meta/whatsapp-business-platform/folder/o48mro7/messages), consultada em 27/10, confirma o endpoint `/{Phone-Number-ID}/messages`, identificação de mensagens por ID, recibos por webhook e permissão `whatsapp_business_messaging`. As páginas atuais de Embedded Signup e referências diretas em developers.facebook.com permaneceram indisponíveis/429. Rótulos, elegibilidade, regras e tarifas atuais devem ser confirmados no painel/documentação oficial antes de ativação; SDK arquivado e guias de terceiros não foram usados como política vigente.

## Condições antes de um envio real

- Aprovação explícita de **número empresarial de teste, destinatário de teste e conteúdo** da rodada. Nenhum contato real escolhido automaticamente.
- Confirmar consentimento, restrições do número e atendimento dentro da janela permitida. Fora dela, o envio de texto livre fica bloqueado; **envio de templates ainda não está implementado nesta versão**.
- Aprovar tarifa aplicável, mercado, categoria, moeda e limites reais de custo. Não inserir tarifa fictícia nem desabilitar o Cost Governor porque o teste usa número de teste.
- Nenhuma inferência paga é necessária para o rascunho determinístico de esclarecimento. Gemini e automação externa permanecem separados e desativados sem aprovação.

## Rodada controlada e evidência sanitizada

| Etapa | Procedimento e aceitação |
|---|---|
| Receber | Destinatário aprovado envia frase sem dado sensível; webhook com HMAC válido deve persistir exatamente uma mensagem na empresa autorizada |
| Isolar | A mensagem não aparece em B; replay mantém uma persistência, sem nova conversa indevida |
| Exibir | Conversas mostra texto, data e papel corretos; atualização da conversa em até um ciclo de polling de 15s, fila em até30s quando a página está visível; botão manual permanece disponível |
| Conteúdo não suportado | Imagem/áudio/documento gera aviso explícito; nenhum download, interpretação ou transcrição é alegado. Notificação desconhecida é interna e não abre janela de atendimento |
| Preparar | Contexto → Preparar resposta na WIA → revisar pedido; fontes ficam ligadas à conversa/mensagem. Conteúdo do cliente não ganha autoridade administrativa |
| Aprovar | Decisão por papel permitido, persistida e auditada; replay gera uma tarefa interna. Não é envio externo |
| Enviar | Ação humana separada em Conversas, conteúdo revisado e destinatário autorizado. Graph `POST /{phone-number-id}/messages` com idempotência local e tentativa persistida |
| Confirmar | Aceite da API não vira entrega. `sent`, `delivered`, `read` são correlacionados ao ID/destinatário e persistidos; leitura local não produz recibo externo |
| Conciliar | Timeout/resultado desconhecido não autoriza reenvio cego. Recibo que chega antes de salvar o aceite pede retry e permanece rastreável |
| Recuperar | Token inválido exige reconexão; desconectar só sem envio pendente. A pausa/revogação ORKTO não revoga globalmente a concessão Meta compartilhada |

Guardar somente ambiente, SHA/runtime das funções, data, resultado HTTP, decision e referências internas mascaradas. Não capturar corpos de cliente, tokens ou sessão. Confirmar que preparação/aprovação não gerou `orkto_channel_send_requests`, envio externo ou consumo Pulso.

## Bloqueios restantes

**BLOCKED_EXTERNAL:** ativos Meta e vínculo autorizado, configuração segura, handshake/inscrição, tarifa/limites e autorização da rodada real. **NOT_TESTED:** entrada/recibo positivos do fornecedor, envio real, reconexão real, dispositivo Android/iPhone físico, teclado virtual e E2E A/B autenticado da nova versão. **AUSENTE:** download/render de mídia, transcrição, envio por templates e despacho externo autônomo; não anunciar essas funcionalidades como concluídas.

Procedimento anterior e evidência histórica: [configuração de26/10](WHATSAPP_META_OWNER_SETUP_2026-10-26.md), [relatório de26/10](WHATSAPP_E2E_RESULT_2026-10-26.md). Nenhum desses relatórios substitui esta rodada no novo SHA.
