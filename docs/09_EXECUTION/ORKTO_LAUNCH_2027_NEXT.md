# Retomada ORKTO Launch 2027

**READY_FOR_PRODUCTION_CANDIDATE=NO**

## Checkout e commits

Usar exclusivamente `C:\Users\sobooa7iqytvqheo\Documents\Codex\Orktoverdeiro-launch-2027`, branch `feat/orkto-launch-2027`, base aa6e4de.

- 0f3f046: binding telefone/WABA, paginação segura e decisões reais do ledger Meta.
- 1e58e23: pricing fornecido adaptado a cinco planos mensais, sem checkout.
- 3436a68: preparação determinística de recuperação de proposta pela WIA, reaproveitando Radar, aprovação, tarefa interna e auditoria existentes.
- 134de66: confirmação explícita de inscrição Meta e coexistência desconhecida quando não verificada pelo fornecedor.

Não alterar PR #2, checkout antigo ou branches de origem. Nenhum push/merge/deploy autorizado nesta rodada. Vercel Git deployment desta branch permanece false.

## Atenção ao trabalho concorrente

Foram detectadas alterações não produzidas por esta rodada em finanças, localização, pricing e landing no mesmo worktree. Preservar tudo, inspecionar status/diff antes de editar, não incluir em commit coletivo nem reverter. Há teste de localização concorrente que esperava `1.234,5` para es-419, enquanto o Intl do runtime retornou `1,234.5`; registrar separadamente, não atribuir aos commits acima. Não recriar simulador econômico: já existe e está sendo alterado.

## Evidências

Ler MASTER, PLAYBOOK_PROPOSAL_RECOVERY_SLICE e ORKTO_PILOT_01_PROTOCOL. A validação final limpa usa export Git de 134de66 em `.tmp-launch/review-source`, dependências locais do lockfile; não copiar alterações concorrentes para esse snapshot. Logs `.tmp-launch/clean-*-134de66.log`. Consultar resultado consolidado no MASTER antes de repetir.

QA local de fixtures em localhost:4177; capturas 1280px em docs/09_EXECUTION/evidence/launch-2027. Override de viewport não alterou innerWidth: mobile/tablet não foram comprovados nesta rodada. Nunca chamar fixture de PASS_REMOTE.

## Próximo incremento seguro

1. Confirmar preservação, status e ownership dos arquivos concorrentes antes de continuar.
2. Resolver associação ambígua de cliente/telefone no ingest Meta com migration aditiva: múltiplos clientes devem permanecer sem vínculo, não escolher o mais antigo. Reutilizar assert_meta_whatsapp_connections.sql e executar replay PostgreSQL 17 descartável. Não reescrever migration histórica nem aplicar em staging sem validação.
3. Playbook: executar RPC real de preparação→aprovação/rejeição→tarefa→replay com dados sintéticos em PostgreSQL descartável. Nenhuma task/envio antes de aprovação, isolamento entre tenants, papel recusado e auditoria. Sem novo permission engine. Melhorar seleção contextual de proposta/Radar, hoje exige UUID no formulário WIA.
4. Retomar mobile/tablet com viewport comprovado por innerWidth e verificar teclado/dock/último item e comparação de planos.
5. Só preparar Preview isolado após analisar conflito com homologação atual e obter autorização específica de publicação. Nenhuma flag foi ligada nesta rodada.

## Bloqueios externos preservados

G01–G12: executor legítimo de duas sessões Google, sem extração de tokens. B01–B13: customer sintético aprovado, notificações OFF, credenciais no secret store e autorização controlada. Não solicitar chaves no chat. Gemini/Meta reais e recuperação exigem configuração/autorização próprias. Franquias, assentos, termos e término de acesso continuam sem aprovação; não inventar números. Produção e PR #2 permanecem intocados.
