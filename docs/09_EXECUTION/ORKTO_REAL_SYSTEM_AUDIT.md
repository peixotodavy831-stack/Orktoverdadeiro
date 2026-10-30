## Checkpoint R2 — 30/10/2026

Código local final `77634fd` (base R2 `7236ba2` preservada). A R2 acrescenta recuperação por leitura da execução persistida e adaptador de eventos do Inbox, sem habilitação remota. As lacunas descritas abaixo para a R1 são históricas; consultar o checkpoint R2 para o estado vigente. [Implementação, provas e gates atuais](ORKTO_REAL_SYSTEM_R2.md). **READY_FOR_PRODUCTION_CANDIDATE=NO.**

---

# ORKTO Real System 2027 — auditoria de execução R1

29/10/2026. Código local: `939426c`, branch `feat/orkto-real-system-2027`, worktree `Orktoverdeiro-real-system-2027`. Base `c4983ac3571e75f4fa4f00a6d9c0b3c8fa536d67`. **Missão integral ainda parcial; READY_FOR_PRODUCTION_CANDIDATE=NO.**

## Preservação e fontes

[Inventário dos worktrees, HEADs e acessos](evidence/real-system-2027/preservation-and-access.json). O checkout original continua com 54 caminhos locais pendentes; nenhuma alteração dele foi incorporada ou descartada. Os demais trabalhos foram inspecionados por Git e documentos, sem checkout forçado, clean, reset ou stash. A branch nova parte da consolidação UX, que contém a branch atual da PR2 como ancestral. A consulta autenticada ao GitHub confirmou PR2 OPEN/draft no HEAD `78497da5bfd52166c6852aa14c06ebbf84fa1248`; ela não foi alterada.

Referências vigentes: `ORKTO_LAUNCH_2027_MASTER.md`, `ORKTO_LAUNCH_2027_NEXT.md`, `WHATSAPP_E2E_RESULT_2026-10-26.md`, `../05_ENGINEERING/STAGING_CLOSURE_2026-10-20.md`, código de `backend/wiaos`, Radar e Playbooks. Resultados antigos permanecem históricos e não comprovam este candidato.

## Causas encontradas e correções

1. A tela WIA chamava `/api/wia/route-agent` sem sessão de conversa e mantinha apenas a resposta atual em React. A tabela de chat e o endpoint de leitura já existiam, mas o caminho de staging pelo gateway não gravava conversas. Integrados os caminhos existentes, sem outro framework ou novo provedor.
2. Histórico ganhou seleção de conversa, nova conversa, reload, estados de erro/loading, janela limitada e respostas vinculadas à execução/fontes. O histórico enviado ao modelo vem exclusivamente do banco, filtrado por workspace, autor e sessão. Não aceita histórico do navegador como evidência empresarial.
3. Repetição reutiliza a chave da operação. Gravação é seguida de leitura de confirmação; falha parcial não retorna sucesso. Replay de execução concluída pode reparar o histórico sem repetir inferência. A chave de retry fica apenas na instância da tela; recuperação automática de retry após fechar a página ainda não foi implementada.
4. A política antiga de chat permitia leitura por colegas do mesmo workspace. Migration `20261029224850_wia_private_chat_history.sql` restringe leitura ao autor com associação ativa à empresa, mantém escrita do navegador revogada e adiciona índice para histórico recente. **Somente aplicada em banco descartável local.**
5. Pulsos/tarifa já bloqueavam a geração no Edge, mas seus códigos eram mascarados pelo proxy. Preservados os bloqueios e adicionados motivos específicos. Nenhuma tarifa, franquia, chave, permissão ou inferência real foi criada.
6. O wrapper local PostgreSQL recusava a saída legítima `postgres (PostgreSQL) 17.11` e prendia a captura do processo filho na inicialização. Corrigidos os dois problemas; replay completo e asserções de segurança passaram em cluster descartável, encerrado e removido pelo próprio runner.

## Limites reais

- O endereço `tests/visual/index.html` é uma demonstração explicitamente fictícia. O reload nessa fixture usa `sessionStorage` exclusivo de teste; o aplicativo usa API/banco. Não há armazenamento de tokens de teste em evidências.
- Conversas comerciais já têm persistência, cursor estável, gateway e recibos. A fila da interface ainda consulta a cada 30 segundos quando visível; **Realtime privado/reconexão entre dois navegadores não está concluído**.
- WhatsApp oficial, assinatura HMAC, vínculo WABA/telefone e aprovação interna existem, mas o ciclo real Meta não foi executado nesta rodada. Não houve mensagem enviada.
- A geração assistida segue restrita ao staging, workspace permitido, secret server-side, quota, Pulso e tarifa vigente. Não foi habilitada em produção. Nenhuma resposta desta rodada veio de inferência paga.
- CRUD e gateway foram preservados e regredidos com doubles e SQL local. Não foram novamente homologados com as identidades Google A/B no staging.
- O conector Supabase exige vínculo `link_id` indisponível; o CLI está sem sessão de gerenciamento. Logo, a configuração remota atual não pôde ser reinspecionada. Isso **não prova ausência de secrets no projeto**.
- CI remoto não foi executado. O replay local inclui asserções usadas pelo CI, mas não é uma execução GitHub Actions.
- O build mantém aviso de chunk acima de500KB. O tempo percebido em celular físico e com rede limitada não foi medido; seis verificações de layout não comprovam desempenho de produção.

## Evidências e continuação

[IA](ORKTO_REAL_AI_VALIDATION.md), [chat](ORKTO_REAL_CHAT_VALIDATION.md), [WhatsApp](ORKTO_WHATSAPP_E2E.md), [matriz](ORKTO_FUNCTIONALITY_MATRIX.md), [próximos passos e autorizações](ORKTO_REAL_SYSTEM_NEXT.md). Sem push, deploy, merge ou mudança em produção. Guard de deploy automático da nova branch está OFF.
