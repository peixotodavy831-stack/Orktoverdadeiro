# Radar R1 — integração seletiva, 21/10/2026

**READY_FOR_PRODUCTION_CANDIDATE=NO. Local somente. Sem deploy, merge, push ou alteração da PR #2.**

## Fonte e preservação

- Branch antiga: production-readiness/migration-replay-20260928, HEAD bff22b7aa29e909e5e560ca4dbf53ea742726d8f.
- Inspeção real encontrou **6 arquivos rastreados modificados +100 arquivos não rastreados (106 arquivos)**, em vez de presumir a contagem47 do pedido. Diretórios agrupados pelo Git explicam contagens visuais diferentes; todos os arquivos listados foram incluídos, não somente Radar.
- Cópia privada local verificada por SHA256: `C:/Users/sobooa7iqytvqheo/Documents/Codex/_preservation/orkto-radar-20261021/`. Contém bytes originais, manifest, diff binário dos rastreados e status completo. Não foi incluída em commit nem enviada externamente.
- [Conferência de preservação](evidence/radar-r1-2026-10-21/preservation.json):106 arquivos iguais byte a byte, backup íntegro, HEAD/branch/status antigos inalterados. Sem reset, clean, stash ou checkout forçado; nenhum commit coletivo do trabalho existente.
- Fetch confirmou origin/production-readiness/google-only-pilot-preflight em **78497da5bfd52166c6852aa14c06ebbf84fa1248**. Worktree separado `C:/Users/sobooa7iqytvqheo/Documents/Codex/Orktoverdeiro-radar-2027`, branch exata **feat/orkto-radar-2027**, sem upstream para a branch da PR #2. O helper de worktree do app não resolveu a ref; criação feita pelo Git no repositório explicitamente identificado, sem alterar checkouts anteriores.
- Implementação exclusiva Radar: commit **5738f520e869a24fd8b1f546324880de5b3a7ef0**. O segundo commit contém documentação/evidências apenas. A aplicação de staging permanece com sua versão histórica; esse commit não foi implantado.

## Integração seletiva e revisão

Copiados somente arquivos novos Radar/teste/spec/gap. Rotas, tipos e Hoje foram integrados sobre a fonte atual por trechos: rota nova +import, tipos aditivos e **duas linhas na Hoje** (import e composição). Não houve substituição de arquivo inteiro por versão antiga. Novo painel isolado reutiliza tokens e superfícies de vidro fosco e callbacks atuais. Harness visual recebeu somente fixtures Radar, fora do runtime do produto.

A revisão encontrou e resolveu no código recuperado: provisionamento implícito em GET; uso potencial de cliente compartilhado; falta de filtro workspace_id nas mensagens; inferência sobre histórico truncado; reset de espera a cada inbound; nota interna tomada como resposta; conversa vazia tomada como lead recebido; mensagem de visualização com conclusões não comprovadas; navegação taskId→dealId; falta de estado configuration_required; NaN/configuração inválida; datas de calendário normalizadas indevidamente.

Comparação com os contratos atuais:

| Área | Integração / preservação |
| --- | --- |
| Auth/tenant | Middleware Google/piloto atual intacto. Radar exige membership ativa existente, usa cliente JWT-bound e workspace_id em todas as leituras. Sem criação de conta/workspace/role. |
| Propostas | Usa status, envio, decisão, arquivamento e retenção reais do contrato atual. Sem decisão registrada é proxy, não prova de ausência de resposta externa. |
| Tarefas/oportunidades | Tarefa vencida e fechamento esperado têm fontes diferentes. Gateway WIA já produz tarefas internas; due_at não é inventado. Sem vínculo de negócio, tarefa não gera link enganoso. |
| WIA/WIAOS/aprovação | Só observações determinísticas; não chama WIA nem cria prepared/approved/executed. Gateway/proveniência/aprovação existentes intactos. |
| Pulso/Central Econômica | Nenhuma chamada de modelo, reserva Pulso, ledger, franquia ou tarifa. Catálogo/Cost Governor/billing/financeiro sem diff. |
| Playbooks | Preparação documental no contrato R1: revalidar fonte/tenant/política, idempotência, aprovação e orçamento antes de qualquer futuro efeito. Sem execução automática. |

## Validação local

Todos os resultados abaixo usam banco em memória, fixtures ou artefato isolado. Não são prova de Supabase/RLS/Edge/Google autenticados remotos.

| Verificação | Resultado | Evidência |
| --- | --- | --- |
| Radar puro +rota+UI final | PASS,18/18 | [log](evidence/radar-r1-2026-10-21/radar-tests.txt). Inclui o último caso adicional de mensagem estrangeira/member/imutabilidade. |
| Regressão focada Radar/tenancy/workspace/operação/auth | PASS,50/50 | Rodada intermediária em .tmp-radar-validation; último teste adicional coberto na rodada18/18. |
| Suíte completa existente | PASS,306/306 aplicação +107/107 ferramentas | [log](evidence/radar-r1-2026-10-21/regression.txt). Rodada antes do último teste adicional; não somar18 como testes novos disjuntos. |
| Lint TypeScript | PASS | [log](evidence/radar-r1-2026-10-21/lint.txt). |
| Build Google-only e smoke isolado | PASS | [log](evidence/radar-r1-2026-10-21/build.txt): frontend/publicUrl/server/runtime true, distPreserved true. Aviso de chunk WebGL grande preservado, não é falha do Radar. |
| Isolamento bidirecional local | PASS | Usuários A/B sintéticos, header estrangeiro403, sessão ausente401, membership ausente/inativa403; role member não promovida; cliente compartilhado proibido no teste. |
| Somente leitura | PASS local | Estado do banco antes/depois idêntico, queries select, nenhum método de escrita/provider habilitado; contrato R1 explícito. |
| Limiares/fontes | PASS local | 48h inclusivo, SLA da primeira incoming pendente, futuras/inválidas/terminais/retidas excluídas, due_at estrito, UTC calendário, NaN/config e limite de mensagens. |
| UI em navegador local | PASS limitado,fixture desktop | [estados](evidence/radar-r1-2026-10-21/ui-fixture-states.json), [captura](evidence/radar-r1-2026-10-21/desktop-fixture.png). Radar968px sem overflow; botões44px; atualização e avisos parcial/vazio/erro/permissão/configuração/backend pendente observados. Não é validação mobile completa. |
| Secret scan | PASS,537 arquivos, zero findings/blockers | [log](evidence/radar-r1-2026-10-21/secret-scan.txt); scanner por categorias conhecidas, não certificação universal. Captura contém somente fixtures identificadas. |
| RLS/Edge/API autenticada remotos | NOT_TESTED | Nenhuma consulta ou alteração no staging nesta missão. Gates anteriores continuam abertos. |
| Deploy Radar/staging/produção | NOT_TESTED / NÃO EXECUTADO | Branch local isolada. Homologação existente não foi invalidada por publicação. |

A primeira execução local restrita teve fetch loopback bloqueado; rodada autorizada passou. A primeira suíte completa encontrou importação ESM sem extensão no novo teste de UI; importação corrigida e rodada completa posterior passou. As evidências PASS são das rodadas finais, sem ocultar as ocorrências iniciais. A skill React foi aplicada à revisão de hooks, estado assíncrono, semântica e ações acessíveis dos dois componentes TSX.

## Limites e próxima integração

R1 não dá autorização para contato externo. Contagens são limitadas à consulta; max25 por tipo e até seis exibidos. No cap1000 de mensagens, nenhuma inferência de leads e aviso explícito. Pode existir falta de dados/recibos e isso não deve ser convertido em promessa de atendimento ou entrega. UTC de expected_close_on é uma convenção técnica documentada; fuso comercial por workspace fica para desenho separado.

Antes de incorporar na PR #2: revisar os commits Radar, confirmar que a base da PR não avançou e reconciliar eventuais trechos novos; aprovar estratégia de homologação em candidato separado. Não fazer merge ou deploy automaticamente. Executar RLS/API/Edge e navegação autenticados reais apenas em staging autorizado, com os gates externos já rastreados. Políticas/automação Playbooks permanecem desativadas e dependem de especificação própria.

Conferência final somente leitura da PR #2: OPEN/draft, headRefOid78497da5bfd52166c6852aa14c06ebbf84fa1248; checkout google-pilot limpo e no mesmo HEAD. Nenhuma alteração remota realizada nesta missão.
