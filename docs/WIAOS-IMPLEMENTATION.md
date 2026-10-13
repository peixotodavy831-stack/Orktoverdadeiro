# WiaOS - primeira entrega segura

## Delta em staging — 13/10/2026

A Edge Function `orkto-core-mutations` v22, somente em Supabase staging, já rejeita os comandos públicos `START_WIA_RUN` e `COMPLETE_WIA_RUN`. O novo `PREPARE_WIA_T0` deriva a rota, consulta dados do workspace validado e grava sua própria decisão, tool call e audit; o backend correspondente está no checkout local e ainda precisa de Preview atualizado. Modelo pago permanece desabilitado nessa rota. Testes locais passaram, mas a execução autenticada no deployment novo ainda está pendente; portanto a proveniência não é declarada PASS de release. O texto de 12/10 abaixo descreve o estado anterior à v22.

## Estado vigente em 12/10/2026

Este cabeçalho prevalece sobre instruções históricas abaixo que mencionam provider em Preview, fallback simulado ou migrations antigas. O runtime Preview staging usa URL/publishable key Supabase, Auth e RLS; não há nome de service-role ou chave paga entre as dez variáveis Preview observadas no painel. O backend roteia consultas T0 determinísticas com contexto de tenant (`backend/wiaos/wia-service.ts`, `t0-tools.ts`) e usa o Core Mutation Gateway para iniciar/completar runs e decisões internas. Ausência de provider configurado retorna `CONFIGURATION_REQUIRED`; não autoriza fallback pago ou mock em staging/produção.

**Proveniência ainda BLOCKED:** `COMPLETE_WIA_RUN` aceita decisão, uso de modelo e execução de tool enviados pelo mesmo JWT de usuário que inicia o run. A Edge valida identidade, membership e payload, mas não atesta a origem server-side desses fatos; o SQL grava atribuição de bot. A aprovação de ação interna é separada e exige papel mais alto, e nenhuma entrega externa/pagamento foi demonstrado nesse caminho. Até substituir a conclusão por computação/atestado confiável no servidor e repetir testes no Preview do SHA atual, não chamar a trilha de execução/auditoria WIA verificada nem declarar Production Candidate.

Esta entrega substitui o chat local simulado da WIA por um fluxo autenticado no servidor.

## Fluxo entregue

1. A interface envia a solicitacao para `POST /api/wia/decide` com a sessao Supabase.
2. O servidor resolve o usuario e carrega apenas um resumo de propostas pertencentes a ele.
3. O `ModelProvider` usa Gemini como padrão em produção e desenvolvimento quando `GEMINI_API_KEY` existe. `WIA_MODEL_PROVIDER=auto` também significa Gemini. DeepSeek e OpenRouter só são selecionados com opt-in explícito; a presença de suas chaves não altera a rota. Sem a chave Gemini, a chamada falha com erro de configuração, sem fallback automático pago ou resposta simulada.
4. Guardrails do servidor filtram fontes, impedem preco sem fonte e interceptam opt-out e pedido de humano.
5. A decisao volta como proposta. Nenhuma mensagem, desconto, cobranca ou compromisso e executado por esta rota.
6. Auditoria e uso de tokens sao registrados sem armazenar o texto da conversa no evento.

## Configurar Gemini para testar

1. Crie uma chave no Google AI Studio.
2. No projeto ORKTO da Vercel, abra **Settings → Environment Variables**.
3. Adicione `GEMINI_API_KEY` com a chave (marque Production e, se quiser testar em previews, Preview também).
4. Deixe `WIA_MODEL_PROVIDER` ausente ou como `auto` (ou defina `gemini`) e, opcionalmente, `GEMINI_MODEL` como `gemini-3.8-flash`.
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
