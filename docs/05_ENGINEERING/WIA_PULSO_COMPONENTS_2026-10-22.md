# Componentes fornecidos — WIA e Pulso

Fonte: `6ed137aea1b8c3d1206618708f0389c726c277f9`, branch `feat/orkto-intelligence-whatsapp-2027`.
Somente integração local. Sem push, deploy, merge, alterações na PR #2 ou produção.
`READY_FOR_PRODUCTION_CANDIDATE=NO`.

## Mapeamento e estrutura

- Primeiro anexo (`755aff50-58e6-47d2-a240-7828859d15aa`): referência do input React com expansão, composição e botão circular. Integrado na tela WIA via `src/components/ui/wia-prompt-input.tsx`.
- Segundo anexo (`06570b1e-7fc8-45a7-a498-a5246482bc82`): referência do quota-banner. Integrado ao saldo de Pulso em Plano & cobrança via `src/components/ui/quota-banner.tsx`.
- O projeto já tem React, TypeScript, Tailwind 4, componentes em `src/components/ui` e `cn` em `src/lib/utils.ts`. Não foi necessário executar shadcn CLI, instalar Tailwind/TypeScript ou mudar aliases.
- Usados botões/meter nativos e lucide-react já instalado. Nenhuma dependência extra `cn`, Base UI ou Solar foi adicionada; nenhum asset remoto ou imagem de estoque é necessário para estes componentes.

## Adaptação da WIA ao contrato real

O arquivo `src/components/ui/ai-chat-input.tsx` já existia e é usado por InboxPage e WiaContactPage. Ele foi preservado, sem diferença em relação ao HEAD anterior. A adaptação nova é aditiva, evitando alterar seus tipos e consumidores.

Mantidos: expansão de largura/altura, texto controlado, botão circular, teclado Enter/Shift+Enter, loading/disabled, limite de 4.000 caracteres e visual laranja/carvão. Envio usa o POST existente `/api/wia/route-agent`; o componente não chama provedores diretamente. O campo só limpa após sucesso do pai; erro preserva a mensagem.

O anexo inclui modelos/níveis de esforço ilustrativos, imagens remotas, anexos e uma transcrição de voz simulada quando o microfone não funciona. Essas funções não foram conectadas ao backend atual, que recebe texto e define o modelo no servidor. Não há seletor prometendo modelos inexistentes, transcrição falsa, anexos descartados silenciosamente ou solicitação automática de microfone. Voz, arquivos e seleção de modelo exigem uma integração funcional própria antes de serem apresentados como disponíveis.

## Pulso sem política inventada

`/api/billing/current` já fornece `pulso.state`, `allowance`, `used` e `remaining`. O `used` atual inclui utilização/reservas não liberadas. O banner usa esses dados, com número pt-BR e até três casas decimais.

- Estado desconhecido: sem medidor e sem falso saldo zero; informa que a franquia ainda não foi aprovada.
- Franquia zero configurada: mostra zero, sem criar meter com max=0 inválido.
- Dados negativos/não finitos/inconsistentes: saldo não confirmado, sem apresentar consumo como válido.
- Uso acima da franquia: percentual visual limitado a 100%, mantendo o valor utilizado verdadeiro.
- O contrato atual não retorna a renovação específica de Pulso. Exibido “Renovação não informada”; o fim da assinatura não foi usado como se fosse renovação da quota.
- “Ver planos” apenas rola até o catálogo existente. Não inicia checkout, assinatura, compra de Pulso ou chamada de IA. Os cinco planos e seus preços permanecem inalterados.

## Validação local

Logs e resultados vinculados ao SHA em `evidence/wia-pulso-components/validation.json` e arquivos `*-output.txt`.
Incluídos testes puros de limite desconhecido, zero, consumo, limiares 80/95/96%, excesso, números inválidos e arredondamento decimal.

Browser com fixtures, sem conta ou provedor real:

- WIA: digitação expande, Shift+Enter quebra linha, Enter consulta, loading desabilita, sucesso limpa, falha mantém o pedido.
- Pulso: demo 742/1000 (somente cenário `quota-demo`, explicitamente fictício), meter 742/1000, 74,2%, 258 restantes; `quota-zero` sem meter; estado normal do harness sem franquia, sem números inventados.
- “Ver planos” navega localmente; nenhum pagamento criado.
- Recortes 390×844 dark, 730×728 light/dark e 1440×900 dark; sem overflow horizontal observado. Viewport restaurado.

Estas verificações não são homologação de Gemini, billing real, Google A/B ou RLS remoto. Gates externos anteriores permanecem pendentes.
