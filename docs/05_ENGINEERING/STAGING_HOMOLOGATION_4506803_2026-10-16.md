# ORKTO — homologação final do staging 4506803

**READY_FOR_PRODUCTION_CANDIDATE=NO.** PR #2 draft, sem merge. Runtime avaliado: `45068033a3b41f7fb170ca174408dc5fd1ba53fa`, [Preview](https://orkto-staging-g8jxnq6ye-peixoto-s-projects1.vercel.app/), deployment `dpl_4Np4vbkDNQWSxLAtVLvHzxzeXf5e`, projeto `orkto-staging`, target Preview, READY. HEAD documental inicial `278145d`; nenhum código executável alterado nesta homologação.

## Evidências e critérios

[Evidência sanitizada por teste](evidence/staging-homologation-4506803.json). Screenshots: [login A](evidence/google-owner-4506803.png), [redirect salvo](evidence/redirect-4506803.png), [quota Enterprise](evidence/enterprise-quota-4506803.png), [backup Free](evidence/backup-free-staging.png).

| Gate | Resultado | Prova / limite |
| --- | --- | --- |
| Redirect exato | PASS | Estava ausente. Proprietário confirmou salvar; lista passou de 15 a 16 URLs. Novo endereço com barra final persistido; Site URL anterior preservado. |
| Google A real / callback | PASS | Conta A aprovada selecionada no Google; retorno ao Preview exato; Hoje e billing reais carregados. |
| Persistência | PASS | Reload manteve sessão e workspace original. |
| Refresh / expiração natural | NOT_TESTED | Reload não comprova renovação de token. Não foi forçado TTL, alterada configuração de sessão nem esperado vencimento natural. |
| Logout / remoção de sessões | PASS | Sair voltou à landing; reload permaneceu deslogado; auth.sessions de A caiu de 2 para 0. |
| Replay de JWT/refresh revogado | NOT_TESTED | Não foram extraídos tokens do navegador. Remoção de sessões não substitui ensaio de replay HTTP. |
| Identidade B aprovada | PASS_APPROVAL | Proprietário indicou B e aprovou owner somente em novo workspace isolado, por 30 dias. Admissão e auditoria registradas; expira em 15/11/2026 16:08 UTC. Email permanece apenas na configuração privada, sem publicação neste relatório. |
| Login B / workspace B | BLOCKED_EXTERNAL | Google pede senha/2FA; aguardando preenchimento direto pelo proprietário. Usuário/workspace ainda não criados. Não foi criada conta por senha. |
| A/B real RLS / Edge / API | BLOCKED_EXTERNAL | Depende do login B e execução dos negativos reais. Testes sintéticos anteriores não promovidos a PASS. |
| Allowlist e papéis | PASS_STRUCTURAL | Schema privado sem USAGE para anon/authenticated; browser não insere/altera/remove admissões. Zero usuários Auth sem admissão. Owner de B foi explicitamente aprovado, não inferido de metadata do Google. |
| Enterprise persistido | PASS | Formulário autenticado → API → Edge → RPC gravou solicitação. Mesmo conteúdo/chave repetidos: mesmo protocolo, sem duplicação. |
| Enterprise quota / auditoria | PASS | Cinco chaves distintas, cinco linhas, cinco eventos commercial.proposal.requested. Sexta solicitação recusada; banco continua com cinco. Zero bindings de pagamento. |
| Catálogo e Pulso | PASS_GUARD / PENDING_DECISION | Cinco ofertas exatas, v2; nenhum novo plano. Zero política Pulso/tarifa criada. UI informa franquia não aprovada. |
| Asaas fail closed | PASS | POST sem segredo ao webhook retorna 503 CONFIGURATION_REQUIRED antes de persistência/chamada ao fornecedor. |
| Asaas sandbox real | BLOCKED_EXTERNAL | UI de secrets mostra zero secrets customizados; zero customers aprovados e zero bindings no banco. Nenhuma chamada Asaas executada. |
| Cancelamento nativo do Asaas | BLOCKED_IMPLEMENTATION_AND_POLICY | Handler atual só aceita PAYMENT_*. SUBSCRIPTION_INACTIVATED/DELETED e cancel/update no fornecedor não estão conectados. Política comercial de término de acesso precisa ser aprovada; o resultado unitário de cancellation não comprova essa integração. |
| Pagamento/renovação/falha/replay real | BLOCKED_EXTERNAL | Fixtures passam; nenhum evento real de sandbox foi recebido. Não há homologação de ciclo completo. |
| Backup gerenciado / PITR | BLOCKED_BY_PLAN | Organização Free e painel Backups confirmam ausência de backups de projeto no Free. Nenhum upgrade, restore ou alteração comercial. |
| Gemini / Meta real | BLOCKED_EXTERNAL | Sem secrets/configuração de fornecedor. Sem inferência paga ou mensagem externa. |
| Regressões focadas | PASS_LOCAL | 33/33 Google, catálogo, billing, reconciliação e webhook; zero falhas/skips, acesso externo mockado/proibido nos testes do handler. |
| Produção / merge | PASS_SCOPE | Intocados. |

### Reprovações e intercorrências

Nenhum teste focado de produto falhou. O batch de automação da quota alcançou 60 segundos e perdeu o estado da ferramenta; a página e as contagens foram inspecionadas antes de continuar. A sexta solicitação foi então concluída e negada. Isso não foi tratado como falha funcional nem como PASS sem prova.

A mensagem da quota é genérica (“Não foi possível concluir a operação.”). O limite protegeu o banco; não foi validada uma mensagem específica de quota nem um HTTP 429. O gap de ciclo nativo de assinatura acima é engenharia pendente, não apenas falta de credenciais.

### Dados de teste e impacto

Cinco solicitações sintéticas foram identificadas pelo prefixo “Homologação técnica 4506803”. Cinco eventos de auditoria correspondentes foram preservados. O workspace A consumiu a quota de cinco solicitações Enterprise em 24 horas; o limite volta conforme esses registros saem da janela. Não foram apagados dados/auditoria para esconder o teste. Nenhuma assinatura, cobrança, nova permissão na empresa A ou franquia comercial foi criada.

## Asaas sandbox — preparação e sequência de homologação

### Configuração que falta

No secret store das **Edge Functions do projeto ghrjongiodziasupakrk**, nunca no Vite/Preview ou chat:

| Nome | Origem / condição |
| --- | --- |
| ASAAS_API_KEY | Chave exclusiva da conta sandbox autorizada; não criar conta/chave em nome do proprietário sem confirmação aplicável. |
| ASAAS_WEBHOOK_SECRET | Segredo dedicado diferente da API key, com pelo menos 32 caracteres. |
| APP_ENV | staging |
| ASAAS_ENVIRONMENT | sandbox |
| ORKTO_BILLING_SANDBOX_ENABLED | Manter ausente/OFF até customer, notificações, webhook e política de teste conferidos; ON somente na homologação controlada. |

A URL Supabase já é fornecida pelo runtime. Endpoint do fornecedor é fixo em `https://api-sandbox.asaas.com/v3`. Callback: `https://ghrjongiodziasupakrk.supabase.co/functions/v1/orkto-billing-webhook`.

O proprietário deve identificar a conta e o customer **de teste** autorizados. Conferir no fornecedor que notificações email/SMS/WhatsApp e envio postal estão desativados. Não presumir que sandbox elimina mensagens: [documentação Asaas](https://docs.asaas.com/docs/sandbox-2). Somente então vincular customer ao workspace escolhido em orkto_billing_customers, com aprovador e ambiente sandbox; nenhum vínculo foi criado agora.

### Execução após configuração

1. Confirmar conta sandbox, customer, notificações desativadas, preço v2 e workspace alvo. Guardar apenas aliases/IDs sanitizados e horários.
2. Criar Start pelo endpoint autenticado de sandbox com idempotency key única. Confirmar reserva durável e acesso anterior preservado; criar assinatura não confirma pagamento.
3. Repetir a chave antes/depois de resposta do fornecedor; exigir uma única assinatura/binding. Em resultado incerto, reconciliar; não reenviar criação automaticamente.
4. Receber PAYMENT_CREATED/PENDING e verificar que não libera acesso. Token inválido, preço/customer/empresa divergente e evento incompleto devem falhar sem ativar.
5. Simular confirmação **no sandbox** com customer autorizado, receber evento real, reler pagamento e assinatura no fornecedor, comparar vínculo/valor/moeda/referência e confirmar mutação auditada.
6. Reentregar o mesmo evento e payload; exigir REPLAY sem duplicação. Evento velho não regride renovação mais recente; mesmo ID com fingerprint diferente exige reconciliação.
7. Renovação usa pagamento/período novo; período futuro não libera acesso antecipado. Falha/outage mantém estado desconhecido/pendente sem ativação fictícia.
8. Cancelamento/inativação nativos exigem completar o gap de implementação e aprovar se o término ocorre ao fim do período pago ou imediatamente. Não cadastrar eventos SUBSCRIPTION_* como se fossem suportados hoje.
9. Testar expiração por relógio/período controlado no ensaio autorizado e confirmar servidor negando acesso. Não alterar a assinatura da empresa A ou atribuir plano comercial só para fazer o teste passar.
10. Manter checkout público e notificações reais OFF ao concluir. Registrar respostas bounded, reconciliação e ledger; jamais API key, token, payload completo com dados pessoais ou JWT.

[Assinaturas](https://docs.asaas.com/reference/create-new-subscription) e [eventos nativos de assinatura](https://docs.asaas.com/docs/subscription-events) foram consultados em 16/10/2026. O ciclo de assinatura é distinto do ciclo financeiro do pagamento.

## Decisões comerciais ainda pendentes

Preservados Start R$79,90; Pro R$149,90; Business R$299,90; Scale R$599,90; Enterprise sob consulta. Não reapresentar os preços aprovados como decisão aberta.

Aprovar por plano: usuários/assentos; franquia Pulso e validade; consumo por classe; limites operacionais; overage/bloqueio; suporte/SLA; impostos e condições contratuais; cancelamento/refund e término de acesso. Referências Pulso 0,25/0,5/1/2–4 são hipóteses, não políticas publicadas. Nenhuma política ou tarifa foi semeada nesta fase.

## Gemini — procedimento preparado, sem chamada

- Usar projeto/credencial autorizados no AI Studio. Verificar tier/custo/modelo/quota antes da chamada. Chaves novas podem ser authorization keys; standard keys irrestritas são recusadas conforme [guia oficial](https://ai.google.dev/gemini-api/docs/api-key). Nenhuma chave criada ou lida.
- Cadastrar GEMINI_API_KEY somente no secret store Edge; selecionar WIA_GEMINI_MODEL existente no projeto; informar WIA_GEMINI_TEST_WORKSPACES apenas com workspace de teste aprovado.
- Manter WIA_STAGING_GEMINI_TESTS OFF até autorização de teste/custo, política Pulso e tarifa versionada aprovadas. Ausência de tarifa não é custo zero.
- Iniciar com consulta determinística sem modelo. Para inferência autorizada, usar entrada sintética, limites de tokens, uma solicitação idempotente, proveniência e auditoria; confirmar débito/reserva e saída sem execução externa.
- Ensaiar cota esgotada, timeout, resposta inválida e repetição; não enviar mensagens ou aprovar ações automaticamente. Nenhuma chamada paga autorizada neste pedido.

## Meta — procedimento preparado, sem mensagem

Configuração ausente: META_APP_ID, META_APP_SECRET, META_EMBEDDED_SIGNUP_CONFIG_ID, META_GRAPH_API_VERSION, META_EMBEDDED_SIGNUP_REDIRECT_URI e META_WEBHOOK_VERIFY_TOKEN. Tokens de conexão devem ir para Vault; nenhum token no navegador ou repositório.

1. Proprietário identifica App/WABA/número de teste e elegibilidade; não migrar número real ou presumir coexistência.
2. Confirmar versão Graph suportada, permissões e callback HTTPS no fornecedor. Manter envio OFF.
3. Endpoint de staging: `https://ghrjongiodziasupakrk.supabase.co/functions/v1/orkto-meta-webhook`. Conferir challenge, assinatura HMAC no corpo bruto, tenant por conexão persistida e deduplicação.
4. Homologar eventos de teste do painel sem enviar mensagem externa; assinatura errada, WABA/número estrangeiro e replay devem ser negados/isolados.
5. Conferir tarifas e controles antes de qualquer envio futuro. O pedido atual proíbe mensagens reais.

A consulta atual à documentação Meta retornou 429/indisponibilidade. O procedimento descreve a implementação existente e os dados que precisam de conferência no painel; não certifica regras atuais de App Review/coexistência.

## Recuperação disponível

[Organização Free](https://supabase.com/dashboard/org/kdmnypyaalcpkppjjhxa) confirmada por conector; [painel de backups staging](https://supabase.com/dashboard/project/ghrjongiodziasupakrk/database/backups/scheduled) confirma que Free não inclui backups gerenciados. [Guia oficial](https://supabase.com/docs/guides/platform/backups) recomenda exportações regulares via CLI no Free; backups de banco não recuperam objetos do Storage.

Alternativa a preparar: dump lógico com credencial DB fornecida diretamente em secret store, destino privado aprovado, checksum, cópia off-site, configuração/Edge separadas e restore em PostgreSQL17 isolado. Não foi exportado dado real para destino não aprovado nem executado restore sobre staging. O ensaio sintético de CI anterior permanece histórico e não comprova recuperação gerenciada, Auth/Google, Storage ou RPO/RTO real. PITR é recurso pago; nenhum plano/add-on foi ativado.

## Ações humanas mínimas

1. Concluir login B diretamente na aba Google já preparada, incluindo 2FA. Não enviar credenciais pelo chat. A admissão e o redirect já foram resolvidos.
2. Identificar conta/customer sandbox e inserir chave/token dedicado somente no secret store. Confirmar notificações desativadas. Depois executar homologação real e concluir o gap nativo de cancelamento.
3. Aprovar condições comerciais ainda abertas; informar configuração e orçamento de teste Gemini quando desejar essa homologação; preparar App/WABA/número de teste Meta.
4. Definir estratégia de backup compatível com Free ou decidir posteriormente sobre plano pago; nenhuma compra automática.

A/B, ciclo completo de sessão/billing, integrações e recuperação continuam obrigatórios. Não marcar readiness YES enquanto faltarem provas.
