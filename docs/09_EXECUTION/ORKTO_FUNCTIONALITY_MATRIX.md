# ORKTO Real System — matriz R1

29/10/2026. Código local `939426c`. `REAL_VERIFIED` nesta tabela exige ler a coluna ambiente: comprovação em PostgreSQL local ou teste com double não é comprovação staging/fornecedor.

| Funcionalidade/gate | Estado | Ambiente/evidência | O que falta |
|---|---|---|---|
| WIA determinística e fontes por tenant | REAL_VERIFIED | Testes de serviço/T0 locais | Homologação HTTP A/B no candidato |
| Chat WIA persistente via gateway | IMPLEMENTED_NOT_VERIFIED | Unidade + SQL local + UI fictícia separados | API→Edge→staging→reload real |
| Chat privado por autor e empresa | REAL_VERIFIED | PostgreSQL17, migration54, asserção negativa | Aplicação autorizada e PostgREST A/B remoto |
| Repetição e gravação parcial | REAL_VERIFIED | Double de persistência; execução não repetida | Falha controlada em staging |
| IA generativa real e continuidade | BLOCKED_EXTERNAL | Adaptador existente; nenhuma inferência feita | Configuração segura + autorização de gasto |
| Cancelar inferência em andamento | NOT_IMPLEMENTED | Nenhum botão promete cancelamento | Contrato/garantia do fornecedor e contabilização |
| Streaming de tokens | NOT_IMPLEMENTED | Resposta completa, loading verdadeiro | Implementar somente se suportado/aprovado |
| Recuperar retry parcial após fechar a página | PARTIAL | Retry estável enquanto a instância da tela existe | Reconciliação durável pelo gateway |
| Fila e mensagens comerciais persistidas | IMPLEMENTED_NOT_VERIFIED | Backend/cursor/gateway existentes, regressão local | Recepção Meta real no candidato |
| Realtime privado/reconexão no Inbox | PARTIAL | Fila atualizada em30s quando visível; sem subscription | Engenharia e validação local antes do gate remoto |
| Webhook Meta/HMAC/deduplicação/recibos | IMPLEMENTED_NOT_VERIFIED | Testes locais + evidência histórica separada | Configuração e E2E oficial atual |
| Envio e receipt Meta reais | BLOCKED_EXTERNAL | Não executado | Assets/consentimento/limites e autorização específica |
| Clientes, negócios e propostas via Mutation Gateway | IMPLEMENTED_NOT_VERIFIED | Contratos/API com doubles + SQL local | CRUD com banco real autenticado no novo SHA |
| CRUD na prévia visual | DEMO_ONLY | Fixture identificada; não altera registros reais | Não usar como validação operacional |
| Radar leitura e limiares | REAL_VERIFIED | Suite local da engine preservada | Endpoint autenticado remoto no candidato |
| Playbook→aprovação→tarefa interna→auditoria | IMPLEMENTED_NOT_VERIFIED | Gateway/T0/SQL existentes, sem envio implícito | Fluxo integrado em staging |
| Google PKCE/persistência/revogação/isolamento G01–G12 | BLOCKED_EXTERNAL | Identidades existentes preservadas; nenhum login repetido | Executor autorizado com dois contextos reais |
| Asaas B01–B13 | BLOCKED_EXTERNAL | Adaptador e preflight existentes, sem cobrança | Customer sintético aprovado, canais OFF, secrets, autorização |
| Pulso, Cost Governor e Central Econômica | IMPLEMENTED_NOT_VERIFIED | Bloqueios locais preservados | Franquias/tarifas/políticas aprovadas e execução remota |
| Backup/restauração gerenciada | BLOCKED_EXTERNAL | Nenhuma operação remota realizada | Disponibilidade/plano/restore drill autorizado |
| Lint/Edge/build/regressão/secret scan | REAL_VERIFIED | Evidência local consolidada | CI remoto e homologação do deployment são gates distintos |
| Publicação e venda pública | BLOCKED_EXTERNAL | Sem deploy/merge; PR2 continua draft | Encerrar todos os gates e obter autorização explícita |

Catálogo preservado: Start R$79,90; Pro R$149,90; Business R$299,90; Scale R$599,90; Enterprise sob consulta. Sem novas franquias, assentos, tarifas ou política de término de acesso.

Não foi comprovada uma vulnerabilidade nova em produção ou no staging; a política ampla de chat foi identificada na fonte e corrigida localmente. O staging atual não foi reinspecionado nesta rodada.

**READY_FOR_PRODUCTION_CANDIDATE=NO.** [Auditoria](ORKTO_REAL_SYSTEM_AUDIT.md) · [Execução seguinte](ORKTO_REAL_SYSTEM_NEXT.md).
