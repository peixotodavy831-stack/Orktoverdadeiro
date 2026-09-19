# Riscos e Decisões Pendentes — Onda 0

**Autor:** @merces  
**Data:** 18/09/2026  
**Status:** Executável  
**Base:** material orgânico e análise do repo

---

## 1. Riscos principais

### 1.1 Risco de schema divergente

O repo tem três migrações relacionadas e possivelmente inconsistentes. Se o time executar tudo sem decidir qual é a verdade, o schema acaba com versões conflitantes e o desenvolvimento trava mais cedo.

**Mitigação:** adotar um arquivo único consolidado e marcar os outros como legados ou remanejados.

### 1.2 Risco de hipótese de Hermes

A entrega depende de Hermes como motor. Nenhum dos quatro perfis locais é, por si só, produção. Modelo, provedor, modo de execução e plano de rollout ainda não são decorrência automática do que existe na máquina.

**Mitigação:** HermesAdapter mockável desde a Onda 0; gate de validação antes de qualquer bot em produção.

### 1.3 Risco de canal

O canal do WhatsApp pode mudar de adaptador. Se o normalizador for acoplado a um formato ou a uma assinatura específica, trocar o canal vira trabalho de rework.

**Mitigação:** contrato de evento interno normalizado, não payload nativo.

### 1.4 Risco de tenancy

Se o modelo de workspace for decidido tarde, RLS e isolamento precisam ser refatorados. Isso é arriscado porque toca segurança.

**Mitigação:** escolher o modelo antes da migração única; não deixar `workspace_id` sem significado definido.

### 1.5 Risco de segredo

Qualquer vazamento de credencial de WhatsApp, CRM, contabilidade ou Hermes é problemático. O risco aumenta se o código ou o histórico carregar segredos ou se a UI expuser algo que não deveria.

**Mitigação:** segredos só no servidor; contrato claro de outbox; RLS e Policy Engine antes de qualquer ação externa.

### 1.6 Risco de autonomia sem gate

Se um bot executar antes do Policy Engine estar ativo, o sistema perde o controle central sobre desconto, cobrança e envio. Isso é o risco mais direto because o ORKTO promete controle humano.

**Mitigação:** nenuma ação externa sem Policy Engine e outbox; mesmo em homologação, “executar” só no sentido de registrar, não de afetar o cliente.

### 1.7 Risco de custo e latência

Hermes e bots podem consumir mais do que o esperado se não houver correlação de custo e latência desde o início. Descobrir isso depois é mais caro.

**Mitigação:** ADR 004, campos de custo e latência em `agent_runs`, correlação obrigatória.

---

## 2. Decisões pendentes que não podem ser adiadas para depois

### 2.1 Qual migração é a verdade?

Escolher o esqueleto consolidado e remover ambiguidade entre os três arquivos.

### 2.2 Hermes em homologação e produção

Versão, provedor, modelo, perfil, modo de execução, canal de inferência e plano de rollout.

### 2.3 Canais oficiais

Canal principal do WhatsApp, canal de cobrança se houver, e suporte a canal futuro.

### 2.4 Tenancy

Single-tenant por perfil no início ou workspaces reais com membros e papéis agora.

### 2.5 Limites por plano

Desconto máximo, ações autônomas por dia, janela de horário, limites de bot.

### 2.6 Retenção e privacidade

Por quanto tempo guardar mensagem, anexo, trace e audit. Revisão jurídica antes de cobrança agressiva e importação de histórico.

### 2.7 Segredos e infra

Onde ficam as credenciais, como o servidor as consome, e papel do Supabase e do Express como worker de fila e webhook.

### 2.8 Equipe e ritmo

Qual a equipe real e qual o ritmo que define o cronograma, não o orgânico de 20 semanas.

---

## 3. Decisões que podem esperar uma fase depois da Onda 0

- playbooks reais e versões
- feed de feedback de ações
- Mood Rings ativos
- Scored de risco ativo
- relatórios automáticos
- cobrança completa
- Wrapped e cases
- graph de clientes
- memória coletiva

---

## 4. Resumo do que precisa de decisão antes de rodar

Se o time quiser executar a Onda 0 hoje, precisa decidir:

1. migração única
2. modelo de tenancy
3. canal do WhatsApp para homologação
4. Hermes mock versus Hermes real para a primeira validação
5. workspace de teste e como vai injetar mensagens simuladas ou reais

Isso abre a primeira fatia vertical: conversa entra, aparece na inbox e gera sugestão segura em modo observação.

---

*Riscos e decisões pendentes documentados. Isso é o que o time precisa resolver para a arquitetura sair do papel e entrar no banco e no código.*
