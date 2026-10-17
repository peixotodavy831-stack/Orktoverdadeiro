# Ferramentas de homologação preparadas sem credenciais

**Código das ferramentas:** `1c4f4a93c86301c2fe0bb25f49f0cb00b1f2806e`.
**Runtime de referência preservado:** `a2a3651319196ffc56813992f705692d368ef967`, Preview az36qohmo / Supabase staging ghrjongiodziasupakrk.
**READY_FOR_PRODUCTION_CANDIDATE=NO.** A implementação destas ferramentas não é homologação real do Google ou Asaas.

## Entrega independente de credenciais

- `scripts/readiness/google-ab-transport.mjs`: motor HTTP com alvos fixos, duas identidades previamente aprovadas e saída sanitizada. Não cria conta, workspace, convite ou permissão.
- `scripts/readiness/asaas-sandbox-readonly-preflight.mjs`: inspeção GET-only de customer/notifications exclusivamente no host sandbox. Não cria assinatura, não altera notificações, não habilita flags nem concede acesso.
- Dois novos arquivos de testes, **24/24 testes offline aprovados**. Os JWTs dos testes são sintéticos, sem assinatura válida; não são evidência de Auth staging. [Log](evidence/homologation-tools-1c4f4a9.txt).
- Lint e sintaxe Node aprovados. Secret scan dos quatro módulos/testes: zero achados. Nenhuma nova dependência.
- Invocações CLI sem adaptação retornam `BLOCKED_EXTERNAL`, exit code 2, sem rede e sem leitura de credenciais. [Saída sanitizada](evidence/homologation-tools-cli-1c4f4a9.jsonl).
- Workflow de deploy boundary inclui os novos testes com fixtures, sem secrets e sem requisições externas. [CI das ferramentas](https://github.com/peixotodavy831-stack/Orktoverdadeiro/actions/runs/38986371314).

Não foram repetidos logins, redirect, migration50, deploy Edge, regressão da aplicação ou build do candidato. O diff dos arquivos de runtime/frontend/backend/Supabase/package entre a2a3651 e este source é vazio. As ferramentas não foram incorporadas ao deployment nem publicadas como endpoint.

## Como o motor Google deverá ser integrado

`runGoogleAbTransport` recebe um adaptador confiável no mesmo processo; ele **não** extrai sessão de abas existentes. A integração de aquisição Google permanece **BLOCKED_EXTERNAL** neste ambiente.

| Entrada | Contrato obrigatório |
| --- | --- |
| `verifyDeployment` | Metadados obtidos por acesso Vercel autenticado. Host, projeto, SHA a2a3651 e READY/Preview conferidos antes de adquirir credenciais. |
| `acquireContexts` | Retorna A e B obtidos pelo fluxo Google PKCE normal, em contextos realmente isolados. IDs de contexto distintos, storage em memória, auto-refresh desligado e função dispose. Marcadores de proveniência são atestação do adaptador confiável, não prova independente de isolamento. |
| `session` de cada contexto | access_token/refresh_token somente em memória, sem arquivo, storageState, trace, HAR, logs ou leitura interna de navegador. Nunca enviar ao agente/chat. O servidor Auth confirma subject e identidade Google antes dos testes. |
| `publicKey` | Somente publishable/anon do projeto staging; segredo/service_role e anon de outro projeto são rejeitados. |
| `oidcToken` / `getPreviewOidc` | Proteção Vercel separada do JWT Supabase, somente no host Preview. Para esperas longas, o adaptador pode renovar OIDC em memória. Expiração/bloqueio Vercel não será contado como revogação ORKTO. |
| `fixtureClients` | Opcional: dois IDs de clientes sintéticos já autorizados, um por workspace. Leitura própria precisa retornar recurso conhecido; tentativa cruzada deve negar/retornar vazio. Sem isso, BUSINESS_RESOURCE_AB fica NOT_TESTED. Nenhuma fixture é criada automaticamente. |
| `naturalExpiry` | Default false. Quando explicitamente acionado, espera pelo exp real dos JWTs originais, em intervalos de até 30 segundos, sem alterar relógio ou TTL. Limite de espera e validade OIDC podem bloquear a fase sem gerar falso PASS. |
| `revokeCurrentSessions` | Default false. Quando explicitamente acionado, logout `scope=local` somente das sessões de teste fornecidas, JWT ainda não expirado testado nas superfícies protegidas e tentativa de refresh revogado. Verifica que revogar A não derrubou B. Não usa revogação global. |
| `executionMode` | STAGING usa fetch/relógio reais; injeções sintéticas de transporte/tempo exigem FIXTURE. A saída identifica o modo. Não promover FIXTURE a gate real. |

O motor cobre metadata do workspace em API, membership Edge e PostgREST nas duas direções. Com fixtures, acrescenta clientes em API/PostgREST. Não declara cobertura integral de todos os recursos da plataforma.

**Limitações explícitas:** CROSS_TENANT_WRITES e REFRESH_REUSE_OUTSIDE_EXCEPTIONS permanecem NOT_TESTED. Escrever dados reais ou revogar outra sessão para satisfazer cobertura não é automático. Falta ainda o adaptador OAuth/ambiente isolado autorizado, integração operacional e execução real; não renomear esse bloqueio como teste concluído.

Falhas de identidade, corpo excessivo, redirect, origem errada, storage persistente, contexto compartilhado ou erro de descarte não expõem diagnóstico bruto e impedem aprovação. A saída contém somente enums/IDs de caso e status HTTP; nunca subject, customer, token, hash de token ou corpo de dados.

## Preflight Asaas preparado

`preflightAsaasSandbox` aceita configuração em memória de um operador/ambiente autorizado com acesso ao secret store. **Não** lê automaticamente env local, arquivo, chave do chat ou secret do painel. A integração com o secret store real ainda precisa ser disponibilizada; cadastrar uma chave no Edge não executa este script local automaticamente.

Pré-condições: APP_ENV=staging, ASAAS_ENVIRONMENT=sandbox, URL Supabase exata, customer explicitamente aprovado como sintético e API key sandbox. Os marcadores de aprovação recebidos não criam nem substituem o vínculo/auditoria de customer no banco.

Realiza somente:

1. GET do customer para conferir ID e ausência de exclusão.
2. GET de `/customers/:id/notifications` para analisar o snapshot completo.

Resposta vazia, paginação incompleta, campos ambíguos, customer divergente ou canal desconhecido bloqueiam a certificação. Uma notificação globalmente `enabled=false` está desativada mesmo que um canal individual permaneça marcado. Se enabled=true, todos os canais conhecidos precisam estar explicitamente false; canal externo ativo gera FAIL. O estado é uma observação pontual, não garantia de notificações históricas ou futuras.

O script não desativa notificações sozinho. Credenciais ausentes/falha de fornecedor/redirect/corpo excessivo retornam bloqueio sanitizado, sem ecoar chave ou dados do customer. Não há endpoint de produção ou chamadas de escrita.

Sem customer e secret store configurados, **nenhuma chamada Asaas foi feita nesta entrega**. Não se definiu timing de término de acesso; o ciclo nativo e a guarda RECORDED_POLICY_REQUIRED existentes permanecem intactos.

## Execuções CLI seguras para diagnóstico de bloqueio

```powershell
node scripts/readiness/google-ab-transport.mjs
node scripts/readiness/asaas-sandbox-readonly-preflight.mjs
```

Esses comandos não recebem tokens ou chaves por argumentos e não tentam autenticar. Exit code 2 significa pré-requisitos externos pendentes. A execução real requer integração em processo com os adaptadores acima, não copiar credenciais para o terminal.

## Matriz desta entrega

| Gate | Estado | Escopo / evidência |
| --- | --- | --- |
| Motor Google A/B e limites de segurança | PASS | Ferramenta 1c4f4a9, testes offline; não é Google E2E. |
| Preflight Asaas somente leitura | PASS | Ferramenta 1c4f4a9, testes offline; não é inspeção real de customer. |
| Invocações sem pré-requisitos fechadas | PASS | 1c4f4a9, CLI local exit2/BLOCKED_EXTERNAL, zero rede. |
| Aquisição Google em dois contextos isolados | BLOCKED_EXTERNAL | Adaptador/ambiente real não disponibilizado; login B histórico preservado. |
| A/B, refresh, expiração, logout e replay reais | NOT_TESTED | Alvo a2a3651; nenhum token real fornecido ou extraído. |
| Asaas com customer/conta/notificações reais sandbox | BLOCKED_EXTERNAL | Última inspeção staging confirmou zero customers aprovados e secrets personalizados; nenhuma configuração informada depois. |
| Casos reais de assinatura/pagamento/webhook | NOT_TESTED | Alvo a2a3651, fornecedor não acionado. |
| Política comercial, Gemini, Meta e recuperação | BLOCKED_EXTERNAL | Pendências anteriores preservadas; sem política inventada ou integração paga ativada. |

Fontes verificadas: [sessões Supabase](https://supabase.com/docs/guides/auth/sessions), [refreshSession](https://supabase.com/docs/reference/javascript/auth-refreshsession), [signOut](https://supabase.com/docs/reference/javascript/auth-signout), [consulta de notificações Asaas](https://docs.asaas.com/reference/retrieve-notifications-from-a-customer), [semântica enabled/canais](https://docs.asaas.com/reference/update-existing-notification). Changelog Supabase consultado; não foi instalado/atualizado SDK nem alterada configuração TLS.
