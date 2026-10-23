# ORKTO Pilot 01 — roteiro operacional, sem execução real

Estado: NOT_TESTED. Documento de preparação, não evidência de uso ou satisfação de clientes.

## Pré-condições

- Proprietário identifica a empresa participante e autoriza contas Google, workspace e papéis. Reutilizar contas aprovadas; não criar contas, permissões ou clientes reais automaticamente.
- Candidato exato, redirect, migrations e Edge vinculados ao mesmo registro de homologação. Não publicar esta branch sobre a PR #2 em homologação.
- G01–G12 com HTTP real, isolamento bidirecional e sem exportar sessões; recuperação e suporte definidos.
- Contratação, mensagens externas e inferência paga permanecem desligadas até os respectivos gates e autorizações. Dados fictícios no ensaio interno devem ser rotulados.

## Jornada observada

| Etapa | Ação da pessoa participante | Prova necessária | Estado inicial |
|---|---|---|---|
| Entrada | Login Google e retorno após reload | Conta/workspace corretos; outra empresa negada | NOT_TESTED |
| Organização | Localizar/criar cliente autorizado, identificar duplicata | ID persistido e associação correta, sem nomes ambíguos tratados como identidade | NOT_TESTED |
| Negócio | Abrir negócio ligado ao cliente e definir próximo passo | API confirma vínculo no workspace; cancelar não grava | NOT_TESTED |
| Proposta | Preparar valores e revisar antes de salvar | Cálculo determinístico, erro recuperável, persistência confirmada | NOT_TESTED |
| Radar | Consultar sinal com envio antigo e sem decisão | Datas/fontes verdadeiras, cobertura parcial explícita | NOT_TESTED |
| WIA/Playbook | Preparar recuperação elegível | Ação aguardando revisão, zero tarefa/envio antes de aprovar | NOT_TESTED |
| Decisão | Aprovar ou rejeitar com papel autorizado | Tarefa interna e auditoria confirmadas; replay não duplica; rejeitar não cria tarefa | NOT_TESTED |
| Rotina | Voltar ao cliente e concluir revisão | Resultado persistido; tarefa não equivale a mensagem entregue | NOT_TESTED |
| Conta | Consultar plano e Pulso | Saldo não configurado continua desconhecido, sem cobrar | NOT_TESTED |
| Saída | Logout e tentativa de operação sensível | Bloqueio conforme sessão/revogação e sem reaproveitar credenciais | NOT_TESTED |

## Registro por observação

Preencher somente após execução: data UTC, SHA de frontend/API/Edge, ambiente, alias pseudônimo do participante, tarefa, início/fim, conclusão ou abandono, erro, trace/request ID, necessidade de ajuda e comentário consentido. Não incluir e-mail pessoal, conteúdo de conversa, JWT, cookie ou chave.

Métricas: tempo observado por jornada, proporção concluída sobre tentativas observadas, erros por etapa, retrabalho, aprovações/rejeições e duplicações evitadas confirmadas. Baseline e resultados começam indisponíveis; não criar percentuais ou ganhos fictícios.

Custos: separar chamadas determinísticas, Pulso reservado/consumido/liberado/desconhecido, estimativa por tarifa efetiva, custo confirmado pelo fornecedor e caixa registrado. Falta de ledger não significa custo zero.

## Interrupção e recuperação

Isolamento incorreto, aprovação indevida, falso ACK ou estado financeiro conflitante interrompem a jornada afetada. Registrar incidente sanitizado e bloquear novas tentativas até análise; não ampliar permissões para contornar erro. Falha de fornecedor ambígua exige reconciliação antes de retry com chave nova.

Backup/restauração gerenciada continua BLOCKED_EXTERNAL até confirmar o recurso contratado e executar ensaio autorizado. Não fazer backup pessoal completo nem restaurar sobre staging/produção para este piloto.

## Aprovações ainda necessárias

- Empresa e participantes do piloto, acesso por papel e duração.
- Franquias Pulso, assentos, limites, termos e política de término de acesso.
- Asaas: customer sintético aprovado, notificações de todos os canais OFF, secrets no secret store, webhook e autorização B01–B13.
- Gemini: modelo/tarifa, workspace e teto de gasto autorizados antes de inferência real.
- Meta: ativos oficiais, permissões, número, modo e autorização da rodada controlada antes de qualquer mensagem externa.
- Publicação isolada e mudança de redirect quando aplicável; produção exige autorização de release separada.

Os preços mensais permanecem Start R$79,90, Pro R$149,90, Business R$299,90, Scale R$599,90 e Enterprise sob consulta. Não representam contrato de franquias ou assinatura ativa.

READY_FOR_PRODUCTION_CANDIDATE=NO.
