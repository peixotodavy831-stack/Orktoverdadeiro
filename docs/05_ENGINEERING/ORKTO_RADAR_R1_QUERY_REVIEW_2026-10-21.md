# Radar R1 — revisão de consultas e grandes históricos

21/10/2026. Fonte da engine/rota:5738f52, sem modificação nesta rodada. **Revisão estática +teste em memória; não é EXPLAIN nem benchmark do Postgres/Supabase.**

## Forma da consulta

Até8 statements de leitura por request: membership1 → workspace1 → cinco consultas independentes em Promise.all (quotes/conversations/tasks/deals/config) → messages1 se houver conversas. Quatro ondas de dependência de I/O, não oito queries paralelas. Sem N+1 por sinal ou conversa, SELECT * de mensagens, conteúdo de mensagens, RPC, cron ou escrita.

Projeções e caps por request: quotes200, conversations250, tasks200, deals500, config1, messages1000 e duas linhas de contexto. Máximo nominal2153 linhas retornadas quando todos os caps são atingidos. O cap de resposta não limita, por si só, custo de scan/sort do banco. Contagens R1 são da consulta limitada; não totais da empresa.

## Fonte dos índices (revisão estática)

| Consulta | Índice versionado encontrado | Risco / medição necessária |
| --- | --- | --- |
| quotes por workspace/status/arquivo/retention, order sent_at/id | quotes_workspace_created_idx e índices parciais workspace/customer/deal/created_at | Não correspondem integralmente ao filtro/ordem Radar. Medir linhas lidas, sort, retenção e seletividade antes de propor índice novo. |
| conversations por workspace/status, order last_message_at/id | Índices existentes de contexto/updated_at; conferir schema real | Índice de ordenação exata last_message_at não foi certificado nesta revisão. |
| tasks por workspace/status/due_at, order due_at/id | orkto_tasks_workspace_due_idx(workspace_id,status,due_at) | Possível sort entre status distintos e desempateid; confirmar plano sob RLS. |
| deals por workspace/status/expected_close_on | orkto_deals_workspace_stage_idx(workspace_id,status,stage,updated_at desc) | Não cobre a ordem expected_close_on/id por inteiro. |
| messages por workspace e IN conversation_id, order sent_at desc,limit1000 | orkto_messages_conversation_sent_idx(conversation_id,sent_at) | IN com até250 IDs pode exigir merge/sort; não presumir index-only scan ou custo constante. |

A listagem de migrations não prova índice aplicado remotamente. Nenhum índice, ANALYZE, migration ou configuração remota foi executado nesta missão. Não criar índice especulativo sem plano/volume observados.

## Grande histórico — comportamento comprovado localmente

Teste novo:100000 mensagens sintéticas na fixture em memória, rota GET loopback,8 leituras, zero escrita e estado antes/depois igual. Ao atingir1000 mensagens retornadas: coverage.partial=true, leads_evaluated=false, zero sinais de lead; demais categorias continuam disponíveis. O log traz tempo e tamanho dessa execução com escopo LOCAL_MEMORY_ADAPTER_ONLY_NOT_POSTGRES_BENCHMARK. Não usar o tempo como SLA, throughput ou p95 de produção.

Esse comportamento evita falso positivo por resposta ausente no recorte. Limitação intencional: uma conversa muito ativa pode atingir o cap global e suspender todos os sinais de lead da consulta. Isso reduz cobertura, não representa “nenhum lead pendente”; UI explicita a limitação. Reavaliar seleção/agrupamento apenas com requisito de completude e testes próprios, sem reimplementar detector agora.

Mensagens internal consomem parte do cap embora não respondam ao lead; grande proporção de notas pode reduzir cobertura. A lista de250 UUIDs no filtro IN também exige conferir limite de URL do caminho real Vercel→PostgREST. Falhas de transporte/consulta devolvem erro, nunca snapshot saudável vazio. Nenhuma dessas medições reais foi presumida aprovada.

## Rodada real futura, após autorização

1. Confirmar SHA/Preview/staging e somente dados sintéticos aprovados. Nenhuma criação de massa remota pela presente missão.
2. Em sessão de leitura aprovada com papel real/RLS, EXPLAIN (ANALYZE,BUFFERS) das consultas SELECT parametrizadas sobre dados sintéticos, com timeout/limites do operador. Não usar service_role para mascarar custo das policies.
3. Registrar plano, rows removed, buffers, sort/spill, tempo e taxa de erro; nenhum conteúdo/token/contato. Separar aquecimento de amostras quentes/frias, concorrência e cardinalidade. Não aprovar p95 com uma requisição.
4. Conferir401/403/404, troca de workspace, payload/cap, URL de IN e repetição GET. Observar ausência de inserts/updates via mecanismo read-only aprovado; não habilitar logging de payload sensível.
5. Só então propor índice ou ajuste do loader, sem mudanças na engine determinística nem em permissions/RLS para obter velocidade.

**Estado:** PASS local para limites e comportamento conservador; desempenho SQL/RLS remoto NOT_TESTED. READY_FOR_PRODUCTION_CANDIDATE=NO.
