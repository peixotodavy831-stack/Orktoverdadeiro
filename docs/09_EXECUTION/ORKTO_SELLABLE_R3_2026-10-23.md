# ORKTO — preparação para uso comercial R3

Data: 23/10/2026. Branch: `feat/orkto-launch-2027`.
Base preservada: `8c97bed9b000dd0962a904ac51bd301fa114a059`.
Código desta rodada: `748a625d1148d7f60cd452b367ef1f0f809f7b17`.

**READY_FOR_PRODUCTION_CANDIDATE=NO**

## Entregue

- `d7ba958`: migration aditiva 51. Ingest Meta associa automaticamente cliente somente quando existe exatamente um cliente ativo, com telefone igual e no mesmo workspace. Zero ou múltiplas correspondências deixam a conversa nova sem cliente associado. Vínculos existentes são preservados; não há backfill ou reparo presumido de histórico.
- A consulta lê no máximo dois candidatos, com índice parcial `(workspace_id,phone)` para clientes não arquivados. Não foi medido desempenho em dados reais ou sob concorrência; não há garantia de latência remota.
- A assinatura da RPC, claim de webhook, deduplicação, auditoria, grants e RLS existentes são preservados. Nenhum novo papel, permissão, conta ou envio externo.
- `748a625`: Radar → “Preparar com a WIA” abre o pedido contextual para a proposta, sem o usuário copiar UUID. O rascunho contém somente um UUID validado; nome do cliente e texto de recomendação não entram no comando. Abrir não chama IA nem cria tarefa ou mensagem.
- O usuário precisa enviar o pedido e depois aprovar a ação elegível. O backend continua verificando workspace, disponibilidade do Playbook e estado da proposta. A aprovação atual cria somente tarefa interna; esta rodada não habilita o Playbook em nenhum ambiente.
- O formulário por ID permanece como alternativa avançada, com orientação para o fluxo contextual.
- Exatamente cinco planos e preços preservados: Start R$ 79,90; Pro R$ 149,90; Business R$ 299,90; Scale R$ 599,90; Enterprise sob consulta. Sem franquias, assentos, ofertas ou direitos novos.

## Matriz de evidências

PASS nesta tabela significa **PASS_LOCAL**. Nenhuma prova abaixo homologa o runtime remoto. Manifesto: [evidence/sellable-r3/validation.json](evidence/sellable-r3/validation.json).

| Gate | Estado | Ambiente e prova |
|---|---|---|
| Associação Meta única e isolamento na seleção do cliente | PASS | PostgreSQL 17.11 descartável: zero, um, dois clientes; arquivado; telefone igual em B; replay; vínculo existente preservado; grants não ampliados. `assert_meta_unique_client_match.sql`. |
| Controle negativo da nova regressão | PASS | O teste novo falha na implementação anterior (`Unsafe client association scenario 2`) e passa na migration 51. Transações revertidas. |
| Replay limpo | PASS | 51/51 migrations e asserts de segurança no banco local novo `orkto_sellable_r3`. |
| Atualização Supabase-like | PASS | 44/44 migrations posteriores ao baseline sanitizado, asserts de segurança, Meta e recuperação de proposta. Banco novo `orkto_sellable_r3_upgrade`. |
| Regressão aplicação e ferramentas | PASS | `npm run test:all`: 374/374 +108/108. A primeira execução detectou import ESM sem extensão; corrigido e suíte completa reexecutada. |
| Typecheck aplicação/Edge | PASS | `npm run lint`, `npm run lint:edge`; Edge é compilação com shim, não execução Deno remota. |
| Build e smoke | PASS | `readiness:build`, frontend, metadados, servidor, health, SPA, auth boundary e proteção de fontes. `dist` preservado. |
| Scan | PASS | Scan do checkout sem findings ou blockers; escopo e contagem no manifesto. Não equivale a auditoria completa de dependências ou infraestrutura. |
| Fluxo visual Radar → rascunho WIA | PASS | Fixtures locais: 390×844 dark, 768×1024 dark, 1280×900 light. Rascunho correto nos três; scrollWidth igual a innerWidth em Hoje e WIA. Sem envio do pedido. JPGs nesta pasta. |
| Preservação | PASS | Checkout original: 106/106 arquivos preservados, seis modificados e 100 não rastreados; HEAD/status/branch inalterados. PR #2 local em `78497da5bfd52166c6852aa14c06ebbf84fa1248`, não modificada. |
| Migration 51 e fluxo novo em staging | NOT_TESTED | Sem deploy, push ou alteração remota. Necessita publicação isolada autorizada e revalidação no SHA efetivamente publicado. |
| Google G01–G12 real | BLOCKED_EXTERNAL | Reutilizar as duas identidades/workspaces aprovados e executor legítimo em contextos isolados. Não recriar contas nem exportar sessões. Provas históricas não se transferem ao código novo. |
| Asaas B01–B13 real | BLOCKED_EXTERNAL | Customer sintético aprovado, canais de notificação OFF, secrets seguros, vínculo de workspace e autorização da rodada controlada. Checkout comercial continua desligado. |
| Gemini e Meta reais | BLOCKED_EXTERNAL | Configuração/tarifas e homologação controlada dos fornecedores. Nenhuma chamada paga ou mensagem real autorizada nesta rodada. |
| Recuperação gerenciada | BLOCKED_EXTERNAL | Prova de backup e restauração do serviço real. O ensaio local anterior permanece histórico; não substitui recuperação gerenciada. |
| Condições comerciais | BLOCKED_EXTERNAL | Aprovação de franquias Pulso, assentos, limites, termos, suporte e política de término de acesso. Não inventar parâmetros. |
| Uso público, aparelho real e piloto comercial | NOT_TESTED | Sem publicação, sessão real, acessibilidade assistiva ou cliente piloto nesta rodada. Demanda, retenção, CAC e custo real por workspace não foram medidos. |

Não há FAIL local aberto identificado nesta rodada. Isso não significa ausência de defeitos ou aprovação dos gates bloqueados.

## O que falta para vender com responsabilidade

1. Autorizar um Preview isolado desta branch, com ambiente explicitamente staging e Deployment Protection preservada. Revisar as mudanças contra o candidato de homologação antes de publicar; não substituir a PR #2 automaticamente.
2. Concluir as provas reais de login, sessão e isolamento com A/B existentes. Usar o executor e motores já preparados; solicitar intervenção somente para Google/2FA quando necessária.
3. Confirmar o customer sintético sandbox e notificações desligadas; cadastrar secrets diretamente no secret store. Só então autorizar a rodada Asaas. Não enviar credenciais em chat.
4. Aprovar as condições comerciais acima e concluir recuperação gerenciada, termos e operação de suporte. O planejamento financeiro R2 continua uma simulação com premissas, não custo contratado.
5. Rodar o protocolo Pilot 01 com participantes aprovados, acompanhar ativação, conclusão da primeira proposta, retorno e custo real. Abrir ao público apenas depois dos gates obrigatórios e autorização explícita.

## Retomada

Reutilizar migrations, motor Radar, Mutation Gateway, WIAOS, Pulso, Cost Governor, Central Econômica e motores G/B existentes. Não desenvolver outro framework. Próxima rodada deve fechar provas reais e melhorar problemas observados no piloto, preservando a distinção entre fixture, teste local e operação real.

Nenhum push, merge, deploy, alteração de produção/staging, cobrança, mensagem, compra ou inferência paga foi executado.
