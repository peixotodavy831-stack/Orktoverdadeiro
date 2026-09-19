# ORKTO — Master Handoff V2.0

**Versao:** 2.0  
**Data:** 19/09/2026  
**Status:** fonte unica de produto, IA, funcionalidades e design

## Definicao

A ORKTO e uma plataforma AI-native de operacao comercial conversacional. A conversa e a entrada; a WIA e a camada operacional; regras, historico, ferramentas e aprovacoes formam o sistema de execucao.

**North star:** conversa → entendimento → decisao → acao → acompanhamento → aprendizado.

## Decisoes congeladas

- WIA e distribuida pela interface; nao e chatbot ou sidebar isolada.
- WhatsApp Business e o primeiro canal, mas a arquitetura e channel-agnostic.
- Orcamento e uma acao possivel, nao a definicao do produto.
- A logo atual permanece.
- Identidade minimalista: `#0B0B0B`, `#1A1A1A`, `#3A3A3A`, `#F5F5F5` e laranja `#FF8A00`.
- Inter e a tipografia padrao.
- Branding do cliente entra no Pro+, com ORKTO discreta.
- A camada de IA usa provider abstraction; o provedor principal continua uma decisao aberta.

## Pipeline da WIA

1. Ingerir conversa ou evento.
2. Resolver identidade e contexto.
3. Classificar intencao, urgencia e estagio.
4. Recuperar regras, catalogo, historico e permissoes.
5. Escolher ferramenta ou especialista.
6. Gerar plano com confidence score.
7. Executar dentro do limite ou pedir aprovacao.
8. Registrar acao, resultado e evidencia.
9. Aprender com fechamento, perda e correcao humana.

## Guardrails

- RBAC por organizacao, workspace, equipe e usuario.
- auditoria de cada acao;
- regras explicitas de preco, desconto e pagamento;
- confidence threshold por tipo de acao;
- idempotencia;
- opt-out e limites de contato;
- isolamento entre empresas.

## Navegacao alvo

Visao geral, Conversas, Oportunidades, Orcamentos, Clientes, Tarefas/Acoes, Relatorios e Configuracoes.

## Roadmap

### Fase 0 — Fundamento

Multi-tenant, Auth, RBAC, canal, Inbox, contatos, catalogo/regras, oportunidades, tarefas, auditoria e observabilidade.

### Fase 1 — Loop de valor / MVP

WIA inline, triagem, criacao e envio de orcamento, Orcamento Vivo, recuperacao, aprovacao humana e dashboard de atencao.

### Fase 2 — Operacao inteligente

Relatorios, Replay, Sussurro, memoria por cliente, cobranca e risco com revisao humana.

### Fase 3 — Diferenciacao

Swarm avancado, Mood Rings, Graph, recompra e memoria coletiva.

## Regra de implementacao

Antes de criar uma capacidade, responder:

1. Qual trabalho manual elimina?
2. Qual acao real executa?
3. Qual guardrail exige?
4. Qual metrica comprova valor?
5. Pertence ao MVP ou a uma fase posterior?

Nunca implementar as funcionalidades como lista plana. Preservar auditabilidade, permissoes e aprovacao humana para decisoes sensiveis.
