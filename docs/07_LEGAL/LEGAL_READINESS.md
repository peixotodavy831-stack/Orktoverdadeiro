# ORKTO — prontidão jurídica (checklist, não aconselhamento)

**Versão:** 0.1 · **Data:** 26/09/2026 · **Estado:** pendente de revisão por profissional habilitado antes de uso público ou assinatura.

Este documento não é contrato, política legal final nem parecer. O produto pode tratar mensagens, telefones, dados de clientes, negociações e eventualmente pagamentos; finalidade, papéis e retenção precisam ser definidos com assessoria jurídica e privacidade.

## Verificação de publicação — 12/10/2026

Os arquivos públicos existentes `public/termos.html` e `public/privacidade.html` estão datados de julho/2026 e não têm aprovação jurídica registrada. Os Termos descrevem integração WhatsApp, processamento Asaas e assinatura recorrente como serviços ativos, enquanto o checkout e o envio externo estão desativados no fluxo atual. A Política cita tratamento de dados e analytics que precisam ser confrontados com a configuração efetiva antes de uso por cliente real. **Status: BLOCKED para contratação pública** até revisão/aprovação de textos, escopo comercial e dados processados pelo proprietário e profissional habilitado. Não substituir por texto genérico nem interpretar a presença dos HTMLs como aprovação.

O fluxo de cadastro (`src/components/ui/sign-in-flow-1.tsx`) declara concordância com esses HTMLs ao criar uma conta. Portanto o bloqueio jurídico afeta a jornada de autoatendimento, mesmo que o checkout esteja desligado. O piloto não deve coletar aceite de cliente real com essa versão sem aprovação dos textos.

**Revisão factual de 13/10/2026:** `index.html` carrega um script Umami com identificador público; a coleta efetiva, configuração de cookies e retenção ainda precisam de verificação operacional. Sentry está desabilitado em staging por código e condicionado a DSN fora de staging. Asaas/Resend não têm credenciais no Preview staging e as ações externas continuam desativadas. O pacote de redação para revisão está em `TERMS_PRIVACY_REVIEW_DRAFT_2026-10-13.md`. Nenhum texto público foi substituído nem recebeu aprovação jurídica nesta revisão.

## Pacote a preparar e revisar

- Termos de uso do SaaS e condições comerciais/assinatura.
- Aviso/política de privacidade e cookies/analytics do site e app.
- DPA/aditivo de tratamento para clientes B2B, suboperadores e providers de IA.
- Política de uso de IA, dados enviados, retenção, exclusão e revisão humana.
- Termos/limites de integração de canal e consentimento/opt-out.
- SLA/suporte apenas se a empresa puder cumprir métricas prometidas.
- Procedimento de titular, incidente, solicitação de exclusão e encerramento de workspace.

## Questões para counsel

Controlador/operador por fluxo; bases legais/finalidades; dados de terceiros presentes em conversas; subprocessadores e transferência internacional; direitos e retenção; gravação/transcrição de áudio; marketing/follow-up e opt-out; cobrança automatizada e proteção do consumidor; segurança/incidentes; propriedade de dados e saída/exportação; tratamento de conteúdo por cada modelo.

Não copiar templates de outra empresa nem publicar texto legal genérico como se cobrisse o produto. Associar cada documento final a owner, jurisdição, versão, data de aprovação e fluxo abrangido.
