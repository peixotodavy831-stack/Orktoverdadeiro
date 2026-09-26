# WiaOS - primeira entrega segura

Esta entrega substitui o chat local simulado da WIA por um fluxo autenticado no servidor.

## Fluxo entregue

1. A interface envia a solicitacao para `POST /api/wia/decide` com a sessao Supabase.
2. O servidor resolve o usuario e carrega apenas um resumo de propostas pertencentes a ele.
3. O `ModelProvider` usa Gemini quando selecionado e `GEMINI_API_KEY` existe; com `WIA_MODEL_PROVIDER=auto` (padrao), Gemini tem prioridade para testes, depois DeepSeek. Sem chave configurada, usa um provider deterministico seguro.
4. Guardrails do servidor filtram fontes, impedem preco sem fonte e interceptam opt-out e pedido de humano.
5. A decisao volta como proposta. Nenhuma mensagem, desconto, cobranca ou compromisso e executado por esta rota.
6. Auditoria e uso de tokens sao registrados sem armazenar o texto da conversa no evento.

## Configurar Gemini para testar

1. Crie uma chave no Google AI Studio.
2. No projeto ORKTO da Vercel, abra **Settings → Environment Variables**.
3. Adicione `GEMINI_API_KEY` com a chave (marque Production e, se quiser testar em previews, Preview também).
4. Deixe `WIA_MODEL_PROVIDER` como `auto` (ou defina `gemini`) e, opcionalmente, `GEMINI_MODEL` como `gemini-3.8-flash`.
5. Salve e faça um novo deploy. A interface da WIA já está preparada para usar a API no servidor.

As variáveis são exclusivamente server-side. Nunca use prefixo `VITE_`, exponha a chave no navegador, registre-a em logs ou a versione no Git. A requisição ao Gemini envia a chave no cabeçalho `x-goog-api-key`, não na URL.

## Trocar para DeepSeek depois

- `DEEPSEEK_API_KEY`: segredo exclusivo do servidor.
- `DEEPSEEK_MODEL`: modelo DeepSeek configurável sem mudar o código.
- Quando estiver pronto para mudar, defina `WIA_MODEL_PROVIDER=deepseek`, adicione a chave DeepSeek e faça novo deploy. `GEMINI_API_KEY` pode permanecer configurada; a seleção explícita impede ambiguidade.

Sem nenhuma chave, a WIA continua funcionando em modo simulado. Se o provedor ativo falhar, a resposta segura de contingência é usada e a interface informa o modo simulado. Nenhuma mensagem comercial é enviada por esta rota.

Nunca prefixar a chave com `VITE_`. Em producao, configurar a chave no painel da Vercel e fazer novo deploy.

## Banco

Aplicar `supabase/migrations/202609250001_wiaos_model_usage.sql` antes de exigir telemetria persistente. A rota continua segura caso a tabela ainda nao exista, mas o registro de uso nao sera persistido.

## Limites atuais

- Modo de autonomia: somente sugerir.
- Sem envio real ou ferramenta de escrita nesta rota.
- Sem Swarm ou selecao de bots.
- O provider faz fallback explícito para modo simulado quando o provedor ativo falha; a interface identifica esse modo.
