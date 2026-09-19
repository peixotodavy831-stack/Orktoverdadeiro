# ADR 001: HermesAdapter - Interface entre ORKTO e Hermes Agent

**Data:** 18/09/2026  
**Decisão:** Criar um `HermesAdapter` versionado como único ponto de contato da ORKTO com o Hermes Agent.  
**Status:** Aprovado

## Contexto

A ORKTO precisa integrar com o Hermes Agent para orquestração de bots especialistas, mas não pode depender diretamente da instalação local ou da API interna do Hermes. Essa decisão evita acoplamento à infraestrutura específica e permite evolução independente.

## Opções consideradas

1. **Chamada direta ao CLI do Hermes** - Rejeitada: acopla a ORKTO à versão instalada e ao path local.
2. **HermesAdapter com contrato versionado** - Adotada: desacopla, permite mock em testes e evolução da implementação.
3. **Integração direta via MCP** - Reservada para fase futura quando houver contrato estável.

## Decisão

O `HermesAdapter` será um módulo servidor que:
- Expõe métodos síncronos assíncronos para classificação de intenção, seleção de bot, montagem de contexto e execução de ações.
- Recebe e retorna objetos plain JSON via contrato interno.
- Em desenvolvimento/homologação, usa mock que registra traces e retorna respostas simuladas.
- Em produção, conecta ao gateway do Hermes Agent via protocolo definido.

## Contrato mínimo do HermesAdapter

```typescript
interface HermesAdapter {
  // Classifica intenção e contexto da mensagem
  classifyIntent(context: ConversationContext): Promise<IntentClassification>;
  
  // Seleciona qual especialista deve atuar
  selectSpecialist(intent: IntentClassification, context: ConversationContext): Promise<SpecialistSelection>;
  
  // Monta contexto mínimo para o especialista
  buildSpecialistContext(selection: SpecialistSelection, conversation: Conversation): Promise<SpecialistContext>;
  
  // Executa a ação proposta pelo especialista (se autonomia permitida)
  executeAction(action: ActionProposal, context: SpecialistContext): Promise<ActionResult>;
  
  // Gera sugência de resposta para aprovação humana
  suggestResponse(context: ConversationContext, intent: IntentClassification): Promise<Suggestion>;
}
```

## Consequências

- Nenhuma tela ou rota da ORKTO pode chamar Hermes diretamente.
- Todos os efeitos de bots passam pelo Policy Engine antes de serem executados.
- O mock registra traces completos para auditoria e depuração.
- A versão do adapter é registrada em cada execução para rastreabilidade.

## Referentes

- merces (arquiteto de software)
- xoto (engenheiro full-stack)
