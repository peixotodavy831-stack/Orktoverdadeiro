# ORKTO — execução do produto consolidado R1 (27/10/2026)

**Estado: entrega integral não concluída. READY_FOR_PRODUCTION_CANDIDATE=NO.**

Fonte funcional: [PDF e matriz F01–F15/I01–I03/S01–S05](ORKTO_CONSOLIDATED_PRODUCT_REFERENCE_2026-10-27.md). Esta execução não usa o planejador financeiro como especificação do produto.

## Ambiente e fonte executada

- Worktree isolado: `Orktoverdeiro-whatsapp-e2e`; branch `codex/orkto-whatsapp-e2e`.
- Código desta rodada: `9704684039499e4da01bef93cbffcbde91c99480`, sobre `d547c9f` (adoção do PDF).
- Validação: aplicação local, fixtures sintéticas, HTTP local e build sem credenciais externas. Nenhuma evidência abaixo representa implantação ou homologação Meta.
- PR #2, outros checkouts, produção, billing, mensagens reais e inferência paga preservados. Sem push, merge ou deploy.

## Correções verificadas

|Caso|Resultado|Evidência e limite|
|---|---|---|
|F01 — assinatura discreta existente|PASS local / cobertura parcial|Símbolo e wordmark de primeira parte no rodapé da proposta pública e do Wrapped; assinatura de impressão compartilhada. Mantidos o sinal do snapshot e a regra existente que suprime assinatura impressa no plano Business. Não muda entitlements. Cartões/vitrine e renderização de um PDF impresso continuam NOT_TESTED|
|F02/S01 — troca de link público|PASS local|Link A aceito ficticiamente → B com nome vazio, aceite desabilitado, cliente/valor de B e Wrapped de B. Link indisponível não mantém cliente, nome ou aceite do anterior. Estado isolado por chave React; nenhum token real utilizado|
|F15 — ocultação após leitura|PASS local|Depois do POST confirmado, sai da lista ativa; histórico explícito permite rever até a expiração, sem apagar registros. Falha HTTP simulada mantém a instrução ativa e mostra erro. Não equivale a realtime estrito; polling existente preservado|
|F15 — escrita de leitura expirada/cross-workspace|PASS local HTTP com banco em memória|API nega registro expirado, registro de outro workspace e repetição; registro ativo permitido. Filtros de audiência existentes preservados. O double ignora o operador `or`, portanto esse teste novo não comprova sozinho audiência nem RLS real|
|Marca e layout|PASS fixture|390/768/1280px sem overflow horizontal e sem imagem de marca quebrada; duas assinaturas no fixture. `public-artifacts-desktop.png` e `sussurro-read-mobile.png`. Não é teste em aparelhos físicos|
|Orçamento sem WhatsApp cadastrado|PASS typecheck/build; NOT_TESTED visual dedicado|Removido número fictício usado como fallback; exibe “Não informado”. Não preenche cadastro nem cria contato|
|Diagnóstico das ferramentas|PASS isolado|Fixture local recebeu orçamento de inicialização de Chromium de30s e processo de120s; limites intencionais de75ms/150ms e configuração do E2E staging preservados. Tentativa anterior registrou timeout de processo e depois captura de10s em vez de150ms; não foram promovidas a PASS|

Regressão da aplicação: **402/402 PASS**. Lint/typecheck, typecheck Edge e build com inicialização do servidor: PASS. A tentativa de build em sandbox falhou com EPERM ao resolver arquivo existente; execução autorizada local completou sem alterar `dist`. Suíte final de ferramentas: **108/108 PASS**. Secret scan antes do manifesto: **711 arquivos,0 achados,0 bloqueadores**; varredura final posterior ao manifesto registrada junto às evidências. Detalhes e hashes dos logs no manifesto desta rodada.

## O que ainda impede 100%

|Grupo|Estado de aceitação integral|Pendência real|
|---|---|---|
|F01–F03: artefatos, Wrapped e case|NOT_TESTED integral / engenharia parcial|Cartão/vitrine, export visual e opt-in/revisão/publicação devem ser homologados nos fluxos reais. Benchmark setorial exige dados válidos; não publicar estimativas como resultado. Validação de30dias por período já existe no gerador de case, mas não é prova de benefício comercial|
|F04/F08: recuperação e cobrança|BLOCKED_EXTERNAL + engenharia parcial|Configurar Meta oficial, consentimento, janela/templates, números de teste, tarifas/limites e rodada autorizada. Segundo número de cobrança e negociação completa não estão comprovados. Nenhum contato ilimitado ou envio foi ativado|
|F05/F10/F12/F13: Replay, triagem, Swarm e sinais|NOT_TESTED integral|Calibração, propagação governada de estratégia, eficácia e atualização real não comprovadas por uma regressão genérica. Router determinístico não é treinamento neural MoE; sinais não são diagnóstico|
|F06: ciclo de recompra|BLOCKED validação de precisão|O próprio PDF mantém pendente: dados históricos, cold start, amostras e avaliação temporal controlada. Não inventar precisão nem habilitar disparos|
|F07: risco de inadimplência|NOT_TESTED como modelo financeiro|Engine atual representa risco operacional explicável. Não promover a score de crédito nem automatizar negativa de venda|
|F09: cliente fantasma|BLOCKED validação de precisão|Sem prova de precisão>90% nem autorização de merge automático. Revisão humana e isolamento permanecem|
|F11/F14: relatórios e Graph|NOT_TESTED integral / engenharia parcial|Agendamento, baselines, síntese real, export seguro, clustering e canvas precisam de aceitação específica. Rotas/componentes existentes não significam conclusão de todos esses requisitos|
|F15: Sussurro completo|NOT_TESTED remoto|Aceitação da audiência, expiração e leitura em duas sessões reais; sugestão WIA governada ainda não foi homologada. Uma instrução compartilhada conserva a semântica existente de `read_at`, não confirmação individual por membro|
|I01–I03/S01–S05|NOT_TESTED integral / dependências preservadas|Auditoria de preços, adaptadores contábeis, dial de confiança, histórico consentido, acabamento e memória coletiva exigem validação própria. Não assumir importação histórica disponível no provedor nem observar texto não enviado pelo cliente|
|Homologação de lançamento|BLOCKED_EXTERNAL|E2E positivo Meta e entrega/recibo reais continuam ausentes; ver [configuração controlada](ORKTO_WHATSAPP_LIVE_SETUP.md). Gates anteriores de Google/billing/recuperação não são encerrados por esta rodada local|

## Evidências

Pasta: `evidence/consolidated-product-r1-20261027/`. Manifesto com SHA, comandos, hashes dos logs e fronteira de ambiente; `visual-checks.json` com observações sanitizadas. Evidências anteriores `whatsapp-launch-r2-20261027` e replays PostgreSQL53/53 e upgrade46/46 preservados; migrations não foram modificadas ou reaplicadas nesta rodada.

O aviso de variáveis Supabase ausentes é esperado no harness sem credenciais. Não se declara console global sem erros. Fixtures não realizam aceite contratual, pagamento, postagem ou envio externo real.

**Critério de conclusão:** cada funcionalidade e infraestrutura precisa ter aceitação específica e evidência do ambiente correto; eficácia estatística, configuração de fornecedor e decisão comercial não podem ser substituídas por código local. Este relatório é registro de trabalho e bloqueios, não entrega pública ou promessa de execução em segundo plano.
