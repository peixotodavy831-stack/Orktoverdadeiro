# Real System R4 — staging reconectado e Edge core33

**Atualização vigente:** o transporte está resolvido no [Preview normal do projeto staging](https://orkto-staging-frefbzvte-peixoto-s-projects1.vercel.app), deployment `dpl_3ntLY4HfcFBHvNXy2bC86TanwctV`, mesmo runtime389a9c8, target null/Preview, READY. HTTP real com OIDC/TLS: health200, ready200, clients sem sessão401. [Recibo](evidence/real-system-2027/r4/normal-preview-http.json). O target literal staging anterior era um ambiente personalizado inexistente. A regra development→staging foi autorizada pelo proprietário, mas a API recusou esse ambiente; nenhuma regra foi alterada. Publicar Preview no projeto staging reutilizou o acesso padrão e resolveu a causa sem ampliar permissões. As referências ao403 abaixo são o diagnóstico histórico do target incorreto.

Ferramentas atuais `3fd27efda689edf77b5f76bc4600fe042b08f483`: API/RLS/Edge apontam para o Preview novo, enquanto o executor PKCE reutiliza exclusivamente o callback previamente aprovado1qkrj43tb, interceptado no contexto que criou o verifier. Não redirecionar sessões para o runtime antigo nem contar a UI OAuth do frontend novo como validada. Testes de callback/origin incorretos passaram com os demais38 testes focados. Chrome iniciou aquisição A, com login/2FA humano necessário; B abre depois. G01–G12 permanecem NOT_TESTED enquanto a execução real não terminar. Nenhuma conta, workspace ou role foi recriada. G06 encontrou zero fixtures `ORKTO-G06-` nas empresas autorizadas; a rodada iniciada não declara escrita cruzada validada. G08 exige rodada separada de reuse e configuração de rotação verificada, não uma suposição de defaults.

**Handoff Google atual:** a primeira invocação foi encerrada a pedido de reabertura visível, sem registro de identidade adquirida. Executor existente reaberto em PowerShell visível; Chrome de teste localizado e trazido à frente pela janela retornada pelo helper nativo. Seu título mostra “Não foi possível fazer o login”. Nenhum formulário de autenticação foi preenchido pelo agente; solicitado ao proprietário somente o texto do erro. A causa específica ainda não foi confirmada. Não presumir falha de allowlist ou de navegador; não remover flags/controles para contornar uma recusa do Google. O callback reaproveitado não substitui teste OAuth do frontend novo. Se o executor encerrar por timeout, reabrir somente após esclarecer esse erro e sem processos concorrentes.

31/10/2026. Branch `feat/orkto-real-system-2027`, aplicação `77634fd`, publicador `414fa6c`, checkpoint inicial `ddb89f6`. **READY_FOR_PRODUCTION_CANDIDATE=NO.** Produção e PR2 preservadas.

## Resultados reais

**Candidato vigente:** `389a9c893a87ea18785241e7f6a1a219d964dd53`, [Preview do projeto staging](https://orkto-staging-frefbzvte-peixoto-s-projects1.vercel.app), deployment `dpl_3ntLY4HfcFBHvNXy2bC86TanwctV`, READY, target null/Preview. Ferramentas vigentes `3fd27efda689edf77b5f76bc4600fe042b08f483`;38/38 testes focados do motor/PKCE/inspection aprovados. Não confundir o SHA de ferramentas com o SHA do runtime. O deployment anterior `dpl_AbwFf15j2mXYuTPnbiQ6HUKWykfr`, target literal staging, foi superado por não corresponder a ambiente personalizado existente.

As variáveis `ORKTO_AUTH_MODE` e `VITE_ORKTO_AUTH_MODE` foram criadas somente no target preview e branch `feat/orkto-real-system-2027`, valor `google_pilot`; readback de metadados e execução CLI em memória confirmaram a seleção. A primeira tentativa usava SHA como ref, foi cancelada antes de READY e substituída por ref da branch mais SHA esperado. Não repetir esse candidato cancelado nem contá-lo como aplicação homologada.

**HTTP real do Auth:** GET settings200, Google=true, email=false, phone=false, anonymous=false. **HTTP negativo real:** core33 sem sessão401 `UNAUTHORIZED_NO_AUTH_HEADER`; PostgREST do chat sem sessão401 `42501`. Esses dois negativos não substituem o teste autenticado bidirecional A/B. [Prova do candidato e transporte](evidence/real-system-2027/r4/candidate-and-http.json).

**Diagnóstico histórico do target incorreto:** requisições Node com TLS válido, token OIDC curto em memória e header restrito ao host receberam403 `TRUSTED_SOURCES_ENVIRONMENT_MISMATCH` em health, ready e clients. A aplicação não foi alcançada; não contar403 como isolamento de tenant PASS. Trusted Sources retornou null; SSO permanece `all_except_custom_domains`. O proprietário autorizou somente development→staging; a API recusou porque esse ambiente personalizado não existe. Nenhuma regra foi alterada. A solução validada foi o Preview normal descrito acima.

O transporte CLI via `vercel.ps1` consumia o separador `--`; a entrada nativa `vercel.cmd` preservou os argumentos. O curl instalado usa Schannel e falhou ao verificar revogação de certificado; nenhuma flag para ignorar essa verificação foi usada. Node com CA do sistema resolveu o transporte e permitiu reproduzir o403 verdadeiro. Nenhuma sessão/token foi gravada em arquivo.

As conexões Supabase e Vercel voltaram a funcionar. Identidade confirmada: Supabase Primary `ghrjongiodziasupakrk`; Vercel `orkto-staging`, projeto `prj_KZm12jmZIKL3Tqnk2I9DBa9MabKc`, equipe `team_7mNnmcZNv9miOp7pl7otO6wE`.

O histórico remoto contém54 migrations. As quatro últimas estão presentes: `wia_private_chat_history`20261030150210; `meta_unique_client_match`20261030151119; `meta_disconnect_guard`20261030151122; `meta_unsupported_message_notice`20261030151228. A incerteza da R3 foi resolvida por leitura; não houve reaplicação de SQL.

Readback do chat: política restritiva de sessão do piloto preservada, leitura somente por autor e workspace, escritas do navegador revogadas e índice privado presente. Os índices de telefone e histórico Meta existem. As quatro funções Meta inspecionadas têm `search_path=''`, execução negada a anon/authenticated e permitida a service_role. Isso comprova configuração, não o E2E HTTP A/B.

Backup da core32 conferido contra a versão remota:22/22 arquivos correspondentes após normalização de quebras de linha. Rollout autorizado executado exclusivamente no staging: **core33 ACTIVE, verify_jwt=true**, artefato `6d3b9ef98f6ad1b3bedbbf638de954c02b1db1f2c38dbd92834a5c352936f675`. Readback27/27 arquivos do grafo de runtime correspondem à fonte; o arquivo `billing-reconciliation.ts`, não importado pelo entrypoint core, foi eliminado pelo empacotador. Radar determinístico incluído como dependência da preparação de propostas. Não foram alteradas flags de custo, billing, envios, roles ou grants.

Evidências: [snapshot anterior ao rollout](evidence/real-system-2027/r4/staging-before-rollout.json), [core33/readback e auditoria](evidence/real-system-2027/r4/core-v33-readback.json). Nenhum desses resultados deve ser chamado de login Google ou homologação de fornecedor.

## Alertas reais e dependências

-19 tabelas com RLS sem políticas: todas as19 inspecionadas negam SELECT e escritas ao authenticated. São tabelas internas deliberadamente fechadas; não criar políticas permissivas para eliminar o aviso. [Advisor oficial](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
-5 helpers SECURITY DEFINER acessíveis ao authenticated: helpers de sessão e membership, com search_path vazio. O aviso permanece rastreado; não retirar os gates nem conceder novas permissões. [Advisor oficial](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
- Proteção de senhas vazadas continua desativada. GET real de Auth settings confirmou email/senha, telefone e login anônimo desativados, Google ativo. O aviso não comprova uma via de senha disponível; qualquer reativação futura exige revisar esse controle. Login Google, identidade verificada e sessão continuam gates distintos. [Documentação oficial](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- Performance:79 FKs sem índice e40 índices sem uso, informativos. Não houve remoção/criação indiscriminada. Histórico recente reduzido não comprova desempenho sob carga.
- Publicação Realtime continua sem tabelas públicas. Manter flag OFF e fallback HTTP até homologação de isolamento.
- Zero model_tariffs, pulso_policies, billing_customers, billing_bindings, whatsapp_rate_cards e channel_connections. Não há configuração comercial aprovada registrada nessas tabelas para executar inferência paga, cobrança ou envio.
- O transporte inicial no sandbox falhou com DNS `ENOTFOUND`; a execução autorizada fora desse isolamento com Node/CA do sistema funcionou. O conector Vercel de fetch foi rejeitado pela aprovação automática porque cria/reutiliza compartilhamento temporário; nenhum link foi criado. A alternativa autenticada OIDC não usa compartilhamento e funcionou no Preview normal, sem mudar Trusted Sources. Deployment Protection/TLS preservados.

## Regressões desta rodada

425/425 testes de aplicação e110/110 testes de ferramentas aprovados novamente; typecheck Edge aprovado. Após fixar o executor ao novo candidato,38/38 testes específicos passaram. Primeira execução no sandbox foi interrompida por limitações do ambiente; a evidência aproveitável vem da execução com servidores de teste locais acessíveis. IA e provedores continuam doubles nesses testes.

CI remoto **PASS**, exclusivamente na branch isolada e SHA de ferramentas `01f7233`: [deploy/provider boundary](https://github.com/peixotodavy831-stack/Orktoverdadeiro/actions/runs/41212046064), [PostgreSQL17/replay](https://github.com/peixotodavy831-stack/Orktoverdadeiro/actions/runs/41212048690). Os quatro jobs concluíram com success; [recibos sanitizados](evidence/real-system-2027/r4/ci-results.json). O workflow PostgreSQL incluiu replay das54 migrations, assertions de segurança e ensaio descartável de backup/restore. Esse ensaio não comprova restauração gerenciada do Supabase staging.

Após ajustar somente o alvo e o callback do executor, o [CI deploy/provider boundary no SHA3fd27ef](https://github.com/peixotodavy831-stack/Orktoverdadeiro/actions/runs/41212578448) também concluiu com success. Nenhuma migration mudou entre esses SHAs. Secret scan final da rodada:829 arquivos, zero achados. PR2 confirmada OPEN/draft em `78497da5bfd52166c6852aa14c06ebbf84fa1248`, sem alteração.

Secret scan antes da publicação:823 arquivos, zero achados. Build Google-only e smoke da R3 preservados; o código de aplicação não mudou desde esse build. Alterações atuais são documentação e rollout da fonte já validada.

## Matriz

| Gate | Estado | Escopo |
|---|---|---|
| Acesso de gerenciamento Supabase/Vercel | PASS | Leitura real dos projetos staging |
| Presença das54 migrations | PASS | Histórico remoto e objetos críticos; não é replay fresh remoto |
| RLS/grants privados do chat e funções Meta | PASS | Readback SQL de configuração |
| Core33 e correspondência da fonte | PASS | Deploy/readback real; JWT mantido |
| Build remoto do novo candidato | PASS | READY no SHA389a9c8; não é API E2E |
| Google-only configurado | PASS | Auth settings real e variáveis do candidato; login A/B separado |
| Edge/PostgREST sem sessão | PASS | HTTP401 reais; não substituem isolamento autenticado |
| CI deploy/providers e PostgreSQL17 | PASS | Quatro jobs remotos no SHA de ferramentas01f7233; fornecedores offline e DB descartável |
| Health/ready e barreira anônima do candidato | PASS | Preview normal:200/200/401 com OIDC/TLS; não é A/B autenticado |
| Google G01–G12 | BLOCKED_EXTERNAL | Transporte HTTP seguro e duas sessões PKCE reais; não recriar contas |
| IA real | BLOCKED_EXTERNAL | Modelo/tarifa/Pulso/teto aprovados e secret store |
| WhatsApp real | BLOCKED_EXTERNAL | Assets/callback/destinatário/consentimento/limites e custos |
| Asaas B01–B13 | BLOCKED_EXTERNAL | Customer sintético, canais OFF, secrets e rodada controlada |
| Realtime e restauração | NOT_TESTED | Manter controles atuais; exigir testes reais específicos |
| Venda pública | BLOCKED_EXTERNAL | Gates obrigatórios abertos e sem autorização de produção |

Não presumir presença/ausência de secrets Edge a partir das tabelas vazias. As configurações externas seguem [procedimento Asaas](../05_ENGINEERING/ASAAS_SANDBOX_OWNER_SETUP.md) e gates da R3. Preservados exatamente os cinco planos e seus preços, Pulso, Cost Governor e Central Econômica.
