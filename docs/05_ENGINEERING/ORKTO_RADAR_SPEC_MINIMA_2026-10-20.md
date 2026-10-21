# ORKTO Radar R1 — contrato integrado à fonte atual

Data: 21/10/2026. Branch exclusiva feat/orkto-radar-2027, base origin/production-readiness/google-only-pilot-preflight **78497da5bfd52166c6852aa14c06ebbf84fa1248**. Recuperação seletiva do trabalho local bff22b7, preservado integralmente fora desta branch. **Somente leitura, sem implantação. READY_FOR_PRODUCTION_CANDIDATE=NO.**

## Contrato R1

GET /api/radar usa authenticate existente, banco disponível e membership ativa já provisionada. workspaceContext(..., false) impede qualquer provisionamento/owner implícito. Todas as consultas usam req.authenticatedSupabase (fallback de construção para testes locais), com workspace_id explícito inclusive em mensagens. Nunca usa owner_user_id como substituto de tenant. Cache-Control private,no-store. Nenhuma escrita, RPC, provider, cron, cobrança ou inferência.

Envelope: data contém version='R1', read_only=true, generated_at ISO UTC, counts, signals e coverage {partial,limited_sources,leads_evaluated}. Cada sinal tem ID estável, kind, severity, title, recommendation, entity_type/ref, evidence, suggested_view; source diferencia task_due de deal_expected_close. action_query.dealId apenas quando existe vínculo de tarefa/proposta. Uma tarefa sem negócio não abre seu task ID como negócio.

## Regras e limiares

- **Proposta sem decisão registrada:** status sent/viewed/pending, sent_at válido, sem approved_at/rejected_at, archived_at ausente e retenção válida. Limiar >=48h desde envio; alta >=168h. Visualização só é considerada se entre envio e agora; texto não presume objeção nem ausência real de leitura. Aprovação/rejeição/expiração/arquivamento excluem. Ausência de decisão é um proxy do estado da proposta, não prova de ausência de resposta por todos os canais.
- **Conversa aguardando resposta registrada:** open/active, ao menos uma mensagem incoming pendente após a última outgoing persistida. Espera começa na mais antiga dessa sequência, não reinicia com novas mensagens. SLA priority_triage.slaMinutes, default60, clamp5–1440 e fallback para NaN/tipo inválido. Prioridade alta >=max(SLA,240min). evidence.response_scope distingue first_response e next_response. Read_at e mensagens internal não contam como atendimento. Criação de conversa sem mensagem inbound não prova lead aguardando resposta. Mensagem relevante inválida/futura impede inferência nessa conversa. Outgoing persistida não é comprovante de entrega externa; evidence.response_basis explicita isso.
- **Tarefa vencida:** open/in_progress, due_at válido estritamente anterior ao instante e completed_at ausente; alta >=7dias. Não inventa produtor ou prazo. Tarefa WIA pode existir sem due_at e não será sinalizada.
- **Fechamento previsto ultrapassado:** negócio open, expected_close_on calendário válido; vencido após fim do dia UTC explicitado na fonte/UI. É um prazo de negócio, não uma tarefa de follow-up criada. Alta >=7dias; datas inválidas, mesmo dia ou futuras não sinalizam. Não aplica fuso comercial não configurado.
- Limiares opcionais das funções puras são validados/limitados. API não aceita override por query/body. Sinais ordenados por prioridade, maior tempo e ID; máximo25 por categoria, até75 retornados, seis inicialmente exibidos com quantidade retornada explícita. São contagens da consulta limitada, não totais de toda a empresa.

## Completude e falhas

Limites de leitura: quotes200, conversations250, tasks200, deals500, messages1000. Atingir um limite marca coverage.partial conservadoramente, mesmo se a quantidade coincidir exatamente. Mensagens no limite tornam leads_evaluated=false e suspendem os sinais de conversa; não se conclui falta de atendimento a partir de histórico truncado. A UI exibe a limitação e não converte zero parcial em operação integralmente saudável. Falha de qualquer consulta retorna erro, sem snapshot vazio de sucesso. Ausência legítima de registros retorna listas vazias.

## UI e integrações preservadas

TodayV2Page recebeu somente import/composição de TodayRadarPanel: a versão atual da página, navegação e superfícies de vidro fosco foram mantidas. Painel tem carregamento, indisponibilidade, erro, offline, configuração e permissão; valida o envelope e ignora resposta assíncrona de sessão antiga. Nenhuma falha no Radar derruba Inbox/WIA/negócios. Destinos reusam os callbacks atuais; não há botão de envio/execução.

WIA/WIAOS não são chamados por R1. Sem consumo/reserva de Pulso, tarifa ou alteração de ledger/Cost Governor/Central Econômica. Os cinco planos e preços permanecem intactos. O produtor WIA atual de tarefas via gateway continua existente; R1 não o altera.

## Próximo recorte Playbooks — apenas preparação arquitetural

Referência: ORKTO_PLAYBOOKS_2027_ARCHITECTURE.md. Sinal R1 é uma observação transitória, não autorização, job ou prova de evento ocorrido. Para uso futuro: reconsultar entidade no workspace no servidor, versionar regra e janela/fingerprint, verificar opt-out e papel, deduplicar por workspace+entidade+tipo+janela, preparar ação exclusivamente pelo Mutation Gateway. Não confiar em evidence enviada pelo cliente como proveniência confiável. Exigir nova aprovação conforme efeito, validar novamente no momento da execução e aplicar Cost Governor/Pulso somente se houver consumo aprovado. Não habilitar automações, polling persistente, notificações, escrita em customer_signals ou envio externo nesta versão.

## Validação

Resultados e limites no relatório ORKTO_RADAR_R1_INTEGRATION_2026-10-21.md. Testes de rota em banco em memória não certificam RLS remoto, Edge, Google A/B ou homologação do candidato de staging.
