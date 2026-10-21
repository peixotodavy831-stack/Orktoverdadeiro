# ORKTO — diagnóstico da WIA e fluxo por objetivos

Data: 2026-10-21. Engenharia examinada: `0c74ff53e2afdaffe2bd0afa246ea9750f4eef4e`, derivada de Radar `30c2c089aaef356db3760ce68c99811d8b2b572a`. Somente leitura no staging; nenhum fornecedor acionado.

## O problema confirmado

1. **A interface aberta está antiga.** A Vercel retornou deployment READY `dpl_DVBEBHw2CRpxeZhrAFWSccFBEki4`, projeto `orkto-staging`, host `orkto-staging-21c76du92-peixoto-s-projects1.vercel.app`, runtime `cd96e879cb0f1d2cb51bba1803ed33f1a1f2d58f`. Na própria UI, Integrações, Equipe, Auditoria e Ajuda ainda aparecem indisponíveis. Não usar esse host para avaliar funcionalidades locais novas.
2. **O uso generativo não está liberado pelos pré-requisitos econômicos atuais.** Consulta GET-equivalente administrativa ao Supabase staging `ghrjongiodziasupakrk`: zero tarifas Gemini vigentes e zero políticas Pulso com expiração futura. Não foram lidos valores de segredos nem dados pessoais. A engine atual exige reserva Pulso autorizada e tarifa efetiva antes da chamada ao fornecedor. Ausência de chave/flag/workspace autorizado é outra possibilidade, que esta consulta não verifica.
3. **O comando comercial completo ainda não existe.** Em staging, `/api/wia/route-agent` delega a `PREPARE_WIA_REQUEST`. T0 possui consultas determinísticas específicas. Fora delas, Gemini recebe a mensagem e contagens agregadas, e retorna análise/rascunho estruturado. A chamada não recebe ferramentas de criação de clientes, negócios, imóveis ou propostas. Aprovar uma ação WIA existente pode criar uma tarefa interna pelo gateway; isso não transforma o texto em uma venda inteira registrada.
4. **Login Google não configura Gemini.** São integrações e autorizações diferentes. Não é correto prometer que entrar com Google ativa a inteligência generativa.

A causa exata de uma mensagem de erro anterior não foi reproduzida por inferência nesta rodada: nenhuma chamada real foi disparada. Os bloqueios acima são fatos verificados no banco/código e a lacuna funcional é comprovada pelo contrato implementado; não são um diagnóstico inventado de credencial inválida.

## Evidência de leitura administrativa

```sql
select
 (select count(*) from public.orkto_model_tariffs
  where provider='gemini' and effective_from <= now()
  and (effective_until is null or effective_until > now())) as effective_gemini_tariffs,
 (select count(*) from public.orkto_pulso_policies
  where expires_at > now()) as active_pulso_policies;
```

Resultado sanitizado: `effective_gemini_tariffs=0`, `active_pulso_policies=0`. Zero registros inseridos/alterados nesta verificação. A leitura administrativa não prova autorização de usuário final, RLS ou disponibilidade do modelo.

## Fronteiras no código

- `backend/operational-routes.ts`: rota web, autenticação e contexto de workspace existentes.
- `supabase/functions/orkto-core-mutations/_shared/wia-request.ts`: roteamento T0, configuração generativa, claim/idempotência, Pulso e tarifa antes da rede.
- `supabase/functions/orkto-core-mutations/_shared/wia-gemini.ts`: chamada limitada, sem ferramentas nem despacho externo.
- `supabase/functions/orkto-core-mutations/index.ts`: `READ_WIA_RUNTIME` só informa configuração, não valida tarifa/Pulso nem comprova inferência.

Nenhum desses arquivos foi alterado por este trabalho de frontend.

## O que a UI desta branch melhora

- Campo de pedido em Hoje: encaminha o texto à WIA para revisão, sem POST automático.
- Composer dedicado antes dos detalhes de configuração/histórico.
- Atalhos T0 preenchem a mensagem sem executar automaticamente.
- Status lido do contrato de integrações existente, sem chamar o modelo. `configured_not_verified` é explicado como configuração ainda sem validação.
- A resposta textual é priorizada sobre um eventual código de motivo.
- A tela declara que criação comercial por comando livre ainda não está disponível.

## Como organizar o fluxo desejado — proposta de produto, NÃO IMPLEMENTADA

Exemplo sintético: “WIA, preciso vender um imóvel para um cliente”. Não tratar isso como uma autorização genérica de cadastro ou envio.

| Etapa | Comportamento esperado | Proteção necessária |
|---|---|---|
| Objetivo | Entender intenção e resultado esperado | Não executar SQL/ferramenta livre produzidos pelo modelo |
| Identificação | Localizar cliente e oportunidade existentes no workspace | Não confundir homônimos; pedir escolha quando ambíguo |
| Esclarecimento | Perguntar qual imóvel, valor, prazo e dados faltantes | Não inventar imóvel, preço, telefone ou condições |
| Plano | Mostrar cliente, negócio, proposta e tarefa que seriam vinculados | Prever efeitos, fontes e campos antes de criar |
| Aprovação | Usuário revisa cada alteração proposta | Verificar papel, estado atual e validade da aprovação no servidor |
| Execução | Usar comandos tipados do Mutation Gateway | Idempotência, tenant explícito do contexto autenticado, auditoria e tratamento de falha parcial |
| Comprovação | Exibir IDs e estados persistidos e permitir abrir os registros | “Preparado”, “criado”, “solicitação aceita” e “entregue” são estados distintos |

Reutilizar WIAOS para execução/trace e contratos de ferramentas, Radar para sinais determinísticos e o desenho Playbooks R0 para checklist/revalidação. Não reimplementar detectores nem conceder owner/admin. Um catálogo de imóveis e automações externas não devem ser presumidos como existentes. O frontend desta rodada não habilita esse fluxo de escrita.

## Mínimo para um teste Gemini real posterior

1. Confirmar chave, flag e escopo de workspace exclusivamente no secret store Edge staging; não enviar chaves ao chat, Git ou Preview.
2. Aprovar uma política Pulso de homologação limitada, com workspace, teto e expiração. Não há números propostos ou inseridos nesta rodada.
3. Cadastrar tarifa efetiva conferida na conta/provedor para o modelo realmente disponível. Não inserir custo zero apenas para passar o gate.
4. Autorizar uma rodada controlada com mensagens sintéticas e limite de consumo; executar no candidato correto e registrar resultado/uso real.
5. Implementar o fluxo por objetivos em escopo separado aprovado, preservando Mutation Gateway, auditoria e aprovações. A autorização de UI não altera políticas de escrita.

`READY_FOR_PRODUCTION_CANDIDATE=NO`
