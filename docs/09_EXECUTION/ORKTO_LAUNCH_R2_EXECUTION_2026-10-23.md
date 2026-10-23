# ORKTO Launch 2027 — execução R2, 23/10/2026

READY_FOR_PRODUCTION_CANDIDATE=NO. Somente desenvolvimento local, branch feat/orkto-launch-2027. Nenhum staging, produção, push, merge, compra, campanha, cobrança, envio externo ou inferência paga.

## O que foi corrigido e consolidado

- Locale: a implementação Intl de es-419 retorna `1,234.5` neste runtime. O teste antigo esperava separadores de outra convenção. Ao iniciar R2, a expectativa já estava corrigida nas alterações locais; 23 testes focados passaram antes das mudanças R2. Consolidado com pt-BR como padrão, sem anunciar tradução integral. Não foi uma regressão de execução da WIA.
- Finanças: corrigido o ponto de equilíbrio e contribuição por plano para aplicar às taxas o mesmo stress de custo do caixa. Cenário de regressão verifica cobertura em N contas e resultado negativo em N−1. Incluída escala de 200 empresas e simulador de operações/Pulso, reutilizando os pesos do Cost Governor, sem franquia ou mutação de ledger.
- Tema: `@variant dark` não registrava o override por classe do Tailwind 4. Alterado para `@custom-variant dark`; Inbox passou de título RGB(23,23,23) para RGB(245,245,245) no fundo escuro com classe dark. Teste compila a variante e verifica seletor de classe, não preferência do aparelho. [Referência oficial](https://tailwindcss.com/docs/dark-mode).
- Landing: trabalho local de casos de uso/FAQ consolidado; disponibilidade do piloto e integrações explícitas. Corrigida precedência dos estilos das novas seções, que reintroduziam duas colunas após o breakpoint mobile.
- Playbook: adicionado assert PostgreSQL ao workflow existente, sem framework, migration ou grant novo.

Os trabalhos locais de finanças/landing/localização foram copiados para `.tmp-launch/r2-preservation` antes da revisão e consolidados por assunto. Checkout antigo: verificador PASS 106/106, head/status/branch preservados. PR #2 local preservada em 78497da.

## Banco PostgreSQL real, local e descartável

Obtido PostgreSQL portátil 17.11 do fornecedor [EDB](https://www.enterprisedb.com/download-postgresql-binaries), indicado pelo [projeto PostgreSQL](https://www.postgresql.org/download/windows/). SHA256 do zip: 4b8db0930c38f6ef845db919551dedda3b6b845aeb0927b3d79a6e8e9e4537cf. Não foi instalado serviço. Instância limitada a 127.0.0.1:55437, somente fixtures sintéticas.

A primeira tentativa usou owner orkto_fixture e falhou na proteção que exige postgres; foi preservada como falha de preparação do ambiente. Novo banco vazio, owner postgres, repetiu o motor existente e passou 50/50 migrations, assert_readiness e contrato de segurança. Caminho Supabase-like passou 43/43 migrations posteriores ao baseline e suas asserções. Isso não é replay contra Supabase remoto.

Asserts adicionais existentes: Google pilot, proveniência WIA, catálogo/Pulso comercial, ciclo billing e Meta. Novo `assert_proposal_recovery.sql`: preparação persiste aguardando aprovação, nenhuma tarefa prévia, membro e workspace cruzado recusados, aprovação cria tarefa confirmada, replay não duplica, rejeição não cria tarefa, suspenso não executa replay. Controle positivo e isolamento A↔B como role authenticated, tanto tarefas quanto propostas. Zero mensagem, reserva Pulso ou usage de modelo. Fixtures revertidas por ROLLBACK.

Backup local: pg_dump custom do banco de fixtures, pg_restore em outro banco vazio e assert do Playbook após restauração passaram. Não comprova backup gerenciado/PITR, restauração de clientes ou recuperação do staging.

## Matriz de evidências

| Gate | Resultado R2 | Ambiente / limite |
|---|---|---|
| Aplicação, 372/372 | PASS_LOCAL | Código consolidado e1e680e; sem credenciais reais |
| Ferramentas, 108/108 | PASS_LOCAL | Runner existente; não CI remoto |
| Lint / lint Edge / build / smoke | PASS_LOCAL | Compilação e HTTP loopback; dist preservado |
| Secret scan | PASS_LOCAL | 644 arquivos, 0 findings no fechamento de código |
| 50 migrations e upgrade de baseline | PASS_LOCAL | PostgreSQL 17.11, 50/50 e 43/43 selecionadas |
| Playbook, papéis, replay e RLS A↔B | PASS_LOCAL | SQL real + unit tests; não Edge/PostgREST remoto |
| Backup/restauração | PASS_LOCAL | Apenas schema/fixtures locais |
| 18 telas, 390×844 e 768×1024 | PASS_LOCAL | Nove telas por viewport; nenhuma largura excedeu viewport |
| Inbox thread / erro proposta / FAQ | PASS_LOCAL | Fixtures: dock oculto no thread; erro foca nome; FAQ e comparação funcionam |
| WCAG formal, leitor de tela e teclado físico | NOT_TESTED | Inspeção visual e foco não substituem auditoria assistiva/aparelho |
| Central Econômica autenticada remota | NOT_TESTED | Matemática e compilação locais; nenhuma conta real usada |
| Planilha, três casos e recebimento | PASS_LOCAL | Recalculada/exportada/reimportada; 0 erros com premissas válidas |
| Tarifa real Meta e faturas contratadas | BLOCKED_EXTERNAL | Rate card retornou 429; envelopes não são preços |
| Google real G01–G12 / Asaas B01–B13 | BLOCKED_EXTERNAL | Sessões legítimas/customer/secrets/autorização ainda necessários |
| Recuperação gerenciada e integrações reais | BLOCKED_EXTERNAL | Não alteradas ou homologadas por esta execução |
| Ambiguidade cliente/telefone Meta | FAIL — auditoria local anterior | Ingest ainda escolhe primeiro cliente; exige correção aditiva e testes antes de rollout |
| Piloto, demanda, retenção e CAC | NOT_TESTED | Documentos e cenários não são uso ou vendas |
| Franquias, assentos e término de acesso | BLOCKED_EXTERNAL | Decisão comercial, sem números inventados |

Código runtime R2 consolidado em e1e680e; prova SQL ampliada possui hash no manifesto. Commits documentais seguintes não publicam novo runtime. A checagem final do HEAD e estado limpo fica em `.tmp-launch/r2-head-validation.json`, gerada depois do commit documental, sem reescrever fonte.

## Visual

Telas: Hoje, WIA, Conversas, Negócios, Clientes, Propostas, Criar proposta, Equipe e Billing. Viewports medidos no DOM. Capturas em evidence/launch-r2; layout-results.json registra cada medida. A primeira tentativa de captura fullPage falhou; foram usadas capturas de viewport. Um tab antigo ficou na página de erro após o servidor anterior ter encerrado; servidor local reiniciado, HTTP 200 confirmado, aba nova acessou normalmente. Não houve mudança de firewall, TLS ou proteção.

Prova de interação: abrir conversa oculta o dock, sem enviar mensagem; avançar proposta vazia produz erro e foco em quote-client-name; landing mobile mantém novas seções em uma coluna; tabela de comparação tem scroll local de 640px sem ampliar documento; FAQ declara canais inativos. Mobile/tablet são emulação de viewport, não aparelho físico.

## Finanças e recomendação

Planilha principal: evidence/launch-r2/ORKTO_LAUNCH_R2_BUDGET_2027.xlsx. Orçamento inicial de três meses + implantação + contingência: A R$890,40; B R$5.847,60; C R$10.932,00. Não são cotações fechadas; itens não públicos são envelopes, Meta é desconhecido, câmbio 5,20 é hipótese e tributação 15,5% é sensibilidade condicionada ao contador.

Recomendar B como modelo de orçamento profissional a cotar, não como autorização de contratar. Fixo R$1.414,33/mês; equilíbrio em 13 contas do mix hipotético, 27 com reserva de 40%. Não confundir com os dois clientes que cobriam apenas software no cálculo antigo. Receita, resultado simplificado, recebimento, caixa e reserva separados na planilha. Enterprise permanece sob consulta.

Brasil primeiro; hipótese de segmento: manutenção/instalação e serviços técnicos com propostas recorrentes. Entrevistar e observar uso antes de mídia paga. Plano dos cinco primeiros clientes, 30 dias de conteúdo, roteiros, funil e SEO em ORKTO_GROWTH_MARKETING_2027.md. Comparação de Brasil, Portugal, Espanha, América Latina e Estados Unidos em ORKTO_INTERNATIONALIZATION_2027.md. Portugal somente descoberta posterior; não lançar global sem demanda, contratos, idioma, suporte e cobrança.

## Intervenções humanas realmente restantes

- Aprovar orçamento após cotações/faturas, regime com contador, termos, limites e política de término de acesso.
- Autorizar participantes e executor de sessões Google reais; não exportar tokens ou pedir credenciais no chat.
- Asaas: identificar customer exclusivamente sintético, comprovar notificações OFF, secrets somente no secret store e autorizar rodada sandbox controlada. Nenhuma cobrança comercial.
- Autorizar eventual publicação isolada e configuração do candidato após análise da homologação. Produção exige autorização separada.
- Definir empresa piloto e consentimento; obter configuração/contratos de Meta/Gemini e recuperação quando aplicável.

Nenhuma dessas pendências impede preservar as entregas locais; nenhuma foi marcada PASS por documentação.
