# ORKTO — WhatsApp e planejamento 2027: execução de 27/10

**PARCIAL / BLOCKED_EXTERNAL. READY_FOR_PRODUCTION_CANDIDATE=NO.** A missão integral não está concluída: mensagem real, envio e entrega Meta e os gates comerciais permanecem sem homologação positiva.

## Código e preservação

Worktree `Orktoverdeiro-whatsapp-e2e`, branch `codex/orkto-whatsapp-e2e`, base `07d2f00`. Sem reset, clean, stash, push, merge, deploy ou alteração de produção. Os cinco commits citados na missão existem no Git local.

- WhatsApp: **3f0e17919c0159a1b515766c79599a545d9e478e**.
- Fonte final, incluindo planejamento: **d57cff0f54c40a0f63b8f03635fdd9a3241f2aaf**.
- Launch preservado no HEAD `1c2bf8972fd63c6f530f5940a7e56a5e81db5a4b`, clean na verificação. PR #2 local preservada em `78497da5bfd52166c6852aa14c06ebbf84fa1248`.

As evidências de 26/10 foram preservadas. O checkout original tem alterações próprias/concomitantes; esta missão não as editou nem consolidou. Nenhum SHA acima foi implantado remotamente.

## Defeitos corrigidos

1. Mensagens não textuais eram ignoradas sem aparecer na conversa. A migration 53 reutiliza a ingestão transacional e persiste aviso explícito, tipo e estado de conteúdo não processado. Não baixa ou interpreta mídia. Notificações desconhecidas/sistema ficam internas e não abrem janela de atendimento.
2. Recibos `read` e `delivered` eram agrupados sem apresentação distinta. O wrapper preserva o ledger e grava recibo autenticado na mensagem correspondente; leitura local não vira leitura do fornecedor. `read` não regride na apresentação.
3. Recibo anterior à persistência da referência do envio podia ser perdido como ignorado. Agora pede retry503 e registra `send_reference_pending`, sem reenvio automático ou confirmação falsa.
4. Mensagens e aprovações chegavam em snake_case, enquanto o componente esperava camelCase. Adaptadores preservam data, papel e conteúdo; objetos de ação não são renderizados como nós React. Estados desconhecidos não habilitam aprovação.
5. Um segundo GET de mensagens era descartado. Foi removido. Conversa atualiza a cada15s e lista a cada30s quando visíveis, sem apagar rascunho; respostas antigas são descartadas e a troca de conversa reinicia estado.
6. O detalhe carregava mensagens sem limite. Histórico passou a páginas de200, cursor timestamp+UUID com microssegundos preservados, índice e botão para carregar mensagens anteriores. Continua filtrado por workspace/conversa; cursor inválido recebe400.
7. Financeiro do fundador ganhou funil e caixa acumulado30/60/90 na tela existente, reutilizando o modelo econômico. Campos inicialmente vazios, CAC sem denominador indisponível, reserva separada de despesa e nenhuma transferência/ledger alterados. Inputs novos duram a sessão; persistência/backup de cenários do planejador original permanece separada.
8. Financeiro limpa dados quando acesso falha e descarta respostas de cargas antigas. O gate founder no servidor, catálogo, preços e permissões não foram ampliados.

Fluxo preservado: **Meta → HMAC → conexão/workspace → persistência → Conversas → pedido humano à WIA → aprovação/tarefa interna → ação humana separada de envio → Graph → recibo correlacionado**. Aprovação WIA não envia a mensagem ao cliente. Texto externo não ganha autoridade administrativa.

## WhatsApp: matriz exigida

| Capacidade | Código | Evidência local | Remoto positivo |
|---|---|---|---|
| Recebimento | IMPLEMENTADO texto/marcador | PASS handler com HMAC sintético e SQL | BLOCKED_EXTERNAL |
| Persistência | IMPLEMENTADO | PASS PostgreSQL17, claim, dedup e fixture A/B | BLOCKED_EXTERNAL |
| Exibição em Conversas | IMPLEMENTADO/PARCIAL | PASS contratos, aviso, recibos e layouts | BLOCKED_EXTERNAL |
| Preparação de resposta | IMPLEMENTADO determinístico | PASS fontes, janela e esclarecimento textual | BLOCKED_EXTERNAL |
| Envio oficial | IMPLEMENTADO texto e controles | PASS adaptador/gateway com doubles; zero envio real | BLOCKED_EXTERNAL |
| Recibos de entrega/leitura | IMPLEMENTADO | PASS destinatário, ledger, replay, corrida e ordem | BLOCKED_EXTERNAL |
| Integração WIA | PARCIAL | PASS preparação governada; compreensão generativa não homologada | BLOCKED_EXTERNAL |
| E2E remoto | NÃO EXECUTADO | Fixtures não o substituem | BLOCKED_EXTERNAL |
| Templates fora da janela | AUSENTE | Texto livre permanece bloqueado | NOT_TESTED |
| Mídia e Coexistence | PARCIAL/AUSENTE | Marcador não é interpretação; Coexistence não comprovado | NOT_TESTED |

Consulta agregada real de27/10: **zero conexões, eventos, envios Meta e tarifas aprovadas**. Inspeção de nomes de secrets é histórica, de26/10; não presumir configuração atual. Não houve criação de ativo, usuário, tarifa ou permissão.

## Planejamento: fonte, inventário e contagem

Sites confirmou projeto ativo, versão2 e URL original. O conteúdo publicado não foi lido: web indisponível e navegador bloqueado por revisão automática da origem privada. Não houve contorno. **BLOCKED_SOURCE para comparar a publicação atual**; quantidade de mudanças existentes apenas no navegador é indeterminada.

Foi lido o HTML local original com seis capítulos,19fontes, oito áreas e módulos editáveis. Hashes, seções e critérios constam do [inventário](ORKTO_PLANNING_2027_REQUIREMENTS.md) e [JSON](ORKTO_PLANNING_2027_REQUIREMENTS.json). Documentos atuais do repositório são continuação identificada, sem substituir silenciosamente a publicação.

| Classificação exclusiva | Quantidade | Significado |
|---|---:|---|
| PLANNER_LOCAL |18| Existe no planejador offline preservado; não implica integração ao app comercial |
| IMPLEMENTED_LOCAL |3| Capacidade no app/servidor, incluindo gate founder existente e novas simulações |
| PARTIAL |11| Implementação ou aceitação incompleta |
| BLOCKED_EXTERNAL |8| Configuração, decisão, dados ou validação externos |
| Total |40|29 administrativos e11 comerciais |

**25 requisitos têm ao menos uma asserção ou interação local relacionada**, sem significar25 homologações integrais. Evidência e limite por ID no JSON. Os demais não foram promovidos a PASS por leitura de documentação. Recursos administrativos não foram colocados no painel de clientes; não foi criada outra aplicação.

Calendário de marketing é pauta para revisão, sem publicação. Comparação de países é descoberta, sem oferta estrangeira. Revisão jurídica, tradução integral e métricas observadas de retenção não foram fabricadas. Mantidos StartR$79,90, ProR$149,90, BusinessR$299,90, ScaleR$599,90 e Enterprise sob consulta. Compatibilidade financeira legada não cria ofertas novas. Franquias e tarifas continuam dependentes de aprovação.

## Testes e limites

- **399/399 aplicação +108/108 ferramentas PASS**, no SHA final `d57cff0`. Não reutiliza contagens históricas.
- Lint, typecheck Edge com shim e build/smoke isolados PASS no mesmo SHA; `distPreserved=true`. Não é execução Deno ou CI remotos.
- PostgreSQL17.11: **53/53 migrations novas** e **46/46 selecionadas no upgrade**. Asserts adicionais de mensagem não suportada, recibos, associação única, disconnect e aprovação WIA passaram com rollback. Sem migrations remotas.
- Histórico com10mil mensagens sintéticas:201 retornadas, índice utilizado,0,162ms nesta medição local. Não é p95, concorrência ou benchmark remoto. [EXPLAIN](evidence/whatsapp-launch-r2-20261027/history-performance.log).
- Planejador original:12 verificações reexecutadas e artefato com6documentos/19fontes/3scripts, zero dependências de rede, sem edição do original.
- QA de fixtures em390/768/1280px, sem overflow do documento nas medidas; rascunho preservado durante polling, estado não suportado, recibo fictício e cálculos sintéticos. [Medidas](evidence/whatsapp-launch-r2-20261027/visual-checks.json). Sem aparelho físico, teclado virtual real ou leitor de tela.
- Harness registra aviso esperado de variáveis Supabase ausentes; nenhuma credencial real foi fornecida. Não afirmar console integralmente limpo nem sessão remota validada.
- Primeiras rodadas tiveram falhas ambientais de loopback/realpath; reexecução autorizada em localhost passou sem enfraquecer TLS. SSR detectou imports ESM sem extensão, corrigidos. Primeiro assert SQL tinha nomes de coluna errados na fixture, corrigidos sem suprimir asserções.
- Secret scan final e hashes no [manifesto](evidence/whatsapp-launch-r2-20261027/validation-manifest.json). CI remoto NOT_TESTED; sem push não houve rodada GitHub. Workflow atualizado para53 e novo assert em replay/upgrade.

## Pendências e intervenção mínima

O código ainda não implementa envio de templates, download/render/transcrição de mídia ou despacho externo autônomo. Compreensão generativa completa, persistência dos novos cenários no app e indicadores reais de aquisição/retention permanecem parciais. Não declarar a missão integral concluída.

Para provar texto real: [manual exato](ORKTO_WHATSAPP_LIVE_SETUP.md). Identificar ativos/par de teste, cadastrar secrets no painel seguro, confirmar callback/inscrição/elegibilidade, aprovar tarifas/limites e rodada, revisar rollout isolado do SHA/migrations/funções, executar entrada→resposta→recibo e A/B real. Nenhum segredo deve ser enviado no chat.

Para comparar a publicação privada, é necessária autorização explícita da origem bloqueada ou exportação atual do proprietário. A cópia local permitiu concluir o trabalho independente.

**Sem produção, merge, push, cobranças, mensagens reais ou inferência paga. READY_FOR_PRODUCTION_CANDIDATE=NO.**

## Arquivos dos dois commits de implementação

- .github/workflows/validate-migrations-postgres17.yml
- backend/channels/message-history.ts
- backend/core-app.ts
- backend/finance/launch-planning.ts
- src/components/inbox/ConversationView.tsx
- src/components/internal/FinanceDashboard.tsx
- src/components/internal/LaunchPlanningPanel.tsx
- src/product/conversation-message.ts
- src/product/screens/inbox-workspace.tsx
- supabase/functions/orkto-core-mutations/_shared/whatsapp-reply.ts
- supabase/functions/orkto-meta-webhook/index.ts
- supabase/migrations/20261027111004_meta_unsupported_message_notice.sql
- supabase/tests/assert_meta_message_states.sql
- supabase/tests/assert_readiness.sql
- tests/conversation-message.test.ts
- tests/launch-planning-ui.test.ts
- tests/launch-planning.test.ts
- tests/message-history.test.ts
- tests/meta-webhook-handler.test.ts
- tests/visual/harness.tsx
- tests/whatsapp-reply.test.ts
