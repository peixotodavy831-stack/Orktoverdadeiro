---
name: ORKTO — material interno em vidro fosco
description: Material da aplicação autenticada sobre os tokens e layouts existentes.
colors:
  brand: "#FF9F1C"
  brand-hover-light: "#E9890B"
  brand-hover-dark: "#FFB347"
  brand-text-light: "#8A4B00"
  brand-text-dark: "#FFC36D"
  brand-on-fill: "#0B0B0B"
  text-light: "#171717"
  text-dark: "#F5F5F5"
  secondary-light: "#5F5F5F"
  secondary-dark: "#B8B8B8"
  surface-light: "#FFFFFF"
  surface-dark: "#111111"
  glass-canvas-light: "#eef0f2"
  glass-canvas-dark: "#0c0f12"
  glass-fill-light: "rgba(255, 255, 255, .72)"
  glass-fill-dark: "rgba(26, 29, 32, .64)"
  glass-edge-light: "rgba(110, 119, 132, .24)"
  glass-edge-dark: "rgba(227, 235, 242, .15)"
  glass-highlight-light: "rgba(255, 255, 255, .9)"
  glass-highlight-dark: "rgba(255, 255, 255, .08)"
  glass-soft-light: "rgba(239, 243, 247, .56)"
  glass-soft-dark: "rgba(35, 40, 46, .48)"
  glass-control-light: "rgba(255, 255, 255, .76)"
  glass-control-dark: "rgba(12, 17, 22, .64)"
  glass-elevated-light: "rgba(250, 252, 254, .94)"
  glass-elevated-dark: "rgba(23, 28, 34, .94)"
typography:
  headline:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(26px, 2.5vw, 38px)"
    fontWeight: 650
    lineHeight: 1.16
    letterSpacing: "-.035em"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    lineHeight: 1.6
  section-title:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    letterSpacing: "-.015em"
rounded:
  control: "10px"
  glass-panel: "16px"
  sidebar: "18px"
spacing:
  unit: "4px"
  metrics-gap: "10px"
  mobile-gap: "16px"
  panel-gap: "20px"
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

O vidro fosco começou em Hoje e na navegação lateral desktop; após a ampliação solicitada pelo usuário, o material também cobre a aplicação interna autenticada. A camada inclui superfícies semânticas compartilhadas, painéis neutros legados com borda, formulários, diálogos, cabeçalhos de tabela, Inbox e dock móvel. Preserva a identidade laranja, as cores de estado, os botões e a organização funcional existente. Login público, landing e páginas públicas de proposta ficam fora desse escopo.

`src/product/design/tokens.css` continua como fonte geral. `src/product/design/today-glass.css` conserva a composição de Hoje/sidebar; `src/product/design/product-glass.css` estende somente o material sob `.orkto-glass-shell`, sem alterar layout ou backend. Histórico: a primeira etapa teve revisão visual clara/escura e em 390px no harness local de fixtures, conforme registro anterior. Esta ampliação foi documentada por leitura do CSS; não constitui verificação de build, staging ou E2E autenticado.
**Key Characteristics:**
- Vidro fosco com bordas sutis e destaque laranja.
- Material compartilhado sem mudar a organização funcional das telas.
- Temas claro e escuro, com superfície opaca alternativa.

## Colors

### Primary

O laranja da marca identifica ações principais, navegação atual e detalhes da WIA. Os tokens de texto e hover variam com o tema; o preenchimento da marca conserva sua identidade.

### Neutral

O canvas de vidro é frio e neutro. Texto primário e secundário continuam nos tokens semânticos incumbentes; preenchimento, borda e brilho do vidro possuem variantes claras e escuras. A classe `.dark` escolhe os valores escuros. Os tokens de sucesso, atenção e falha continuam definidos em `tokens.css` e indicam estados recebidos. O material interno acrescenta tons suaves para conteúdo secundário, controles e superfícies elevadas; estes últimos têm maior opacidade para leitura sobre outros conteúdos.

## Typography

Inter, com fallback `ui-sans-serif, system-ui, sans-serif`, é a família do produto. A chamada principal usa `headline`; o texto explicativo usa `body` e limita a largura a 46ch. Títulos operacionais usam `section-title`. O cumprimento tem 18px e peso 550; valores de métricas têm 28px, entrelinha 34px e peso 600. Rótulos são menores e secundários, sem competir com valores e ações.

## Layout

Hoje tem largura máxima de 1600px e margens automáticas; padding horizontal de 16px, 24px a partir de 640px e 32px a partir de 1024px. O topo usa colunas `minmax(0, 1.3fr) minmax(290px, .9fr)` e intervalo de 20px. A WIA ocupa a coluna direita por duas linhas; quatro métricas ficam em uma linha. Até 1199px o topo passa a uma coluna e a WIA vai à terceira linha.

A área operacional usa `minmax(0, 1.2fr) minmax(0, 1fr)` com intervalo de 20px. Até 767px passa a uma coluna, intervalos de 16px e métricas em duas colunas; o rodapé empilha conteúdo e ações. A navegação desktop aparece a partir de 1024px, mede 248px expandida (224px entre 1024 e 1279px) ou 76px recolhida, com margem externa de 8px. O dock móvel recebe superfície elevada; sua organização e seus controles existentes são preservados. A ampliação do material às outras telas mantém seus layouts e breakpoints incumbentes.

## Elevation & Depth

Painéis combinam brilho linear, preenchimento translúcido, borda de 1px e sombra ambiente. Na camada interna compartilhada, painéis elegíveis usam blur de 16px e saturação 125%; filhos aninhados recebem tonalidade sem acumular filtros e sombras. Contêineres que abrigam elementos fixos ou diálogos não recebem esse filtro, evitando mudar o bloco de referência de posicionamento. Diálogos, sheets e menus elevados usam maior opacidade e blur de 20px com saturação 120%; o dock usa 18px. Opções nativas de select permanecem opacas. A impressão usa fundo branco e remove sombras e filtros. Em Hoje, o desfoque dos painéis é 18px com saturação 125%; a navegação usa 20px e 130%. Sombras clara e escura estão no sidecar. O fundo recebe halos estáticos discretos. Sem suporte a `backdrop-filter`, o CSS usa a superfície opaca semântica. Com `prefers-reduced-transparency: reduce`, usa superfície opaca e remove os filtros. Os controles conservam foco visível de 2px com afastamento de 2px; a preferência de movimento reduzido vem dos tokens incumbentes.

## Shapes

A extensão usa `glass-panel` nos blocos, `sidebar` na navegação flutuante e `control` nas ações. Os raios gerais existentes (6px, 10px, 14px e pill de 999px) continuam em `tokens.css`. O símbolo decorativo WIA usa núcleo de 72px com raio de 20px e órbitas elípticas; não representa um indicador de execução.

## Components

- **Ações:** botões principais laranja, secundários com borda sutil e atualização translúcida. As ações de Hoje têm altura mínima de 44px e mantêm seus callbacks.
- **Material interno:** painéis semânticos e neutros legados recebem vidro; superfícies secundárias recebem tom suave, campos recebem preenchimento próprio, cabeçalhos de tabela e diálogos recebem tom elevado. Na Inbox, só as superfícies neutras mudam; canais, estados e conteúdo mantêm suas cores e significados.
- **Painéis e métricas:** superfícies foscas compartilham material e borda. Valores vêm dos dados existentes; `—` e mensagens de espera indicam indisponibilidade.
- **Navegação:** preserva módulos, itens indisponíveis, seleção por `aria-current`, recolhimento, aparência, conta e saída. Seleção combina texto laranja, borda e gradiente discretos.
- **WIA:** a central oferece acesso ao workspace; a atividade apresenta ações persistidas e seus estados. O ornamento não afirma que a WIA está ativa. Carregamento, erro, offline, permissão, configuração, backend pendente e vazio continuam explícitos.

## Do's and Don'ts

### Do
- Do aplicar o material dentro do shell autenticado, preservando os layouts existentes e evitando blur aninhado.
- Do preservar marca laranja, dados reais, callbacks e estados operacionais existentes.
- Do manter contraste textual, foco visível e alternativa opaca do material.

### Don't
- Don't aplicar esta camada ao login público, landing ou páginas públicas de proposta, nem substituir cores de estado e botões por vidro.
- Don't preencher métricas com KPIs fictícios ou transformar indisponibilidade em zero confirmado.
- Don't interpretar o ornamento da WIA como atividade, execução ou entrega confirmada.
