# ADR 0001 — WIA pertence à ORKTO; Hermes não é requisito do produto

- **Data:** 26/09/2026
- **Status:** Aceita como limite de produto; integração de runtime permanece decisão técnica separada.

## Contexto

Documentos antigos da Onda 0 descrevem Hermes e bots como parte central da arquitetura. Em conversas de produto, o usuário esclareceu que a WIA não tem relação de dependência com Hermes. A direção atual coloca ORKTO como produto e WiaOS como orquestração da WIA.

## Decisão

WIA/WiaOS são capacidades da ORKTO e não dependem conceitualmente do Hermes Agent. Não instalar, invocar ou tornar Hermes pré-requisito para uma tela, feature ou fluxo da WIA sem pedido/decisão explícita. O adapter Hermes legado pode permanecer isolado até revisão de uso; sua existência não comprova execução de bots de negócio.

## Consequências

- Specs de produto/WiaOS e UX não devem instruir a WIA a falar com Hermes.
- Referências antigas a Hermes/Swarm são legadas/alvo e devem receber rótulo de validade; não removê-las sem revisão de dependências.
- Qualquer adapter de execução continua atrás de contrato, policy, ambiente e decisão técnica próprios.
