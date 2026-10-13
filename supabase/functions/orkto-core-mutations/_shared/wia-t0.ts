export type T0Route = { name: string; input: Record<string, unknown>; clarification?: string };

export function routeT0Request(message: string): T0Route | null {
  const text = message.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/\b(vendas?|vendemos|vendeu|faturamento)\b/.test(text) && /\bhoje\b/.test(text)) return { name: 'get_sales_today', input: {} };
  if (/\b(or[cç]amentos?|propostas?)\b/.test(text) && /\b(abertos?|pendentes?|sem resposta)\b/.test(text)) return { name: 'get_open_quotes', input: {} };
  if (/\b(aprovacoes?|decisoes?)\b/.test(text) && /\b(pendentes?|aguardando|esperando)\b/.test(text)) return { name: 'get_pending_approvals', input: {} };
  const phone = message.match(/(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?\d{4,5}[\s-]?\d{4}/)?.[0];
  if (/\b(risco|calote|inadimplencia|memoria|preferencia|combinado|historico)\b/.test(text)) {
    if (phone) return { name: 'get_customer_operational_context', input: { phone: phone.replace(/\D/g, '') } };
    const customerId = message.match(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i)?.[0];
    if (customerId) return { name: 'get_customer_operational_context', input: { customerId } };
    return { name: 'get_customer_operational_context', input: {}, clarification: 'Para consultar risco e memórias sem confundir clientes, envie o telefone ou o ID do cliente.' };
  }
  if (/\b(cliente|contato)\b/.test(text) && phone) return { name: 'get_customer', input: { phone: phone.replace(/\D/g, '') } };
  return null;
}

function brl(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function messageForTool(name: string, output: unknown): string {
  const data = output as Record<string, unknown>;
  if (name === 'get_sales_today') return data.truncated === true
    ? 'Há mais de 100 vendas aprovadas hoje (UTC). O limite de consulta foi atingido; o total precisa de uma consulta específica.'
    : `Hoje (UTC) há ${data.salesCount} venda(s) aprovada(s), totalizando ${brl(Number(data.total))}.`;
  if (name === 'get_open_quotes') return data.truncated === true
    ? 'Há mais de 50 orçamentos abertos. O limite de consulta foi atingido; o total precisa de uma consulta específica.'
    : `Há ${data.count} orçamento(s) aberto(s), totalizando ${brl(Number(data.total))}.`;
  if (name === 'get_pending_approvals') return data.truncated === true
    ? 'Há mais de 50 aprovações aguardando decisão. O limite de consulta foi atingido.'
    : `Há ${data.count} aprovação(ões) aguardando sua decisão.`;
  if (name === 'get_customer') {
    const customer = data.customer as { name?: string; company?: string | null; quote_count?: number } | null;
    return customer ? `${customer.name}${customer.company ? `, da ${customer.company}` : ''}, possui ${customer.quote_count ?? 0} orçamento(s) registrado(s).` : 'Não encontrei esse cliente neste workspace.';
  }
  if (name === 'get_customer_operational_context') {
    const context = data.context as {
      customer?: { name?: string; company?: string | null };
      risk?: { score?: number; confidence?: number; reasons?: unknown[]; recommended_action?: string } | null;
      memories?: Array<{ memory_type?: string; content?: Record<string, unknown>; confidence?: number | null }>;
    } | null;
    if (!context?.customer) return 'Não encontrei esse cliente neste workspace. Nenhum dado foi alterado.';
    const risk = context.risk;
    const riskLevel = risk ? (Number(risk.score) >= 85 ? 'crítico' : Number(risk.score) >= 60 ? 'alto' : Number(risk.score) >= 30 ? 'médio' : 'baixo') : null;
    const reasons = risk?.reasons?.filter((reason): reason is string => typeof reason === 'string').slice(0, 3) || [];
    const riskText = risk
      ? `Risco ${riskLevel} (${Math.round(Number(risk.score))}/100; confiança ${Math.round(Number(risk.confidence) * 100)}%).${reasons.length ? ` Sinais: ${reasons.join('; ')}.` : ''} Próxima ação recomendada: ${risk.recommended_action || 'revisar o contexto'}.`
      : 'Ainda não há uma avaliação de risco registrada.';
    const memories = context.memories || [];
    const memoryText = memories.length
      ? `Memórias comerciais ativas: ${memories.slice(0, 3).map(memory => `${memory.memory_type}: ${JSON.stringify(memory.content || {}).slice(0, 180)}`).join(' | ')}.`
      : 'Não há memórias comerciais ativas para este cliente.';
    return `${context.customer.name}${context.customer.company ? `, da ${context.customer.company}` : ''}. ${riskText} ${memoryText}`;
  }
  return 'Consulta concluída.';
}
