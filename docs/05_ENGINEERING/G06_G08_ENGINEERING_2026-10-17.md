# G06/G08 — engenharia concluída, execução real pendente

**READY_FOR_PRODUCTION_CANDIDATE=NO.** Source das ferramentas: `40fcfdcc6effb6d2bd32f875e39e4e81b30b1e29`. Runtime alvo preservado: `a2a3651319196ffc56813992f705692d368ef967`. PR #2 aberta, sem merge.

Esta atualização sucede o [checkpoint ac93bd5](REAL_GATES_CHECKPOINT_2026-10-17.md): as lacunas de cobertura G06/G08 foram implementadas no motor existente. Seus resultados reais permanecem NOT_TESTED. Nenhum arquivo da aplicação, Edge, migration, package ou Vercel difere do runtime alvo nesta alteração; não houve implantação.

## G06 — escrita cruzada com observação independente

`runGoogleAbTransport` recebe opcionalmente `crossTenantWrites`:

- `A` e `B`: `{id, ownerApproved:true, exclusivelySynthetic:true}` para clientes sintéticos já autorizados nos workspaces existentes. IDs distintos e UUIDs válidos. Não cria nem aprova clientes, usuários, workspaces ou papéis automaticamente.
- `inspect({project,ids})`: adaptador administrativo **somente de leitura**, autorizado, que devolve as duas linhas completas atuais de `clients` exclusivamente para esses IDs. O motor não fornece tokens ou chaves a esse callback. Não usar leitura do atacante como prova de persistência. Credencial administrativa continua sob responsabilidade do executor/secret store, nunca entra no relatório.
- O baseline exige ownership exato, `archived_at=null` e nome com prefixo `ORKTO-G06-`. Flags são atestações do operador; prefixo e booleans não substituem auditoria/aprovação real da origem sintética.
- Antes de escrever, cada owner lê seu cliente por API. Cada tentativa exige sessão válida e guarda sensível ativa antes/depois. Isso evita certificar isolamento usando uma sessão já encerrada.

Por direção A→B e B→A, são cinco tentativas de alterar somente `name`: PATCH API com header próprio e estrangeiro; comando Edge `UPDATE_CLIENT` com os mesmos dois headers; PATCH PostgREST com filtro exato do ID e `return=representation`. Nenhum INSERT, DELETE ou alteração de ownership/permissões.

Após **cada** tentativa, inclusive timeout, o observador compara as duas linhas completas com o baseline. HTTP de negação sem estado inalterado não é PASS. Resposta genérica de proteção Vercel/404 sem contrato ORKTO não certifica a negação. PostgREST pode negar por grant/RLS ou devolver representação vazia; isso é comportamento permitido, não uma vulnerabilidade.

Se houver alteração indevida, registra FAIL e interrompe novas tentativas. Só tenta restaurar `name` pelo owner legítimo se a alteração corresponder exatamente ao marcador enviado e não houver mudança em outros campos, salvo `updated_at`. Releitura independente confirma restauração dos campos, tolerando apenas o novo timestamp. A falha de segurança continua FAIL mesmo após recuperação; timestamp e auditoria não são apagados. Mudança concorrente, ownership alterado, observador indisponível ou recuperação não confirmada exigem revisão manual; o motor não sobrescreve estado desconhecido.

## G08 — reuse fora das exceções

Opt-in `refreshReuse:true` e callback read-only `verifyRefreshPolicy()` retornando `{project:'ghrjongiodziasupakrk',rotationEnabled:true,reuseIntervalSeconds}`. O operador deve obter esses valores da configuração real de Auth, sem alterá-la. O motor não presume os dez segundos padrão. Política desconhecida, rotação desligada ou intervalo fora do limite de ensaio 0–120s: BLOCKED_EXTERNAL, não vulnerabilidade.

1. O refresh normal avança R0→R1; o ensaio avança R1→R2. Os três tokens precisam ser distintos e pertencer à mesma sessão Google aprovada.
2. Espera o intervalo configurado mais 2s, em fatias de até 30s e com relógio real em STAGING. JWT com vida insuficiente para o ensaio bloqueia esse caso; não altera TTL nem simula expiração.
3. Reutiliza R1, o pai do ativo R2: exige retorno legítimo do ativo e mesma sessão. A exceção é validada, não denunciada como falha.
4. Espera novamente a janela mais margem, confirma a guarda sensível ativa e reutiliza R0, que não é pai nem ativo. Exige erro Auth conhecido; timeout, 429 ou erro genérico não prova rejeição.
5. Exige rejeição também do refresh ativo R2, negação do JWT ainda não expirado em API/Edge/PostgREST e guarda sensível false. Confirma que a sessão B continua válida após o caso A.

G08 pode revogar a família de refresh da sessão sob teste. Não pode ser combinado com `revokeCurrentSessions:true`: G10 de logout exige rodada separada com nova autenticação Google legítima, reutilizando as mesmas contas/papéis. Não há relogin implícito nem logout global. Tokens e ancestrais ficam somente em memória e não aparecem em evidências.

Semântica conferida na [documentação oficial de sessões Supabase](https://supabase.com/docs/guides/auth/sessions): intervalo e parent exception são legítimos; fora deles o reuse encerra a família. JWT criptograficamente válido pode exigir consulta de `session_id` para negar operações sensíveis após revogação.

## Validações e ambientes

| Gate | Estado | Evidência / ambiente |
| --- | --- | --- |
| G06/G08 implementados no motor existente | PASS | Source 40fcfdc, somente ferramentas. |
| Testes de ferramentas | PASS | **39/39**, Node local FIXTURE; [log](evidence/g06-g08-tools-tests.log). Inclui os 25 anteriores, 14 novos; nenhuma credencial/HTTP staging. |
| Deploy boundary / preflight Google | PASS | **22/22**, local; [log](evidence/g06-g08-deploy-boundary.log). |
| Lint/typecheck e sintaxe dos dois módulos | PASS | `npm run lint` exit0; `node --check` exit0. JS de readiness também executado pelos testes. |
| Build Google-only isolado | PASS | [Build + smoke](evidence/g06-g08-build.log); frontend/backend/metadata/runtime=true, distPreserved=true. Primeira tentativa restrita falhou EPERM/realpath; repetição autorizada concluiu. Não é build publicado. |
| Secret scan | PASS | [Log](evidence/g06-g08-secret-scan.log); nenhum finding/blocker. |
| CI do source exato | PASS | [Deploy boundary + 39 testes](https://github.com/peixotodavy831-stack/Orktoverdadeiro/actions/runs/39075890884), [PostgreSQL17](https://github.com/peixotodavy831-stack/Orktoverdadeiro/actions/runs/39075890867), head 40fcfdc; não substitui Auth ou Asaas reais. |
| Aquisição Google PKCE isolada | BLOCKED_EXTERNAL | Nenhum adaptador autorizado conectado; não houve extração nem novo login. |
| G01–G12 reais, inclusive G06/G08 | NOT_TESTED | Alvo a2a3651; cobertura local não satisfaz esses gates. |
| Customer/secret store/notificações Asaas | BLOCKED_EXTERNAL | Última inspeção real 17/10/2026: zero customers/custom secrets; nenhuma nova inspeção de fornecedor alegada nesta entrega. |
| B01–B13 | NOT_TESTED | Preflight GET-only preservado, fornecedor não chamado. |
| Política comercial de término | BLOCKED_EXTERNAL | Não aprovada nem implementada por presunção. |

## Investigação do adaptador PKCE

O contrato de aquisição permanece `acquireContexts()`, duas sessões de Google PKCE distintas, SDK sem auto-refresh e storage exclusivamente em memória, com `dispose()`. Na superfície conectada IAB, controle de abas não fornece criação de dois browser contexts independentes nem entrega do callback PKCE ao processo HTTP; a descoberta de ferramentas não encontrou `browserAuth`/executor OAuth compatível. Nenhum adaptador real está no checkout; os únicos chamadores de `acquireContexts` encontrados são os testes sintéticos.

Um executor legítimo precisaria manter verifier, code e troca de sessão no próprio fluxo normal, com intervenção humana para login/2FA, mantendo A/B em contextos separados. A [documentação PKCE Supabase](https://supabase.com/docs/guides/auth/sessions/pkce-flow) fundamenta essa troca. O SDK instalado não fornece por si só isolamento de navegador ou intervenção interativa. Não conectar a perfis existentes via CDP, extrair localStorage, exportar storageState/HAR/trace ou encaminhar codes/tokens pelo chat. Um callback loopback novo exigiria redirect autorizado; nenhum foi adicionado para contornar o bloqueio.

Próxima intervenção mínima: identificar/disponibilizar executor de autenticação isolada compatível, não recriar A/B nem aprovar seus papéis novamente. Fixtures G06 e observador precisam ser identificados e auditados antes de habilitar a opção; sem isso, o caso fica NOT_TESTED.

## Preparação Asaas e preservação comercial

[Passos exatos do proprietário](ASAAS_SANDBOX_OWNER_SETUP.md). Checkout e flags permanecem fechados; segredos nunca são solicitados no chat. Nenhuma execução B01–B13 alegada.

Mantidos exclusivamente Start R$79,90, Pro R$149,90, Business R$299,90, Scale R$599,90 e Enterprise sob consulta. Pulso, Cost Governor e Central Econômica intactos, sem novas franquias, assentos, tarifas ou direitos. Gemini, Meta e recuperação real continuam rastreados no roteiro canônico, sem mensagens/inferência paga/compra/produção.
