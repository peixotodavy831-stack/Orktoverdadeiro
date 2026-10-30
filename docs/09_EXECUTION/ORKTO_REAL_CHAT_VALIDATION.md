## Checkpoint R2 — 30/10/2026

Código local final `77634fd` (base R2 `7236ba2` preservada). A R2 recupera após reload uma resposta já salva na execução, sem escrever no GET nem repetir inferência. Também prepara atualização do Inbox por eventos, OFF por padrão. A validação remota continua bloqueada. [Implementação, provas e gates atuais](ORKTO_REAL_SYSTEM_R2.md). **READY_FOR_PRODUCTION_CANDIDATE=NO.**

---

# Conversas WIA — persistência e isolamento R1

Código `939426c`, branch isolada `feat/orkto-real-system-2027`, 29/10/2026. Estado: **IMPLEMENTED_NOT_VERIFIED no staging**.

## Contratos

- `POST /api/wia/route-agent`: `message` e `sessionId` UUID; `x-idempotency-key` estável na repetição. Identidade e workspace vêm da autenticação, nunca do corpo do navegador.
- `GET /api/wia/chat-sessions`: conversas recentes do usuário na empresa atual; janela máxima de 200 mensagens para descobrir sessões, com `truncated` explícito. Não é um diretório completo de todo o histórico.
- `GET /api/wia/chat-history?sessionId=...`: até 200 mensagens recentes em ordem estável, com fontes/provedor/modelo vinculados à execução quando disponíveis. Falha de consulta retorna erro, não histórico vazio de sucesso.
- Escrita ocorre apenas no gateway já autorizado. O par autor/workspace/sessão é filtrado nas leituras; conteúdo não pode sobrescrever mensagem persistida com a mesma chave. Escrita confirmada por readback.

## Evidência local

- Testes de serviço: idempotência, conflito de conteúdo, isolamento de três dimensões, limites, T0 sem IA e reparação de gravação parcial por replay.
- PostgreSQL 17.11 descartável: **54/54 migrations**, asserções de readiness, contrato de segurança e nova asserção de privacidade. Colega da mesma empresa e usuário de outra empresa não podem ler a mensagem de A; browser não recebe INSERT/UPDATE/DELETE.
- Navegador com fixture explícita: erro, loading, envio sintético, reload, nova conversa e retorno ao histórico; 390/768/1440px e seis combinações claro/escuro. Não é E2E de banco remoto.
- [Jornadas e capturas](evidence/real-system-2027/browser/after/journeys.json). Capturas antigas com SHA-base e árvore suja são rodadas de desenvolvimento; usar o SHA e a evidência consolidada desta entrega para rastreabilidade.

O primeiro replay falhou na detecção da versão; outro ficou preso no pipe herdado pelo processo PostgreSQL. O cluster foi parado pelo caminho exato criado nessa rodada; o runner foi corrigido e a rodada final passou. Uma primeira jornada de UI falhou por procurar o nome acessível errado do campo; seletor corrigido e jornada repetida. Os eventos de falha não foram tratados como PASS.

## Pendências

Migration, Edge e frontend precisam ser publicados juntos num candidato autorizado. Não existe validação de reload com banco staging ou de privacidade PostgREST usando Google A/B neste SHA. A chave de repetição não é exportada para storage; após fechar a tela, reparação automática de resposta parcialmente gravada ainda não existe. Paginação de arquivo completo e exclusão/exportação de conversas exigem ciclo próprio de produto e retenção.

As conversas comerciais do Inbox são outro fluxo: tabela de mensagens e cursor já existem, mas Realtime privado e reconexão ainda são **PARTIAL**. Não confundir histórico WIA com mensagem de cliente Meta. **READY_FOR_PRODUCTION_CANDIDATE=NO.**
