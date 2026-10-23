# Retomada vigente — R3 de 23/10/2026

Ler primeiro ORKTO_SELLABLE_R3_2026-10-23.md. Código 748a625, correção Meta d7ba958: associação somente a cliente ativo único, migration 51, fluxo contextual Radar → WIA sem copiar ID. Regressão local 374+108; replay 51/51 e upgrade 44/44; nenhuma homologação remota nova. Evidências em evidence/sellable-r3. A ambiguidade descrita no histórico abaixo foi corrigida localmente, ainda sem deploy.

Próximo passo: publicação isolada autorizada e gates reais Google A/B, Asaas e recuperação gerenciada. Preservar PR #2, contas e workspaces já aprovados. Não repetir/recriar os motores. READY_FOR_PRODUCTION_CANDIDATE=NO.

---
# Histórico R2 de 23/10/2026

Ler primeiro ORKTO_LAUNCH_R2_EXECUTION_2026-10-23.md e o último bloco R2 do MASTER. Abaixo permanece o histórico, inclusive limitações que esta rodada resolveu localmente.

- Branch feat/orkto-launch-2027, worktree Orktoverdeiro-launch-2027. Consolidação por assunto: 8c5c9e6 locale, 2f6327e SQL Playbook, 9df9ac5 finanças/Pulso, 5c11fd1 tema, e1e680e landing. Nenhuma alteração nos outros worktrees ou PR #2.
- Nova regressão: 372 aplicação +108 ferramentas PASS_LOCAL; lint, lint Edge, build/smoke e scan passaram. Manifesto em evidence/launch-r2. Validação do HEAD documental final em .tmp-launch/r2-head-validation.json. Inspecionar status antes de editar.
- PostgreSQL 17 disponível em .tmp-launch/pg17-tools/pgsql/bin; data em .tmp-launch/pg17-data, somente fixtures. PGHOST=127.0.0.1, PGPORT=55437, PGUSER=postgres, PGDATABASE=orkto_launch_r2_replay. Instância encerrada após validação. Para retomar, pg_ctl -D .tmp-launch/pg17-data -l .tmp-launch/r2-postgres-server.log -w start. Não vincular Supabase ou usar URL remota. Asserts em supabase/tests/assert_proposal_recovery.sql usam BEGIN/ROLLBACK.
- Provas de replay em .tmp-launch/r2-pg-replay (50/50) e r2-upgrade-evidence (43/43); restore local também passou. Isso não fecha recuperação gerenciada real.
- QA local usa servidor Vite 127.0.0.1:4177, fixtures explicitamente rotuladas. 18 medidas em evidence/launch-r2/layout-results.json. Viewport agora funcionou. Sem aparelho/teclado físico ou E2E autenticado.
- Planilha financeira oficial desta revisão: evidence/launch-r2/ORKTO_LAUNCH_R2_BUDGET_2027.xlsx. Preservar versões anteriores. Builder temporário .tmp-launch/r2-artifact/build.mjs usa só o runtime de artefatos, não dependências instaladas no app. Valores públicos consultados 23/10/2026; envelopes e impostos são hipóteses, Meta rate card bloqueado 429.

Próximo incremento de engenharia: corrigir vínculo ambíguo cliente/telefone Meta com migration aditiva e replay PG17, sem alterar grants ou dados reais. Reutilizar assert_meta_whatsapp_connections.sql. Supabase CLI ainda não foi instalado; se precisar, consultar --help e usar migration new. Não reescrever a migration histórica.

Depois: reduzir seleção por UUID na recuperação (abrir com proposta/Radar em contexto), validar componentes administrativos em sessão real autorizada, aparelho físico e custo medido por workspace. Não duplicar simulador, engine Radar ou gateway.

Ações externas: executor Google legítimo; Asaas customer sintético/notificações OFF/secrets e autorização; fornecedores/tarifas/termos; empresa piloto; aprovação de publicação isolada. Não repetir logins ou criar contas/papéis sem aprovação. Não efetuar gasto, envio, cobrança ou IA paga.

READY_FOR_PRODUCTION_CANDIDATE=NO. Sem push, merge, staging ou produção.

---
## Histórico preservado

# Retomada ORKTO Launch 2027

**READY_FOR_PRODUCTION_CANDIDATE=NO**

## Checkout e commits

Usar exclusivamente `C:\Users\sobooa7iqytvqheo\Documents\Codex\Orktoverdeiro-launch-2027`, branch `feat/orkto-launch-2027`, base aa6e4de.

- 0f3f046: binding telefone/WABA, paginação segura e decisões reais do ledger Meta.
- 1e58e23: pricing fornecido adaptado a cinco planos mensais, sem checkout.
- 3436a68: preparação determinística de recuperação de proposta pela WIA, reaproveitando Radar, aprovação, tarefa interna e auditoria existentes.
- 134de66: confirmação explícita de inscrição Meta e coexistência desconhecida quando não verificada pelo fornecedor.
- f5a652a: registro da validação limpa, protocolo Pilot 01 e gates remanescentes.

Não alterar PR #2, checkout antigo ou branches de origem. Nenhum push/merge/deploy autorizado nesta rodada. Vercel Git deployment desta branch permanece false.

## Atenção ao trabalho concorrente

Foram detectadas alterações não produzidas por esta rodada em finanças, localização, pricing e landing no mesmo worktree. Preservar tudo, inspecionar status/diff antes de editar, não incluir em commit coletivo nem reverter. Há teste de localização concorrente que esperava `1.234,5` para es-419, enquanto o Intl do runtime retornou `1,234.5`; registrar separadamente, não atribuir aos commits acima. Não recriar simulador econômico: já existe e está sendo alterado.

## Evidências

Ler MASTER, PLAYBOOK_PROPOSAL_RECOVERY_SLICE e ORKTO_PILOT_01_PROTOCOL. A validação final limpa usa export Git de 134de66 em `.tmp-launch/review-source`, dependências locais do lockfile; não copiar alterações concorrentes para esse snapshot. Logs `.tmp-launch/clean-*-134de66.log`. Consultar resultado consolidado no MASTER antes de repetir.

QA local de fixtures em localhost:4177; capturas 1280px em docs/09_EXECUTION/evidence/launch-2027. Override de viewport não alterou innerWidth: mobile/tablet não foram comprovados nesta rodada. Nunca chamar fixture de PASS_REMOTE.

## Atualização financeira e landing — 2026-10-22

O Ciclo 5 do MASTER registra o planejamento financeiro e de crescimento e a extensão local do simulador. Retomar pelo estado do worktree antes de qualquer edição; preservar alterações existentes de finanças, landing, localization e testes. Os documentos novos são:

- `docs/09_EXECUTION/ORKTO_LAUNCH_2027_FINANCIAL_MASTER.md`
- `docs/09_EXECUTION/ORKTO_FIRST_MONTH_BUDGET_2027.md`
- `docs/09_EXECUTION/ORKTO_UNIT_ECONOMICS_2027.md`
- `docs/09_EXECUTION/ORKTO_GROWTH_MARKETING_2027.md`
- `docs/09_EXECUTION/ORKTO_INTERNATIONALIZATION_2027.md`
- `docs/09_EXECUTION/ORKTO_FOUNDER_FINANCES_2027.md`

Concluído nesta etapa: workbook de fórmulas exportado/reimportado e recalculado; 26/26 testes focados de finanças, localização, pricing e estimativa WhatsApp; lint e build local isolado passaram (`frontend/publicURL/server/runtime=true`, `distPreserved=true`). O build alerta chunk WebGL de aproximadamente 889 KB. A inspeção de metadados SEO foi estática. Interações, viewport desktop/mobile, teclado e acessibilidade no navegador continuam `NOT_VERIFIED`: o bind do servidor local falhou com WinError 10013 e a política do browser recusou `file:` sem permitir alternativa. Não declarar responsive QA.

Status de versionamento desta retomada: alterações continuam locais e sem commit. O checkpoint anterior identificou arquivos de finanças, landing, pricing e localização com ownership concorrente; preservá-los e não fazer commit coletivo sem confirmar a autoria/escopo. Nenhum push, merge ou deploy foi realizado.

Permanecem `NOT_VERIFIED`: preço e contrato WhatsApp, custo real por workspace, tributos aplicáveis e demanda. A planilha exclui WhatsApp, configuração/implantação, domínio, suporte e outros itens sem cotação; seus custos conhecidos são pisos parciais, não orçamento all-in. Mantêm-se sem alteração PR #2, checkout original, gates G01–G12/B01–B13, billing, mensagens, IA paga, push, merge e deploy. O build e os testes locais não mudam `READY_FOR_PRODUCTION_CANDIDATE=NO`.

## Próximo incremento seguro

1. Confirmar preservação, status e ownership dos arquivos concorrentes antes de continuar.
2. Resolver associação ambígua de cliente/telefone em `orkto_ingest_meta_text_message`: a migration `20261016030000_meta_whatsapp_connections.sql` ainda usa `order by created_at limit 1`. Criar migration aditiva para associar somente quando houver exatamente um cliente ativo com o telefone; nenhum ou múltiplos devem continuar sem vínculo. Reutilizar `assert_meta_whatsapp_connections.sql` e executar replay PostgreSQL 17 descartável. Esta retomada não criou a migration porque o bin PostgreSQL 17 não está disponível/configurado (`docker`, `psql`, Supabase CLI e `C:\Program Files\PostgreSQL` ausentes); não reescrever migration histórica nem aplicar em staging.
3. Playbook: executar RPC real de preparação→aprovação/rejeição→tarefa→replay com dados sintéticos em PostgreSQL descartável. Nenhuma task/envio antes de aprovação, isolamento entre tenants, papel recusado e auditoria. Sem novo permission engine. Melhorar seleção contextual de proposta/Radar, hoje exige UUID no formulário WIA.
4. Retomar mobile/tablet com viewport comprovado por innerWidth e verificar teclado/dock/último item e comparação de planos.
5. Só preparar Preview isolado após analisar conflito com homologação atual e obter autorização específica de publicação. Nenhuma flag foi ligada nesta rodada.

## Bloqueios externos preservados

G01–G12: executor legítimo de duas sessões Google, sem extração de tokens. B01–B13: customer sintético aprovado, notificações OFF, credenciais no secret store e autorização controlada. Não solicitar chaves no chat. Gemini/Meta reais e recuperação exigem configuração/autorização próprias. Franquias, assentos, termos e término de acesso continuam sem aprovação; não inventar números. Produção e PR #2 permanecem intocados.
