import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  aggregateReplay,
  aggregateCollectiveMemory,
  assessOperationalRisk,
  auditProposalPrice,
  buildRecoverySchedule,
  classifyConversationSignals,
  classifyImportDuplicates,
  compareCustomers,
  computeOperationalMetrics,
  deriveMoodRing,
  estimateRepurchaseWindow,
  rankConversation,
  recoveryStopReason,
  routeSwarmAgent,
  scoreOperationalAnxiety,
  transitionCollection,
  validateImportRows,
} from '../backend/orkto-core/full-operational.js';

test('inbox priority reports evidence and respects manual override', () => {
  const ranked = rankConversation({ valueCents: 500_000, urgency: 'urgent', minutesWaiting: 90, slaMinutes: 30, recurringCustomer: true, intent: 'buy' });
  assert.equal(ranked.level, 'urgent');
  assert.ok(ranked.reasons.length >= 4);
  assert.deepEqual(rankConversation({ override: 'low', urgency: 'urgent' }), { score: 15, level: 'low', reasons: ['Prioridade ajustada manualmente.'], overridden: true });
});

test('risk engine explains score, holds irreversible decisions for humans, and honors opt out', () => {
  const risky = assessOperationalRisk([{ type: 'overdue_payment' }, { type: 'missed_promise' }, { type: 'proposal_unanswered' }]);
  assert.ok(risky.score >= 60);
  assert.equal(risky.riskLevel, 'HIGH');
  assert.equal(risky.recommendedAction, 'human_review');
  assert.equal(assessOperationalRisk([{ type: 'explicit_opt_out' }]).recommendedAction, 'pause_contact');
  assert.deepEqual(assessOperationalRisk([]), {
    score: 0, riskLevel: 'LOW', confidence: 0, reasons: [], signals: [], engineVersion: 'operational-risk-v1', recommendedAction: 'continue_normally',
  });
});

test('mood rings and anxiety use operational signals, not diagnosis', () => {
  assert.equal(deriveMoodRing({ completedPurchases: 4, positiveSignals: 3 }).state, 'LOYAL');
  assert.equal(deriveMoodRing({ negativeSignals: 2 }).state, 'STUCK');
  assert.equal(deriveMoodRing({}).confidence, 0);
  assert.ok(deriveMoodRing({ completedPurchases: 4, positiveSignals: 3, replyRate: 0.8 }).confidence > 0.5);
  assert.ok(scoreOperationalAnxiety({ urgencyWords: 2, messagesLastDay: 6 }).score > 30);
});

test('conversation signal classification detects Portuguese buying urgency without an LLM', () => {
  assert.deepEqual(classifyConversationSignals('Preciso de um orçamento urgente para hoje'), {
    intent: 'buy', urgency: 'urgent', signals: ['Urgência identificada na mensagem (urgent).', 'Intenção identificada: buy.'],
  });
  assert.equal(classifyConversationSignals('Meu pagamento está vencido').intent, 'payment');
  assert.equal(classifyConversationSignals('Olá, tudo bem?').intent, 'unknown');
});

test('repeat-purchase estimator cold-starts safely and requires confidence before activation', () => {
  assert.equal(estimateRepurchaseWindow([{ purchasedAt: '2026-01-01', amountCents: 100 }]).eligible, false);
  const result = estimateRepurchaseWindow([
    { purchasedAt: '2026-01-01', amountCents: 100 },
    { purchasedAt: '2026-01-31', amountCents: 100 },
    { purchasedAt: '2026-03-02', amountCents: 100 },
    { purchasedAt: '2026-04-01', amountCents: 100 },
  ], new Date('2026-05-10'));
  assert.equal(result.intervalDays, 30);
  assert.equal(result.eligible, true);
});

test('proposal recovery schedules default D+1/4/10/30/90 and stops on opt-out or reply', () => {
  assert.deepEqual(buildRecoverySchedule(new Date('2026-01-01T00:00:00.000Z')).map(step => step.step), ['D+1', 'D+4', 'D+10', 'D+30', 'D+90']);
  assert.equal(recoveryStopReason({ customerReplied: true, optedOut: true }), 'opt_out');
  assert.throws(() => buildRecoverySchedule(new Date(), [4, 1]), /inválida/);
});

test('collection transitions reject impossible state changes', () => {
  transitionCollection('OPEN', 'CONTACTED');
  assert.throws(() => transitionCollection('CLOSED', 'PROMISED'), /inválida/);
});

test('swarm routes to one contextual specialist', () => {
  assert.equal(routeSwarmAgent('Analise este pagamento vencido', { overdueAmountCents: 100 }), 'collection_agent');
  assert.equal(routeSwarmAgent('gere um relatório das vendas'), 'reporting_agent');
  assert.equal(routeSwarmAgent('olá'), 'qualification_agent');
});

test('duplicate matching returns possible match for review and does not merge', () => {
  assert.equal(compareCustomers({ id: 'a', name: 'João Silva', email: 'a@example.com' }, { id: 'b', name: 'Joao Silva', email: 'A@example.com' }).status, 'MATCH');
  assert.equal(compareCustomers({ id: 'a', phone: '+55 11 99999-0000' }, { id: 'b', phone: '5511999990000' }).status, 'POSSIBLE_MATCH');
  assert.equal(compareCustomers({ id: 'a', email: 'a@x.com' }, { id: 'b', email: 'b@y.com' }).status, 'NO_MATCH');
});

test('price audit blocks unauthorized discounts', () => {
  const blocked = auditProposalPrice({ catalogPriceCents: 10_000, proposedPriceCents: 8_000, maxDiscountPercent: 15 });
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.requiresApproval, true);
  const approved = auditProposalPrice({ catalogPriceCents: 10_000, proposedPriceCents: 9_000, maxDiscountPercent: 15, authorizedDiscountPercent: 10 });
  assert.equal(approved.allowed, true);
});

test('conversation replay only recommends after minimum resolved sample', () => {
  const data = aggregateReplay([
    { objectionType: 'preço', strategy: 'parcelamento', outcome: 'won' },
    { objectionType: 'preço', strategy: 'parcelamento', outcome: 'won' },
    { objectionType: 'preço', strategy: 'parcelamento', outcome: 'lost' },
  ]);
  assert.equal(data[0].eligibleForRecommendation, true);
  assert.equal(data[0].conversionRate, 0.667);
  assert.equal(aggregateReplay([{ objectionType: 'preço', strategy: 'parcelamento', outcome: 'won' }])[0].eligibleForRecommendation, false);
});

test('collective memory aggregates only latest approved numeric contributions after minimum cohort', () => {
  const contributions = Array.from({ length:5 }, (_,index) => ({
    workspace_id:`workspace-${index}`, sector_key:'automotive', pattern_key:'quote_acceptance', consent_status:'approved' as const,
    contribution_version:1, aggregate:{ periodStart:'2026-01-01',periodEnd:'2026-01-31',quoteCount:2, acceptedQuotes:1, conversationCount:10, responseMinutesTotal:120, responseSamples:2, customerName:'must-not-leak' },
  }));
  const aggregate = aggregateCollectiveMemory(contributions);
  assert.equal(aggregate.eligibleGroupCount,1);
  assert.equal(aggregate.items[0].contributingWorkspaceCount,5);
  assert.equal(aggregate.items[0].aggregate.quoteCount,10);
  assert.equal(aggregate.items[0].aggregate.quoteAcceptanceRate,0.5);
  assert.equal(aggregate.items[0].aggregate.averageResponseMinutes,60);
  assert.equal(JSON.stringify(aggregate).includes('workspace-0'),false);
  assert.equal(JSON.stringify(aggregate).includes('must-not-leak'),false);
  assert.equal(aggregateCollectiveMemory(contributions.slice(0,4)).suppressedGroupCount,1);
  const retracted = aggregateCollectiveMemory([...contributions,{ ...contributions[0], contribution_version:2, consent_status:'retracted' as const }]);
  assert.equal(retracted.eligibleGroupCount,0,'a newer retraction must not revive an older approved contribution');
});

test('import validator identifies incomplete records before any insert', () => {
  const rows = validateImportRows([{ name: 'Ana', phone: '12345678' }, { name: '', phone: '1' }], ['name']);
  assert.equal(rows[0].valid, true);
  assert.equal(rows[1].valid, false);
  assert.equal(rows[1].errors.length, 2);
});

test('import duplicate review catches existing customers and repeats inside the same file', () => {
  const checked = validateImportRows([
    { name: 'Ana Silva', phone: '11987654321' },
    { name: 'Ana Silva', phone: '11987654321' },
    { name: 'Bruno Costa', phone: '21987654321' },
  ], ['name']);
  const classified = classifyImportDuplicates(checked, []);
  assert.equal(classified[0].status, 'valid');
  assert.equal(classified[1].status, 'duplicate');
  assert.equal(classified[1].duplicateMatches[0].rowNumber, 1);
  assert.equal(classified[2].status, 'valid');
  const matchedExisting = classifyImportDuplicates([checked[0]], [{ id: 'existing-ana', name: 'Ana Silva', phone: '11987654321' }]);
  assert.equal(matchedExisting[0].status, 'duplicate');
  assert.equal(matchedExisting[0].duplicateMatches[0].clientId, 'existing-ana');
});

test('report metrics distinguish computed data from missing coverage', () => {
  const metrics = computeOperationalMetrics({
    quotes: [{ total: 100, status: 'approved' }, { total: 50, status: 'pending' }],
    deals: [{ value_cents: 20_000, status: 'won' }, { value_cents: 10_000, status: 'open' }],
    conversations: [{ status: 'open' }, { status: 'closed' }],
    responseMinutes: [30, 10, 20],
  });
  assert.equal(metrics.basis, 'computed_from_workspace_records');
  assert.equal(metrics.quotes.valueCents, 15_000);
  assert.equal(metrics.deals.pipelineValueCents, 10_000);
  assert.equal(metrics.response.medianMinutes, 20);
  assert.equal(computeOperationalMetrics({ quotes: [], deals: [], conversations: [] }).response.medianMinutes, null);
});
