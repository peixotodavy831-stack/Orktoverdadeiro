import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildCommercialGraph } from '../backend/orkto-core/commercial-graph.js';
import { deriveMessageMemoryCandidates, estimateRepurchaseByProduct, estimateRepurchaseWindow, identifyReplayCandidate } from '../backend/orkto-core/full-operational.js';
import { buildVerifiedCommercialFact } from '../backend/orkto-core/memory-engine.js';
import { prepareResponseDraft } from '../backend/wiaos/response-pipeline.js';

test('Replay candidate needs a resolved objection and a later operator response', () => {
  assert.deepEqual(identifyReplayCandidate([
    { id: 'm1', direction: 'incoming', content: 'Achei caro, tem outra opção?', sentAt: '2026-09-01T10:00:00Z' },
    { id: 'm2', direction: 'outgoing', content: 'Posso apresentar uma alternativa em duas parcelas.', sentAt: '2026-09-01T10:02:00Z' },
  ]), {
    objectionType: 'price', strategy: 'offer_options', responseText: 'Posso apresentar uma alternativa em duas parcelas.', objectionMessageId: 'm1', responseMessageId: 'm2',
  });
  assert.equal(identifyReplayCandidate([{ direction: 'incoming', content: 'Olá, tudo bem?' }]), null);
  assert.equal(identifyReplayCandidate([{ direction: 'incoming', content: 'Achei caro' }]), null);
});

test('repeat-purchase estimate is separated by product and schedules a confident future window', () => {
  const events = [
    ...['2026-01-01','2026-01-31','2026-03-02','2026-04-01'].map(purchasedAt => ({ purchasedAt, amountCents: 5000, productKey: 'oil' })),
    ...['2026-01-01','2026-03-02','2026-05-01'].map(purchasedAt => ({ purchasedAt, amountCents: 3000, productKey: 'filter' })),
  ];
  const estimates = estimateRepurchaseByProduct(events, new Date('2026-04-15'));
  assert.deepEqual(estimates.map(item => item.productKey).sort(), ['filter','oil']);
  const future = estimateRepurchaseWindow(events.filter(item => item.productKey === 'oil'), new Date('2026-04-15'));
  assert.equal(future.eligible, true);
  assert.equal(future.windowOpen, false);
  assert.equal(future.intervalDays, 30);
  assert.equal(estimateRepurchaseWindow(events.slice(0, 2)).eligible, false);
});

test('automatic memory candidates are message-idempotent and only classify explicit contact preferences', () => {
  const input = { messageId: 'm-7', conversationId: 'c-2', direction: 'incoming' as const, content: 'Prefiro falar pela manhã, por favor.', occurredAt: '2026-09-27T12:00:00Z' };
  const candidates = deriveMessageMemoryCandidates(input);
  assert.equal(candidates.length, 2);
  assert.equal(candidates[0].type, 'raw_event');
  assert.deepEqual(candidates[1].content, { contactWindow: 'morning' });
  assert.equal(deriveMessageMemoryCandidates({ ...input, content: 'Oi, tudo bem?' }).length, 1);
  assert.deepEqual(deriveMessageMemoryCandidates({ ...input, direction: 'outgoing' }), []);
});

test('verified commercial memories retain entity-scoped provenance and reject incomplete sources', () => {
  const candidate = buildVerifiedCommercialFact({
    workspaceId:'workspace-a',customerId:'customer-a',factType:'purchase',source:'workspace_payment',sourceRef:'payment-1',
    facts:{ purchaseId:'purchase-1',amountCents:5000,confirmed:true,untrustedObject:{ignored:true} },
  });
  assert.ok(candidate);
  assert.equal(candidate.entityType,'customer');
  assert.equal(candidate.entityRef,'customer-a');
  assert.equal(candidate.memoryType,'fact');
  assert.deepEqual(candidate.content,{ factType:'purchase',purchaseId:'purchase-1',amountCents:5000,confirmed:true });
  assert.deepEqual(candidate.provenance,{ source:'workspace_payment',sourceRef:'payment-1',verification:'workspace_record' });
  assert.match(candidate.idempotencyKey,/verified-fact:workspace_payment:payment-1:purchase/);
  assert.equal(buildVerifiedCommercialFact({ workspaceId:'workspace-a',customerId:'customer-a',factType:'purchase',source:'workspace_payment',sourceRef:'',facts:{} }),null);
});

test('commercial graph emits typed, workspace-scoped edges only from explicit evidence', () => {
  const graph = buildCommercialGraph({ workspaceId: 'ws-a',
    customers: [{ id:'customer-a',name:'A',phone:'+5511999000001',company:'Oficina Norte' },{ id:'customer-b',name:'B',phone:'+5511999000002',company:'Oficina Norte' }],
    conversations: [{ id:'conversation-a',contact_name:'A',contact_phone:'+55 11 99900-0001' }],
    deals: [{ id:'deal-a',title:'Revisão',customer_ref:'customer-a',conversation_ref:'conversation-a',source:'referral',status:'open',value_cents:1200 }],
    proposals: [{ id:'quote-a',quote_number:'Q-1',deal_id:'deal-a',customer_id:'customer-a',status:'sent' }],
  });
  assert.ok(graph.edges.some(edge => edge.type === 'CUSTOMER_ORIGIN'));
  assert.ok(graph.edges.some(edge => edge.type === 'CUSTOMER_DEAL'));
  assert.ok(graph.edges.some(edge => edge.type === 'DEAL_PROPOSAL'));
  assert.ok(graph.edges.some(edge => edge.type === 'SHARED_SOURCE'));
  assert.ok(graph.edges.some(edge => edge.type === 'SUPPORTED_SIMILARITY'));
  assert.ok(graph.nodes.every(node => node.workspaceId === 'ws-a'));
  assert.ok(graph.edges.every(edge => edge.workspaceId === 'ws-a' && edge.provenance));
  assert.equal(graph.edges.some(edge => edge.type === 'CUSTOMER_REFERRAL'), false);
});

test('response pipeline preserves sourced prices and blocks unsourced values and prohibited guarantees', () => {
  const valid = prepareResponseDraft({ draft:'O total é R$ 125,00.', surface:'inbox', tone:'cordial', verifiedFacts:['Total vigente: R$ 125,00'], sourceRefs:['quote:q1'] });
  assert.equal(valid.status, 'ready');
  assert.match(valid.draft, /Olá!/);
  const unsourced = prepareResponseDraft({ draft:'O total é R$ 125,00.', surface:'recovery' });
  assert.equal(unsourced.status, 'blocked');
  const guarantee = prepareResponseDraft({ draft:'Resultado garantido, sem risco.', surface:'wia' });
  assert.equal(guarantee.status, 'blocked');
  assert.ok(guarantee.blockedReasons.length);
});
