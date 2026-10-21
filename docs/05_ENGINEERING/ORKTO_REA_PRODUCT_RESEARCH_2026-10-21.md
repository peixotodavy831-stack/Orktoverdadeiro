# Intelligence Lab R2 — pesquisa e limites

Data: 2026-10-21. Implementação local: `c5861c86da19784098767b02208a4d7662787d7f`.
Branch: `feat/orkto-intelligence-whatsapp-2027`. `READY_FOR_PRODUCTION_CANDIDATE=NO`.

## Ferramentas efetivamente utilizadas

- REA CLI `rea-agents@6.7.0`, obtido do registro npm. `doctor --client codex --json` encontrou Node válido, mas registro Codex em config_drift; nenhum MCP REA foi exposto nesta sessão. Nenhum setup, alteração de configuração global ou instalação de engine nativa foi executado.
- `analyze-javascript-application` executado sobre build próprio, selecionando exclusivamente `server.cjs`, orçamento de 5.000 nós e 30s por fonte. Evidência inicial `ev_4bb38dad1189a2ed59f0ddaf229df4a09461f9531620d834c62ddb79779b997c`; resumo em [rea-summary.json](evidence/intelligence-r2/rea-summary.json). Arquivo completo temporário `.tmp-r2/rea-analysis.json` (~21 MB), não versionado.
- A análise é estática/inertemente sintática; relações dinâmicas e 42 arquivos não selecionados permanecem desconhecidos. Não demonstra chamadas de produção, isolamento remoto ou execução de fornecedores. A evidência inicial foi gerada antes do commit final; não deve ser apresentada como análise integral desse SHA.
- A execução foi repetida sobre o build do SHA final: `ev_c208102727ad7b2855fce4b097ae533a87cee3367a565b60a1d700190c7514a9`, [resumo final](evidence/intelligence-r2/rea-final-summary.json). Uma fonte JavaScript analisada, zero falhas de parse; as 256 observações estáticas não significam 256 vulnerabilidades. Mesmos limites de seleção e execução inerte.
- Código próprio auditado diretamente; browser CUA usado para interfaces locais com fixtures. Impeccable aplicado por leitura de DESIGN.md, craft-floor e operate; seu launcher de contexto estava indisponível, sem instalar runtime adicional.
- Nenhum binário, sessão privada, código proprietário ou API privada dos concorrentes foi extraído.

## Pesquisa primária: documentação, não auditoria dos produtos

| Referência oficial | Fato documentado | Hipótese para ORKTO |
| --- | --- | --- |
| [Salesforce Next Best Action](https://help.salesforce.com/s/articleView?id=platform.nba_implementation_checklist.htm&language=en_US&type=5) | Recomendações e ações associadas a estratégias/flows | Contexto e justificativa junto da decisão |
| [HubSpot — quick actions](https://knowledge.hubspot.com/records/use-cards-on-records#quick-actions) | Ações no contexto dos registros | Evitar perder o cliente ao abrir outra área |
| [Intercom Copilot](https://www.intercom.com/help/en/articles/8587194-how-to-use-copilot) | Assistência na conversa, com fontes para revisão | Mostrar limites antes de usar uma sugestão |
| [Linear Triage](https://linear.app/docs/triage) | Revisão antes de aceitar trabalho no fluxo | Distinguir sugestão de ação aceita |
| [Gong — to-dos](https://help.gong.io/docs/about-to-dos) | Trabalho associado ao contexto comercial | Vincular o próximo passo a registros existentes |

Não houve teste autenticado dessas plataformas nem comparação objetiva de produtividade. Não copiar interfaces ou atribuir resultados comerciais a estas referências.

## Cinco ideias avaliadas

| Ideia original aplicada à arquitetura ORKTO | Valor esperado (hipótese) | Decisão |
| --- | --- | --- |
| Contexto e rascunho determinístico dentro da conversa | Menos perda de contexto; independe de IA paga | Implementado R0, somente leitura |
| Plano de alterações com revisão e aprovação | Explicitar efeitos antes do Mutation Gateway | Planejado; sem execução multi-registro |
| Fila de decisões unificada em Hoje | Reduzir duplicação visual entre Radar/WIA | Adiado; preservar engines e prioridades atuais |
| Fontes junto de cada sugestão | Permitir revisão humana | Incluído na primeira fatia |
| Continuidade móvel com dock legível | Manter navegação sem esconder último conteúdo | Incluído como correção da observação do proprietário |

Nenhum ganho de tempo, conversão ou cliques foi estimado como resultado comprovado. Medição local limitada em [UX antes/depois](ORKTO_UX_BEFORE_AFTER_2026-10-21.md).
