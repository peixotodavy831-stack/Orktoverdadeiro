# Real System R4 — staging reconectado e Edge core33

31/10/2026. Branch `feat/orkto-real-system-2027`, aplicação `77634fd`, publicador `414fa6c`, checkpoint inicial `ddb89f6`. **READY_FOR_PRODUCTION_CANDIDATE=NO.** Produção e PR2 preservadas.

## Resultados reais

As conexões Supabase e Vercel voltaram a funcionar. Identidade confirmada: Supabase Primary `ghrjongiodziasupakrk`; Vercel `orkto-staging`, projeto `prj_KZm12jmZIKL3Tqnk2I9DBa9MabKc`, equipe `team_7mNnmcZNv9miOp7pl7otO6wE`.

O histórico remoto contém54 migrations. As quatro últimas estão presentes: `wia_private_chat_history`20261030150210; `meta_unique_client_match`20261030151119; `meta_disconnect_guard`20261030151122; `meta_unsupported_message_notice`20261030151228. A incerteza da R3 foi resolvida por leitura; não houve reaplicação de SQL.

Readback do chat: política restritiva de sessão do piloto preservada, leitura somente por autor e workspace, escritas do navegador revogadas e índice privado presente. Os índices de telefone e histórico Meta existem. As quatro funções Meta inspecionadas têm `search_path=''`, execução negada a anon/authenticated e permitida a service_role. Isso comprova configuração, não o E2E HTTP A/B.

Backup da core32 conferido contra a versão remota:22/22 arquivos correspondentes após normalização de quebras de linha. Rollout autorizado executado exclusivamente no staging: **core33 ACTIVE, verify_jwt=true**, artefato `6d3b9ef98f6ad1b3bedbbf638de954c02b1db1f2c38dbd92834a5c352936f675`. Readback27/27 arquivos do grafo de runtime correspondem à fonte; o arquivo `billing-reconciliation.ts`, não importado pelo entrypoint core, foi eliminado pelo empacotador. Radar determinístico incluído como dependência da preparação de propostas. Não foram alteradas flags de custo, billing, envios, roles ou grants.

Evidências: [snapshot anterior ao rollout](evidence/real-system-2027/r4/staging-before-rollout.json), [core33/readback e auditoria](evidence/real-system-2027/r4/core-v33-readback.json). Nenhum desses resultados deve ser chamado de login Google ou homologação de fornecedor.

## Alertas reais e dependências

-19 tabelas com RLS sem políticas: todas as19 inspecionadas negam SELECT e escritas ao authenticated. São tabelas internas deliberadamente fechadas; não criar políticas permissivas para eliminar o aviso. [Advisor oficial](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
-5 helpers SECURITY DEFINER acessíveis ao authenticated: helpers de sessão e membership, com search_path vazio. O aviso permanece rastreado; não retirar os gates nem conceder novas permissões. [Advisor oficial](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
- Proteção de senhas vazadas continua desativada. Métodos efetivamente habilitados do Auth não foram confirmados nesta rodada; não concluir exposição por senha nem considerar o Google-only comprovado apenas pela UI. [Documentação oficial](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- Performance:79 FKs sem índice e40 índices sem uso, informativos. Não houve remoção/criação indiscriminada. Histórico recente reduzido não comprova desempenho sob carga.
- Publicação Realtime continua sem tabelas públicas. Manter flag OFF e fallback HTTP até homologação de isolamento.
- Zero model_tariffs, pulso_policies, billing_customers, billing_bindings, whatsapp_rate_cards e channel_connections. Não há configuração comercial aprovada registrada nessas tabelas para executar inferência paga, cobrança ou envio.
- Transporte HTTP direto local falhou com DNS `ENOTFOUND`. O conector Vercel de fetch foi rejeitado pela aprovação automática porque cria/reutiliza compartilhamento temporário; nenhum link foi criado. Não contornar a decisão nem remover Deployment Protection/TLS.

## Regressões desta rodada

425/425 testes de aplicação aprovados novamente; typecheck Edge aprovado. O runner da aplicação encadeia a suíte de ferramentas; consultar recibo consolidado da rodada para o resultado final. Primeira execução no sandbox foi interrompida por limitações do ambiente; a evidência aproveitável vem da execução com servidores de teste locais acessíveis. IA e provedores continuam doubles nesses testes.

Secret scan antes da publicação:823 arquivos, zero achados. Build Google-only e smoke da R3 preservados; o código de aplicação não mudou desde esse build. Alterações atuais são documentação e rollout da fonte já validada.

## Matriz

| Gate | Estado | Escopo |
|---|---|---|
| Acesso de gerenciamento Supabase/Vercel | PASS | Leitura real dos projetos staging |
| Presença das54 migrations | PASS | Histórico remoto e objetos críticos; não é replay fresh remoto |
| RLS/grants privados do chat e funções Meta | PASS | Readback SQL de configuração |
| Core33 e correspondência da fonte | PASS | Deploy/readback real; JWT mantido |
| Novo frontend/API compatível | NOT_TESTED | Preparar candidato isolado com Google-only explícito |
| Google G01–G12 | BLOCKED_EXTERNAL | Transporte HTTP seguro e duas sessões PKCE reais; não recriar contas |
| IA real | BLOCKED_EXTERNAL | Modelo/tarifa/Pulso/teto aprovados e secret store |
| WhatsApp real | BLOCKED_EXTERNAL | Assets/callback/destinatário/consentimento/limites e custos |
| Asaas B01–B13 | BLOCKED_EXTERNAL | Customer sintético, canais OFF, secrets e rodada controlada |
| Realtime e restauração | NOT_TESTED | Manter controles atuais; exigir testes reais específicos |
| Venda pública | BLOCKED_EXTERNAL | Gates obrigatórios abertos e sem autorização de produção |

Não presumir presença/ausência de secrets Edge a partir das tabelas vazias. As configurações externas seguem [procedimento Asaas](../05_ENGINEERING/ASAAS_SANDBOX_OWNER_SETUP.md) e gates da R3. Preservados exatamente os cinco planos e seus preços, Pulso, Cost Governor e Central Econômica.
