# Ferramentas de homologação — estado vigente

**Source final:** `c40fba9789206b0206902d966cdd1ed8c6593e71`. **Runtime preservado:** a2a3651. **READY_FOR_PRODUCTION_CANDIDATE=NO.**

O [contrato detalhado das ferramentas](HOMOLOGATION_TOOLS_1C4F4A9.md) permanece aplicável. Sua versão-base tinha 24 testes; a versão atual acrescenta verificação obrigatória da membership existente antes da API de workspace, totalizando **25/25 testes offline PASS**. [Log final](evidence/homologation-tools-c40fba9.txt).

Essa guarda usa PostgREST para confirmar a única membership owner ativa e o workspace já aprovado de cada identidade. Se faltar ou divergir, encerra antes de qualquer API que possa acionar provisionamento legado. Não cria nem repara permissões para fazer o teste passar.

| Verificação | Estado | Evidência |
| --- | --- | --- |
| Novos módulos e trava contra provisionamento | PASS | c40fba9, 25 testes offline; JWTs e respostas sintéticos, sem prova de Auth real. |
| Lint e sintaxe | PASS | c40fba9, local; nenhuma nova dependência. |
| CI das ferramentas e deploy boundary | PASS | [38986681237](https://github.com/peixotodavy831-stack/Orktoverdadeiro/actions/runs/38986681237), source c40fba9. |
| CI PostgreSQL17 da árvore final | PASS | [38986680854](https://github.com/peixotodavy831-stack/Orktoverdadeiro/actions/runs/38986680854); migrations inalteradas, nenhuma aplicação remota. |
| CLI sem credenciais/adaptadores | PASS | Sem rede, retorna BLOCKED_EXTERNAL/exit2; comportamento validado na versão-base e mantido. |
| Aquisição Google PKCE com isolamento real | BLOCKED_EXTERNAL | Adaptador/ambiente não disponibilizado; nenhuma extração do navegador. |
| Testes A/B, refresh, expiração e revogação reais | NOT_TESTED | Runtime alvo a2a3651; não são substituídos pelos 25 testes locais. |
| Escritas cruzadas e refresh reuse fora das exceções | NOT_TESTED | Cobertura ainda não implementada/executada; não é ocultada pelo executor de leitura. |
| Integração secret store/customer Asaas | BLOCKED_EXTERNAL | Preflight GET-only pronto, porém sem credencial/customer fornecidos e sem chamada ao fornecedor. |
| Homologação real Asaas e decisão de término de acesso | NOT_TESTED | Casos reais não executados; política comercial continua BLOCKED_EXTERNAL e sem alteração. |

Alterações restritas a scripts de homologação, seus testes/CI e documentação. Nenhum arquivo de src/backend/Supabase/package/server/vercel.json difere do runtime de referência nesta entrega. Não houve novo deploy, redirect, conta, workspace, grant, flag, cobrança ou mensagem. Pulso, Cost Governor, Central Econômica e os cinco planos permanecem intactos.

Para avançar externamente, continuam necessários somente o adaptador Google com sessões reais em memória e a configuração segura Asaas de teste. As decisões comerciais e as dependências Gemini/Meta/recuperação não foram presumidas nem ativadas.
