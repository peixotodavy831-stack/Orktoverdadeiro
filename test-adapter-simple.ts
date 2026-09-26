// Teste simples do hermes-adapter
import { getHermesAdapter, type ConversationContext } from './backend/orkto-core/hermes-adapter.js';
import crypto from 'crypto';

const adapter = getHermesAdapter();
console.log('Adapter:', typeof adapter);

const context: ConversationContext = {
  conversationId: crypto.randomUUID(),
  workspaceId: 'ws-001',
  contactId: crypto.randomUUID(),
  contactName: 'Test',
  contactPhone: '5511999999999',
  channel: 'whatsapp',
  recentMessages: [{
    id: crypto.randomUUID(),
    senderType: 'customer',
    content: 'Olá, gostaria de saber mais',
    createdAt: new Date().toISOString(),
    messageType: 'text',
  }],
};

console.log('Context criado');

try {
  const intent = await adapter.classifyIntent(context);
  console.log('Intent:', JSON.stringify(intent, null, 2));
  
  const specialist = await adapter.selectSpecialist(intent, context);
  console.log('Specialist:', specialist.specialistName);
  
  const suggestion = await adapter.suggestResponse(context, intent);
  console.log('Suggestion:', suggestion.text);
  
  console.log('\n✅ Todos os testes passaram!');
} catch (error) {
  console.error('\n❌ Erro:', error);
  console.error('Stack:', error instanceof Error ? error.stack : 'N/A');
  process.exit(1);
}
