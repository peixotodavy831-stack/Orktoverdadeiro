# WhatsApp Meta — configuração externa e rodada real controlada

Projeto autorizado: **Supabase staging `ghrjongiodziasupakrk`**. Não usar produção. Não enviar secrets, códigos OAuth ou tokens por chat, arquivo de evidência ou log.

## 1. Escolher os ativos autorizados

No [painel de aplicativos Meta](https://developers.facebook.com/apps/), o proprietário precisa identificar o aplicativo existente da ORKTO e a WABA/número Cloud API que poderão ser usados. Se não houver aplicativo/conta aprovados, a criação, termos e verificações do fornecedor dependem do proprietário.

Informações não secretas necessárias: App ID, configuração de Embedded Signup, WABA ID e Phone Number ID. A autenticação deverá ocorrer diretamente na Meta. Não usar token temporário copiado no frontend como implementação de conexão.

O número precisa estar habilitado pelo fornecedor para Cloud API; verificar propriedade/registro e eventuais exigências de PIN no fluxo oficial. A verificação de vínculo implementada pela ORKTO, isoladamente, não certifica registro do número ou capacidade de envio.

## 2. Configurar o servidor staging

Abra [Edge Functions → Secrets do staging](https://supabase.com/dashboard/project/ghrjongiodziasupakrk/functions/secrets). A inspeção de 26/10 encontrou somente os nomes APP_ENV, ASAAS_ENVIRONMENT e as duas flags de sandbox billing; nenhum nome META estava cadastrado. Não modificar billing.

| Nome esperado | Origem/uso |
|---|---|
| `META_APP_ID` | ID do aplicativo escolhido. |
| `META_APP_SECRET` | Segredo do aplicativo, cadastrado diretamente no secret store. |
| `META_EMBEDDED_SIGNUP_CONFIG_ID` | ID da configuração oficial de Embedded Signup/Facebook Login for Business. |
| `META_GRAPH_API_VERSION` | Versão suportada aprovada para o aplicativo; confirmar na documentação/painel Meta. Não trocar globalmente por uma versão presumida. |
| `META_EMBEDDED_SIGNUP_REDIRECT_URI` | Quando exigido pela configuração OAuth, URI HTTPS exata e coerente com o fluxo e o Preview aprovado. Sem wildcard. |
| `META_WEBHOOK_VERIFY_TOKEN` | Valor escolhido no fluxo seguro, idêntico ao configurado na verificação do callback Meta. Não publicar. |

As credenciais de conta/número retornadas pelo OAuth são trocadas somente no servidor e guardadas no Vault pelo gateway existente. Não cadastrar tokens Meta em variáveis VITE nem em código cliente.

## 3. Validar o callback oficial

Na configuração WhatsApp/Webhooks do aplicativo Meta escolhido:

- Callback: `https://ghrjongiodziasupakrk.supabase.co/functions/v1/orkto-meta-webhook`.
- Executar a verificação com o mesmo verify token guardado acima. O resultado esperado é o challenge devolvido pelo endpoint e confirmação da Meta. O probe inválido 403 desta missão **não** substitui essa confirmação.
- Habilitar eventos `messages`, usados para mensagens e status. Concluir o vínculo/inscrição do aplicativo à WABA pelo fluxo oficial.
- Manter HMAC `X-Hub-Signature-256` sobre os bytes originais; não desativar a assinatura para fazer um teste passar.
- Registrar apenas data, identificadores mascarados e resultado. Nunca registrar corpo de cliente, cabeçalhos Authorization ou verify token.

As páginas de documentação Meta retornaram 429 durante a missão; os rótulos exatos e as exigências atuais devem ser confirmados no painel oficial. Não basear uma alteração de política comercial em SDK arquivado ou guia de terceiros.

## 4. Publicação e conexão

O código validado está na branch isolada `codex/orkto-whatsapp-e2e`, commit `4e2787037e4a6df256b3cfc7e3d9ca9d334de2c1`. Não foi implantado.

Antes de publicar um Preview isolado, revisar o diff contra o candidato vigente, confirmar projeto Vercel staging e configuração de callback exata. Não fazer push/merge que possa disparar produção. A branch tem Git deployment desabilitado.

Aplicar migrations e funções somente no escopo aprovado, incluindo a migration 51 já existente na base e a 52 de desconexão desta missão. A ordem importa. O staging consultado não possui a nova RPC. Não substituir silenciosamente o core compartilhado da homologação.

Na ORKTO autenticada como owner/admin do workspace aprovado: Conectar/Reconectar → aguardar preparação do SDK → **Continuar na Meta** → concluir autenticação/permissões → voltar e **Verificar conexão**. A consulta confirma vínculo de conta/número; não equivale a entrega comprovada.

## 5. Antes de permitir saída real

- O proprietário deve aprovar explicitamente o par número empresarial/destinatário de teste e o conteúdo da rodada. Não escolher um contato real arbitrário.
- Verificar consentimento e restrições do número de teste da Meta.
- Confirmar tarifa de serviço, mercado, moeda e limites de mensagem/custo no fluxo de governança comercial. A consulta real encontrou **zero tarifas de serviço aprovadas**; não criar uma tarifa fictícia, nem desativar bloqueio de custo sem preço.
- Verificar `ORKTO_EXTERNAL_MESSAGING_ENABLED` no servidor Vercel do ambiente de teste exato. Não habilitar em produção ou globalmente para outras empresas.
- Não habilitar inferência paga. O novo pedido determinístico funciona sem chave Gemini e sem consumir Pulso; continua sujeito às permissões e quotas existentes da WIA.

## 6. Roteiro de homologação e evidências exigidas

1. Destinatário aprovado envia uma frase não sensível ao número empresarial aprovado. Confirmar evento com assinatura válida, tenant resolvido e exatamente uma mensagem/conversa persistida no workspace correto.
2. Verificar que a mesma mensagem não aparece em B. Repetir evento pelo mecanismo autorizado do fornecedor: uma única persistência; não exportar sessões.
3. No Inbox, abrir contexto → Preparar resposta na WIA → revisar e enviar **o pedido à WIA**. Confirmar fontes conversation/message, provider none, aprovação persistida e nenhum envio externo nessa preparação.
4. Aprovar com papel permitido; confirmar somente uma tarefa interna e trilha de auditoria. Repetir a aprovação não pode criar outra tarefa. B e membro sem papel de decisão devem ser recusados.
5. Após revisão humana, solicitar o envio da resposta pelo Inbox ao destinatário autorizado, dentro da janela de atendimento. Guardar apenas resultado HTTP, request ID interno mascarado e confirmação de aceite Meta, sem texto pessoal.
6. Aguardar `sent`/`delivered` e registrar mudança real no ledger. **Aceite não significa entrega.** Recibo com destinatário diferente não pode atualizar a conversa.
7. Testar token revogado/expirado e falha/rate limit usando mecanismos autorizados do fornecedor; não revogar acessos compartilhados de outra empresa. Resultado incerto exige conciliação; não reenviar cegamente.
8. Desconectar somente quando não houver envio pendente/incerto. A desconexão implementada bloqueia uso pela ORKTO e ativa pausa humana; não revoga permissões globalmente na Meta. A revogação externa deve ser feita pelo proprietário no ativo exato, preservando integrações de outras empresas.

OPERACIONAL só poderá ser marcado após essas provas no SHA/versões realmente implantados. Mídias, templates e automação completa não estão implementados nesta fatia e devem permanecer indisponíveis na oferta.

**READY_FOR_PRODUCTION_CANDIDATE=NO**.
