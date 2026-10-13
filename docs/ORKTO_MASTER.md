# ORKTO Master

**Versão:** 0.1 · **Data:** 26/09/2026 · **Estado:** direção inicial consolidada; requer validação com produto, repositório e decisões comerciais/jurídicas.

## O que é a ORKTO

A ORKTO é um sistema operacional comercial AI-native que ajuda empresas a transformar conversas e outros sinais comerciais em operação organizada. A plataforma entende contexto, organiza clientes e oportunidades, prepara ações e pode automatizar trabalho repetitivo sob regras configuradas. Não deve ser reduzida a chatbot de WhatsApp, CRM genérico ou gerador de orçamento.

**Hierarquia:** ORKTO = produto; WiaOS = camada de operação/orquestração; WIA = inteligência com a qual a pessoa interage e que também aparece nos fluxos; agentes = especialistas acionados quando úteis; tools = ações permitidas; Memory Fabric = contexto recuperável; banco = fonte de verdade do estado persistido; eventos = sinais auditáveis; Policy Engine = limites; UI = superfície operacional.

**Ciclo de valor:** conversa/sinal → entendimento → contexto → decisão → ação autorizada → acompanhamento → aprendizado verificável.

## Como trabalhar com esta direção

1. Leia `AGENTS.md` e `docs/00_GOVERNANCE/SOURCE_OF_TRUTH.md`.
2. Identifique o domínio e abra os documentos correspondentes na tabela abaixo.
3. Confirme no código e nos dados o que existe. Blueprint, tela, mock, teste isolado ou nome de módulo não comprovam, por si só, uma capacidade de produção.
4. Faça primeiro a menor fatia operacional completa, com dados reais, permissão, estados de erro e resultado observável.
5. Atualize documentos de estado quando a implementação mudar. Registre decisões duradouras em `docs/00_GOVERNANCE/DECISIONS/`.

| Domínio | Documento principal |
| --- | --- |
| Valor, usuário e escopo | `01_PRODUCT/ORKTO_PRODUCT_SPEC.md` |
| Marca | `02_DESIGN/ORKTO_BRAND_SYSTEM.md` |
| App autenticado e UX/UI | `02_DESIGN/ORKTO_PRODUCT_UX.md` |
| Site público | `03_WEBSITE/ORKTO_MARKETING_SITE.md` |
| WIA e governança | `04_WIAOS/WIAOS_SPEC.md`, `AI_GOVERNANCE.md`, `MEMORY_FABRIC.md` |
| Arquitetura e dados | `05_ENGINEERING/ORKTO_ARCHITECTURE_BLUEPRINT.md`, `ORKTO_DATA_MODEL.md` |
| Estado e lacunas reais | `05_ENGINEERING/ORKTO_CURRENT_STATE.md`, `ORKTO_IMPLEMENTATION_GAP.md` |
| Comercial e jurídico | `06_BUSINESS/COMMERCIAL_DECISIONS.md`, `07_LEGAL/LEGAL_READINESS.md` |
| Ordem de execução | `09_EXECUTION/ORKTO_EXECUTION_PLAN.md` |

Os documentos são concisos e evoluem com evidência. Não criar arquivos vazios para completar uma árvore idealizada.

## Princípios de produto

- Eliminar trabalho manual preservando controle humano sobre decisões de impacto.
- Mostrar primeiro o que precisa de atenção, depois o estado da operação, depois o que a WIA fez ou preparou.
- Fazer o contexto acompanhar a tela; a pessoa não deve repetir cliente, conversa ou negócio já selecionado.
- Manter separados Cliente, Conversa, Negócio, Proposta/Orçamento, Pedido, Pagamento e Tarefa.
- Distinguir UI pronta de funcionalidade pronta, sugestão de execução, demo de produção e roadmap de compromisso.
- Tratar privacidade, isolamento por empresa, auditabilidade, confiabilidade e custo previsível como parte do produto.
- Construir uma fatia útil e verificável antes de ampliar a visão futura.
- Não usar LLM quando regra determinística, consulta ou cálculo confiável resolver melhor.

## Experiência e preferência do usuário

O aplicativo deve ser minimalista, claro, operacional, responsivo e acessível, sem virar um painel genérico de IA. A WIA é uma superfície de contato e uma inteligência contextual distribuída pelos fluxos; não deve dominar a interface com mascote ou decoração futurista.

Preferência de experiência registrada nesta direção: saudação pessoal discreta na tela Hoje (“Bom dia”, “Boa tarde”, “Boa noite” ou “Boa madrugada”), usando o nome preferido e o fuso configurado quando disponível. Deve ter fallback seguro e opção de desativação; humor leve é opcional e nunca deve atrasar ou esconder a fila de atenção. A personalização não autoriza inferências sensíveis nem uso de conversas fora do contexto permitido.

## Primeira prioridade

A primeira prioridade é fechar uma fatia real de operação: estabelecer tenant/permissões e estado comercial confiáveis, oferecer consultas/tools determinísticas da operação e conectar a experiência da WIA a esse contexto com aprovação e auditoria proporcionais. Não implementar Memory Fabric, Swarm amplo ou automações em lote antes de verificar pré-requisitos no estado atual e no plano de execução.

## Estado e referência

O estado auditado mais recente encontrado no repositório é [`ORKTO-REPOSITORY-STATE-2026-09-25.md`](ORKTO-REPOSITORY-STATE-2026-09-25.md). Ele foi escrito para um commit anterior e não substitui a verificação do checkout atual. O estado de 26/09, limitações e itens que ainda precisam de confirmação ficam em `05_ENGINEERING/ORKTO_CURRENT_STATE.md` e `ORKTO_IMPLEMENTATION_GAP.md`.

Os documentos de funcionalidades aprovadas preservam intenção ou aprovação conceitual; não definem sozinhos sequência de implementação nem status de produção. Referências externas citadas no Master precisam estar versionadas no repositório antes de serem tratadas como material disponível.
