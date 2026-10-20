# Homologação — rollout e bloqueios reais, 20/10/2026

**READY_FOR_PRODUCTION_CANDIDATE=NO. PR #2 permanece draft, sem merge.** Este relatório prevalece sobre os checkpoints anteriores; as evidências históricas continuam preservadas.

## Atualização após autorização do proprietário

Foi salvo **somente** o novo redirect exato, após confirmação pontual: lista **17→18**, URLs anteriores e Site URL preservados. [Captura do resultado](evidence/redirect-saved-837b5e5-2026-10-20.png). A captura “redirect-pending” documenta apenas a preparação anterior.

No candidato **837b5e5 / core31**, o agente concluiu o login Google normal das identidades A e B já existentes, sequencialmente no IAB, sem intervenção adicional do proprietário ou preenchimento de credenciais. Ambas mantiveram a sessão após reload. A retornou à entrada por logout e permaneceu fora após reload; B também retornou à entrada. B apresentou seu onboarding ainda vazio, que não foi preenchido. [Evidências sanitizadas](evidence/google-ui-837b5e5-2026-10-20.json), [A após reload](evidence/google-a-reload-837b5e5-2026-10-20.png), [B após reload](evidence/google-b-reload-837b5e5-2026-10-20.png), [logout](evidence/google-logout-837b5e5-2026-10-20.png).

Consulta administrativa: antes de sair A3/B2 sessões; após sair A0/B2; após a rodada B e sua saída A0/B0. Portanto, o logout da interface revoga as sessões do usuário inteiro, preservando a outra identidade na conferência A; **não é logout local exclusivo da sessão atual**, como o runner HTTP oferece para seus próprios contextos. Memberships finais: uma owner ativa no workspace próprio aprovado por identidade, zero estrangeiras. Não foram criados usuários, empresas, papéis ou dados de onboarding.

São provas reais de **login/reload/logout da interface e observação administrativa de revogação**. Não certificam G01–G12 integrais: o transporte em contextos isolados, escritas cruzadas, refresh/reuse, expiração natural e replay dos tokens não foram executados. O bloqueio OIDC/Trusted Sources e a autorização/configuração do customer Asaas continuam pendentes.

## Identidade do ambiente

- Aplicação: **837b5e57ed7706aa08a039b22efaa94a0797d8af**, [candidato staging](https://orkto-staging-1qkrj43tb-peixoto-s-projects1.vercel.app/), deployment `dpl_5wye3rqTMK2CWscKrbPmv9HbWyke`, READY, alvo REST explícito `staging`, projeto `prj_KZm12jmZIKL3Tqnk2I9DBa9MabKc` e equipe staging verificados.
- Supabase: exclusivamente `ghrjongiodziasupakrk`; **core v31, Meta webhook v2, billing webhook v2**. Nenhuma migration nesta rodada.
- Ferramentas: **0c72508b1b42a18f23d4e39095117210a77e097d**. Esse commit modifica somente scripts/testes/CI; não é o SHA executável da aplicação publicada.
- O frontend antigo a2a3651 continua histórico; chamadas novas dele usam agora core31/Meta2 compartilhados. Não atribuir novas execuções à combinação histórica core30/Meta1.

## Trabalho concluído nesta rodada

1. Comparados os **24 arquivos** das funções remotas anteriores com a fonte a2a3651: todos equivalentes, normalizando apenas CRLF/final de linha. Rollout preservou os arquivos core e substituiu apenas `wia-request.ts`; Meta recebeu o handler e o helper de streaming/fingerprint já testados na source601e519. Readback confirmou integralmente os **22 arquivos core / 3 Meta**, versões e JWT. Core mantém verify_jwt=true; Meta mantém verify_jwt=false com autenticação HMAC própria. Não foram criados segredos, tarifas, mensagens ou permissões.
2. Publicado candidato novo a partir da conexão Git existente, com SHA fixado. CLI gerou uma tentativa BLOCKED (`dpl_TDo44ubLQ9CGu8WPoGZBupEZF2Mg`) e terminou por timeout; não foi tratada como publicação aprovada. REST recusou `target=preview` como valor de schema; `target=staging` foi aceito e ficou READY. A revisão automática rejeitou uma solicitação posterior sem alvo explícito por risco de ambiente ambíguo; essa solicitação não criou deployment. Não se contornou a rejeição nem se alterou autoria/permissões/plano para publicar.
3. Compatibilidade do verificador com o alvo REST `staging`: além de host/SHA/READY, exige ID do projeto vindo de inspeção autenticada. O runner consulta o projeto e verifica equipe, ID e nome, cruzando a listagem escopada. Produção, ambientes desconhecidos, divergência de projeto/equipe/host/SHA e origem sem vínculo continuam recusados. Inspeção real do candidato: PASS.
4. Login normal A no candidato histórico a2a3651 e sessão Asaas sandbox foram confirmados. **Não equivalem a aquisição Google nos contextos do motor HTTP.** A superfície controlável só oferece IAB e MCP Apps; os contextos Chrome do executor não aparecem nela. Nenhuma sessão existente foi extraída. A interface do candidato novo carregou, mostrou cinco planos e checkout indisponível; `/api/ready` retornou corpo `ready`, `environment=staging`, Auth reachable, e `/api/clients` recusou acesso sem sessão. Isso é observação de corpo no navegador, sem prova de status HTTP pelo motor.
5. Auditado cadastro existente denominado “Cliente Teste Orkto” no sandbox: **e-mails de notificações para cliente e fornecedor habilitados**, além de assinatura legada. Nome de teste não prova origem sintética/aprovação de todos os campos. Nenhum dado pessoal, cobrança, assinatura ou configuração desse cadastro foi modificado ou copiado para evidências. Não recriar nem cancelar a assinatura legada como parte dos cinco planos atuais.
6. Configuração não secreta salva no secret store Edge staging às **15:32 UTC**: `APP_ENV=staging`, `ASAAS_ENVIRONMENT=sandbox`, `ORKTO_BILLING_SANDBOX_ENABLED=OFF`, `ORKTO_BILLING_SANDBOX_LIFECYCLE_ENABLED=OFF`. Os quatro digests exibidos pelo painel coincidem com os valores esperados; [prova dos valores não secretos e probes posteriores](evidence/closure-flags-off-2026-10-20.json), [captura do painel](evidence/staging-billing-flags-off-2026-10-20.png). Core sem sessão continua401 e billing sem credencial503. Nenhum valor de credencial foi criado/lido; API key e webhook secret continuam ausentes.

## Matriz de gates e evidências

| Gate | Estado | Escopo / prova |
| --- | --- | --- |
| Identidade e publicação do candidato | PASS | Aplicação837b5e5, staging READY; metadados sanitizados em [closure JSON](evidence/closure-2026-10-20.json). Alvo REST staging explícito, não produção. |
| Rollout Gemini/Meta | PASS de publicação | Core31 / Meta2; readback e bundle SHA256 no mesmo JSON. Correções source601e519 agora publicadas. Não prova fornecedor real. |
| HTTP Edge sem autorização/configuração | PASS | Core sem sessão401; Meta sem assinatura401 / handshake não aprovado403; billing sem configuração503. Nenhuma persistência/fornecedor autorizados pelos probes. |
| UI pública / readiness / cinco planos | PASS limitado | Navegador com acesso Vercel existente: landing e corpo ready/staging, clientes sem sessão negados. Nenhum status HTTP de aplicação inferido a partir do DOM. |
| Ferramentas / negativas de fronteira | PASS | **66/66 offline**, [log](evidence/closure-tools-2026-10-20.txt), tools0c72508. Inclui os testes novos de inspeção. Não é E2E remoto. |
| Lint e Edge | PASS | [TypeScript](evidence/closure-lint-2026-10-20.txt), [Edge](evidence/closure-edge-2026-10-20.txt). |
| Build Google-only / smoke | PASS | [Log](evidence/closure-build-2026-10-20.txt): frontend/server/smoke true e distPreserved=true. Houve EPERM na primeira tentativa restrita e timeout transitório do smoke em outra tentativa; smoke direto e rodada final completa passaram. Nenhuma alteração no app para mascarar essas ocorrências. |
| CI ferramentas/provider | PASS | [39448519097](https://github.com/peixotodavy831-stack/Orktoverdadeiro/actions/runs/39448519097), head0c72508. |
| CI PostgreSQL17 | PASS | [39448519138](https://github.com/peixotodavy831-stack/Orktoverdadeiro/actions/runs/39448519138), head0c72508; replay/segurança/restore sintético, sem migration remota nova. |
| Secret scan | PASS | [Log](evidence/closure-secret-scan-2026-10-20.txt); zero findings/blockers. |
| HTTP automatizado na aplicação protegida | BLOCKED_EXTERNAL | Direto302 na proteção; OIDC em memória403 **TRUSTED_SOURCES_ENVIRONMENT_MISMATCH**, [diagnóstico](evidence/closure-authenticated-preview-http-2026-10-20.json). Não contar como negação Auth/RLS da ORKTO. |
| Redirect OAuth do candidato837b5e5 | PASS | Salvo após confirmação; lista17→18, Site URL e URLs anteriores preservados. [Resultado](evidence/redirect-saved-837b5e5-2026-10-20.png). |
| Google A/B login, reload e logout de interface | PASS limitado | Sequencial IAB no candidato837b5e5, sessões removidas na base, memberships próprias preservadas; [prova](evidence/google-ui-837b5e5-2026-10-20.json). Não são dois contextos HTTP isolados. |
| Google G01–G12 integrais no candidato novo | NOT_TESTED | Executor isolado sem interface controlável e transporte HTTP bloqueado. A/B existentes e aprovações preservados. G06 depende das fixtures sintéticas/observador independentes; G08 da política real de reuse e rodada de sessões separada. Não são contados como executados. |
| Asaas sessão sandbox | PASS | Domínio sandbox.asaas.com autenticado; metadata de chave habilitada e webhook desativado observados. Valores de chave não revelados. |
| Asaas ausência de notificações externas | FAIL | Cadastro de teste nominal tem e-mail habilitado; não pode ser usado na rodada protegida. Isso é configuração do fornecedor, não teste de vulnerabilidade da aplicação. |
| Asaas configuração segura / vínculo | BLOCKED_EXTERNAL | Quatro entradas não secretas salvas, flags OFF, **zero credenciais de fornecedor**. Consulta administrativa20/10 15:05:38Z: customers0, bindings0, tarifas0, políticas Pulso0. Cadastro real `cus_...`, origem sintética, workspace e autorização da rodada ainda não comprovados. |
| Asaas B01–B13 | NOT_TESTED | Nenhuma criação/alteração/cancelamento/confirmação de pagamento executada; preflight GET-only preservado e ainda não executado com credencial real. |
| Gemini / Meta reais | NOT_TESTED | Sem credenciais/configuração externa e aprovação de consumo. Nenhuma inferência paga, mensagem ou chamada Graph. |
| Recuperação real / política comercial | BLOCKED_EXTERNAL | Destino privado, escopo/Auth/Storage, retenção/RPO/RTO e direitos comerciais ainda exigem decisão do proprietário. Restore sintético histórico não os substitui. |

### Acesso Vercel e limpeza

O `vercel curl` recomendado para acesso normal gerou automaticamente um automation bypass no projeto staging antes de falhar na verificação de revogação TLS do curl Windows. Seu valor não foi impresso, gravado em evidência ou reutilizado. O token exato criado nessa chamada foi revogado imediatamente, com regenerate=false; consulta autenticada posterior confirmou **automationBypassCount=0**. Não se desativou TLS nem Deployment Protection. As tentativas seguintes usaram somente OIDC efêmero em memória, sem env pull/arquivo de credenciais e sem alterar Trusted Sources.

## Intervenções mínimas restantes

1. **Acesso de execução:** redirect já aprovado/salvo e login normal A/B comprovado, sem necessidade de repeti-los. Para o transporte automatizado, uma política Vercel precisa permitir o contexto de execução autorizado no alvo staging; qualquer mudança exige aprovação específica. Alternativamente, publicar um Preview pelo fluxo aceito da plataforma depois de resolver a ambiguidade rejeitada pela revisão automática. Não ampliar acesso a produção. O agente deve verificar o caminho escolhido e sua interface de login antes de pedir novos logins ao proprietário.
2. **Asaas:** aprovar customer exclusivamente sintético e workspace de billing. Preferir registro de teste dedicado sem contatos reais, pois o cadastro encontrado tem notificações ativas e assinatura legada. Não apagar/modificar o legado sem autorização. API key existente não pode ser recuperada pela listagem de metadata; não gerar/rotacionar chave sem confirmação. Proprietário cadastra `ASAAS_API_KEY` e `ASAAS_WEBHOOK_SECRET` diretamente no secret store staging; nunca no chat. Seguir o [roteiro exato](ASAAS_SANDBOX_OWNER_SETUP.md). Conferir todos os canais OFF via preflight antes de autorizar B01–B13 e habilitar flags somente na rodada autorizada.
3. **Decisões comerciais e integrações:** aprovar franquias/assentos/limites/término de acesso e escopo de consumo Gemini, configuração Meta de teste e destino/escopo de backup. Não preencher decisões com números inventados. Os cinco planos permanecem Start79,90 / Pro149,90 / Business299,90 / Scale599,90 / Enterprise sob consulta.

Não é necessário repetir o login normal A ou o login Asaas. O agente concluiu publicação, compatibilidade, regressões afetadas, CI e documentação disponíveis; a homologação integral **continua incompleta**. Pulso, Cost Governor, Central Econômica e evidências E2E anteriores preservados. Produção, usuários/papéis, preços e contratos não foram modificados.
