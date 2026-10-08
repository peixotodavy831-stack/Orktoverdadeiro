import assert from 'node:assert/strict';
import test from 'node:test';
import { clientInput } from '../backend/orkto-core/client-input.js';

test('client command accepts only operator-editable fields', () => {
  assert.equal(clientInput.safeParse({ name:' Cliente A ',phone:' +5511999990001 ' }).success,true);
  for (const field of ['workspace_id','tenant_id','user_id','created_by','owner_user_id','archived_at','quote_count']) {
    assert.equal(clientInput.safeParse({ name:'Cliente A',phone:'+5511999990001',[field]:'forged' }).success,false,field);
  }
});

test('client update fields use the same strict validator', () => {
  const patch=clientInput.partial().strict();
  assert.equal(patch.safeParse({ name:'Novo nome' }).success,true);
  assert.equal(patch.safeParse({ phone:'a' }).success,false);
  assert.equal(patch.safeParse({ company:null }).success,true);
  assert.equal(patch.safeParse({ workspace_id:'foreign' }).success,false);
});
