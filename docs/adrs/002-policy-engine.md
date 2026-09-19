# ADR 002: Policy Engine - Motor de Políticas de Autonomia

**Data:** 18/09/2026  
**Decisão:** Criar um `Policy Engine` que aplica regras de autonomia, horário, consentimento, limites de desconto e níveis de confiança antes de qualquer ação de bot.  
**Status:** Aprovado

## Contexto

Bots especialistas não podem executar ações sensíveis (desconto, cobrança, mudança de estratégia) sem passar por verificação de políticas. O Policy Engine garante que:
- Ações sejam auditáveis
- Limites comerciais sejam respeitados
- Humanos mantenham controle sobre decisões críticas
- O nível de autonomia seja definido por bot e tipo de ação

## Níveis do Dial de Confiância

1. **Observando:** Bot registra o que faria, nenhuma ação externa é executada.
2. **Sugerindo:** Bot cria rascunho de ação, humano aprova antes de executar.
3. **Autonomia Limitada:** Bot executa playbooks pré-aprovados dentro de limites explícitos.
4. **Autonomia Ampliada:** Somente após validação de volume, qualidade e rollback testado.

## Políticas obrigatórias

### 1. Política de Horário
- Bots só executam ações durante janelas configuradas por workspace.
- Fora da janela, ações ficam em fila ou são rejeitadas com registro.

### 2. Política de Consentimento
- Ação só é executada se o contato tiver consentimento registrado para o canal/uso.
- Opt-out é respeitado imediatamente.

### 3. Política de Limites Comerciais
- Desconto acima do limite do plano requer aprovação humana.
- Promessas não cadastradas no sistema não podem ser feitas por bots.

### 4. Política de Risco
- Score de risco acima do limiar configuravel gera fila humana, não bloqueio automático.
- Bots não acusam cliente ou bloqueiam venda sozinhos.

### 5. Política de Idempotência
- Ações repetidas com mesmo contexto não duplicam efeitos.
- Cada ação recebe ID único e é rastreada no audit log.

## Contrato mínimo do Policy Engine

```typescript
interface PolicyEngine {
  // Verifica se uma ação pode ser executada
  canExecute(action: ActionProposal, context: PolicyContext): Promise<PolicyDecision>;
  
  // Aplica políticas e retorna decisão
  evaluate(action: ActionProposal, context: PolicyContext): Promise<PolicyResult>;
  
  // Registra ação executada para auditoria
  recordExecution(execution: ActionExecution): Promise<void>;
  
  // Verifica nível de autonomia para bot/capacidade
  getAutonomyLevel(botId: string, capability: string): Promise<AutonomyLevel>;
}
```

## Consequências

- Todo caminho de execução de bot passa pelo Policy Engine.
- O Policy Engine é testado com casos difíceis (límites, horários, opt-out).
- Decisões de política são versionadas e auditáveis.
- Humanos sempre podem interceptar e modificar decisões.

## Referentes

- merces (arquiteto de software)
- gueguel (product manager - regras comerciais)
