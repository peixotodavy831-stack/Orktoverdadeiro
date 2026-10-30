import test from 'node:test';
import assert from 'node:assert/strict';
import {saveChatMessage,loadChatContext} from '../supabase/functions/orkto-core-mutations/_shared/wia-chat.ts';
import {readWiaChat} from '../backend/wiaos/chat-history.js';
import {prepareTrustedRequest} from '../supabase/functions/orkto-core-mutations/_shared/wia-request.ts';

const scope={workspaceId:'11111111-1111-4111-8111-111111111111',actorId:'22222222-2222-4222-8222-222222222222',sessionId:'33333333-3333-4333-8333-333333333333',traceId:'44444444-4444-4444-8444-444444444444'};
function database(seed:any[]=[]) {
  const rows=[...seed];let completed:any=null;let failAssistant=false;let finishes=0;
  const db={rows,get finishes(){return finishes;},failAssistant(){failAssistant=true;},
    rpc:async(name:string,args:any)=>{
      if(name==='orkto_wia_claim_request')return {data:completed?{result:'REPLAY',status:'succeeded',runtime_response:completed,wia_run_id:scope.traceId}:{result:'STARTED',wia_run_id:scope.traceId},error:null};
      if(name==='orkto_wia_finish_request'){finishes++;if(args.p_status==='succeeded')completed=args.p_payload;}
      return {data:{result:'COMPLETED',wia_run_id:scope.traceId},error:null};
    },from(table:string){
      let limit=Infinity;let single=false;let writing:any=null;const filters:any[]=[];
      const query:any={select:()=>query,eq:(k:string,v:any)=>{filters.push((r:any)=>r[k]===v);return query;},
        gte:()=>query,in:()=>query,is:()=>query,order:()=>query,limit:(n:number)=>{limit=n;return query;},
        maybeSingle:()=>{single=true;return query;},upsert:(row:any)=>{writing=row;return query;},
        then:async(done:any)=>{
          if(writing){
            if(failAssistant&&writing.role==='assistant'){failAssistant=false;return done({error:{code:'unavailable'}});}
            if(!rows.some(r=>['workspace_id','session_id','message_key','role'].every(k=>r[k]===writing[k])))rows.push({...writing,id:`row-${rows.length}`,created_at:'2026-10-29T12:00:00Z'});
          }
          const found=(table==='orkto_wia_chat_messages'?rows:[]).filter(r=>filters.every(f=>f(r))).slice(0,limit);
          return done({data:single?found[0]||null:found,error:null,count:0});
        }};return query;
    }};return db;
}
const row=(extra:any={})=>({id:'seed',workspace_id:scope.workspaceId,user_id:scope.actorId,session_id:scope.sessionId,role:'user',message_key:'old',content:'Minha conversa',created_at:'2026-10-29T10:00:00Z',...extra});
test('reload recovers a durable completed response without inference or GET writes',async()=>{
  const run={workspace_id:scope.workspaceId,user_id:scope.actorId,status:'succeeded',completed_at:'2026-10-29T10:01:00Z',runtime_response:{path:'t0',decision:{messageDraft:'Resposta já persistida',sourceIds:['quote:synthetic']},usage:{provider:'none',model:'t0-deterministic'}}};
  const db=database([row({run_id:scope.traceId,run})]);
  for(let i=0;i<2;i++) {
    const history=await readWiaChat(db,scope.workspaceId,scope.actorId,scope.sessionId);
    assert.equal(history.data.length,2);assert.equal(history.data[1].recovered,true);
    assert.equal(history.data[1].content,'Resposta já persistida');assert.deepEqual(history.data[1].sourceIds,['quote:synthetic']);
  }
  assert.equal(db.rows.length,1);assert.equal(db.finishes,0);
  db.rows.push(row({id:'saved-reply',role:'assistant',run_id:scope.traceId,run,content:'Resposta já persistida',created_at:run.completed_at}));
  const history=await readWiaChat(db,scope.workspaceId,scope.actorId,scope.sessionId);
  assert.equal(history.data.length,2);assert.equal(history.data.some((r:any)=>r.recovered),false);
});
test('reload cannot recover foreign, running, failed, malformed or oversized run output',async()=>{
  const run={workspace_id:scope.workspaceId,user_id:scope.actorId,status:'succeeded',completed_at:'2026-10-29T10:01:00Z',runtime_response:{decision:{messageDraft:'Private output'}}};
  for(const extra of [{workspace_id:'foreign'},{user_id:'foreign'},{status:'failed'},{status:'running'},{completed_at:'invalid'},{runtime_response:{decision:{messageDraft:'x'.repeat(4001)}}}]) {
    const history=await readWiaChat(database([row({run_id:scope.traceId,run:{...run,...extra}})]),scope.workspaceId,scope.actorId,scope.sessionId);
    assert.equal(history.data.length,1);assert.equal(history.data.some((r:any)=>r.recovered),false);
  }
});
test('chat upsert is durable, idempotent and never overwrites a conflicting message',async()=>{
  const db=database();await saveChatMessage(db,scope,'user','Olá');await saveChatMessage(db,scope,'user','Olá');
  assert.equal(db.rows.length,1);await assert.rejects(saveChatMessage(db,scope,'user','Outra mensagem'));
  assert.equal(db.rows[0].content,'Olá');
});
test('context and history isolate workspace, actor and session; never accept browser-supplied history',async()=>{
  const db=database([row(),row({id:'foreign-w',workspace_id:'foreign'}),row({id:'foreign-u',user_id:'foreign'}),row({id:'foreign-s',session_id:'foreign'}),row({id:'current',message_key:scope.traceId})]);
  assert.deepEqual(await loadChatContext(db,scope),[{role:'user',content:'Minha conversa'}]);
  const history=await readWiaChat(db,scope.workspaceId,scope.actorId,scope.sessionId);
  assert.deepEqual(history.data.map((r:any)=>r.id),['current','seed']);
  assert.equal(JSON.stringify(history).includes('foreign-'),false);
});
test('history windows are bounded and expose truncation instead of claiming complete history',async()=>{
  const db=database(Array.from({length:205},(_,i)=>row({id:`row-${i}`,content:'x'.repeat(4000)})));
  const context=await loadChatContext(db,scope);assert.equal(context.length,3);assert.equal(context.reduce((n,r)=>n+r.content.length,0),12000);
  const history=await readWiaChat(db,scope.workspaceId,scope.actorId,scope.sessionId);
  assert.equal(history.truncated,true);assert.equal(history.data.length,200);
});
test('T0 chat needs no model and records both messages only after durable execution',async()=>{
  const db=database();const input={...scope,message:'Aprovações pendentes',monthlyLimit:10,requestId:scope.traceId,fingerprint:'a'.repeat(64)};
  const result=await prepareTrustedRequest(db,input,{get:()=>undefined},async()=>{throw Error('No inference authorized');});
  assert.equal(result.chatPersistence,'persisted');assert.equal(result.path,'t0');assert.deepEqual(db.rows.map(r=>r.role),['user','assistant']);
});
test('ambiguous assistant persistence is not success; replay repairs history without repeating execution',async()=>{
  const db=database();db.failAssistant();const input={...scope,message:'Aprovações pendentes',monthlyLimit:10,requestId:scope.traceId,fingerprint:'a'.repeat(64)};
  const noSend=async()=>{throw Error('No inference authorized');};
  await assert.rejects(prepareTrustedRequest(db,input,{get:()=>undefined},noSend),(error:any)=>error.code==='CHAT_PERSISTENCE_UNAVAILABLE');
  assert.equal(db.rows.length,1);assert.equal(db.finishes,1);
  const replay=await prepareTrustedRequest(db,input,{get:()=>undefined},noSend);
  assert.equal(replay.replayed,true);assert.equal(replay.chatPersistence,'persisted');assert.equal(db.rows.length,2);assert.equal(db.finishes,1);
});
