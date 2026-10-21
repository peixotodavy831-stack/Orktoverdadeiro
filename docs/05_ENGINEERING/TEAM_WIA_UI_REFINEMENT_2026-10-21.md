# Equipe e WIA — refinamento local

Fonte: `871f4df32986a0e2894eac539d6f502d08f1eb7b`.
Branch: `feat/orkto-intelligence-whatsapp-2027`. Sem deploy, merge ou alteração da PR #2.
`READY_FOR_PRODUCTION_CANDIDATE=NO`.

## Equipe

O erro da captura do proprietário era reproduzível no harness: o fixture devolvia `{data:{members,...}}`, enquanto a API real `/api/team` e a tela usam `{members,invites,currentRole,currentUserId}` diretamente. A correção preserva esse contrato real; não relaxa autenticação nem inventa membros ausentes.

- Fixture tipado compartilhado; parser valida envelope, membros e convites antes de renderizar.
- Busca por conta/papel/status, contagem dos vínculos retornados e identificador em expansão.
- Mantidos os estados vazio, erro e acesso restrito. Nenhum usuário, convite ou papel real criado.
- Gestão de convites/papéis continua indisponível nesta tela, conforme aviso existente. Esta correção não declara essa funcionalidade implementada.

## WIA

Organizada em três seções: Pedido, Aprovações e Histórico. Aprovações mostram contador; o histórico não repete ações aguardando aprovação. Pedido e resposta ficam juntos, com as fontes em expansão; avisos de disponibilidade ficam em área própria. Removidos cartões repetidos de análise/recomendação/contexto vazio e texto redundante. Mantidos os limites reais da WIA e a confirmação explícita das ações.

Não foram alterados endpoints, Mutation Gateway, efeitos de aprovação/rejeição, custos ou provedores. Um atalho apenas preenche o campo; consultar continua exigindo clique. A aprovação continua descrevendo criação de tarefa interna, sem afirmar envio externo.

## Referências consultadas

- [Intercom Copilot](https://www.intercom.com/help/en/articles/8587194-how-to-use-copilot): assistência no contexto da conversa, fontes junto da resposta e revisão antes de uso.
- [Microsoft Copilot](https://support.microsoft.com/en-us/microsoft-365-copilot/get-started-with-microsoft-365-copilot-chat): separação das experiências e entrada por pedido conversacional.

São referências documentadas, não auditorias autenticadas dessas plataformas nem promessa de capacidades equivalentes. A implementação mantém a identidade laranja/carvão e material da ORKTO.

## Evidência e limites

Browser real com respostas fictícias locais: Equipe carregada, busca por proprietário, filtro sem resultado e negação 403; WIA com consulta explícita, resposta, fontes, aprovações e histórico sem duplicação das pendências.

Recortes: 390×844 dark; 730×728 light; 1440×900 dark. Sem overflow horizontal observado nos recortes inspecionados. Viewport restaurado após revisão. Não constitui homologação de OAuth, RLS, Meta ou inferência real.

Capturas em `evidence/team-wia-polish/`: `team-mobile.png`, `team-tablet.png`, `wia-request-mobile.png`, `wia-approvals-mobile.png`, `wia-desktop.png`.

Resultados automatizados e logs finais: `evidence/team-wia-polish/validation.json` e arquivos `*-output.txt`. Os gates externos anteriores permanecem abertos.
