# Real System R2 — recuperação e atualização de Conversas

30/10/2026. Código final `77634fd` (base R2 `7236ba2` preservada), branch `feat/orkto-real-system-2027`. Continuação dos commits `939426c` e `bb65724`, preservados. **READY_FOR_PRODUCTION_CANDIDATE=NO.**

## Correções concretas

**Resposta recuperável após reload.** O histórico consulta a resposta da execução WIA já persistida. Quando o turno do usuário existe, a execução terminou com sucesso e o registro separado da resposta falhou, o GET retorna a resposta durável com indicação de recuperação. Não chama modelo, não insere mensagem, não altera execução nem requer exportar a chave de retry para storage. Execuções de outro autor/workspace, em andamento, falhas, datas inválidas e conteúdo excessivo não são recuperadas. Uma resposta já presente não é duplicada. Fontes e modelo são allowlisted somente de execução pertencente ao mesmo autor e empresa. A lista de sessões não carrega os payloads de todas as execuções.

**Eventos de Conversas.** Adaptador usa o Supabase SDK existente, com token apenas em memória, workspace obtido pela API autenticada e filtros exatos em `orkto_conversations` e `orkto_messages`. Escuta INSERT/UPDATE e usa o evento apenas para invalidar leituras HTTP autorizadas. Não renderiza conteúdo do WAL diretamente nem trata um evento como prova de entrega Meta. Eventos de outro workspace e callbacks de gerações encerradas são ignorados. Lotes são coalescidos, reconnect refaz leitura, e fechamento inesperado recria canal com backoff limitado.

O adaptador **não usa broadcast público**. O isolamento do transporte Postgres Changes depende das políticas RLS reais, além do filtro. Não existe subscription `*` ou DELETE: a documentação Supabase alerta que RLS não se aplica da mesma forma a registros já deletados. Exclusão física exige atualização manual/retomada da tela ou futura solução de broadcast privado autorizada. Arquivamento por UPDATE pode gerar notificação normal.

**Fallback honesto.** `VITE_ORKTO_INBOX_REALTIME=OFF` por padrão. Sem ativação/homologação remota, a tela mostra atualização periódica. Fila e thread usam intervalo de30s somente visíveis e online; com canal conectado, o polling é suspenso. Ao retornar à aba ou ficar online, lista e thread são consultadas de novo. Rascunhos não são apagados pela releitura. Nenhuma configuração remota/publicação/grant foi alterada.

## Ordem e deduplicação de mensagens

A revisão visual encontrou um snapshot sintético fora de ordem. O runtime final `77634fd` ordena também o primeiro carregamento, deduplica por ID e preserva timestamps/recibos ao aplicar atualizações tardias. O helper não modifica as listas recebidas. O teste cobre payload fora de ordem, empate de horários, repetição e atualização de recibo sem duplicação.

## Provas e limites

- `tests/wia-chat.test.ts`: recuperação sem escrita ou inferência, rejeição de saída de execução não pertencente ao autor/empresa e ausência de duplicatas.
- `tests/inbox-realtime.test.ts`: filtros/eventos permitidos, autenticação, coalescência, payload estrangeiro, desconexão, substituição de canal, callback antigo, cleanup durante autenticação e falha de autenticação. **Transportes doubles; não são teste de WebSocket Supabase real.**
- [Jornadas visuais](evidence/real-system-2027/r2/browser/after/journeys.json): recuperação sem novo POST e retomada do Inbox com rascunho preservado, além dos casos R1. A primeira observação tentou esperar um evento de rede inexistente na fixture `window.fetch`; o teste foi corrigido para observar a chamada sintética, preservando o relatório de falha.
- [Resumo de validação R2](evidence/real-system-2027/r2/validation-summary.json): SHA, contagens, build, scan e fronteiras de evidência.
- Schema inalterado nesta rodada. O replay PostgreSQL17.11 de54 migrations e asserções RLS da R1 permanece válido pelos hashes dos mesmos arquivos. Não foi anunciado novo replay em staging ou CI remoto.

## Acesso externo tentado

O conector Supabase voltou a exigir `link_id`; CLI continua sem sessão de gerenciamento. Tentativa de navegação direta ao staging `ghrjongiodziasupakrk` terminou na lista de organizações, sem abrir o projeto autorizado. O painel inicial ainda carregando mostrava indicadores provisórios; eles **não foram usados** como zero tráfego, ausência de alertas ou configuração comprovada. Não foi acessado outro projeto nem aberto segredo.

## Gate antes de ativar eventos

1. Restaurar sessão com acesso ao projeto staging correto, sem criar usuários, papéis ou credenciais no chat.
2. Conferir, somente por leitura, RLS/SELECT dos dois objetos e presença na publicação `supabase_realtime`:

```sql
select schemaname, tablename from pg_publication_tables
where pubname = 'supabase_realtime'
  and schemaname = 'public'
  and tablename in ('orkto_conversations','orkto_messages');
select tablename, policyname, roles, cmd, qual from pg_policies
where schemaname='public'
  and tablename in ('orkto_conversations','orkto_messages');
select relname, relrowsecurity from pg_class
where oid in ('public.orkto_conversations'::regclass,'public.orkto_messages'::regclass);
```

3. Se faltar publicação ou houver política divergente, preparar mudança revisável; não ampliar permissões indiscriminadamente nem reduzir RLS.
4. Publicar somente candidato autorizado com a migration54/Edge/frontend compatíveis; executar A/B real em dois contextos, reconexão, troca/revogação de sessão, inserts/updates e ausência de vazamento entre empresas. Só então habilitar o flag no staging aprovado. Sem ativação automática por esta documentação.
5. Meta real continua exigindo assets, consentimento/limites e autorização de envio. IA paga e Asaas sandbox possuem seus próprios gates.

Fontes oficiais: [Supabase Postgres Changes e limites de DELETE](https://supabase.com/docs/guides/realtime/postgres-changes), [subscribe e estados do canal](https://supabase.com/docs/reference/javascript/subscribe), [troubleshooting de publicação/conexão](https://supabase.com/kb/troubleshooting/realtime-messages-not-arriving).

## Trabalho ainda aberto

Homologação HTTP→Edge→banco real, eventos reais A/B e revogação, paginação completa das sessões e políticas de retenção, Meta/Gemini/Asaas reais autorizados, recuperação gerenciada, decisões de franquias e autorização comercial. O adaptador preparado e testes locais não equivalem à missão integral concluída.
