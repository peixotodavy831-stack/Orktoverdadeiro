# Políticas de Autorização — Onda 0

**Autor:** @merces  
**Data:** 18/09/2026  
**Status:** Executável  
**Base:** ADRs 002, 003, 006

---

## 1. Princípio central

Dois níveis de controle:

- **Nível banco:** RLS + papel de workspace. Decide quem pode ver ou escrever cada linha.
- **Nível sistema:** Policy Engine. Decide se a ação pode acontecer, mesmo para quem tem permissão de escrita.

Isso evita a falha clássica em que “o usuário pode escrever na tabela” vira “o usuário pode fazer qualquer coisa”. No ORKTO, a escrita na tabela de ações não é o mesmo que executar a ação.

---

## 2. Hierarquia de acesso ao workspace

### 2.1 Papéis

- **owner:** cria workspace, gerencia integrações, gerencia bots, define limits.
- **admin:** na maior parte das vezes igual ao owner para as ações de configuração; pode ter restrições adicionais por decisão de negócio.
- **operator:** atua nas conversas, aprova sugestões, pausa/resume bots, edita ações. Não define integrações nem limites gerais.
- **viewer:** vê conversas, ações e status, mas não executa.

### 2.2 O que cada papel pode fazer

- owner/admin: configurar canal, bot, limites, trust level, playbooks, feature flags.
- operator: ver inbox, aprovar/editar/rejeitar sugestões, emitir respostas humanas, pausar/resume bots, ver audit log próprio.
- viewer: ver inbox, conversas, ações, relatórios pré-determinados, sem execução nem aprovação.

---

## 3. RLS no banco

### 3.1 Regra básica

Toda tabela nova tem `workspace_id` e RLS ativo. A política padrão é a visibilidade e edição limitadas ao workspace onde o usuário é membro. Exemplo mínimo:

- SELECT: usuário pode ver linhas do workspace onde é membro.
- INSERT/UPDATE/DELETE: usuário pode escrever se for membro com papel adequado.

### 3.2 Tabelas com escrita mais restrita

- `agent_definitions` globais: visíveis, mas só owner/admin pode criar ou editar nos seus workspaces.
- `action_outbox`: o consumo e a escrita de status são feitos por função servidor controlada, não por plano cliente.
- `audit_log`: append-only; escrita por função SECURITY DEFINER; leitura por membro.

### 3.3 O que o RLS não resolve

RLS isola tenant. Não decide se um humano pode aprovar desconto, enviar cobrança ou executar ação fora de janela. Isso é Policy Engine.

---

## 4. Policy Engine como gate de ação

### 4.1 Pontos de gate

Todo efeito sensível passa pelo Policy Engine:

- envio de mensagem pelo bot
- desconto
- criação ou alteração de proposta
- agendamento de follow-up
- escalonamento
- cobrança qualquer
- qualquer ação que vá para action_outbox com canal externo

### 4.2 Decisões do gate

O Policy Engine decide entre:

- **permitir execução** → ação vai para outbox
- **enviar para aprovador humano** → cria approval_task
- **bloquear** → registra violação de política e não executa
- **observar** → registra no audit log sem efeito externo

### 4.3 Políticas mínimas para a Onda 0

- janela de operação por workspace
- consentimento registrado por contato/canal
- limite de desconto por plano e por ação
- escore de risco acima do limiar vai para fila humana
- idempotência: mesma ação num contexto idêntico não executa duas vezes
- bot pausado não executa

---

## 5. Aprovações

### 5.1 Quando uma aprovação é obrigatória

- ação fora do nível de autonomia do bot
- desconto acima do limite
- cobrança sensível
- estratégia que pode impactar o cliente diretamente
- ação que o Policy Engine não pode decidir automaticamente

### 5.2 Controle da aprovação

- quem aprova é definido por papel e, quando configurado, por `assigned_to`
- a aprovação gera evento de auditoria
- a aprovação só libera a ação para o outbox, nunca envia direto
- rejeição registra motivo e não executa

---

## 6. Segredos e integrações

- Credenciais de WhatsApp, CRM, contabilidade e Hermes ficam no servidor ou em cofre.
- Nenhuma chave ou token vai para o navegador ou para o repo.
- O client nunca vê o que está no outbox além do estado visível por política.
- Integrações externas só são chamadas pelo servidor, fora do browser.

---

## 7. Realtime e presença

- Realtime é canal de UI, não de decisão de negócio.
- A conexão do Realtime só entrega eventos do workspace do usuário.
- Se o usuário perde permissão durante a sessão, o canal deve parar de entregar.
- Presence é opcional e pertence a uma fase mais avançada.

---

## 8. Auditoria

Tudo que importa vai para `audit_log`:

- webhook recebido
- evento normalizado
- execução Hermes iniciada/concluída/falhou
- decisão de política
- ação criada
- ação aprovada/edita/rejeitada
- ação enviada/entregue/falhou
- bot pausado/resume
- feature flag alterada

Cada evento tem `trace_id`, `workspace_id`, `conversation_id`, `agent_run_id`, `action_id` quando aplicável.

---

## 9. Controle de acesso à UI

A UI obedece o mesmo modelo:

- view por papel
- botões de ação só quando o papel e a política permitem
- sugestão e aprovação no mesmo fluxo de conversa para não fragmentar a operação
- nenhuma ação externa é iniciada pelo cliente do navegador

---

## 10. O que não é política ainda

- política de retenção definitiva de mensagens, anexos e traces
- política de cobrança agressiva e de importação de histórico
- política de memória coletiva
- política de compartilhamento externo de cases e Wrapped

Esses entram depois, com revisão jurídica e produto.

---

*Políticas de autorização prontas para implementação. A execução deve ter RLS + Policy Engine ativos antes de qualquer bot com autonomia, mesmo em homologação.*
