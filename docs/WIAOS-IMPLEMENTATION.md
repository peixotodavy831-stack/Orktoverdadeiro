# WiaOS - primeira entrega segura

Esta entrega substitui o chat local simulado da WIA por um fluxo autenticado no servidor.

## Fluxo entregue

1. A interface envia a solicitacao para `POST /api/wia/decide` com a sessao Supabase.
2. O servidor resolve o usuario e carrega apenas um resumo de propostas pertencentes a ele.
3. O `ModelProvider` usa DeepSeek quando `DEEPSEEK_API_KEY` existe ou um provider deterministico seguro quando nao existe.
4. Guardrails do servidor filtram fontes, impedem preco sem fonte e interceptam opt-out e pedido de humano.
5. A decisao volta como proposta. Nenhuma mensagem, desconto, cobranca ou compromisso e executado por esta rota.
6. Auditoria e uso de tokens sao registrados sem armazenar o texto da conversa no evento.

## Variaveis

- `DEEPSEEK_API_KEY`: segredo exclusivo do servidor.
- `DEEPSEEK_MODEL`: padrao `deepseek-flash`, configuravel sem mudar o codigo.

Nunca prefixar a chave com `VITE_`. Em producao, configurar a chave no painel da Vercel e fazer novo deploy.

## Banco

Aplicar `supabase/migrations/202609250001_wiaos_model_usage.sql` antes de exigir telemetria persistente. A rota continua segura caso a tabela ainda nao exista, mas o registro de uso nao sera persistido.

## Limites atuais

- Modo de autonomia: somente sugerir.
- Sem envio real ou ferramenta de escrita nesta rota.
- Sem Swarm ou selecao de bots.
- O provider faz fallback explicito para modo simulado quando a DeepSeek falha; a interface identifica esse modo.
