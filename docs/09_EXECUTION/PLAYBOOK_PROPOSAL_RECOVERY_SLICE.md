# Playbook proposal_recovery — primeira fatia governada

## Contrato implementado nesta branch

Pedido exato na WIA: `Preparar recuperação da proposta <UUID>`.

1. API WIA e Mutation Gateway existentes verificam sessão Google/piloto, membership, plano e quota WIA. Nenhum novo papel ou permissão.
2. O dispatcher determinístico aceita somente intenção completa + UUID. Não interpreta instruções vindas de nome do cliente ou proposta.
3. Consulta `orkto_feature_configs` no workspace, exigindo `proposal_recovery=ACTIVE`. O padrão continua desligado; esta entrega não habilita configuração alguma.
4. Lê uma proposta com workspace + ID + não arquivada. Reutiliza `detectUnansweredProposals` do Radar: envio válido, espera mínima de 48h, sem decisão, retenção vigente.
5. A claim/finish WIA existente vincula fingerprint, quota, fontes, ferramenta, zero tokens, idempotência e auditoria. O resultado é `send_proposal_followup` aguardando aprovação, não tarefa executada.
6. Owner/admin/manager usam APPROVE_WIA_ACTION existente. A RPC `orkto_wia_decide_command` cria somente tarefa interna com chave `approved-action:<actionId>` e registra o resultado. Rejeitar não cria tarefa. Não envia mensagem, cobra, reserva Pulso ou chama IA.

A proposta é um snapshot de consulta. A tarefa pede revisão do estado atual antes de qualquer contato; não representa um follow-up já enviado. Não há revalidação de elegibilidade na decisão SQL nem agendamento automático nesta fatia. Não anunciar automação de contato.

## Interface

WIA → Pedido → Recuperar uma proposta sem resposta. O ID é validado e preenche o composer. O usuário envia o pedido separadamente e revisa a sugestão em Aprovações. A interface atual exige o UUID; seleção contextual a partir da proposta/Radar é a melhoria seguinte, sem criar uma segunda engine.

## Evidência e limites

PASS_LOCAL: parser estrito, limiar exato, estados inválidos, filtro de tenant, gate desligado, erro de leitura, replay, falha de commit, zero inferência e zero criação de tarefa antes da aprovação. Testes com doubles dos contratos existentes, não banco remoto.

PASS_LOCAL visual: ID inválido produz erro; UUID preenche o campo sem envio. `evidence/launch-2027/wia-playbook-draft-1280.jpg`, localhost:4177, fixtures.

NOT_TESTED: ciclo completo com SQL real, aprovação/rejeição e replay de tarefa em PostgreSQL desta branch; sessão Google real; publicação Edge. Nenhuma migration/grant foi alterada. Reusar os asserts SQL existentes em PostgreSQL 17 descartável antes de homologação remota.

Não ativar no staging sem revisar o candidato de homologação, ambiente, migrations, deployment e autorização. READY_FOR_PRODUCTION_CANDIDATE=NO.
