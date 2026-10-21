# ORKTO Playbooks R0 — especificação técnica proposta

Data: 21/10/2026. **DOCUMENTAÇÃO, NÃO IMPLEMENTADO.** Base Radar R1 em feat/orkto-radar-2027, commits5738f52/2cd2844 preservados; complemento de ORKTO_PLAYBOOKS_2027_ARCHITECTURE.md. Não aprova rollout, uso generativo, política comercial, migração ou automação. READY_FOR_PRODUCTION_CANDIDATE=NO.

## 1. Recorte R0

Playbooks R0 transforma **um sinal determinístico revalidado** em uma prévia de checklist manual, no workspace autenticado. Reutiliza as funções de backend/orkto-core/radar.ts e os contratos de contexto/leitura da WIAOS; não cria uma segunda engine de sinais. O primeiro produto é “entender o sinal, conferir a evidência, abrir a entidade correta e decidir manualmente”.

Fora de R0: persistência de run/job, notificações, scheduler/cron, alteração de tarefas/negócios/propostas, aprovações executáveis, envio externo, billing, inferência generativa, reserva/consumo de Pulso e delegação offline. Não criar tabelas vazias ou migrations para antecipar R1+.

## 2. Templates allowlisted

| Template proposto | Sinal R1 / entidade | Passos visíveis na prévia |
| --- | --- | --- |
| proposal.review_unanswered.v0 | unanswered_proposal / quote | Conferir envio e decisão registrada; abrir proposta; revisar manualmente contexto/canal. |
| inbox.review_response.v0 | unattended_lead / conversation | Conferir waiting_since, SLA e mensagens; abrir Inbox; operador decide a resposta. |
| task.review_overdue.v0 | overdue_followup / task_due | Conferir due_at e estado; abrir negócio vinculado somente se existir; sem vínculo, explicar ausência de destino executável. |
| deal.review_expected_close.v0 | overdue_followup / deal_expected_close | Conferir data UTC e status aberto; abrir negócio; revisão manual da previsão. |

Templates são dados versionados no código, revisáveis. Nenhuma expressão livre, JavaScript, SQL, URL, tool name, provider ou comando fornecido por modelo/cliente. Não inventar objeção comercial, resposta recebida ou entrega a partir de ausência de registro.

## 3. Fronteira HTTP proposta, somente leitura

GET /api/playbooks/preview?template_id=<allowlisted>&entity_ref=<uuid>. Query estrita, campos desconhecidos recusados, sem payload de evidence ou workspace no corpo; workspace vem do tenant/membership resolvidos pelo middleware existente. Headers de cache private,no-store. Não chamar workspaceContext com provisionamento habilitado. Sem service_role como substituto de usuário.

Fluxo proposto:

1. Autenticar pelo caminho Google/piloto atual; resolver membership ativa e contexto de workspace. Papel/owner não é inferido de email, metadata editável, sinal ou template.
2. Carregar fatos pelo cliente JWT-bound, sempre com workspace_id; o futuro loader extraído das consultas R1 preservará seus filtros, limites, estados e testes. Extração é tarefa futura aditiva, sem reescrever detector. Não chamar a própria API por HTTP para duplicar roundtrips.
3. Invocar o detector R1 correspondente, com os limiares e relógio do servidor. O cliente só fornece template e referência; não aceita contagem, severidade, “aprovado” ou evidência recebida como fato confiável.
4. Exigir cobertura suficiente da fonte usada. Para lead com messages incompleto, responder SOURCE_INCOMPLETE sem checklist afirmando não atendimento. Entity estrangeira/ausente retorna resposta indistinguível de not-found, sem confirmar existência.
5. Se o sinal não está mais vigente (resposta, decisão, prazo ou status mudou), retornar SIGNAL_NOT_CURRENT. Um sinal visto anteriormente não garante elegibilidade atual.
6. Montar prévia declarativa dos passos de leitura/navegação. Nenhum passo é marcado executed, sent, delivered ou approved. No máximo state='preview'.

Erros propostos:401 sessão ausente/inválida;403 membership/piloto negado;404 entidade não disponível;400 template/parâmetros inválidos;409 SIGNAL_NOT_CURRENT ou SOURCE_INCOMPLETE;503 dependência/configuração indisponível. Sem transformar erro de origem em sucesso vazio. Documentar categorias finais junto da implementação; não alterar handlers atuais por esta especificação.

## 4. Contratos de dados propostos

Entrada interna: tenantContext verificado, templateId allowlisted, entityRef validado, nowMs do servidor. O frontend não escolhe ferramentas nem actor_user_id.

Resposta: version='R0', state='preview', read_only=true, workspace_context validado, template_id/version, signal {kind, entity_type/ref, severity, source}, snapshot_generated_at, coverage, evidências minimizadas e steps [{id,kind:'review_evidence'|'open_entity'|'manual_check',label,target?}], warnings e fingerprint.

Fingerprint SHA256 canônico inclui workspace, template/version, rule version, referência da entidade e fatos normalizados usados no detector (timestamps/status/prazo). Não inclui PII desnecessária, tokens ou corpos de conversa. É identificador de comparação, **não assinatura/autorização** nem garantia de replay sem revalidação. Relógio de apresentação não deve sozinho mudar o identificador; janelas de regras, se necessárias depois, serão explícitas. Colisões semânticas e mudanças de fatos devem ser cobertas por testes.

Sem tabela de runs/idempotência nesta versão: repetir GET apenas recalcula leitura, nunca repete efeito. Uma futura mutação não pode reutilizar esse fingerprint como autorização nem confiar na prévia devolvida pelo cliente; precisa gateway/idempotência e reconsulta próprios.

## 5. Reutilização da WIAOS e gateway

- backend/wiaos/core-contracts.ts e contracts.ts: trace, tenant, fontes e erros, adaptados sem tornar preview uma execução do agente.
- tool-registry.ts e t0-tools.ts: padrões de validação e ferramentas de leitura allowlisted. Leitura de dados não pode acionar memória persistente como efeito colateral.
- _shared/wia-trusted.ts: exemplo de consulta T0 validada no servidor. Não incluir provider no caminho determinístico.
- Mutation Gateway, proveniência, approval task e orkto_wia_actions: preservados como fronteira para eventual R1+. R0 não invoca APPROVE_WIA_ACTION, PREPARE_WIA_REQUEST ou comandos públicos que criem estado.
- START_WIA_RUN/COMPLETE_WIA_RUN no enum TypeScript não provam comandos públicos habilitados na Edge atual. Não usar enum como autorização.

Uma futura fase de rascunho persistente exigirá contrato próprio, vínculo confiável ao sinal, revalidação de opt-out/role, aprovação conforme efeito, idempotência por tenant e auditoria transacional. Scheduler durável exige lease/fencing e delegação revogável; nunca armazenar JWT/refresh do usuário para executar depois. Esses recursos continuam fora de R0.

## 6. UI proposta

Entrada contextual no Radar: “Revisar passos”, somente quando existir prévia homologada. Enquanto R0 é documentação, **não adicionar botão funcional fictício**. Prévia futura mostra fonte, datas UTC/fuso explicitado, cobertura, recomendação e checklist; CTA abre somente entidade do tenant. Ausência de destino para tarefa sem deal é explicada.

Loading, vazio/sinal não vigente, erro, permissão e fonte incompleta têm estados distintos. Abort/cleanup e chave de contexto impedem resposta antiga de um tenant/sessão aparecer no outro. Navegação/revisão não aparece no histórico como tarefa executada ou mensagem enviada.

## 7. Segurança, custo e observabilidade

Sem inferência, chamada externa, escrita, billing ou consumo de Pulso. Preservar os cinco planos e direitos ainda não aprovados. Traces sanitizados podem registrar categoria de resultado, contagens, duração e regra/version; não registrar tokens, telefones, texto de mensagens ou evidência completa. Nenhuma gravação de business audit é necessária para um GET R0; logs operacionais seguem a política existente.

Limites de leitura e timeouts reutilizam o padrão atual; nenhuma promessa de latência com base em benchmark em memória. Não habilitar tenant de produção nem subir permissões para satisfazer uma consulta. Dados SQL/RLS reais serão verificados separadamente.

## 8. Critérios de aceite da futura implementação

1. Mesmos fatos/limiares geram sinal equivalente ao Radar; sem detector duplicado.
2. A/B bidirecional por API e RLS, UUID forjado, membership removida, sessão ausente e token expirado negados conforme contrato.
3. Snapshot antes/depois demonstra zero usuários/workspaces/tasks/deals/quotes/jobs criados ou alterados. Nenhuma RPC de mutação/provider invocada.
4. Proposta decidida/retida/arquivada, lead respondido, tarefa concluída e negócio fechado invalidam prévia antiga.
5. Histórico parcial/consulta falha não gera checklist de conclusão falsa; evidências mantêm fontes e base temporal.
6. Repetição/concorrência de preview não cria estado; fingerprint não aceita escalada, callback/URL/tool arbitrários ou instruções vindas de conteúdo.
7. Desktop/tablet/mobile, teclado, loading/erro/vazio e mudança de contexto validados com fixtures; prova local separada de staging real.
8. Nenhum segredo/PII nos logs e nenhum consumo financeiro/generativo.

## 9. Decisão de entrega

Esta especificação prepara R0 e a reutilização, sem implementá-lo. Aprovar o recorte e executar em tarefa futura isolada após a homologação do Radar. Publicar R0 ou afirmar automação exige nova implementação, testes e autorização de ambiente. Gates G01–G12/B01–B13 e política comercial continuam abertos independentemente desta documentação.
