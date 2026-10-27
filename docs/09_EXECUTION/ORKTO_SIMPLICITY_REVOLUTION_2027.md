# ORKTO Simplicity Revolution 2027

## Estado desta execução — R1, 27/10/2026

**Auditoria inicial e primeira melhoria de navegação implementadas. A transformação completa das fases3–8 ainda não foi executada. READY_FOR_PRODUCTION_CANDIDATE=NO.**

- Branch: `feat/orkto-simplicity-revolution`.
- Worktree: `C:/Users/sobooa7iqytvqheo/Documents/Codex/Orktoverdeiro-simplicity-revolution`.
- Base preservada: `497271081b2a99dd1969532ea13c893594b87f24`, contendo Launch, integração Meta e correções posteriores de produto. Código R1: `0aedbef8aa930c8122e7eb9d7bdea04fc28a0bcd`.
- A ferramenta gerenciada não resolveu a ref no repositório associado ao chat; worktree criado pelo Git no repositório local confirmado. Não houve reset, clean, stash, checkout forçado ou substituição de arquivos de outras branches.
- Sem push, merge, deploy, migration remota, cobrança, envio externo ou inferência. Bloqueio de publicação automática da nova branch adicionado somente ao mapa deny-only do `vercel.json`; configurações staging/production permanecem byte a byte iguais à base.

## Referências efetivamente consultadas

Leitura online em27/10/2026, antes de modificar componentes do produto:

1. [Nubank — How we created Tabs](https://building.nu.com/how-we-created-tabs/): navegação organizada pelas intenções das pessoas, em vez da estrutura interna dos produtos; validação e comunicação gradual das mudanças.
2. [Nubank — O que muda quando seu produto atinge127milhões de pessoas](https://building.nu.com/pt-br/o-que-muda-quando-seu-produto-atinge-127-milhoes-de-pessoas/): atritos acumulados, escolhas deliberadas e observação de uso em condições reais. A revisão local desta rodada não substitui esse contato com usuários.
3. [Nubank — Design em escala](https://building.nu.com/pt-br/design-em-escala-como-manter-a-excelencia-quando-o-produto-nao-para-de-crescer/): consistência entre contextos, padrões compartilhados e performance como parte da experiência.
4. [NN/g — Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/): priorizar funções frequentes, tornar o acesso secundário claro e evitar profundidade excessiva.

Aplicação à ORKTO: quatro objetivos recorrentes visíveis, um diretório secundário previsível e os mesmos nomes nos dois shells. São decisões de design, ainda sem pesquisa com clientes reais. Nenhum código, identidade, cor ou tela proprietária foi copiado.

A skill Impeccable foi consultada. Seu launcher não executou por falta de cache/permissão; contexto lido diretamente em DESIGN.md, arquitetura, Launch Master/NEXT, relatórios de homologação, código e harness. PRODUCT.md não existe nesta base; não foi inventada pesquisa de segmento para preencher essa ausência.

## Inventário e preservação

|Componente|Fonte localizada e situação|
|---|---|
|PR #2|URL preservada: https://github.com/peixotodavy831-stack/Orktoverdadeiro/pull/2. Checkout local `Orktoverdeiro-google-pilot`, branch `production-readiness/google-only-pilot-preflight`, HEAD78497da5bfd52166c6852aa14c06ebbf84fa1248. Não alterado. O estado remoto atual não foi recertificado nesta rodada|
|Launch|`Orktoverdeiro-launch-2027`, `feat/orkto-launch-2027`, HEAD1c2bf8972fd63c6f530f5940a7e56a5e81db5a4b; ancestral da base escolhida|
|Radar|Branch local `feat/orkto-radar-2027`, HEAD30c2c08; engine `backend/orkto-core/radar.ts`. Blob da base idêntico ao dessa branch:0fb36bf8fbd1eb1bccd18b3850a1f317be07ffac. Integração read-only já presente em Hoje|
|Playbooks|Branch local `feat/orkto-playbooks-r1`, HEAD1f194ce; `backend/orkto-core/playbooks.ts`, blob c128ed0a4e56f74a529304ea51d4961528e748fd idêntico na base. Fatia governada de recuperação já documentada; não equivale a agendamento/envio autônomo|
|WIA Efficiency|Branch local `feat/orkto-wia-efficiency-2027`, HEADf98709a. `backend/wiaos/efficiency.ts`, blob15db18e3c0d77e1390b453c316e7512acd91520d idêntico na base; não foram copiados arquivos de branches antigas|
|WhatsApp Meta|Base `codex/orkto-whatsapp-e2e`, HEAD4972710 preservada e limpa. `backend/channels/meta-webhook.ts`, persistência e recibos. UI mantém diferença entre solicitação aceita e entrega confirmada; E2E Meta continua bloqueado externamente|
|Design system|DESIGN.md, `src/product/design/tokens.css`, `product-refinement.css`, materiais anteriores e iconografia existentes. Direção vigente registrada; não houve redesenho global por CSS|
|Central Econômica/admin|`src/components/internal/FinanceDashboard.tsx`, modelo financeiro, Cost Governor e Pulso existentes. Entrada interna condicionada a `isInternalAdmin` preservada; ausente do diretório público compartilhado|

Referências locais lidas incluem `docs/ARCHITECTURE_ONDA0.md`, `STAGING_CLOSURE_2026-10-20.md`, integração Radar R1, `PLAYBOOK_PROPOSAL_RECOVERY_SLICE.md`, Launch Master/NEXT e a matriz vigente do PDF consolidado. Homologações históricas não foram convertidas em validação do novo SHA.

## Diagnóstico inicial e mudanças

|Área|Problema encontrado|R1 e próximo passo|
|---|---|---|
|Navegação|A arquitetura de quatro destinos já existia. Ao recolher o desktop, porém,15destinos eram expostos de uma vez|Rail agora com Hoje, Conversas, Negócios, WIA e Mais. Mais expande a própria sidebar para abrir o diretório; não acrescenta popover/modal desktop|
|Mais|11destinos em uma grade móvel plana e outra implementação no desktop, sem busca|Registro único,3categorias por objetivo, busca local e mesma lista de destinos. Nenhum item disponível removido|
|Criação|Criar proposta pelo menu secundário exigia abrir o painel de criação genérico|Nova proposta abre diretamente a tela existente, sem salvar. Outras criações preserva clientes, negócios e o estado indisponível de interação|
|Mobile|Altura máxima rígida e risco de recorte; clique no backdrop não fechava os painéis|Área central flexível com rolagem quando necessária, superfície opaca e backdrop funcional. Duas colunas dentro de grupos mantêm todos os destinos acessíveis no viewport de850px de altura testado|
|Hoje|Resumo, WIA, Radar, atenção e atividade já existem; há repetição de CTAs e informação técnica exposta|Somente auditada nesta etapa. Próxima: priorizar decisão e evitar duplicação, sem inventar contagens ou alterar a engine|
|Conversas|Lista/conversa/contexto já separados; mobile possui conversa própria e dock oculto|Preservado. Próxima: rever handoff, estados do canal e contexto sob demanda com o WhatsApp real ainda gated|
|Negócios|Pipeline/listas e detalhe comercial já existem, mas a jornada entre cliente/proposta ainda precisa de aceitação específica|Não reescrito. Próxima: reunir contexto e próximas ações com contratos atuais|
|WIA|Espaço dedicado, preparação contextual e aprovação já existentes; ainda há linguagem/estrutura extensas|Preservado. Próxima: mensagens humanas por estado real e detalhes avançados sob demanda|

## Arquitetura de informação

Antes:4entradas principais; Mais expansível no desktop aberto e11itens secundários planos no celular. No desktop recolhido,15ícones de módulos visíveis. Cada shell mantinha sua própria seleção/montagem de itens.

Agora:mesmos4objetivos e Mais em ambos;15→5entradas no rail recolhido. Diretório secundário compartilhado:

- **Vender e acompanhar:** Clientes, Propostas, Catálogo, Relatórios.
- **Empresa e conta:** Integrações, Equipe, Plano & Cobrança, Configurações, Perfil.
- **Ajuda e registros:** Auditoria, Ajuda.

Busca aceita nomes de tarefas como orçamento, WhatsApp, pessoas e Pulsos. Filtra somente os destinos já registrados, sem requests ou gravações. Consulta sem resultado explica como recuperar. Item indisponível permanece indisponível. Não há concessão de papéis ou substituição das verificações do backend.

## Jornadas e métricas

Contagem de ações de navegação; não inclui digitar conteúdo, revisar ou confirmar uma operação de negócio. Antes derivado do código e baseline visual; depois confirmado quando indicado. Não são tempos de execução nem feedback de clientes.

|Cenário|Antes|Depois|Evidência/limite|
|---|---|---|---|
|Nova proposta pelo Mais móvel|Mais → Criar novo → Nova proposta:3|Mais → Nova proposta:2|Novo fluxo abriu “Criar Nova Proposta” em fixture real da UI; nenhum envio/gravação. A tela usa seus controles existentes, não um novo formulário ou contrato|
|Nova proposta pela Hoje|Criar proposta:1|Criar proposta:1|Caminho existente preservado; não reivindicado como ganho novo|
|Encontrar Clientes pelo menu|Mais → Clientes:2|Mais → Clientes:2|Agora também pesquisável; não há alegação de redução no total da busca de um cliente real|
|Criar oportunidade pelo Mais|3seleções pelo criador|3seleções por Outras criações|Contrato de criação existente mantido; jornada completa de salvar não executada|
|Consultar negócio|Negócios → negócio|Mesmo acesso|Detalhe não redesenhado; tempo não medido|
|Responder conversa|Conversas → conversa|Mesmo acesso|Digitação/envio Meta não homologados nesta missão|
|Aprovar ação WIA/acompanhar follow-up|Contexto Hoje/Radar/WIA existente|Preservado|Aprovação real e follow-up externo não executados; não há ganho percentual reivindicado|
|Ver Radar|Na própria Hoje|Na própria Hoje|Motor e evidências preservados; fixture não é consulta remota|

Números confirmados:rail recolhido15→5; destinos secundários11→11; grupos secundários0→3; novos caminhos em profundidade máxima de2níveis. Desktop expandido fechado e dock móvel já tinham5entradas antes; não se atribui essa organização inteira a esta rodada.

## Validação e evidências

- **406/406 testes da aplicação PASS**, incluindo4novos contratos de cobertura do diretório, busca, aliases de rotas e bloqueio de publicação. HTTP local com doubles e testes de motores existentes; não é RLS remoto.
- **108/108 testes de ferramentas PASS** na execução final. A primeira execução falhou no snapshot do mapa deny-only após adicionar a branch; contrato de teste atualizado para a nova negação, sem alterar configurações de runtime.
- Lint/typecheck e build local com inicialização do servidor, saúde, SPA, fronteira de autenticação e proteção de fontes:PASS. `dist` preservado.
- Revisão no navegador em320/360/390/430/768/1280px, claro e escuro:sem overflow horizontal. Menu móvel corretamente oculto no desktop. Área de toque mínima44px nos botões inspecionados, inclusive limpar busca.
- Foco contido no menu, Shift+Tab do fechar ao Sair, Escape restaura Mais, backdrop fecha, busca por orçamento retorna Propostas, vazio honesto, acesso direto à proposta e rótulo Configurações inteiro em320px.
- Viewport390×430 testado com busca focada e fonte16px; **não equivale a teclado virtual real nem aparelho físico**. VoiceOver/TalkBack e medição de performance/usabilidade com pessoas:NOT_TESTED.
- Aviso esperado de Supabase sem configuração no harness. Não se declara console global sem erros. Sem credenciais, cookies ou sessões reais em evidências.

Pasta:`evidence/simplicity-r1-20261027/`. `baseline.json`, capturas antes/depois, `visual-checks.json` e manifesto de validação com SHA e hashes dos logs locais. As capturas finais foram feitas após a aplicação do tema; estados transitórios de cor não são baseline visual.

Rotas/callbacks App, autenticação, APIs, migrations e regras de acesso não foram alterados. Aliases de quote_detail/create_quote/conversation mantidos e testados; favoritos/links reais autenticados não foram revalidados remotamente.

## Pendências e próxima execução

Fases1–2 concluídas como primeira fatia; fases3–8 permanecem abertas. Priorizar Hoje, depois Conversas, contexto de Negócios, WIA e onboarding, com commits e validação próprios. Usar os mesmos motores e não substituir bloqueios de provedor por conteúdo fictício.

Roteiro posterior com pessoas reais:encontrar uma pendência, responder sem perder contexto, criar proposta, acompanhar um negócio e revisar uma sugestão da WIA. Medir erros e tempo de cada cenário, sem remover confirmações de segurança. Nenhuma pessoa participou desta rodada; não há teste com clientes concluído.

WhatsApp Meta, Google A/B integral, billing sandbox, critérios comerciais e recuperação gerenciada mantêm seus gates e evidências anteriores; esta missão visual não encerra nenhum deles. **READY_FOR_PRODUCTION_CANDIDATE=NO.**
