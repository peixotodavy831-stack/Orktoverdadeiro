# ORKTO — decisões comerciais em aberto

**Versão:** 0.1 · **Data:** 26/09/2026 · **Estado:** agenda de decisão, sem preços ou promessas aprovados por este documento.

## Reconciliação do MVP — 13/10/2026

As decisões abaixo já constavam do repositório e devem orientar o primeiro piloto. Esta reconciliação não aprova preço, contrato ou integração externa.

| Tema | Decisão recuperada | Fonte e estado |
| --- | --- | --- |
| Produto | ORKTO é uma operação comercial AI-native; WIA/WiaOS, ferramentas determinísticas, autorização, auditoria e gateway de mutações fazem parte da fundação. | `docs/ORKTO_MASTER.md`, ADRs 0001–0003: direção aceita; implementação precisa de E2E no SHA final. |
| Piloto inicial | Uma empresa, um workspace e um operador proprietário. Clientes, Contatos, Catálogo, Negócios, Propostas, Inbox interno e WIA determinística compõem a jornada. Convites multiusuário ficam fora enquanto Equipe estiver indisponível. | `ORKTO_PILOT_01.md`: escopo proposto para validação, sem autorização de contratação. |
| Ações externas | PIX real, cobrança automática, envio externo, provider de IA pago, memória entre workspaces e cases públicos ficam desligados no piloto inicial. | `ORKTO_PILOT_01.md`, ADR 0003 e estado do checkout: limite operacional. |
| Preços candidatos | Starter R$ 79,90, Pro R$ 149,90, Business R$ 299,90 e Scale R$ 599,90. | `ORKTO_FINANCIAL_MODEL.md` e `backend/finance/finance-model.ts`: seed interno **em validação**, sem aprovação de preço público. |
| Outras premissas | Enterprise R$ 1.499,90, mix 60/25/10/4/1 e cenários financeiros. | Seed interno **draft**, não oferta. A proposta antiga de Founders R$ 49 vitalício em `docs/analise-mercado.md` e o commit histórico `a4a7b00` não são aprovação comercial vigente. |
| Catálogo público | O checkout mostra preço somente se a versão tiver `price_is_public=true`. No staging lido em 13/10 havia sete versões aprovadas no catálogo e zero preço marcado público. | Evidência do gateway/SQL; aprovação técnica de versão não equivale a preço publicável. |

**Decisões do proprietário que ainda faltam para contratar:** identificar a empresa piloto e confirmar se o piloto será gratuito ou pago, duração, limites e suporte; aprovar o preço/condições aplicáveis; aprovar o texto jurídico revisado com profissional habilitado; autorizar separadamente o go-live. Esses pontos não impedem desenvolvimento e testes sintéticos em staging.

## Produto que pode ser apresentado

Apresentar a ORKTO como sistema comercial conversacional. Em cada demonstração, separar claramente capacidades reais em produção, beta, simuladas e futuras. A WIA prepara respostas e organiza contexto; autonomia, canal conectado e ações devem ser comprovados conforme ambiente.

## Decisões necessárias antes de preço/contrato

- ICP inicial, segmento e fluxo de valor que será vendido agora.
- Planos, limites de usuário/workspace, conversas, canais e ações de IA.
- Unidade de cobrança de uso, fair use, excedente e bloqueio/upgrade.
- Trial, cobrança, inadimplência, cancelamento, reembolso e dados após encerramento.
- Suporte, onboarding, disponibilidade e processo de incidentes.
- Garantias que a empresa está preparada para cumprir.

## Princípios de go-to-market

Não vender roadmap como feature ativa; não usar benchmark sem amostra/metodologia; casos de sucesso com autorização e dados verificáveis; site e equipe devem descrever a mesma versão do produto. White-label, preço e integração posterior ficam abertos até decisão registrada.

## Onboarding e ativação

Medir criação do workspace, configuração de perfil/regras, conexão autorizada do canal, primeiro dado real, primeira recomendação útil revisada e primeiro resultado confirmado. Não prometer importação de histórico antes de validar limites de canal, consentimento e base legal.
