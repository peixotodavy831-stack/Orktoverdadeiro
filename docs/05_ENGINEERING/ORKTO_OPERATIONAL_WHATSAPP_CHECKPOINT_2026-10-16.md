# ORKTO — checkpoint operacional e WhatsApp · 16/10/2026

## Escopo e limites
Continuação incremental da missão do proprietário no checkout Orktoverdeiro-google-pilot, branch production-readiness/google-only-pilot-preflight. Produção, migrations remotas, cobrança e mensagens externas não foram alteradas. Este documento não é uma aprovação de lançamento.

## Diagnóstico por componente
| Componente | Evidência do código | Estado desta execução |
|---|---|---|
| Auth Google e workspace | Middleware autenticado, membership ativa, piloto allowlist | Preservado; E2E A/B completo deste candidato NOT RUN |
| Core comercial | Gateway de mutações e funções SQL existentes | Regressão HTTP local PASS; não representa nova validação remota completa |
| WIA/WIAOS | T0 e PREPARE_WIA_T0 no gateway; provedor Gemini existente no backend | Consultas determinísticas preservadas. Gemini no fluxo confiável da Edge ainda PENDING |
| Gemini de teste | GeminiModelProvider, teste de JSON/guardrails e runner de solicitação sintética única | Testes com fixtures PASS; chamada real NOT RUN sem chave de teste |
| WhatsApp atual | /api/whatsapp/webhook usa segredo interno e WHATSAPP_TENANT_ID fixo | Não equivale a Cloud API multiempresa. Não ativado |
| Cloud API | Novo normalizador com HMAC de bytes originais e binding confiável por número/WABA | Testes locais PASS; ainda não ligado a endpoint/persistência, Embedded Signup ou envio real |
| Custos WhatsApp | Novo estimador puro por versão, categoria, moeda, país e vigência | Testes locais PASS. Sem tarifas reais aprovadas, conciliação ou medição remota |
| Cobrança | /api/asaas/checkout permanece explicitamente desativado | Bloqueado por condições comerciais e integração; nenhuma assinatura criada |
| Plano atual | Correção de GET /api/billing/current para JWT/RLS da requisição | Regressão HTTP local PASS; leitura autenticada no novo Preview PENDING |
| Integrações | Nova consulta autenticada de estado e tela sem sucesso simulado | Exibe limitações reais. Nenhuma conexão externa ativada |

## Mudanças de interface
- Sidebar: removida a soma de espaçamento space-y com gap; grupos mais próximos e linhas desktop de 36px. Gestão pode ser expandida/recolhida, abrindo ao navegar para um módulo do grupo. Navegação móvel mantém alvos existentes.
- Identidade: logo da empresa se disponível, foto Google como alternativa; foto pequena da conta quando ambas existem. Fallback para inicial em falha; imagens HTTPS sem credenciais, foto Google com host validado e referrerPolicy=no-referrer. Clique abre Perfil.
- Plano & cobrança: estado de acesso em português, planos inexistentes não são apresentados, botões de contratação inoperantes removidos. Continua impossível assinar enquanto checkout e condições não forem aprovados/implementados. Não declarar esse pedido concluído.

## Gemini: caminho seguro de teste
O proprietário autorizou Gemini provisório para testes. A investigação confirmou que permitir uma chave no Preview não substitui a fronteira de proveniência da Edge. O guard final continua recusando GEMINI_API_KEY no runtime do Preview, mesmo com flag de teste; também recusa variáveis públicas contendo a chave. Nenhuma chave foi provisionada ou obtida nesta execução.

Teste isolado preparado, sem banco, dados reais ou ações externas:

```powershell
& 'C:\Users\sobooa7iqytvqheo\Documents\Codex\Orktoverdeiro-google-pilot\scripts\readiness\run-gemini-test-secure.ps1'
```

A chave de teste é inserida somente no prompt mascarado local. Uma chamada sintética, timeout 20s, saída limitada a 700 tokens pelo adaptador, TLS validado. Apenas enums/modelo sanitizado/latência/tokens são impressos, sem resposta textual, chave ou erro bruto. O ambiente é restaurado e o BSTR apagado no finally. A chave do OAuth Google de login não substitui uma chave da Gemini API. Este teste não aprova a WIA de ponta a ponta no Preview.

Para habilitar o chat real com Gemini: concluir o comando/model runtime na fronteira Edge, manter auditoria e idempotência no gateway, configurar o segredo nesse runtime confiável e validar negativa de acesso, isolamento e limites. Não desviar para START/COMPLETE legados não suportados para fazer a tela responder.

## WhatsApp: arquitetura restante
1. App Meta e configuração Embedded Signup próprios, permissões revisadas e elegibilidade de coexistência confirmada na conta.
2. Conexões por workspace com unicidade de phone_number_id, WABA confirmada por chamada autenticada à Meta e referência a segredo protegido; nenhum token no frontend ou tabela pública.
3. Callback OAuth com state vinculado a usuário/workspace, uso único e expiração; validar origin dos eventos do SDK e não confiar em IDs recebidos do navegador sem confirmação no servidor.
4. Endpoint Meta separado do adaptador legado. Validar assinatura dos bytes originais, resolver conexão pelo número e persistir lote em inbox durável antes do 200. Normalizador atual não faz essa persistência.
5. Deduplicação transacional entre requisições, recibos conciliados com outbox existente, reexecução controlada. A deduplicação em memória do normalizador vale somente para um lote.
6. Modos manual/assistido/automático com autorização e limites persistidos; handoff cancela automação. Não marcar disponíveis antes de implementados.
7. Envio pela Cloud API do número da empresa, janela/template/opt-out, orçamento de consumo e resultado ambíguo sem retry cego.
8. Tarifas oficiais vigentes revisadas. O texto do proprietário informa mudança em outubro; a documentação pública consultada e resultados de busca não permitiram conciliar essa alteração. Não usar gratuidade histórica ou preços permanentes. RATE_CONFIGURATION_REQUIRED enquanto faltar versão revisada.
9. Validar com número de teste e destinatário de teste autorizados, sem migrar número real ou desconectar aplicativo.

## Cobrança: o que falta
A documentação vigente COMMERCIAL_DECISIONS.md mantém preços como rascunho (não publicação aprovada). O pedido de fazer a tela funcionar não define um preço, renovação ou contrato específico. Falta confirmar preço/ciclo/condições por plano e provedor em sandbox. Implementar checkout idempotente a partir da versão aprovada no servidor, vincular intent ao workspace, validar confirmação via webhook e reconciliar assinatura; só depois habilitar contratação. Não enviar cliente real para sandbox, não ativar cobrança real nem contratar serviço pago por inferência.

## Dependências externas identificadas
- Gemini: chave de teste em entrada local ou segredo no runtime confiável apropriado, nunca por chat. Não foi possível verificar metadados Vercel nesta execução: CLI autenticada retornou fetch failed; isso não prova ausência da variável.
- Meta: app/permissões, Embedded Signup config, WABA/número de teste, credenciais no runtime de integração e elegibilidade de coexistência. Acesso externo não foi fornecido/verificado nesta execução.
- Comercial: aprovação explícita das condições públicas; depois configuração sandbox do provedor e validação. Nenhuma oferta foi aprovada em nome do proprietário.

## Evidência local
- 53 testes focados: boundary, normalização Meta, custos, canais duráveis, WIA e planos. Repetição com guard final 53/53 PASS.
- Regressão HTTP anterior 34/34 + financeiro 14/14. Com novos testes de auditoria/tenant/billing/estado de integrações, HTTP 37/37 PASS. Fixtures locais, sem tráfego Meta/Gemini real.
- Build isolado SUY5Ne: frontend Google, URL pública staging, backend e smoke PASS; dist original preservado. Aviso preexistente de chunk WebGL grande permanece; não é uma medição de performance.
- Produção intocada. Sem migrations nesta execução. Snapshot final não gerado.

READY_FOR_PRODUCTION_CANDIDATE=NO
WHATSAPP_BUSINESS_REAL=NOT_RUN
GEMINI_LIVE=NOT_RUN
ONLINE_SUBSCRIPTION=NOT_AVAILABLE
