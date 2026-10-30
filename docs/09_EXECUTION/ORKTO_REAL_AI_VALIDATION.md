# WIA — validação de IA real R1

Código local `939426c`, 29/10/2026. **Geração no fornecedor: BLOCKED_EXTERNAL.** Nenhum teste com double é promovido a IA real.

## Caminho implementado

Tela → API autenticada → contexto de workspace → `PREPARE_WIA_REQUEST` → JWT/sessão piloto/membership/papel/plano → claim idempotente → rota determinística ou provider aprovado → execução persistida → chat confirmado → resposta.

Para Gemini permanecem obrigatórios: projeto staging exato, `WIA_STAGING_GEMINI_TESTS=ON`, workspace incluído em `WIA_GEMINI_TEST_WORKSPACES`, `GEMINI_API_KEY` no secret store Edge, modelo configurado, entitlement mensal, franquia Pulso e tarifa vigente do modelo. Esta rodada não alterou esses valores nem leu credenciais. Presença de chave/configuração não comprova acesso ao modelo ou aprovação comercial.

O contexto conversacional é consultado no banco por workspace+autor+sessão, no máximo 12 mensagens e 12.000 caracteres. A mensagem atual é excluída desse histórico para não duplicar o turno. Prosa antiga não concede permissões, fontes, preços ou direitos; dados empresariais vêm das ferramentas autorizadas. A resposta continua sendo rascunho quando passar pelo modelo, sem executar comandos, SQL arbitrário ou envios.

## Resultados

| Caso | Ambiente | Resultado |
|---|---|---|
| T0 sem chave e sem chamada de IA | Unitário com double | PASS |
| Configuração ausente bloqueia modelo antes do claim | Unitário com double | PASS |
| Pulso não aprovado e tarifa ausente/expirada/inválida bloqueiam inferência | Unitário com double | PASS |
| Histórico é prosa não confiável, sem tools ou fontes adicionadas | Unitário com double | PASS |
| Tokens retornados inválidos, payload grande, resposta truncada/HTTP de erro | Unitário com double | PASS |
| Timeout de fornecedor, sem retry automático | Código/contratos locais; nenhuma chamada real | IMPLEMENTED_NOT_VERIFIED no fornecedor |
| Continuidade semântica com Gemini e uso faturado | Staging/fornecedor | BLOCKED_EXTERNAL |

Timeout Edge 15s; proxy 25s; cliente 30s. O cliente não oferece cancelamento de execução no fornecedor nem streaming simulado. Uma interrupção de transporte não prova cancelamento ou ausência de custo. Replay concluído usa o resultado durável, não outra chamada ao modelo.

Fontes consultadas: [Google: generateContent e conversas](https://ai.google.dev/gemini-api/docs/generate-content/text-generation), [Supabase: alterações vigentes](https://supabase.com/changelog?types=breaking-change). O SDK de IA não foi instalado: o requisito de reutilizar os adaptadores existentes foi preservado.

Para homologação real: restaurar o acesso de gerenciamento do staging e aprovar explicitamente workspace/modelo/tarifa/franquia/limite de gasto da rodada. Credenciais somente no secret store; nunca no chat. Valores comerciais não foram inventados. **READY_FOR_PRODUCTION_CANDIDATE=NO.**
