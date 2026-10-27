import test from 'node:test';
import assert from 'node:assert/strict';
import {loadMessageHistory,messageHistoryCursor} from '../backend/channels/message-history.js';
test('history query is bounded, ordered by timestamp and UUID, and always tenant scoped',async()=>{
 const calls:unknown[][]=[];
 const rows=Array.from({length:201},(_,i)=>({id:String(201-i),sent_at:'2026-10-27T00:00:00.000Z'}));
 const q:any={select:(...a:any[])=>{calls.push(['select',...a]);return q;},eq:(...a:any[])=>{calls.push(['eq',...a]);return q;},
  or:(...a:any[])=>{calls.push(['or',...a]);return q;},order:(...a:any[])=>{calls.push(['order',...a]);return q;},
  limit:async(n:number)=>{calls.push(['limit',n]);return {data:rows,error:null};}};
 const cursor=messageHistoryCursor('2026-10-27T10:00:00Z','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
 const result=await loadMessageHistory({from:(name:string)=>{assert.equal(name,'orkto_messages');return q;}},'A','conversation',cursor);
 assert.deepEqual(calls.filter(call=>call[0]==='eq'),[['eq','workspace_id','A'],['eq','conversation_id','conversation']]);
 assert.deepEqual(calls.at(-1),['limit',201]);assert.equal(result.messages.length,200);assert.equal(result.nextCursor?.id,'2');
 assert.equal(result.messages[0].id,'2');assert.equal(result.messages.at(-1).id,'201');
 assert.match(String(calls.find(call=>call[0]==='or')?.[1]),/id.lt.aaaaaaaa/);
});
test('history cursor rejects expression injection, partial cursors and invalid dates',()=>{
 assert.equal(messageHistoryCursor(undefined,undefined),null);
 for(const [at,id] of [['2026-10-27T00:00:00Z',undefined],['bad','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],['2026-10-27T00:00:00Z','id),or(workspace_id.eq.B']])assert.throws(()=>messageHistoryCursor(at,id));
 assert.equal(messageHistoryCursor('2026-10-27T00:00:00.123456+00:00','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')?.at,'2026-10-27T00:00:00.123456+00:00');
});
