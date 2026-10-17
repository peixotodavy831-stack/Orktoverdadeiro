# Gemini provisório na WIA — implementação assistida em staging

## Fronteira

`PREPARE_WIA_REQUEST` é recebido somente pela Edge `orkto-core-mutations`, após JWT, piloto Google, membership ativa, papel, acesso comercial, feature WIA e quota. O Preview continua sem chave Gemini. Pedidos T0 continuam determinísticos; somente o restante pode usar Gemini.

Configuração por segredo da Edge, exclusivamente no projeto staging `ghrjongiodziasupakrk`:

- `WIA_STAGING_GEMINI_TESTS=ON`.
- `WIA_GEMINI_TEST_WORKSPACES`: lista explícita de UUIDs autorizados para teste.
- `GEMINI_API_KEY`: chave de teste configurada diretamente no gerenciador de segredos, nunca no repositório ou chat.

Não há fallback para outro provedor ou produção. Retirar a flag ou o workspace interrompe o acesso ao modelo. Consultar `READ_WIA_RUNTIME` informa configuração, sem revelar chave e sem declarar teste real aprovado. O OAuth Google de login é independente desta chave.

## Dados e limites

O modelo recebe somente a mensagem submetida e contagens agregadas de clientes/propostas do workspace. Não recebe contatos, valores de propostas, histórico privado ou IDs de fontes. O usuário pode incluir dados pessoais na própria mensagem: antes do teste real, usar apenas conteúdo sintético e conferir as condições da conta Google usada para teste. Não ativar cobrança de API por inferência.

Endpoint Google fixo, sem redirects, ferramentas ou execução de código; timeout 15s, 700 tokens de saída e resposta de até 64KiB. A fronteira de rede web aguarda até 25s dentro do limite existente de 30s. Uma chamada por execução, sem retry automático. Quota mensal existente e limite de 30 inícios/minuto por ator/workspace continuam vigentes. Token usage real informado pelo provedor é validado; total inclui tokens adicionais quando reportados, sem tarifação inventada.

Respostas são validadas com schema estrito. Fontes não autorizadas são removidas. Respostas livres viram rascunhos com aviso e aprovação; preço/prazo/condições exigem fonte comercial que esse caminho não possui. Opt-out e handoff são pedidos pendentes, sem declarar execução. Nenhuma ferramenta, cobrança ou mensagem externa é disparada pelo modelo.

## Idempotência e auditoria

Migration 46 adiciona fingerprint e resposta persistida à execução existente, com duas RPCs restritas a service_role e search_path vazio. `orkto_wia_claim_request` vincula o pedido à primeira entrada e consome quota uma vez; outra entrada na mesma chave gera conflito. Replay de execução em andamento/falha retorna conflito, sem repetir inferência. Sucesso só aparece após a transação de conclusão, que mantém uso, evento, ação e auditoria existentes e persiste o resultado original para replay. Membership suspensa bloqueia replay.

Uma execução interrompida pode permanecer running e consumir uma unidade de quota. Não há repetição automática; tratar como resultado inconclusivo e investigar pelo trace, sem assumir ausência de consumo no Google. Não reexecutar usando uma chave nova sem conferir a execução anterior.

## Validação desta implementação

- 9 testes novos de configuração, schema, fontes, limites de resposta, erro sanitizado, escopo tenant, replay, ausência de retry e persistência antes de sucesso: PASS local.
- Regressão da aplicação: 238/238 PASS local com localhost permitido. A primeira execução restrita teve 52 falhas de fetch dos servidores locais, sem alteração de assertions para contornar o sandbox.
- lint/typecheck PASS; readiness:build Hkdckd frontend/backend/smoke PASS com dist preservado; scan 435 arquivos/zero findings/blockers.
- Replay PostgreSQL 17, aplicação da migration/Edge em staging, candidato novo e E2E: PENDING na criação deste documento. Chamada Gemini real NOT RUN.
- Referência de contrato: https://ai.google.dev/gemini-api/docs/generate-content/structured-output?hl=en (consulta em 16/10/2026). Modelo fixado para teste: gemini-3.8-flash. Disponibilidade real depende da conta e só será comprovada por solicitação real.

## Recuperação

Desligar `WIA_STAGING_GEMINI_TESTS` preserva T0 e impede novas chamadas ao modelo. A migration é aditiva; preservar colunas e evidências. Reverter a rota web/Edge à versão anterior somente com fontes correspondentes e sem apagar execuções/uso. Nunca remover as restrições RLS/grants para fazer o teste passar.

READY_FOR_PRODUCTION_CANDIDATE=NO
