import test from 'node:test';
import assert from 'node:assert/strict';
import {metaConnectionStatus} from '../supabase/functions/orkto-core-mutations/_shared/meta-status.js';
const now=Date.parse('2026-10-26T12:00:00Z');
const current={status:'connected',verified_at:'2026-10-26T11:59:00Z',webhook_subscribed_at:'2026-10-26T10:00:00Z'};
test('saved connection alone is not current provider verification',()=>{
 assert.equal(metaConnectionStatus(current,true,now).connected,true);
 for(const patch of [{verified_at:null},{verified_at:'2026-10-25T12:00:00Z'},{verified_at:'2026-10-26T12:01:00Z'},{webhook_subscribed_at:null},{last_error_category:'authentication'}])
  assert.equal(metaConnectionStatus({...current,...patch},true,now).connected,false);
 assert.equal(metaConnectionStatus(current,false,now).state,'configuration_required');
 assert.equal(metaConnectionStatus({...current,status:'revoked'},true,now).state,'disconnected');
 assert.equal(metaConnectionStatus(null,true,now).state,'not_connected');
});
