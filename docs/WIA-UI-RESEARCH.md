# Pesquisa de UI para a WIA

## Decisao

A WIA e uma camada operacional distribuida pelos fluxos da ORKTO, e nao um chatbot isolado. Os padroes de UI pesquisados serao usados dentro de Conversas, Dashboard, Orcamentos, Clientes e Acoes. O desenho combina:

- historico pesquisavel dentro do fluxo de Conversas;
- area central para mensagens e respostas;
- estado vazio com sugestoes de inicio;
- compositor expansivel dentro da conversa e nos pontos em que uma instrucao livre realmente agrega valor;
- texto, voz e imagens;
- modos de trabalho e nivel de esforco;
- estados de espera, sucesso e erro;
- recomendacoes contextuais com motivo, evidencia, nivel de confianca e controle humano;
- provider abstraction: nenhum provedor fica acoplado a interface.

## Referencias avaliadas

- [Vercel AI Elements — Conversation](https://elements.ai-sdk.dev/components/conversation): auto-scroll, estado vazio, botao de retorno ao fim e exportacao.
- [Vercel AI Elements — Chatbot](https://elements.ai-sdk.dev/examples/chatbot): prompt composto, anexos, voz, seletor e mensagens multimodais.
- [Vercel AI Elements — Message](https://elements.ai-sdk.dev/components/message): respostas em Markdown, acoes e ramificacoes.
- [assistant-ui](https://www.assistant-ui.com/docs): historico, anexos, voz, persistencia e runtime desacoplado do provedor.
- [TanStack AI — React UI](https://tanstack.com/ai/latest/docs/ui/react): componentes visiveis controlados pela aplicacao e backend substituivel.

## Componentes recomendados para a integracao DeepSeek

1. `Conversation` para scroll e lista de mensagens.
2. `MessageResponse` para Markdown seguro e streaming.
3. `PromptInput` para texto, anexos e envio.
4. `SpeechInput` para voz.
5. `Sources` somente quando a WIA usar pesquisa ou documentos.
6. `Tool` e `Confirmation` somente quando a WIA ganhar acoes, sempre com aprovacao humana.

Nao instalar a biblioteca inteira. Adicionar apenas os componentes usados quando o endpoint DeepSeek for implementado.
