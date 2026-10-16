---
name: ORKTO — material interno em vidro fosco
description: Material da aplicação autenticada sobre os tokens e layouts existentes.
colors:
  brand: "#ff5a00"
  brand-hover-light: "#ed5200"
  brand-hover-dark: "#ff7633"
  brand-text-light: "#963a00"
  brand-text-dark: "#ffa36f"
  brand-on-fill: "#17120e"
  focus-light: "#a04000"
  focus-dark: "#ffad80"
  muted-light: "#716a62"
  muted-dark: "#aaa297"
  text-light: "#171717"
  text-dark: "#F5F5F5"
  secondary-light: "#625c55"
  secondary-dark: "#c2bbb1"
  surface-light: "#FFFFFF"
  surface-dark: "#111111"
  glass-canvas-light: "#f4f1eb"
  glass-canvas-dark: "#111110"
  glass-fill-light: "rgba(255, 254, 251, .78)"
  glass-fill-dark: "rgba(32, 32, 31, .76)"
  glass-edge-light: "rgba(88, 71, 51, .17)"
  glass-edge-dark: "rgba(244, 229, 208, .13)"
  glass-highlight-light: "rgba(255, 255, 255, .9)"
  glass-highlight-dark: "rgba(255, 245, 229, .045)"
  glass-soft-light: "rgba(238, 233, 223, .64)"
  glass-soft-dark: "rgba(53, 49, 44, .54)"
  glass-control-light: "rgba(255, 254, 251, .88)"
  glass-control-dark: "rgba(21, 20, 18, .86)"
  glass-elevated-light: "rgba(255, 254, 251, .97)"
  glass-elevated-dark: "rgba(35, 33, 30, .97)"
typography:
  headline:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(28px, 2.7vw, 38px)"
    fontWeight: 650
    lineHeight: 1.16
    letterSpacing: "-.035em"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    lineHeight: 1.6
  section-title:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    letterSpacing: "-.015em"
rounded:
  control: "10px"
  glass-panel: "16px"
  sidebar: "18px"
spacing:
  unit: "4px"
  metrics-gap: "12px"
  mobile-gap: "16px"
  panel-gap: "24px"
components:
  button-primary:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.brand-on-fill}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  button-secondary:
    rounded: "{rounded.control}"
    padding: "10px 14px"
  button-refresh:
    rounded: "{rounded.control}"
    padding: "8px 10px"
  glass-panel:
    rounded: "{rounded.glass-panel}"
  sidebar:
    rounded: "{rounded.sidebar}"
---

# Design System: ORKTO — material interno em vidro fosco

## Overview

**Creative North Star: "Vidro fosco operacional"**

O refinamento atual prioriza ações previsíveis, navegação calma e leitura clara, com laranja intenso, carvão e creme translúcido. É uma melhoria da experiência interna autenticada, sem declarar redesenho integral ou conclusão de todo o MVP.

O vidro fosco começou em Hoje e na navegação lateral desktop; após a ampliação solicitada pelo usuário, o material também cobre a aplicação interna autenticada. A camada inclui superfícies semânticas compartilhadas, painéis neutros legados com borda, formulários, diálogos, cabeçalhos de tabela, Inbox e dock móvel. Preserva a identidade laranja, as cores de estado, os botões e a organização funcional existente. Login público, landing e páginas públicas de proposta ficam fora desse escopo.

`src/product/design/tokens.css` continua como fonte geral. `src/product/design/today-glass.css` conserva a composição de Hoje/sidebar; `src/product/design/product-glass.css` estende o material sob `.orkto-glass-shell`; `src/product/design/product-refinement.css` define os overrides atuais de cor, hierarquia, navegação e legibilidade. Os callbacks e contratos existentes são preservados. Histórico: a primeira etapa teve revisão visual clara/escura e em 390px no harness local de fixtures, conforme registro anterior. A ampliação do material e o refinamento atual foram documentados por leitura do código; não constituem verificação de testes, build, staging ou E2E autenticado.
**Key Characteristics:**
- Vidro fosco com bordas sutis e destaque laranja.
- Material compartilhado sem mudar a organização funcional das telas.
- Temas claro e escuro, com superfície opaca alternativa.

Referências de direção registradas para esta etapa: [Linear — design refresh](https://linear.app/now/behind-the-latest-design-refresh), para ações previsíveis e navegação calma; [Intercom Inbox](https://www.intercom.com/helpdesk/inbox), para conversa, contexto e priorização; [NN/g — princípios visuais](https://www.nngroup.com/articles/principles-visual-design/), para hierarquia e contraste. São referências de decisões, sem alegação de superioridade ou premiação.

## Colors

### Primary

O laranja da marca identifica ações principais, navegação atual e detalhes da WIA. Os tokens de texto e hover variam com o tema; o preenchimento da marca conserva sua identidade.

### Neutral

O canvas claro é creme e o escuro é carvão; as superfícies foscas acompanham esse calor neutro. Texto primário e secundário continuam nos tokens semânticos incumbentes; preenchimento, borda e brilho do vidro possuem variantes claras e escuras. A classe `.dark` escolhe os valores escuros. Os tokens de sucesso, atenção e falha continuam definidos em `tokens.css` e indicam estados recebidos. O material interno acrescenta tons suaves para conteúdo secundário, controles e superfícies elevadas; estes últimos têm maior opacidade para leitura sobre outros conteúdos.

## Typography

Inter, com fallback `ui-sans-serif, system-ui, sans-serif`, é a família do produto. Em Hoje, a chamada principal usa `headline` (29px até 767px); a descrição tem 14px e largura máxima de 62ch. Títulos operacionais usam `section-title`. O cumprimento tem 16px e peso 550; valores de métricas têm 30px, entrelinha 36px e peso 600. Cabeçalhos compartilhados usam `clamp(26px, 2.2vw, 32px)` e entrelinha 1.2. Rótulos são menores e secundários, sem competir com valores e ações.

## Layout

Hoje mantém máximo de 1600px, margens automáticas e padding horizontal de 16px, 24px a partir de 640px e 32px a partir de 1024px. O topo usa `minmax(0, 1fr) 310px` com intervalo de 24px: contexto e ações diretas à esquerda, WIA compacta à direita. As quatro métricas ocupam toda a segunda linha, com intervalo de 12px. Até 1023px o topo passa a uma coluna e WIA à terceira linha; até 767px, métricas passam a duas colunas.

A área operacional usa `minmax(0, 1.15fr) minmax(0, 1fr)`, intervalo de 24px e margem superior de 28px; até 767px passa a uma coluna com intervalo de 16px e margem de 20px. Painéis têm padding de 24px (20px no mobile). A sidebar aparece a partir de 1024px, mede 232px expandida ou 76px recolhida e mantém margem externa de 8px. O refinamento não reorganiza todos os fluxos internos.
## Elevation & Depth

Painéis combinam brilho linear, preenchimento translúcido, borda de 1px e sombra ambiente. Na camada interna compartilhada, painéis elegíveis usam blur de 16px e saturação 125%; filhos aninhados recebem tonalidade sem acumular filtros e sombras. Contêineres que abrigam elementos fixos ou diálogos não recebem esse filtro, evitando mudar o bloco de referência de posicionamento. Diálogos, sheets e menus elevados usam maior opacidade e blur de 20px com saturação 120%; o dock usa 18px. Opções nativas de select permanecem opacas. A impressão usa fundo branco e remove sombras e filtros. Em Hoje, o desfoque dos painéis é 18px com saturação 125%; a navegação usa 20px e 130%. Sombras clara e escura estão no sidecar. O fundo recebe halos estáticos discretos. Sem suporte a `backdrop-filter`, o CSS usa a superfície opaca semântica. Com `prefers-reduced-transparency: reduce`, usa superfície opaca e remove os filtros. Campos conservam foco de 2px com afastamento de 2px; botões, links e disclosures usam afastamento de 3px; a preferência de movimento reduzido vem dos tokens incumbentes.

## Shapes

A extensão usa `glass-panel` nos blocos, `sidebar` na navegação flutuante e `control` nas ações. Os raios gerais existentes (6px, 10px, 14px e pill de 999px) continuam em `tokens.css`. O símbolo decorativo WIA usa núcleo compacto de 48px com raio de 14px e órbitas elípticas; não representa um indicador de execução.

## Components

- **Ações:** Criar proposta e Ver negócios ficam no topo de Hoje e usam os callbacks existentes. Criar proposta recebe o destaque laranja; Abrir WIA usa controle neutro. Ações têm altura mínima de 44px. Campos compartilhados têm mínimo de 44px e texto de 13px.
- **Material interno:** painéis semânticos e neutros legados recebem vidro; superfícies secundárias recebem tom suave, campos recebem preenchimento próprio, cabeçalhos de tabela e diálogos recebem tom elevado. Na Inbox, só as superfícies neutras mudam; canais, estados e conteúdo mantêm suas cores e significados.
- **Painéis e métricas:** superfícies foscas compartilham material e borda. Valores vêm dos dados existentes; `—` e mensagens de espera indicam indisponibilidade.
- **Navegação:** preserva módulos, itens indisponíveis, seleção por `aria-current`, recolhimento, aparência, conta e saída. Seleção combina texto laranja, marcador lateral e preenchimento laranja de 11%, sem borda destacada. A lista principal mostra recursos disponíveis; os futuros ficam em Próximos recursos, um disclosure explícito na versão expandida. O rodapé mostra identidade da conta e workspace, sem dados fictícios.
- **Vazios:** mantêm distinção entre vazio confirmado e falha/espera. O vazio operacional oferece Criar uma proposta, acionando o callback existente; textos mantêm largura de leitura controlada.
- **WIA:** a central oferece acesso ao workspace; a atividade apresenta ações persistidas e seus estados. O ornamento não afirma que a WIA está ativa. Carregamento, erro, offline, permissão, configuração, backend pendente e vazio continuam explícitos.

## Do's and Don'ts

### Do
- Do aplicar o material dentro do shell autenticado, preservando os layouts existentes e evitando blur aninhado.
- Do preservar marca laranja, dados reais, callbacks e estados operacionais existentes.
- Do manter contraste textual, foco visível e alternativa opaca do material.

### Don't
- Don't aplicar indiscriminadamente a camada interna à landing ou propostas públicas, nem substituir cores de estado e botões por vidro. O login possui material próprio conforme seção Acesso abaixo.
- Don't preencher métricas com KPIs fictícios ou transformar indisponibilidade em zero confirmado.
- Don't interpretar o ornamento da WIA como atividade, execução ou entrega confirmada.

### Símbolo ORKTO — 15/10/2026
Símbolo de três laços fornecido pelo proprietário, adaptado por contorno em SVG transparente #FF5A00 (public/brand/orkto-symbol.svg). O PNG original possui fundo preto e halo; a adaptação limpa é destinada à interface. OrktoLogo centraliza símbolo/nome, sem halo e sem registro de marca presumido. Nome usa o lettering do arquivo “Logotipo ORKTO Minimalista.png” fornecido pelo proprietário, incorporado sem redesenho em public/brand/orkto-wordmark.svg. O SVG contém o raster original, recorte de exibição e filtro de luminância para transparência; não é uma vetorização. O componente aplica preto/branco conforme o tema, mantendo o símbolo laranja e a tipografia dos textos da interface. Larguras do lettering: 100/130/170/260px por tamanho do componente. Símbolo compacto na navegação recolhida/mobile; lockup nas demais instâncias. Favicon/ícones usam o mesmo contorno. Vidro, funções e tokens de ações preservados.

### Perfil pessoal
Perfil é uma tela operacional própria, disponível em desktop e menu móvel. Dois grupos: dados pessoais (nome editável/e-mail somente leitura/foto Google) e contexto de segurança/empresa. Campos, foco, status e vidro reutilizam tokens existentes. Edição de nome é confirmada pelo gateway, com chave estável para repetir a mesma tentativa; identidade Google, senha, plano e papel não são campos editáveis.

### Acesso e carregamento
O login Google usa carvão, lettering oficial branco, símbolo laranja e um painel de vidro fosco. Desktop separa a introdução do formulário; mobile empilha sem ornamento. A entrada com Google permanece única, com estados de verificação, indisponibilidade e erro, convite obrigatório e links jurídicos de consulta. Sem alterações de autenticação, autorização ou consentimento. Carregamento HTML inicial, autenticação e Suspense usam a marca atual. Animações respeitam movimento reduzido e o painel oferece fundo opaco sem suporte a blur ou com transparência reduzida.

### Equipe, Auditoria e Ajuda
Superfícies Operate seguem o material interno: cabeçalho semântico, busca acessível, listas responsivas e estados reais de carregamento, vazio, falha e acesso restrito. Equipe é consulta de vínculos e papéis existentes; não habilita convites, troca de papel ou remoção. Auditoria mostra até 100 eventos recentes, metadados sem payload, para owner/admin do workspace ativo. Ajuda é local, pesquisável, com disclosures e navegação funcional aos módulos.

### Landing pública — pesquisa aplicada
Modo Persuade, mesma identidade do login e shell. Propósito explícito, fluxo cliente/negócio/proposta e uma demonstração rotulada com dados fictícios. Fundo carvão, lettering branco, laranja de marca e encerramento em creme. CTAs correspondem ao piloto fechado e à demonstração existente; nenhuma promessa de canais, pagamentos ou contratação ativa. Referências e decisões: docs/05_ENGINEERING/ORKTO_LANDING_RESEARCH_2026-10-15.md.

### Navegação compacta e identidade — 16/10/2026
Removida a dupla aplicação de espaçamento por margin/gap. Operação e Inteligência ficam visíveis; Gestão é um grupo expansível e abre quando uma de suas telas é selecionada. Linhas desktop 36px; menu móvel mantém o tamanho existente. Rodapé usa logo da empresa, foto Google como fallback e pequena foto pessoal quando ambas existem. Fallback de erro com inicial, sem imagens inseguras. Integrações apresenta estados reais, não conexões fictícias.
