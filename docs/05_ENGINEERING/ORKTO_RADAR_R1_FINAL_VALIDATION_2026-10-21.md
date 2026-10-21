# Radar R1 — validação final local e gates de publicação

21/10/2026. Exclusivamente **feat/orkto-radar-2027**. Base documental2cd2844; candidato executável preparado **6be27794923d2ec3c57075acef689275bd93de28**. Commits5738f52 e2cd2844 preservados como ancestrais. **READY_FOR_PRODUCTION_CANDIDATE=NO. Sem push/deploy/merge/produção.**

## Resultado por escopo

| Gate | Estado | Prova e limite |
| --- | --- | --- |
| Engine/rota R1 preservadas | PASS | backend/orkto-core/radar.ts e backend/operational-routes.ts idênticos a5738f52. Nenhuma reimplementação, migration, grant, tarefa ou integração nova. |
| Desktop/tablet/mobile | PASS local | Viewports reais do navegador1280×900,768×1024,390×844, claro/escuro:6 casos, sem overflow horizontal. [Matriz](evidence/radar-r1-final-2026-10-21/ui-matrix.json). Não são dispositivos físicos ou emulação de toque/Safari. |
| Evidências de recomendações | PASS local | Detalhes acessíveis por teclado, datas UTC, SLA, etapa, visualização ausente explícita, due_at/expected_close_on. Quatro tipos/subfontes observados na UI e teste renderizado. [Mobile](evidence/radar-r1-final-2026-10-21/radar-390-dark-detail.png), [tablet](evidence/radar-r1-final-2026-10-21/radar-768-dark-detail.png), [desktop](evidence/radar-r1-final-2026-10-21/radar-1280-dark-detail.png). |
| Estados vazio/loading/erro/parcial | PASS local | Quatro cenários em cada tamanho,12 casos. Loading Radar tornou-se fixture estável no harness para evitar corrida de800ms; não muda o produto. Matriz contém texto observado e largura real. |
| Controles/navegação | PASS local | Botões/summary medidos>=44px. Expansão via Enter; abrir conversa→inbox e negócio→deals observados com fixtures. Link proposta e tarefa sem negócio cobertos no teste de destino; não afirmar navegação real de proposta pelo harness que só mantém Hoje. |
| Auth/workspace/isolamento | PASS local | Sessão ausente401, A/B sintéticos próprios200 e estrangeiros negados, membership ausente/inativa403, member sem promoção, cliente autenticado exclusivo e mensagens estrangeiras filtradas. Middleware Google/piloto atual preservado. Não é prova RLS remota. |
| GET sem escritas | PASS local +revisão | Estado fixture antes/depois idêntico, apenas SELECT; sem criação de users/workspaces/tasks/deals, RPC ou envio. workspaceContext(...,false) e Cache-Control private,no-store preservados. |
| Histórico100000 mensagens | PASS local de completude |8 leituras, zero mutação e leads suspensos no cap1000; erro/cap não vira operação saudável. [Testes focados35/35](evidence/radar-r1-final-2026-10-21/focused-tests.txt). Tempo do adapter em memória não mede SQL. |
| Suíte completa | PASS local | **309/309 aplicação +107/107 ferramentas** ([log](evidence/radar-r1-final-2026-10-21/regression.txt)); depois, teste novo de trava de Preview1/1, separado e não somado como execução de CI. |
| Lint/build/smoke | PASS local | [Lint](evidence/radar-r1-final-2026-10-21/lint.txt), [build Google-only](evidence/radar-r1-final-2026-10-21/build.txt); frontend/publicUrl/server/runtime true e distPreserved=true. Node22.23.2 local, sem credenciais reais. |
| Consulta SQL/RLS em volume real | NOT_TESTED | [Revisão de índices, caps e riscos](ORKTO_RADAR_R1_QUERY_REVIEW_2026-10-21.md). Sem EXPLAIN ou medição de banco remoto; não aprovar latência do Postgres com fixture. |
| Identidade/proteção do projeto Preview | PASS somente leitura | Projeto staging/equipe corretos, SSO/Deployment Protection mantidos. Último deployment existente preservado; não é deployment do Radar. [Metadados](evidence/radar-r1-final-2026-10-21/preview-project-identity.json). |
| Configuração Google-only na branch nova | BLOCKED_CONFIGURATION | Preflight em memória: APP_ENV/VITE_APP_ENV staging, Supabase staging e chave pública corretos; **ORKTO_AUTH_MODE e VITE_ORKTO_AUTH_MODE ausentes** no Preview desta branch. [Prova](evidence/radar-r1-final-2026-10-21/preview-env-preflight.json). Nada configurado remotamente. |
| Preview Radar | BLOCKED_AUTHORIZATION | Pacote fonte fixo preparado/hash registrado, deploy automático da branch bloqueado no código, nenhum upload/push/deploy. [Plano e aprovação exata](ORKTO_RADAR_R1_PREVIEW_PLAN_2026-10-21.md). |
| Endpoint Radar remoto/E2E | NOT_TESTED | Depende de corrigir configuração com aprovação, publicar Preview explícito, confirmar SHA e disponibilizar aquisição Google legítima no host/runner aprovados. Não usar o staging antigo sem Radar como prova. |
| Playbooks R0 | PASS documental | [Especificação técnica proposta](ORKTO_PLAYBOOKS_R0_TECH_SPEC_2026-10-21.md): prévia determinística/checklist manual, WIAOS e gateway reutilizados como fronteiras. Nenhum executor/automação implementado. |
| Preservação e PR #2 | PASS de conferência | [106 arquivos antigos verificados](evidence/radar-r1-final-2026-10-21/preservation.json), branch antiga/HEAD/status intactos. PR #2 OPEN/draft no head78497da, sem alteração por esta missão. |

Secret scan final: PASS,554 arquivos, zero findings/blockers ([log](evidence/radar-r1-final-2026-10-21/secret-scan.txt)). SHA documental registrado no commit de entrega. Evidências UI são fixtures identificadas. Capturas gerais do contexto e capturas *-detail da própria seção são separadas; as últimas mostram o Radar enquadrado, não apenas o topo de Hoje. Um timeout transitório de mouse no tablet foi resolvido por teclado; a evidência de expansão é DOM+captura posteriores. O override de viewport foi restaurado e a aba temporária fechada; a aba local do usuário não foi fechada.

## Alterações desta rodada

Somente exibição de evidência na UI, testes, fixture de loading, trava de deploy automático da branch e documentação. A engine, rota, políticas e schema não mudaram. Os dois commits anteriores continuam na história. A ligação local .vercel contém somente IDs não secretos do projeto staging, é ignorada e não foi copiada da produção. CLI env run não gravou env/credenciais; relatório só possui booleans.

## Próximas autorizações mínimas

Aprovar duas variáveis não secretas google_pilot **apenas no Preview/feat/orkto-radar-2027** e a publicação manual do SHA6be2779 no projeto orkto-staging, condicionada a novo preflight PASS. Não conceder autorização implícita de produção, callback wildcard, bypass, nova conta/role, billing ou uso pago. Configuração e publicação ainda não executadas. Endpoint real, RLS, SQL em volume e Node24 remoto permanecem gates separados.

A especificação Playbooks R0 foi preparada após a validação local; a homologação remota do Radar continua pendente e não é substituída por essa especificação. READY_FOR_PRODUCTION_CANDIDATE=NO.
