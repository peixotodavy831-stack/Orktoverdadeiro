export type GraphRecord = Record<string, unknown>;

export interface CommercialGraphInput {
  workspaceId: string;
  customers: GraphRecord[];
  deals: GraphRecord[];
  conversations: GraphRecord[];
  proposals: GraphRecord[];
}

const normalizedText = (value: unknown) => String(value || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
const normalizedPhone = (value: unknown) => String(value || '').replace(/\D/g, '');

/** Build a tenant-local graph only from explicit foreign keys or exact observed values. */
export function buildCommercialGraph(input: CommercialGraphInput) {
  const { workspaceId } = input;
  const nodes: Array<Record<string, unknown>> = [];
  const edges: Array<Record<string, unknown>> = [];
  const customerNodeByRef = new Map<string, string>();
  const conversationNodeById = new Map<string, string>();
  const dealNodeById = new Map<string, string>();
  const customersByExactCompany = new Map<string, string[]>();

  for (const customer of input.customers) {
    const id = `customer:${customer.id}`;
    nodes.push({ id, workspaceId, type: 'customer', entityRef: customer.id, label: customer.name, company: customer.company || null });
    customerNodeByRef.set(String(customer.id), id);
    const phone = normalizedPhone(customer.phone);
    if (phone) customerNodeByRef.set(phone, id);
    const companyKey = normalizedText(customer.company);
    if (companyKey) customersByExactCompany.set(companyKey, [...(customersByExactCompany.get(companyKey) || []), id]);
  }

  const clusters = [...customersByExactCompany.entries()].filter(([, members]) => members.length > 1)
    .map(([label, members], index) => ({ id: `company:${index + 1}`, workspaceId, type: 'exact_company', label, members,
      provenance: { table: 'clients', field: 'company', match: 'normalized_exact' } }));
  for (const cluster of clusters) {
    for (const member of cluster.members) {
      const node = nodes.find(item => item.id === member);
      if (node) node.clusterId = cluster.id;
    }
    for (let index = 1; index < cluster.members.length; index += 1) {
      const left = cluster.members[0]; const right = cluster.members[index];
      edges.push({ id: `${left}<->${right}:company`, workspaceId, source: left, target: right, type: 'SUPPORTED_SIMILARITY', confidence: 0.9, provenance: cluster.provenance });
    }
  }

  for (const conversation of input.conversations) {
    const id = `conversation:${conversation.id}`;
    conversationNodeById.set(String(conversation.id), id);
    nodes.push({ id, workspaceId, type: 'conversation', entityRef: conversation.id, label: conversation.contact_name, channel: 'conversation' });
    const customer = customerNodeByRef.get(normalizedPhone(conversation.contact_phone));
    if (customer) edges.push({ id: `${id}->${customer}:origin`, workspaceId, source: id, target: customer, type: 'CUSTOMER_ORIGIN', confidence: 1,
      provenance: { table: 'orkto_conversations', recordId: conversation.id, field: 'contact_phone', match: 'normalized_exact' } });
  }

  const sourceNodeByKey = new Map<string, string>();
  for (const deal of input.deals) {
    const id = `deal:${deal.id}`;
    dealNodeById.set(String(deal.id), id);
    nodes.push({ id, workspaceId, type: 'deal', entityRef: deal.id, label: deal.title, status: deal.status, valueCents: Number(deal.value_cents || 0) });
    const customerRef = String(deal.customer_ref || '');
    const customer = customerNodeByRef.get(customerRef) || customerNodeByRef.get(normalizedPhone(customerRef));
    if (customer) edges.push({ id: `${customer}->${id}:deal`, workspaceId, source: customer, target: id, type: 'CUSTOMER_DEAL', confidence: 1,
      provenance: { table: 'orkto_deals', recordId: deal.id, field: 'customer_ref', value: customerRef } });
    const conversation = conversationNodeById.get(String(deal.conversation_ref || ''));
    if (conversation) edges.push({ id: `${conversation}->${id}:deal-origin`, workspaceId, source: conversation, target: id, type: 'DEAL_ORIGIN', confidence: 1,
      provenance: { table: 'orkto_deals', recordId: deal.id, field: 'conversation_ref', value: deal.conversation_ref } });
    const sourceLabel = String(deal.source || '').trim();
    if (sourceLabel && !['manual', 'system'].includes(normalizedText(sourceLabel))) {
      const sourceKey = normalizedText(sourceLabel);
      const referringCustomer = customerNodeByRef.get(sourceLabel) || customerNodeByRef.get(normalizedPhone(sourceLabel));
      if (referringCustomer && customer && referringCustomer !== customer) {
        edges.push({ id: `${referringCustomer}->${customer}:referral:${deal.id}`, workspaceId, source: referringCustomer, target: customer, type: 'CUSTOMER_REFERRAL', confidence: 1,
          provenance: { table: 'orkto_deals', recordId: deal.id, field: 'source', match: 'exact_customer_id_or_phone', value: sourceLabel } });
      }
      if (referringCustomer) continue;
      const sourceNode = sourceNodeByKey.get(sourceKey) || `source:${encodeURIComponent(sourceKey)}`;
      if (!sourceNodeByKey.has(sourceKey)) {
        sourceNodeByKey.set(sourceKey, sourceNode);
        nodes.push({ id: sourceNode, workspaceId, type: 'source', entityRef: sourceLabel, label: sourceLabel });
      }
      edges.push({ id: `${id}->${sourceNode}:shared-source`, workspaceId, source: id, target: sourceNode, type: 'SHARED_SOURCE', confidence: 1,
        provenance: { table: 'orkto_deals', recordId: deal.id, field: 'source', value: sourceLabel } });
    }
  }

  for (const proposal of input.proposals) {
    const id = `proposal:${proposal.id}`;
    nodes.push({ id, workspaceId, type: 'proposal', entityRef: proposal.id, label: proposal.quote_number || `Proposta ${String(proposal.id).slice(0, 8)}`, status: proposal.status });
    const deal = dealNodeById.get(String(proposal.deal_id || ''));
    if (deal) edges.push({ id: `${deal}->${id}:proposal`, workspaceId, source: deal, target: id, type: 'DEAL_PROPOSAL', confidence: 1,
      provenance: { table: 'quotes', recordId: proposal.id, field: 'deal_id', value: proposal.deal_id } });
    const customer = proposal.customer_id ? customerNodeByRef.get(String(proposal.customer_id)) : null;
    if (customer) edges.push({ id: `${customer}->${id}:proposal-customer`, workspaceId, source: customer, target: id, type: 'CUSTOMER_PROPOSAL', confidence: 1,
      provenance: { table: 'quotes', recordId: proposal.id, field: 'customer_id', value: proposal.customer_id } });
  }

  return { workspaceId, nodes, edges, clusters, edgeProvenance: 'Cada aresta contém tipo, workspace e a fonte/campo que comprova a relação; nenhuma aresta é inferida pelo modelo.' };
}
