type Profession = string;
type Tone = 'formal' | 'técnico' | 'comercial' | 'criativo';

interface CopywriterInput {
  profession: string;
  tone: Tone;
  items: Array<{ id: string; name: string; description: string; quantity: number; unitPrice: number; discount: number }>;
  clientName: string;
  clientVehicleOrService: string;
  notes: string;
  paymentInstructions: string;
}

interface CopywriterOutput {
  items: Array<{ id: string; name: string; description: string; quantity: number; unitPrice: number; discount: number }>;
  notes: string;
  paymentInstructions: string;
  aestheticAdvice: string;
}

const professionStyles: Record<string, { prefix: string; adjectives: string[]; verbs: string[]; nouns: string[]; closing: string }> = {
  'Advogado': {
    prefix: 'Jurídico',
    adjectives: ['formal', 'sóbrio', 'confiável', 'robusto', 'estratégico', 'fundamentado'],
    verbs: ['assessorar', 'representar', 'conduzir', 'elaborar', 'defender', 'instruir'],
    nouns: ['parecer', 'peça processual', 'defesa', 'recurso', 'contrato', 'petição'],
    closing: 'Prazo de conclusão conforme acordo contratual. Honorários conforme tabela OAB vigente.'
  },
  'Arquiteto': {
    prefix: 'Arquitetônico',
    adjectives: ['elegante', 'sofisticado', 'integrado', 'contemporâneo', 'funcional', 'sustentável'],
    verbs: ['projetar', 'conceber', 'integrar', 'desenvolver', 'materializar', 'compor'],
    nouns: ['projeto executivo', 'maquete eletrônica', 'memorial descritivo', 'planta baixa', 'levantamento', 'especificação técnica'],
    closing: 'Prazo de entrega conforme cronograma acordado. Pagamento mediante medição ou parcela única.'
  },
  'Designer': {
    prefix: 'Criativo',
    adjectives: ['inovador', 'impactante', 'minimalista', 'autoral', 'estratégico', 'imersivo'],
    verbs: ['criar', 'conceituar', 'desenvolver', 'materializar', 'refinar', 'compor'],
    nouns: ['identidade visual', 'conceito criativo', 'branding', 'direção de arte', 'design system', 'interface'],
    closing: 'Entrega dos arquivos finais em alta resolução. Revisões inclusas conforme escopo contratado.'
  },
  'Eletricista': {
    prefix: 'Elétrico',
    adjectives: ['seguro', 'normatizado', 'eficiente', 'dimensionado', 'certificado', 'confiável'],
    verbs: ['instalar', 'dimensionar', 'executar', 'substituir', 'corrigir', 'proteger'],
    nouns: ['quadro de distribuição', 'disjuntor', 'cabos elétricos', 'aterramento', 'projeto elétrico', 'laudo técnico'],
    closing: 'Serviço com garantia de 90 dias. Instalação conforme NBR 5410 vigente.'
  },
  'Oficina': {
    prefix: 'Automotivo',
    adjectives: ['técnico', 'especializado', 'diagnosticado', 'garantido', 'preciso', 'original'],
    verbs: ['diagnosticar', 'reparar', 'substituir', 'revisar', 'trocar', 'alinhar'],
    nouns: ['diagnóstico', 'reparo', 'revisão', 'troca de óleo', 'suspensão', 'injeção eletrônica'],
    closing: 'Serviço com garantia de 3 meses ou 5.000km. Peças originais ou certificadas.'
  },
  'Construção': {
    prefix: 'Estrutural',
    adjectives: ['sólido', 'durável', 'reforçado', 'resistente', 'certificado', 'planejado'],
    verbs: ['executar', 'construir', 'reformar', 'assentar', 'instalar', 'finalizar'],
    nouns: ['alvenaria', 'contrapiso', 'revestimento', 'estrutura metálica', 'cobertura', 'fundação'],
    closing: 'Prazo de execução conforme cronograma. Pagamento por etapa concluída. Garantia de 1 ano.'
  },
  'Marcenaria': {
    prefix: 'Moveleiro',
    adjectives: ['sob medida', 'artesanal', 'matéria-prima selecionada', 'acabamento fino', 'funcional', 'durável'],
    verbs: ['confeccionar', 'montar', 'instalar', 'projetar', 'finalizar', 'restaurar'],
    nouns: ['móvel planejado', 'armário', 'painel', 'marcenaria fina', 'cubas e bancadas', 'esquadrias'],
    closing: 'Prazo de fabricação de 15 a 30 dias úteis. Montagem e instalação inclusas. Garantia de 6 meses.'
  },
  'Consultor': {
    prefix: 'Estratégico',
    adjectives: ['analítico', 'orientado a dados', 'acelerador', 'assertivo', 'escalável', 'transformador'],
    verbs: ['analisar', 'diagnosticar', 'planejar', 'otimizar', 'acelerar', 'estruturar'],
    nouns: ['diagnóstico organizacional', 'plano de ação', 'mapeamento de processos', 'análise de indicadores', 'roadmap estratégico', 'relatório executivo'],
    closing: 'Entrega de relatório completo com recomendações aplicáveis. Sessão de alinhamento inclusa.'
  },
};

const defaultStyle = {
  prefix: 'Premium',
  adjectives: ['profissional', 'completo', 'customizado', 'eficiente', 'moderno', 'confiável'],
  verbs: ['realizar', 'desenvolver', 'executar', 'entregar', 'produzir', 'finalizar'],
  nouns: ['serviço especializado', 'solução completa', 'projeto', 'entrega', 'execução', 'trabalho'],
  closing: 'Prazo de entrega a combinar. Pagamento conforme condições acordadas.'
};

const toneTemplates: Record<Tone, { connectors: string[]; emphasis: string; closingPrefix: string }> = {
  formal: {
    connectors: ['Desta forma,', 'Ressalta-se que', 'Vale mencionar que', 'Cumpre destacar que', 'Nesse sentido,'],
    emphasis: 'Excelência e credibilidade são nossos pilares.',
    closingPrefix: 'Atenciosamente, a equipe responsável pelo presente orçamento.'
  },
  técnico: {
    connectors: ['Tecnicamente,', 'Conforme especificação,', 'Em termos técnicos,', 'Operacionalmente,', 'Seguindo normas técnicas,'],
    emphasis: 'Todas as etapas seguem rigorosamente as normas técnicas aplicáveis.',
    closingPrefix: 'Especificações técnicas detalhadas disponíveis sob consulta.'
  },
  comercial: {
    connectors: ['Aproveite esta oportunidade', 'Invista no melhor', 'Garanta já', 'Não perca tempo', 'Maximize seus resultados'],
    emphasis: 'Solução com melhor custo-benefício do mercado.',
    closingPrefix: 'Oferta válida por tempo limitado. Entre em contato e garanta já!'
  },
  criativo: {
    connectors: ['Que tal inovar?', 'Imagine o resultado:', 'Transforme sua visão em realidade', 'Dê um passo além', 'Surpreenda-se com'],
    emphasis: 'Criatividade e originalidade em cada detalhe.',
    closingPrefix: 'Vamos criar algo incrível juntos?'
  },
};

function detectServiceCategory(name: string, description: string): string {
  const text = `${name} ${description}`.toLowerCase();
  if (/landing|site|web|frontend|desenvolvimento|programação|código/i.test(text)) return 'dev';
  if (/logo|brand|identidade visual|marca|design|criativo|arte/i.test(text)) return 'design';
  if (/consultor|consultoria|diagnóstico|estratégia|mentoria|coaching/i.test(text)) return 'consulting';
  if (/tráfego|ads|mídia|anúncio|marketing|social media/i.test(text)) return 'marketing';
  if (/fotografia|vídeo|produção|conteúdo|editorial/i.test(text)) return 'content';
  if (/manutenção|suporte|infra|cloud|servidor|hospedagem/i.test(text)) return 'infra';
  if (/instalação|elétrica|elétrico|rede|cabeamento|painel solar/i.test(text)) return 'electric';
  if (/mecânico|oficina|carro|automotivo|revisão|troca de óleo/i.test(text)) return 'auto';
  if (/construção|reforma|pedreiro|alvenaria|pintura|telhado/i.test(text)) return 'construction';
  if (/marcenaria|móvel|armário|cozinha planejada|painel/i.test(text)) return 'woodwork';
  if (/advogado|jurídico|parecer|contrato|petição|processual/i.test(text)) return 'legal';
  if (/arquitetura|arquiteto|projeto|planta|decoração|interiores/i.test(text)) return 'architecture';
  return 'general';
}

const categoryTemplates: Record<string, (style: typeof defaultStyle, tone: Tone, itemName: string) => { name: string; description: string }> = {
  dev: (style, tone, name) => ({
    name: name.includes('Premium') || tone === 'criativo' ? name : `${style.prefix} — ${name}`,
    description: `Desenvolvimento completo utilizando tecnologias modernas e arquitetura escalável. Projeto otimizado para performance, SEO e conversão. Inclui testes, homologação e documentação técnica. Suporte pós-entrega incluso.`
  }),
  design: (style, tone, name) => ({
    name: tone === 'criativo' ? `${name} • Conceito Exclusivo` : `${style.prefix} ${name}`,
    description: tone === 'criativo'
      ? `Criação autoral com pesquisa de referências, conceito criativo único e refinamento estético. Entrega de arquivos vetorizados, manual de aplicação e guia de estilo completo.`
      : `Desenvolvimento de identidade visual com briefing estratégico, pesquisa de mercado e criação de peças-chave. Inclui aplicações principais e arquivos prontos para produção.`
  }),
  consulting: (style, tone, name) => ({
    name: `${style.prefix} — ${name}`,
    description: `Diagnóstico aprofundado com análise de cenário, identificação de gaps e oportunidades. Elaboração de plano de ação customizado com metas, prazos e KPIs. Relatório executivo e sessão de alinhamento inclusos.`
  }),
  marketing: (style, tone, name) => ({
    name: tone === 'comercial' ? `${name} • Performance Máxima` : `${style.prefix} em ${name}`,
    description: `Planejamento estratégico de mídia paga com definição de público, orçamento e canais. Criação de criativos, textos e landings pages. Gerenciamento diário, otimização contínua e relatórios semanais de performance.`
  }),
  content: (style, tone, name) => ({
    name: `${style.prefix} — ${name}`,
    description: `Produção de conteúdo com briefing alinhado, roteiro aprovado e entregas em alta resolução. Inclui pós-produção, revisão e formatação para os canais de publicação.`
  }),
  infra: (style, tone, name) => ({
    name: `${style.prefix} — ${name}`,
    description: `Diagnóstico completo da infraestrutura atual, implementação de melhorias e configuração de ambiente. Inclui monitoramento, backups automatizados e documentação técnica.`
  }),
  electric: (style, tone, name) => ({
    name: `${name} — ${style.prefix}`,
    description: `Instalação técnica especializada seguindo normas de segurança vigentes. Serviço realizado por profissional certificado com materiais de primeira linha. Garantia de 90 dias sobre mão de obra e equipamentos.`
  }),
  auto: (style, tone, name) => ({
    name: `${name} • ${style.prefix}`,
    description: `Diagnóstico preciso utilizando equipamentos de última geração. Reparo com peças originais ou certificadas pelo fabricante. Serviço garantido por 3 meses ou 5.000km. Laudo técnico detalhado incluso.`
  }),
  construction: (style, tone, name) => ({
    name: `${style.prefix} — ${name}`,
    description: `Execução com materiais de alta qualidade e mão de obra especializada. Segue rigorosamente as normas técnicas e prazos acordados. Garantia de 1 ano sobre o serviço executado.`
  }),
  woodwork: (style, tone, name) => ({
    name: `${name} • Sob Medida`,
    description: `Confeccionado com matérias-primas selecionadas e acabamento de alto padrão. Projeto personalizado conforme suas necessidades e espaço disponível. Inclui montagem e instalação.`
  }),
  legal: (style, tone, name) => ({
    name: `${style.prefix} — ${name}`,
    description: `Elaboração com fundamentação jurídica robusta e análise criteriosa da legislação aplicável. Peça customizada para o caso concreto, com linguagem formal e técnica. Prazo de entrega conforme complexidade.`
  }),
  architecture: (style, tone, name) => ({
    name: `${style.prefix} — ${name}`,
    description: `Projeto desenvolvido com visão integrada de estética, funcionalidade e sustentabilidade. Inclui levantamento, estudos preliminares, anteprojeto e projeto executivo com detalhamento completo.`
  }),
};

function generateDescription(profession: string, tone: Tone, itemName: string, itemDesc: string): { name: string; description: string } {
  const style = professionStyles[profession] || defaultStyle;
  const category = detectServiceCategory(itemName, itemDesc);
  const template = categoryTemplates[category];

  if (template) {
    return template(style, tone, itemName);
  }

  const adj = style.adjectives[Math.floor(Math.random() * style.adjectives.length)];
  const verb = style.verbs[Math.floor(Math.random() * style.verbs.length)];
  const noun = style.nouns[Math.floor(Math.random() * style.nouns.length)];

  return {
    name: `${style.prefix} ${itemName}`,
    description: itemDesc
      ? `${verb.charAt(0).toUpperCase() + verb.slice(1)} ${itemDesc.toLowerCase()} com abordagem ${adj}, garantindo resultado profissional e seguro. Inclui todas as etapas necessárias para entrega completa do ${noun}.`
      : `Serviço especializado de ${itemName.toLowerCase()} com qualidade ${adj}. Inclui planejamento, execução e acompanhamento dedicado.`
  };
}

function generateNotes(profession: string, tone: Tone, clientName: string, vehicleOrService: string, originalNotes: string): string {
  const style = professionStyles[profession] || defaultStyle;
  const toneTemplate = toneTemplates[tone] || toneTemplates.comercial;
  const connector = toneTemplate.connectors[Math.floor(Math.random() * toneTemplate.connectors.length)];
  const adj = style.adjectives[Math.floor(Math.random() * style.adjectives.length)];
  const verb = style.verbs[Math.floor(Math.random() * style.verbs.length)];

  if (originalNotes) return originalNotes;

  const vehicle = vehicleOrService || 'serviço contratado';
  const client = clientName || 'cliente';

  return `${connector} o presente orçamento foi cuidadosamente elaborado para atender às necessidades específicas do ${client} quanto ao serviço de ${vehicle}. Nosso compromisso é entregar um resultado ${adj}, com total transparência e qualidade. ${toneTemplate.emphasis}\n\n${verb.charAt(0).toUpperCase() + verb.slice(1)} este escopo com dedicação exclusiva, assegurando prazos, custos e especificações acordados.`;
}

function generatePaymentInstructions(profession: string, tone: Tone, originalInstructions: string): string {
  if (originalInstructions) return originalInstructions;

  const style = professionStyles[profession] || defaultStyle;
  const toneTemplate = toneTemplates[tone] || toneTemplates.comercial;

  const instructions = [
    `Pagamento via Pix (CNPJ/CPF) ou transferência bancária.`,
    `Condições de pagamento: entrada de 50% + 50% na conclusão.`,
    `Nota fiscal emitida após confirmação do pagamento.`,
    style.closing,
  ];

  return instructions.join('\n');
}

function generateAestheticAdvice(profession: string, tone: Tone): string {
  const style = professionStyles[profession] || defaultStyle;
  const toneTemplate = toneTemplates[tone] || toneTemplates.comercial;
  const adj = style.adjectives[Math.floor(Math.random() * style.adjectives.length)];

  const advice = [
    `💡 Dica visual: Para maximizar a taxa de conversão deste orçamento, destaque os diferenciais competitivos com ícones e bullet points. Clientes do segmento de ${profession} respondem melhor a propostas objetivas e visualmente organizadas.`,
    `💡 Dica de conversão: Inclua depoimentos de clientes anteriores e cases de sucesso similares ao final da proposta. Isso gera prova social e acelera a decisão de compra em até 40%.`,
    `💡 Dica estratégica: Personalize o tom da conversa de acordo com o perfil do cliente. Para este nicho (${profession}), um tom ${tone} com linguagem ${adj} tende a gerar mais engajamento e fechamento.`,
  ];

  return advice[Math.floor(Math.random() * advice.length)];
}

export function enhanceWithLocalAI(input: CopywriterInput): CopywriterOutput {
  const tone: Tone = (input.tone as Tone) || 'comercial';

  const enhancedItems = input.items.map(item => {
    const enhanced = generateDescription(input.profession, tone, item.name, item.description);
    return {
      ...item,
      name: enhanced.name,
      description: enhanced.description,
    };
  });

  const notes = generateNotes(input.profession, tone, input.clientName, input.clientVehicleOrService, input.notes);
  const paymentInstructions = generatePaymentInstructions(input.profession, tone, input.paymentInstructions);

  return {
    items: enhancedItems,
    notes,
    paymentInstructions,
    aestheticAdvice: generateAestheticAdvice(input.profession, tone),
  };
}
