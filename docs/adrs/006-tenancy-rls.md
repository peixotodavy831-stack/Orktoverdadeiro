# ADR 006 — Tenancy, RLS e Isolamento de Segredos

**Status:** Aprovado  
**Autor:** @merces  
**Data:** 18/09/2026  
**Decisão:** isolamento de tenant é propriedade do banco + Policy Engine; segredos ficam no servidor e nunca no navegador ou no repo.

## Contexto

ORKTO vai multi-tenant gradualmente. Se o isolamento não for explícito no esquema e na política, ele vira incidente. Segredos de WhatsApp, CRM e Hermes também não podem vazar pelo cliente ou pelo histórico.

## Decisão

- RLS em todas as tabelas novas por `workspace_id`, através de `workspace_members` e papéis.
- Funções de efeito externo são SECURITY DEFINER e controladas, não abertas ao plano do cliente.
- Segredos são variáveis de servidor ou cofre, nunca no navegador.
- Exportação, exclusão e retenção têm política explícita por tenant/contato.

## Hierarquia de permissão

- owner / admin : gerenciam workspace, bots, integrações
- operator : atua, aprova, edita
- viewer : vê, não executa

## Consequências

- Um tenant não observa outro mesmo com credenciais vazadas
- Bot só age quando Policy Engine libera
- Auditoria mostra quem aprovou o quê

## Referentes

- merces (segurança e tenancy)
- xoto (RLS e integrações)
