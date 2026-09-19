# Plano de Observabilidade — Onda 0 e Primeira Fatia Vertical

**Autor:** @merces  
**Data:** 18/09/2026  
**Status:** Executável  
**Base:** ADR 004 e material orgânico de métricas

---

## 1. O que a observabilidade precisa resolver na Onda 0

O sistema vai ter três coisas que importam para operação e para custo:

1. **O que aconteceu?** decisões de bot, política, humano, webhook e entrega.
2. **Quanto custou e quanto demorou?** Hermes, bots, outbox, entrega.
3. **O que falhou e por quê?** replay, política, idempotência, outbox, Hermes indisponível.

A observabilidade tem que suportar o dia a dia da operação e o cálculo de custo depois.

---

## 2. Quais são as variáveis de correlação

Toda execução importante carrega:

- `workspace_id`
- `conversation_id`
- `agent_run_id`
- `action_id`
- `trace_id`

Esses cinco formam a espinha dorsal da correlação. Se algo quebra, você consegue seguir a linha do webhook à decisão à ação à entrega. O `trace_id` é o fio que liga as camadas; o resto é o contexto que permite explicar o que aconteceu.

---

## 3. O que medimos

### 3.1 Métricas de operação

- quantidade de mensagens recebidas por workspace
- tempo do webhook até a mensagem persistida
- tempo da mensagem até a sugestão gerada
- tempo da sugestão até a decisão do Policy Engine
- tempo da ação até o outbox
- tempo do outbox até o envio
- tempo do envio até a entrega
- taxa de aprovação de sugestões
- taxa de rejeição e edição
- taxa de opt-out
- taxa de violação de política
- taxa de dead-letter

### 3.2 Métricas de custo

- custo por execução Hermes
- custo por conversa
- custo por workspace
- custo por tipo de ação, quando possível rastrear

### 3.3 Métricas de saúde

- retries de outbox
- dead letters
- falha de job agendado
- indisponibilidade do Hermes
- falha de canal
- comportamento de limite e janela

### 3.4 Métricas de produto

Tudo que o documento orgânico já listou em métricas de produto e plataforma pode ser obtido a partir do modelo de dados e do audit log. Não é necessário criar outra fonte de verdade. Os números vêm da mesma coisa que a operação vê.

---

## 4. Onde cada coisa fica

- `agent_runs`: latência_ms, cost_estimate, trace_id, status, ferramentas chamadas
- `agent_actions`: status de aprovação, status de execução, política aplicada, decisão de política
- `action_outbox`: tentativas, erros, entrega, idempotency_key
- `audit_log`: correlação das decisões e eventos
- `dead_letter_events`: o que falhou e o que pode ser re-processado
- Logs estruturados: métricas de latência e custo que vão para o dashboard ou para o cálculo posterior
- Supabase Cron: jobs de score, relatório, rotina de limpeza e saúde

A decisão é: não criar outra camada de métricas separada do estado real. O estado já está modelado; a observabilidade é derivada dele com correlação explícita.

---

## 5. O que é alerta

Alertas mínimos para a Onda 0:

- Hermes indisponível ou timeout repetido
- aumento repentino de dead letters
- falha de job de score ou de fila
- taxa de violação de política anormal
- falha de entrega no outbox persistente

Esses alertas são os primeiros que valem a pena antes de qualquer painel complexo.

---

## 6. O que não entra agora

- painel de custo complexo por especialista
- dashboard completo de Mood Ring e risco
- relatórios automáticos completos
- métricas de Wrapped e cases
- painel de cobrança completo

Tudo isso pode ser construído sobre as mesmas correlações e o mesmo modelo de dados, então não precisa ser definido como parte da fundação. A fundação tem que tornar tudo isso possível.

---

## 7. Exemplo de correlação real

Um webhook chega, vira evento, Hermes roda, Policy Engine decide, ação vai para outbox, entrega acontece. Se algo der errado, a consulta é:

- qual `trace_id`?
- qual `workspace_id`?
- qual `conversation_id`?
- qual `agent_run_id`?
- qual `action_id`?

Com isso você consegue rastrear tudo o que aconteceu sem precisar adivinhar onde a informação está.

---

*Observabilidade mínima, deliberada e correlacionável. Essa é a base que evita que custo, latência e comportamento de bot se tornem caça-vesgos depois.*
