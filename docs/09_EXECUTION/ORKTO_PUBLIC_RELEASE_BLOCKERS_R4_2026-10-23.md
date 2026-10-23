# Uso público — auditoria real somente leitura R4

**READY_FOR_PRODUCTION_CANDIDATE=NO**. Código local mantido em `748a625`, documentação base `41a86e2`; branch `feat/orkto-launch-2027`. Nenhuma mudança de código nesta rodada.

## Escopo e identidade

Consulta ao MCP Supabase em 23/10/2026: projeto exato `ghrjongiodziasupakrk`, nome `orkto-staging`, status `ACTIVE_HEALTHY`, PostgreSQL 17.6.1.166. Organização vinculada em plano `free`. Foram usados apenas catálogos, helpers booleanos de configuração, contagem agregada de vínculos sandbox, listagens de migrations/funções e advisors. Nenhum segredo, sessão, cookie, token ou conteúdo de cliente foi extraído.

[Evidência sanitizada](evidence/sellable-r4/staging-readonly.json). Essas consultas não são E2E autenticado ou prova de recuperação.

## Resultado real e interpretação

| Verificação | Estado | Prova e limite |
|---|---|---|
| Tabelas públicas com RLS | PASS | Nenhuma tabela pública regular sem RLS no catálogo consultado. Não prova todas as políticas ou isolamento HTTP. |
| 19 tabelas com RLS sem política | PASS para bloqueio direto | Nenhuma permite SELECT/INSERT/UPDATE/DELETE a anon ou authenticated. As cinco do schema privado também recusam USAGE. A ausência de políticas mantém negação por padrão; não criar políticas abertas para apagar aviso. [Advisor](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy). |
| Cinco helpers SECURITY DEFINER executáveis por authenticated | PASS para revisão de definição/ACL | Helpers retornam booleanos; cadeia valida auth.uid, membership ativa e/ou sessão OAuth admitida. Nenhum executável por anon; search_path vazio; sem comandos de mutação. São necessários às políticas existentes. Isso não substitui G01–G12. [Advisor](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable). |
| SECURITY DEFINER público aberto a anon ou search_path não fixado | PASS | Listas vazias no catálogo do staging. |
| Gate do piloto | PASS para configuração consultada | `orkto_pilot_private.is_enabled()` retorna true. Não foi desligado ou convertido em cadastro público. |
| Proteção de senha vazada | BLOCKED_EXTERNAL / escopo a confirmar | Advisor continua WARN. Organização free; recurso exige Pro ou superior. Google-only reduz a relevância do controle de senha somente se métodos antigos estiverem efetivamente bloqueados; isso não foi revalidado por HTTP nesta rodada. Não declarar N/A definitivo e não contratar plano. [Documentação](https://supabase.com/docs/guides/auth/password-security). |
| Desempenho | NOT_TESTED sob carga | Advisors: 80 FKs sem índice cobrindo e 38 índices sem uso observado, ambos INFO. Não se comprovou lentidão. Não remover índices por ausência de tráfego de staging nem criar 80 índices indiscriminadamente. Priorizar EXPLAIN e latência real de fluxos críticos antes de qualquer migration. |
| Divergência local/remoto | NOT_TESTED para release novo | Staging continua com 50 migrations; correção de associação única da migration 51 não está implantada. Funções atuais core32/Meta3/billing3. Não reutilizar como atuais os números core31/Meta2 de relatórios históricos. Não houve readback comparativo integral das novas versões nesta rodada. |
| Google executor | PASS_LOCAL de capacidade / NOT_TESTED login | Probe do executor existente cria contextos Chrome isolados e não exporta sessão. Login Google não foi executado. O motor permanece fixado em candidato histórico; nenhuma sessão anterior foi reaproveitada por extração. |
| Asaas | BLOCKED_EXTERNAL | Zero vínculos `asaas`/`sandbox` na tabela de customers aprovada. Preflight local sem ambiente/key retornou `EXACT_STAGING_ENVIRONMENT_REQUIRED`, antes de I/O. Isso não prova ausência de key no secret store remoto. Sem vínculo e notificações verificadas, não executar B01–B13 nem habilitar billing. |
| Backup gerenciado | BLOCKED_EXTERNAL | Plano free confirmado; não há prova de backup gerenciado restaurável ou restauração real. A documentação descreve backups diários para Pro/Team/Enterprise e recomenda exportações externas para free. Não comprar upgrade, copiar dados reais ou restaurar sobre staging. [Backups](https://supabase.com/docs/guides/platform/backups). |

## Por que não é possível concluir a abertura pública sozinho no estado atual

1. A autorização vigente de engenharia não substitui aprovação de contratação, cobrança comercial, termos, direitos dos planos ou mudança do modelo de admissão do piloto fechado. Os cinco preços permanecem preservados.
2. Sem um customer sintético aprovado e sem verificação completa de notificações/segredos no fluxo autorizado, iniciar cobrança sandbox não fecha uma prova segura.
3. Um login/2FA ou aceite de termos exigido pelo fornecedor precisa ocorrer no fluxo legítimo. O executor não pode substituir identidade humana nem usar exportação de sessão.
4. Falta autorizar um candidato isolado e identificar seu ambiente antes de publicar e repetir testes obrigatórios no SHA realmente implantado. Não fazer push que possa disparar deploy em produção, merge ou publicação pública automática.
5. Recuperação gerenciada e condições comerciais precisam de uma decisão real e verificável. Não é aceitável converter hipóteses financeiras, testes de fixtures ou um backup local em aprovação de produção.

## Próxima execução autorizável

Preparação de código e evidências R3 já concluída. Manter restrições, preservar PR #2, contas A/B, fontes e históricos. Após as dependências acima serem resolvidas, reutilizar os motores existentes G01–G12/B01–B13 e publicar somente no escopo aprovado. Não repetir login normal já comprovado apenas para gerar mais capturas.

Nenhuma migration aplicada no remoto, alteração de configuração, assinatura, conta, papel, permissão, mensagem ou inferência foi realizada. Não houve deploy ou push. Não foram repetidas as 482 regressões locais já aprovadas: esta rodada altera somente documentação e registra consultas reais somente leitura.
