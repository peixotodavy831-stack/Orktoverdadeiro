import test from 'node:test';
import assert from 'node:assert/strict';
import type {SupabaseClient} from '@supabase/supabase-js';
import {subscribeInboxChanges} from '../src/product/adapters/inbox-realtime.js';
const workspace='11111111-1111-4111-8111-111111111111';
const next=()=>new Promise<void>(resolve=>setTimeout(resolve,15));
function transport(auth:Promise<void>=Promise.resolve()) {
  const channels:any[]=[];const removed:any[]=[];const tokens:string[]=[];
  const client={realtime:{setAuth:(token:string)=>{tokens.push(token);return auth;}},channel:(name:string)=>{
    const handlers:any[]=[];let listener:(status:string)=>void=()=>{};
    const channel:any={name,handlers,on:(type:string,filter:any,callback:any)=>{handlers.push({type,filter,callback});return channel;},
      subscribe:(fn:any)=>{listener=fn;return channel;},status:(status:string)=>listener(status)};
    channels.push(channel);return channel;
  },removeChannel:async(channel:any)=>{removed.push(channel);return 'ok';}};
  return {client:client as unknown as SupabaseClient,channels,removed,tokens};
}
test('events require authenticated scope and never subscribe to unfilterable DELETE or wildcards',async()=>{
  const t=transport(),modes:string[]=[];let changes=0;
  const stop=subscribeInboxChanges(t.client,{workspaceId:workspace,accessToken:'synthetic-token',onChange:()=>changes++,onMode:m=>modes.push(m),debounceMs:0});
  await next();assert.equal(t.channels.length,1);assert.deepEqual(t.tokens,['synthetic-token']);
  assert.equal(t.channels[0].handlers.length,4);
  for(const handler of t.channels[0].handlers){assert.equal(handler.type,'postgres_changes');assert.equal(handler.filter.filter,`workspace_id=eq.${workspace}`);assert.ok(['INSERT','UPDATE'].includes(handler.filter.event));assert.ok(['orkto_messages','orkto_conversations'].includes(handler.filter.table));}
  t.channels[0].status('SUBSCRIBED');await next();assert.equal(changes,1);assert.equal(modes.at(-1),'events');stop();
  assert.equal(t.removed.length,1);
});
test('bursts invalidate once; foreign-tenant payloads and late callbacks cannot update the UI',async()=>{
  const t=transport();let changes=0;const stop=subscribeInboxChanges(t.client,{workspaceId:workspace,accessToken:'synthetic-token',onChange:()=>changes++,onMode:()=>{},debounceMs:0});
  await next();const handler=t.channels[0].handlers[0].callback;
  handler({new:{workspace_id:'foreign',content:'must never reach UI'}});await next();assert.equal(changes,0);
  handler({new:{workspace_id:workspace}});handler({new:{workspace_id:workspace}});handler({new:{workspace_id:workspace}});await next();assert.equal(changes,1);
  stop();handler({new:{workspace_id:workspace}});await next();assert.equal(changes,1);
});
test('disconnect falls back and CLOSED replaces channel; previous generation callbacks are ignored',async()=>{
  const t=transport(),modes:string[]=[];let changes=0;
  const stop=subscribeInboxChanges(t.client,{workspaceId:workspace,accessToken:'synthetic-token',onChange:()=>changes++,onMode:m=>modes.push(m),debounceMs:0,retryDelayMs:0});
  await next();t.channels[0].status('CHANNEL_ERROR');assert.equal(modes.at(-1),'periodic');
  t.channels[0].status('CLOSED');await next();assert.equal(t.channels.length,2);assert.equal(t.removed.length,1);
  t.channels[0].handlers[0].callback({new:{workspace_id:workspace}});await next();assert.equal(changes,0);
  t.channels[1].status('SUBSCRIBED');await next();assert.equal(changes,1);assert.equal(modes.at(-1),'events');stop();
});
test('cleanup during authentication opens no channel and invalid scope is rejected',async()=>{
  let release!:()=>void;const t=transport(new Promise(resolve=>{release=resolve;}));
  const stop=subscribeInboxChanges(t.client,{workspaceId:workspace,accessToken:'synthetic-token',onChange:()=>assert.fail('disposed'),onMode:()=>{}});
  stop();release();await next();assert.equal(t.channels.length,0);
  assert.throws(()=>subscribeInboxChanges(t.client,{workspaceId:'injected,filter',accessToken:'synthetic-token',onChange:()=>{},onMode:()=>{}}));
});
test('authentication failure stays periodic without opening a channel',async()=>{
  const t=transport(Promise.reject(Error('fixture failure'))),modes:string[]=[];
  const stop=subscribeInboxChanges(t.client,{workspaceId:workspace,accessToken:'synthetic-token',onChange:()=>{},onMode:m=>modes.push(m)});
  await next();assert.equal(t.channels.length,0);assert.equal(modes.at(-1),'periodic');stop();
});
