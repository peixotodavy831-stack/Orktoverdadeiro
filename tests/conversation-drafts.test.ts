import {test} from 'node:test';
import assert from 'node:assert/strict';
import {updateConversationDraft} from '../src/product/adapters/conversation-drafts';

test('switching conversations retains separate drafts without mutating earlier state', () => {
  const initial = {scope:'fixture-session-a',values:{}};
  const a = updateConversationDraft(initial, initial.scope, 'conversation-a', 'Draft A');
  const b = updateConversationDraft(a, a.scope, 'conversation-b', 'Draft B');
  assert.deepEqual(b.values, {'conversation-a':'Draft A','conversation-b':'Draft B'});
  assert.deepEqual(initial.values, {});
});
test('acknowledging one conversation leaves the other draft intact', () => {
  const previous = {scope:'fixture-session-a',values:{a:'A',b:'B'}};
  assert.deepEqual(updateConversationDraft(previous, previous.scope, 'a', '').values,{b:'B'});
  assert.equal(previous.values.a,'A');
});
test('stale async send completion cannot clear a newer auth session draft', () => {
  const current = {scope:'fixture-session-new',values:{a:'New session draft'}};
  assert.strictEqual(updateConversationDraft(current,'fixture-session-old','a',''),current);
});
test('unauthenticated draft updates are rejected', () => {
  const current = {scope:null,values:{}};
  assert.strictEqual(updateConversationDraft(current,null,'a','Private text'),current);
});
