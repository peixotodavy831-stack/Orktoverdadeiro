# ORKTO Pilot 01 — plano de validação

**Estado:** proposta operacional, 12/10/2026. Não é oferta, contrato ou autorização de go-live.

## Escopo inicial

Uma empresa, um workspace e um operador proprietário. Convites e operação multiusuário só entram se o fluxo de Equipe for implementado e validado; a navegação atual o marca indisponível. Validar cadastro, onboarding, Clientes, Contatos, Catálogo, Negócios, Propostas, Inbox interno e WIA determinística com aprovação/auditoria. Usar dados da empresa somente após acordo e configuração jurídica aprovados. PIX real, cobrança automática, envio externo, provider de IA pago, memória cross-workspace e publicação de cases permanecem desligados.

## Pré-condições para convidar o primeiro cliente

Atualização 14/10/2026: a implementação de confirmação/recovery foi corrigida e o Preview atual é d693e2f; falta validação autenticada nesse SHA. Custom SMTP está ausente no staging. Antes de prometer cadastro/recuperação a cliente, configurar remetente aprovado e comprovar entrega, confirmação e reset com destinatário autorizado. Não usar o serviço de e-mail padrão como prova de capacidade comercial. A matriz vigente é `docs/05_ENGINEERING/MVP_CLOSURE_2026-10-14.md`.

1. Preview do commit candidato confirmado no projeto `orkto-staging`, com migrations e Edge Function compatíveis; Auth A/B, tenant isolation e E2E completos no mesmo deployment.
2. Checkpoint de segurança fechado, incluindo proveniência WIA, autorização da matriz de mutações, RLS/grants, secrets, rate limits, falhas e auditoria. Nenhum achado crítico ou alto aberto.
3. Runbook de deploy, rollback/forward-fix, backup/restore, suporte e resposta a incidente revisado. Evidência de recuperação compatível com o plano contratado.
4. Proprietário aprova segmento/cliente piloto, limites, preço ou gratuidade, prazo, suporte e critérios de saída. Jurídico aprova termos, privacidade, DPA e integrações que serão usadas.
5. Proprietário autoriza separadamente a publicação em produção. Staging e testes não equivalem a essa autorização.

## Jornada de aceite do piloto

| Passo | Evidência exigida |
| --- | --- |
| Visitar site, entender escopo e solicitar acesso | Copy corresponde somente às capacidades habilitadas; contato e suporte alcançáveis. |
| Criar conta e workspace | E-mail confirmado, sessão válida, configuração inicial persistida, workspace correto. |
| Entrar como proprietário e testar usuário sintético de outra empresa | Sessão correta e isolamento entre workspaces comprovados; convites ficam fora do piloto enquanto Equipe estiver indisponível. |
| Registrar cliente e contato | Gateway autorizado, auditoria, replay idempotente, escrita direta negada. |
| Criar negócio e proposta | IDs do mesmo workspace, valores consistentes, estados reais de publicação/visualização/decisão. |
| Consultar WIA e aprovar ação interna | Fontes e proveniência confiáveis; aprovação, execução e resultado distintos e auditados. |
| Usar Inbox | Estado interno persistido; sem declarar entrega externa sem recibo do provider. |
| Falha e recuperação | Erro compreensível, nenhuma cobrança/mensagem duplicada, caminho de suporte e rollback. |
| Sair e voltar | Sessão encerrada, login recuperável, dados persistidos e isolados. |

## Operação e encerramento

Registrar para cada execução: SHA/deployment, migration ledger, workspace sintético ou piloto, data, operador, resultado, request IDs e falhas redigidas. Interromper o piloto diante de vazamento entre tenants, escrita indevida, cobrança/mensagem não autorizada, perda de dados ou proveniência WIA incorreta. O proprietário decide correção, comunicação e retomada. O piloto termina com relatório de uso e decisão explícita de expandir, repetir ou encerrar; não há conversão automática em assinatura.
