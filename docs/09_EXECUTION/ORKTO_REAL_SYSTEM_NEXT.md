# ORKTO Real System — próximo ciclo

30/10/2026. Continuar exclusivamente em `feat/orkto-real-system-2027`, código R2 `77634fd` (R1 `939426c` preservado). **A missão total não está encerrada. READY_FOR_PRODUCTION_CANDIDATE=NO.**

## Engenharia ainda independente de credenciais

1. O adaptador de eventos e a recuperação após reload estão implementados localmente na R2. Consultar [contrato e gate de publicação/RLS/A+B](ORKTO_REAL_SYSTEM_R2.md); manter o flag OFF até homologação real. Não há broadcast público nem assinatura de DELETE.
2. Ampliar integração HTTP com banco local, preservando GET sem escrita. A recuperação atual lê o resultado durável; não exige gravar novamente o turno nem inferir.
3. Paginação de conversas e histórico completo; limite atual de200 é explícito, não uma promessa de busca em todo o acervo.
4. Regressão de operações completas com PostgreSQL local e mocks somente na fronteira do fornecedor; ampliar UI para erros de quota/revogação/concorrência sem novos direitos comerciais.

## Intervenções externas mínimas

- **Acesso de gerenciamento staging:** reconectar o Supabase à sessão de ferramentas ou executar login seguro do CLI fora do chat. O conector retornou exigência de `link_id`; o CLI não encontrou access token. Não enviar credenciais. A tentativa pelo navegador também não abriu o projeto staging e terminou na lista de organizações. Os valores atuais de Meta/Gemini/Asaas permanecem NOT_VERIFIED, sem inferir ausência.
- **Publicação:** autorizar separadamente um candidato isolado com frontend, API, Edge e migration54 revisados. Confirmar Supabase/projeto Vercel e callback exato antes de publicar; nunca apenas o frontend com a política antiga de chat. Não mudar a PR2 nem usar produção.
- **Google A/B:** usar somente as duas identidades e empresas já aprovadas. Login/2FA direto no Google quando necessário. Sem exportar cookies, JWTs, refresh tokens ou storage para arquivos. Executar G01–G12 reais; expiração natural e replay respeitam a semântica Supabase.
- **IA real:** confirmar modelo, workspace, tarifa vigente, franquia Pulso e teto de gasto expressamente aprovados; cadastrar credencial apenas no secret store. Não iniciar inferência paga somente por existir uma chave.
- **Meta:** conferir app/Embedded Signup/WABA/telefone de teste, callback, HMAC, destinatário e consentimento, limites/custos e autorização de uma rodada controlada de envio. Não usar o cadastro de cliente como aprovação implícita.
- **Asaas:** customer exclusivamente sintético aprovado, workspace de teste autorizado, todos os canais de notificação desativados, sandbox confirmado e API key/webhook secret somente no secret store. Preservar customer/assinatura legados. B01–B13 dependem de autorização específica; billing permanece OFF.
- **Comercial/recuperação:** aprovar franquias, assentos, limites e término de acesso; confirmar recurso de backup e autorizar restore drill. Não contratar plano ou presumir PITR disponível.

Manter cinco planos e preços existentes. Cada nova prova deve indicar SHA da aplicação, versão Edge, migrations e ambiente. Não reutilizar relatórios locais como comprovação de staging. Documentação de fornecedor consultada não é prova de uma conta configurada.

Não existe execução autônoma em segundo plano prometida por este documento. Próximo trabalho parte deste checkpoint, com bloqueios externos explícitos.
