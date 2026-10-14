# ORKTO — fechamento verificável do MVP — 14/10/2026

**READY_FOR_PRODUCTION_CANDIDATE=NO. SNAPSHOT_ELIGIBLE=NO. Produção não alterada.**

Este documento substitui o cabeçalho de estado de 13/10, preservando suas evidências históricas. Não declara lançamento, contratação ou aprovação jurídica. A interface aprovada da Frente B foi preservada; as alterações de UI corrigem apenas falhas de autenticação.

## Candidato imutável e validação

- SHA do app: `d693e2f8269759485713fba9c3c2b19f6e4fbc74`.
- Preview: `dpl_6eWYnHtaNeU9Pph2g46FMBDSmw6o`, READY, `target=null`, CLI, projeto `orkto-staging` / `prj_KZm12jmZIKL3Tqnk2I9DBa9MabKc`.
- URL: https://orkto-staging-da5dotdh0-peixoto-s-projects1.vercel.app/
- API Vercel confirma SHA/projeto/target. Consulta read-only ao projeto de produção encontrou zero deployments deste SHA. Nenhuma promoção, merge main ou migration foi executada.
- [CI PostgreSQL 17 do SHA atual](https://github.com/peixotodavy831-stack/Orktoverdadeiro/actions/runs/38538394953): dois jobs concluídos com success (legacy fixture + 41 migrations; baseline semelhante ao Supabase + sequência pendente + security assertions).
- Commits posteriores de runner/documentação não devem ser confundidos com o SHA do aplicativo publicado. O runtime desse Preview só é aprovado por evidência coletada nele.
- Resumo sanitizado durável: [evidence/mvp-d693e2f.json](evidence/mvp-d693e2f.json), com hashes SHA-256 dos logs, probes e screenshots locais. Varredura final: 399 arquivos, zero findings; reteste focado do runner: 14/14 PASS. Os hashes não representam um snapshot oficial de release.

## Defeitos corrigidos nesta execução

### Retorno do launcher d693e2f — 14/10

O proprietário executou a URL/SHA corretos: 3/5 casos PASS (health, logout/revogação e WIA/proveniência/Inbox), 2 FAIL. Auth/RLS A/B e negativos de role do processo pai PASS; cleanup PASS, confirmado read-only com zero sessões/tokens dos dois usuários atuais. Browser B e adversariais finais do caso core não foram alcançados.

- Publicação: o fixture usou linha manual sem catalogItemId. A função SQL exige vínculo com serviço do workspace e conferência de nome/preço. SQL read-only encontrou exatamente uma proposta sintética recente desse teste e ela não tinha o vínculo. Corrigido o harness para criar o serviço pelo gateway e usá-lo nas duas propostas, sem relaxar SQL/Edge/grants.
- Contatos: o selector após reload procurava Decisor no diálogo inteiro. Corrigido para a linha do contato único recém-criado, mantendo count=1 e a verificação do cargo após reload. Reprodução local com dois homônimos e reload real PASS.
- O rótulo OTHER nos logs vinha de um hostname antigo fixo no diagnóstico; agora usa a origem exata configurada e continua distinguindo outros hosts.
- Sete testes focados PASS; a execução remota corrigida permanece PENDING. App/deployment/41 migrations não mudaram. Evidência completa preservada em `test-results/technical-gates-d693e2f/auth-ab-attempt-20261014/` e resumo durável em `evidence/auth-ab-d693e2f-attempt1.json`.

### Correções anteriores do app

1. Recuperação de senha recebia a sessão, mas não apresentava formulário de atualização. Agora há tela lazy para `PASSWORD_RECOVERY`, confirmação da identidade via Auth, política mínima, atualização e revogação global antes de sucesso. Marcador local/URL seleciona apenas a tela; não autoriza nenhuma escrita. Falha após a atualização oferece somente retry da revogação, sem repetir a alteração.
2. Cadastro com confirmação de e-mail era tratado como falha após tentativa indevida de login automático. Agora é um estado pendente explícito, limpa o campo de senha e não abre o produto como se estivesse autenticado.
3. Botão Google era apresentado com o provider desativado. Agora só aparece se o endpoint público de configurações Auth confirmar habilitação. Falha na consulta mantém o botão oculto e não impede e-mail/senha.
4. Recuperação por e-mail não mostrava seu erro no ramo correto e permitia reenvio simultâneo. Agora há pending, erro acessível e resposta não enumeradora.
5. Política de comprimento de senha do Supabase staging salva em 12 e reaberta para verificação visual. Confirmação de e-mail permaneceu ON; login anônimo OFF; nenhum provider pago foi ativado.
6. Site URL e único redirect permitido rotacionados do Preview anterior para o hostname imutável atual, sem wildcard. Nenhum token foi lido.

## Matriz dos gates

| Gate | Estado | Evidência e limite objetivo |
| --- | --- | --- |
| Escopo/produção/guards | PASS | Checkout de deploy limpo, projeto/ref explícitos, Preview, branch protegida. Zero deployment do SHA atual no projeto de produção por consulta read-only. |
| Regressão local | PASS | 207/207 aplicação + 44/44 ferramentas; lint/typecheck; build isolada frontend/servidor; smoke; diff check. Log em `test-results/mvp-closure-2026-10-14/`. |
| Recuperação/cadastro UI | PASS_LOCAL | Nove testes puros e harness de navegador local com componentes reais: identidade inválida, confirmação pendente, erro de rede, falha parcial e retry só da revogação. Adapter é fixture somente do teste; não é validação Auth remota. |
| Entrada Auth pública | PASS | Oito checks no SHA atual: landing → login, Google desativado oculto, senha/labels/autocomplete, recovery routing, responsivo 390/1440, foco, zero page errors. Não envia e-mail nem altera senha. |
| Preview/headers/CORS | PASS | Health/ready 200 staging; nosniff/HSTS/request-ID; anônimo 401; origem hostil 403. URL/SEO noindex e sem referência de produção. |
| Migrations/ledger | PASS | CI atual em PostgreSQL 17; staging read-only 41/41. SQL não mudou nesta execução. Schema/ledger detalhados em `READINESS_TECHNICAL_2026-10-13.md`. |
| RLS/grants/Edge | PASS_REVIEW | Read-only atual: 61 tabelas públicas com RLS, zero grants INSERT/UPDATE/DELETE para anon/authenticated. Edge v23 e SQL não alterados; paridade de fonte/revisão anterior preservada. Teste HTTP autenticado atual ainda BLOCKED abaixo. |
| SECURITY DEFINER / RLS sem policy | PASS_REVIEW | Três helpers booleanos authenticated usam auth.uid, membership ativa e search_path vazio; anon negado. Outras funções privilegiadas service-only. Doze tabelas sem policy são service-only e não concedem SELECT/DML ao browser; não adicionar policy permissiva para silenciar advisor. |
| Metadados de ambiente | PASS | Dez nomes somente Preview; nenhum service/admin/provider/billing/messaging secret. `env ls preview`, sem pull/decrypt. Readiness confirma staging e startup mantém ações externas/legais OFF. |
| Secret/log hygiene | PASS no escopo varrido | Fonte, testes, scripts e bundles isolados sem finding na varredura desta execução. Diagnósticos limitados a classes e etapas; OIDC em memória e somente na origem Preview. Admin continua fora do browser/Vercel. |
| Auditoria/observabilidade | PASS parcial | Estrutura de eventos/actor/workspace/resource/request-ID revisada. Novo request `5730efc1-aaf5-4383-8c22-24acc87787e0` aparece no log do deployment atual como `security.origin_denied`. Não equivale a cobertura autenticada completa. |
| Logout | PASS current-SHA | Caso real d693e2f passou: encerramento, refresh revogado rejeitado 400 e retorno sem sessão. Causa histórica do antigo NETWORK_ERROR não foi atribuída sem correlação original. |
| Auth A/B e isolamento HTTP | PASS parcial / E2E core FAIL | Auth/RLS A/B e negativos de role do pai passaram; core browser parou no seletor de cargo após reload, antes do browser B/adversariais finais. Harness corrigido localmente, repetição PENDING_PRIVATE_INPUT. |
| WIA/Inbox/proveniência | PASS current-SHA | Caso d693e2f de approval/rejection/replay, proveniência persistida, histórico tenant-scoped e decisões de rascunho Inbox passou. Não comprova envio externo, que continua OFF. |
| Proposta pública | FAIL fixture; reteste PENDING | HTTP 400 correto para proposta sem catálogo no fixture. Harness agora cria serviço autorizado e preserva todos os testes de versionamento/aceite/recusa/imutabilidade. Esses passos posteriores ainda não foram executados remotamente. |
| Senhas vazadas | BLOCKED_BY_PLAN | Supabase Free: proteção desativada, Pro+ requerido. Mínimo 12 não substitui consulta de senhas comprometidas. Nenhum gasto ou waiver automático. |
| E-mail de cadastro/recovery real | BLOCKED_EXTERNAL_CONFIG | Painel mostra ausência de custom SMTP. Serviço padrão restrito e limitado não comprova jornada de cliente. Exige domínio/remetente/provider aprovado e prova de entrega com destinatário autorizado. Não foi enviado e-mail real. |
| Acessibilidade/performance | PASS público / BLOCKED autenticado | Nomes/foco/overflow/console públicos aprovados. Público atual response ~3009 ms, DOM ~3767 ms; 5 JS requests. Build entry 164 kB, Auth 21,92 kB, recovery 3,69 kB lazy; WebGL continua lazy. Não é Lighthouse completo nem evidência de carga empresarial. |
| Advisors performance | REVIEW não bloqueador comprovado | 80 FK sem índice e 28 índices não utilizados INFO; uma policy auth_rls_initplan WARN. Sem gargalo medido; não criar DDL indiscriminado. |
| Recovery/rollback | ASSESSED / restore total NOT RUN | Staging reconstruível por migrations/seed, identidade owner excluída, sem negócio não sintético identificado na avaliação anterior. CI valida reconstrução de schema. PITR/restore real completo e RTO não comprovados; não prometer RPO/RTO de produção. |
| Security release checkpoint | BLOCKED | Core/proposta ainda não passaram a execução corrigida; senhas vazadas e jornada real de e-mail abertas. Logout e WIA/Inbox atuais agora têm evidência PASS. Nenhum achado foi encerrado aumentando grants. |
| Snapshot final | NOT RUN, inelegível | Sem snapshot oficial até gates obrigatórios estabilizados. Evidências locais não são snapshot de release. |

## Escopo comercial recuperado, sem reinvenção

Fontes: `docs/06_BUSINESS/COMMERCIAL_DECISIONS.md`, `ORKTO_PILOT_01.md`, specs produto/WIAOS e `docs/07_LEGAL/`. Clientes, Contatos, Catálogo, Negócios, Propostas, Inbox interno e WIA determinística com gateway/auditoria são o core. Piloto proposto: uma empresa, um workspace, um operador proprietário; Equipe não validada fica fora. Independência de modelo/canal e comandos explícitos preservadas.

PIX/cobrança real, WhatsApp/mensagem externa, paid AI, memória coletiva e cases continuam OFF. Contratação não pode prometer essas integrações ativas. Preços 79,90/149,90/299,90/599,90 e Enterprise 1499,90 são hipóteses/modelos internos, não oferta aprovada. Não publicar Founders/lifetime como decisão comercial atual. Não há autorização para ativar cobrança automática.

Termos/Privacidade públicos antigos ainda não têm aprovação registrada e descrevem integrações desligadas. Minuta factual já existe para revisão. Analytics Umami do fonte é removido de TODOS os HTMLs staging pelo build; presença no `index.html` fonte não prova coleta no Preview. Sentry staging desativado. Operação em produção permanece não inspecionada/não alterada.

## Intervenções mínimas consolidadas

Detalhes, local seguro, prioridades e critérios em `ORKTO_HUMAN_ACTION_BACKLOG.md`, SESSION_1_FINAL_STAGING. Sem perguntas durante a execução.

1. Fornecer os dois inputs de staging no launcher mascarado (ou secret store de CI restrito já autorizado). O launcher agora aponta ao SHA/URL acima. Agente executará análise/fix/reteste após receber artefatos sanitizados; não enviar chaves pelo chat.
2. Decisão de conta/plano para proteção de senhas vazadas, sem aceite automático do risco. [Pro começa em US$25/mês](https://supabase.com/pricing); confirmar cobrança efetiva antes de contratar. [Password protection](https://supabase.com/docs/guides/auth/password-security). Hook de verificação de senha exige Teams/Enterprise; validação só no frontend seria contornável pela API Auth e não fecha o gate.
3. Credencial/domínio de SMTP exclusivamente staging e destinatário de teste autorizado. [SMTP padrão](https://supabase.com/docs/guides/auth/auth-smtp) é restrito; [limites](https://supabase.com/docs/guides/auth/rate-limits) incluem 2 e-mails/hora no serviço embutido. Não copiar secret de produção.
4. Separadamente, aprovar condições do piloto, entidade/suporte/privacidade e textos jurídicos antes de cliente real. Depois do candidato técnico: SESSION_2_PRODUCTION_GO_LIVE com revisão de backup/ambiente/migration e GO explícito. UX futuro não é gate desta tarefa.

Depois: cinco casos autenticados do SHA atual → prova real de confirmação/recovery após SMTP → fechar checkpoint → snapshot com manifest/hashes/evidências. Nenhum novo deploy de app é necessário para documentação ou defaults do launcher. Se houver fix de runtime, novo SHA e revalidação obrigatória.

**Decisão: implementação avançou com defeitos reais corrigidos; aprovação técnica final e comercialização permanecem bloqueadas pelas dependências nomeadas. Não declarar 100% nem aceitar risco em nome do proprietário.**
