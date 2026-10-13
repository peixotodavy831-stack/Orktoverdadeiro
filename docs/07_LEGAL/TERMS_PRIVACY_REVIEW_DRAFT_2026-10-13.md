# ORKTO — minuta factual para revisão de Termos e Privacidade

**Data:** 13/10/2026
**Estado:** minuta interna; não aprovada, não publicada e não adequada para coleta de aceite.

## Escopo de produto a descrever

O primeiro piloto proposto atende uma empresa, um workspace e um operador proprietário. O aplicativo organiza clientes, contatos, catálogo, negócios, propostas, decisões internas da Inbox e consultas/ações internas da WIA sob autorização e auditoria. Proposta publicada por link é uma ação específica; a criação de uma proposta não representa envio nem entrega por canal externo. PIX real, cobrança automática, WhatsApp/mensagem externa, provider de IA pago e memória compartilhada entre empresas permanecem desligados neste piloto. Não descrever essas capacidades como serviço contratado ou ativo antes de validação e ativação própria.

## Termos: texto-base para revisão jurídica

1. **Prestador e objeto.** “A ORKTO disponibiliza, nos limites do plano ou piloto acordado, uma plataforma de organização comercial com registros de clientes, oportunidades e propostas, consultas assistidas e ações internas autorizadas. Os recursos efetivamente habilitados constam da proposta comercial e das configurações da conta.” Identificação legal do prestador, endereço e canais oficiais: **PENDENTE DO PROPRIETÁRIO**.
2. **Acesso e responsabilidade.** Definir quem pode criar a conta, representar a empresa, convidar pessoas e gerir acesso. No piloto atual, admitir somente o operador proprietário até a funcionalidade Equipe ser validada. Definir tratamento de credenciais, incidentes e encerramento de acesso.
3. **WIA e decisões.** “Respostas e recomendações da WIA podem exigir revisão humana. Texto sugerido ou requisição aceita não comprova execução, envio, entrega, pagamento ou resultado. Ações externas e financeiras dependem de habilitação e autorização específicas.” Revisar responsabilidade por conteúdo e decisões comerciais.
4. **Plano, preço e duração.** Inserir somente condições aprovadas para a empresa piloto: gratuidade ou valor, duração, limites, suporte, cancelamento, dados após saída e eventual renovação. Os valores do simulador financeiro não devem ser copiados para oferta.
5. **Canais e pagamentos.** Omitir promessa atual de WhatsApp/Asaas/PIX/cartão. Se algum canal ou pagamento for ativado depois, acrescentar condições específicas, recibos, falhas, reembolso, opt-out e limites antes de receber aceite.
6. **Dados e encerramento.** Definir titularidade, exportação, retenção, exclusão, solicitações de titulares, suporte e prazo de resposta. Não preservar a promessa atual de exclusão em 30 dias sem procedimento e capacidade verificados.

## Privacidade: texto-base para revisão jurídica

1. **Papéis e contato.** Identificar o controlador/operador em cada fluxo B2B, encarregado ou canal de privacidade, jurisdição e base legal. **PENDENTE DE DEFINIÇÃO JURÍDICA.**
2. **Categorias reais.** Descrever contas/autenticação, identificação da empresa, clientes e contatos cadastrados pelo workspace, negócios, propostas, eventos de auditoria e consultas WIA. Confirmar por inventário técnico os campos efetivamente coletados antes de listar CPF/CNPJ, chave PIX, endereço ou dados financeiros como coleta universal.
3. **Finalidades.** Operar a conta, aplicar autorização e isolamento por workspace, registrar ações e falhas, prestar suporte e cumprir obrigações aplicáveis. Separar analytics e comunicação opcional das finalidades essenciais.
4. **Operadores e fornecedores.** Supabase hospeda Auth/banco no staging; Vercel hospeda o Preview. `index.html` inclui script Umami; confirmar envio, cookies, retenção e ambiente antes de descrever o uso. Sentry depende de configuração e está desabilitado em staging. Asaas e Resend constam do código, porém sem credenciais no Preview atual; só incluí-los como operadores ativos no serviço quando houver fluxo efetivamente habilitado. Confirmar suboperadores, localização/transferência internacional e acordos.
5. **IA.** Descrever quais dados podem ser enviados a modelos quando o provider for ativado, finalidade, retenção do provider, logs, escolha de modelo e intervenção humana. A WIA determinística do piloto pode operar sem chamada paga.
6. **Segurança, retenção e direitos.** Descrever apenas controles comprováveis; definir prazos por categoria, backups, exclusão/exportação, resposta a titulares, incidentes e contatos. A frase atual “dados removidos em até 30 dias” exige prova operacional antes de reutilização.

## Diferenças concretas dos HTMLs publicados

| Arquivo/seção atual | Problema | Ajuste para revisão |
| --- | --- | --- |
| `public/termos.html` §§2 e 4 | Apresenta WhatsApp, Asaas, assinatura recorrente, PIX/cartão e política de reembolso como serviços ativos. | Substituir pelo escopo habilitado do piloto e condições comerciais aprovadas; publicar integrações separadamente quando operacionais. |
| `public/termos.html` §1 e tela de cadastro | Faz o cadastro equivaler a aceite de texto ainda não aprovado. | Suspender contratação real e aceite até versão jurídica com data/identidade aprovada; registrar a versão aceita. |
| `public/privacidade.html` §§1–3 | Lista coleta e operadores como universais sem conciliação com o ambiente efetivo. | Inventariar dados e fornecedores por fluxo/ambiente; separar ativos, condicionais e desabilitados. |
| `public/privacidade.html` §§6–7 | Afirma cookies e exclusão em 30 dias sem verificação final. | Confirmar comportamento e procedimento de retenção/exclusão antes de assumir prazo. |

## Aprovação requerida

O proprietário deve definir empresa piloto, gratuidade ou preço, duração, limites e suporte; identificar a entidade contratante e responsáveis; e submeter a redação a profissional habilitado. Registrar versão, data, aprovador, fluxos cobertos e evidência de publicação. Nenhum arquivo `public/` foi alterado por esta minuta.
