# Real System R3 — homologação real e publicador seguro

30/10/2026. Branch exclusiva `feat/orkto-real-system-2027`. Aplicação R2 preservada em `77634fd756d5f26ed5c09a77443e8eae3991d8fd`; base documental `dbbb125`. **READY_FOR_PRODUCTION_CANDIDATE=NO.**

Correção do publicador: `414fa6c8bba3f4f9ca22a35a9ecab6243566dcb1`. [Evidência sanitizada R3](evidence/real-system-2027/r3/validation-summary.json):61/61 testes focados,110/110 regressões de ferramentas, typecheck, build Google-only e smoke aprovados localmente. A suíte completa da aplicação R2 permanece evidência histórica425/425; não foi repetida porque esta alteração afeta somente o publicador.

## Alteração de engenharia

O publicador comparava os três JSONs por texto serializado e rejeitava as proteções adicionais de branches isoladas presentes em `vercel.json`. A validação agora compara as configurações estruturadas, permite somente guardas adicionais com valor booleano `false`, exige a preservação dos guardas de staging e rejeita qualquer mudança de runtime, cron, rota ou outra configuração Git. Nenhuma configuração cloud foi alterada nesta retomada.

Os testes cobrem a configuração real, guardas adicionais, valores permissivos, valores malformados, remoção de guarda, mudanças de função, rota, cron e opções Git. Não houve alteração das configurações de produção nem do código de autenticação.

## Evidência e limites da retomada

- O checkpoint da etapa conectada anterior registra inspeção do staging `ghrjongiodziasupakrk`, aplicação e readback da migration54 de chat privado, preservando a política restritiva do piloto e a revogação de escritas pelo navegador. Isso é evidência de DDL/readback, não de HTTP A/B autenticado. O recibo bruto daquela chamada não permaneceu no armazenamento de ferramentas após a retomada; exige nova leitura antes do rollout.
- A última chamada anterior tentou aplicar as migrations51–53; sua saída foi truncada e os resultados em memória não estão mais disponíveis. **Resultado INCONCLUSIVE; não reaplicar às cegas, nem declarar PASS.** Consultar primeiro o histórico e os objetos no staging.
- A cópia local da Edge core v32 contém22 arquivos. O manifesto foi regenerado sobre todos os22 arquivos, com SHA256; o manifesto antigo era parcial. A cópia permanece ignorada em `.tmp-real-system/r3/remote-core`; não é backup do banco nem comprovação da versão remota atual.
- A comparação dessa cópia com a fonte local encontrou12 arquivos diferentes,252 inserções e31 exclusões. Não foi executado deploy Edge nesta retomada.
- Supabase e Vercel inicialmente não constavam nas ferramentas conectadas. Após o proprietário informar “prontop”, a descoberta confirmou ambas instaladas. Seus métodos ainda não estão expostos ao executor desta retomada: instalação confirmada, execução de gerenciamento ainda indisponível. Não solicitar nova instalação sem verificar o estado atualizado. A disponibilidade do navegador local também foi consultada: ferramenta informou que o uso de navegador local está desativado nas configurações Work; não contornar esse bloqueio.
- `vercel whoami` retornou0, mas a consulta GET ao projeto staging falhou, inclusive fora do sandbox. A sessão de CLI, isoladamente, não comprova acesso ao projeto nem autoriza inferir configuração. Não houve alteração de TLS, Deployment Protection ou permissões.
- O executor PKCE existente abriu Chrome com contextos isolados; login Google continua NOT_TESTED nesta retomada. Nenhuma sessão foi exportada e nenhuma conta foi recriada.
- O primeiro build falhou no sandbox ao resolver a junction de dependências. A execução fora desse isolamento passou em modo Google-only, incluindo frontend, metadados, servidor e smoke HTTP local; `dist` foi preservado. Não é deploy remoto.

## Matriz atual

| Gate | Estado | Evidência / próximo passo |
|---|---|---|
| Publicador: proteções adicionais e destinos | PASS local | Testes sobre os arquivos reais e casos negativos; logs R3 |
| Typecheck e build Google-only | PASS local | TypeScript e build isolado com smoke, sem credenciais externas |
| Navegador PKCE em dois contextos | PASS local | Probe existente; não executa login nem G01–G12 |
| Migrations51–53 remotas | NOT_TESTED / INCONCLUSIVE | Tentativa anterior sem recibo recuperável; listar histórico antes de decidir |
| Migration54 remota | BLOCKED_EXTERNAL para reconfirmação | Checkpoint registra aplicação/readback; revalidar com conexão restabelecida |
| Edge e novo candidato compatíveis | BLOCKED_EXTERNAL | Sem deploy nesta retomada; precisa confirmar schema, projeto, modo Google-only e origins exatas |
| Google G01–G12 HTTP A/B | BLOCKED_EXTERNAL | Executor disponível; dependem de candidato confirmado, chaves públicas e login/2FA seguro |
| IA/Gemini real | BLOCKED_EXTERNAL | Modelo, tarifa, Pulso e teto aprovados; credencial somente no secret store |
| WhatsApp/Meta real | BLOCKED_EXTERNAL | Assets de teste, callback/HMAC, destinatário com consentimento, custos e autorização controlada |
| Asaas B01–B13 | BLOCKED_EXTERNAL | Customer sintético exclusivo, canais OFF, secrets sandbox e rodada autorizada; preflight permanece GET-only |
| Realtime do Inbox | NOT_TESTED remoto | Checkpoint anterior: publicação sem tabelas públicas; flag permanece OFF e fallback HTTP preservado |
| Recuperação de banco | BLOCKED_EXTERNAL | Checkpoint anterior: organização free; não presumir PITR ou restore disponível; confirmar e aprovar drill |
| Venda pública | BLOCKED_EXTERNAL | Gates obrigatórios abertos; não houve merge nem produção |

## Ordem para retomar sem repetir o trabalho

1. Restabelecer Supabase e Vercel; confirmar link Primary e staging `ghrjongiodziasupakrk`, projeto Vercel `prj_KZm12jmZIKL3Tqnk2I9DBa9MabKc`, equipe `team_7mNnmcZNv9miOp7pl7otO6wE`.
2. Executar somente as leituras abaixo. Registrar resultado sanitizado e SHA local. Não selecionar tokens, cookies, Vault ou chaves privadas.
3. Comparar migrations e definições completas com a fonte antes de aplicar qualquer SQL faltante. Preservar RLS, grants e sessões existentes.
4. Revisar/deployar somente Edge staging compatível, com `verify_jwt=true` na core. Confirmar readback antes de publicar frontend/API.
5. Publicar candidato isolado Google-only; confirmar SHA, callback e CORS exatos sem wildcard. Não mudar PR2, alias existente ou produção.
6. Reutilizar o motor G01–G12 e identidades A/B aprovadas; login/2FA humano quando indispensável. Não usar tokens fabricados ou SQL administrativo como prova A/B.
7. Reutilizar preflight Asaas GET-only antes de B01–B13. Não tocar no cadastro/assinatura legados; não inferir aprovação de customer a partir de um simples “sim”.

```sql
-- Somente leitura; executar exclusivamente no staging confirmado.
select version, name from supabase_migrations.schema_migrations order by version;
select policyname, permissive, roles, cmd, qual, with_check
from pg_policies where schemaname='public' and tablename='orkto_wia_chat_messages';
select has_table_privilege('authenticated','public.orkto_wia_chat_messages','INSERT') as browser_insert,
       has_table_privilege('authenticated','public.orkto_wia_chat_messages','UPDATE') as browser_update,
       has_table_privilege('authenticated','public.orkto_wia_chat_messages','DELETE') as browser_delete;
select indexname from pg_indexes where schemaname='public' and indexname in
('orkto_wia_chat_actor_recent_idx','clients_workspace_phone_active_idx','orkto_messages_workspace_history_idx');
select p.proname, p.prosecdef, p.proconfig,
       has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
       has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
       has_function_privilege('service_role',p.oid,'EXECUTE') as service_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in
('orkto_ingest_meta_text_message','orkto_disconnect_meta_connection','orkto_ingest_meta_unsupported_message','orkto_record_meta_receipt');
select schemaname, tablename from pg_publication_tables where pubname='supabase_realtime';
```

## Intervenções humanas indispensáveis

Reconectar as integrações de gerenciamento; realizar eventual Google/2FA diretamente no navegador. Depois do candidato preparado, configurar somente callbacks/origins exatos e secrets dos fornecedores nas respectivas lojas seguras, sem chaves no chat. Aprovar modelo/tarifa/teto/Pulso, destinatário e limites Meta, customer sandbox com notificações desativadas e política comercial de término de acesso. A autorização geral de teste não fornece esses valores nem substitui as verificações.

Mantidos exatamente Start R$79,90; Pro R$149,90; Business R$299,90; Scale R$599,90; Enterprise sob consulta. Sem novas ofertas, franquias, assentos, cobranças, mensagens ou inferências pagas.
