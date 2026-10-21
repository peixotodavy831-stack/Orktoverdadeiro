import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {parseRadarSnapshot,radarDestination,RadarResults} from '../src/product/screens/today-radar-panel.js';
import type {RadarSignalView,RadarSnapshotView} from '../src/product/types.js';
const signal:RadarSignalView={id:'r',kind:'overdue_followup',severity:'medium',title:'Tarefa de teste',recommendation:'Revisar prazo',entity_type:'task',entity_ref:'task-1',suggested_view:'deals',source:'task_due',evidence:{}};
const snapshot:RadarSnapshotView={version:'R1',read_only:true,generated_at:'2026-10-21T12:00:00.000Z',counts:{unanswered_proposals:0,unattended_leads:0,overdue_followups:1},signals:[signal],coverage:{partial:false,limited_sources:[],leads_evaluated:true}};
test('Radar UI never navigates a standalone task ID as a deal',()=>{
 assert.equal(radarDestination(signal),null);
 assert.deepEqual(radarDestination({...signal,action_query:{dealId:'deal-1'}}),{type:'deal',id:'deal-1',label:'Abrir negócio vinculado'});
 const html=renderToStaticMarkup(createElement(RadarResults,{snapshot,onOpen:()=>{}}));
 assert.match(html,/sem negócio vinculado/);assert.doesNotMatch(html,/Abrir negócio/);
});
test('Radar malformed/missing data is an error, not an empty success',()=>{
 assert.throws(()=>parseRadarSnapshot({signals:[]}));assert.throws(()=>parseRadarSnapshot({...snapshot,read_only:false}));
 assert.deepEqual(parseRadarSnapshot(snapshot),snapshot);
});
test('Radar partial zero result does not promise a complete healthy operation',()=>{
 const html=renderToStaticMarkup(createElement(RadarResults,{snapshot:{...snapshot,signals:[],coverage:{partial:true,limited_sources:['messages'],leads_evaluated:false}},onOpen:()=>{}}));
 assert.match(html,/Consulta parcial/);assert.match(html,/Leads não foram avaliados/);assert.match(html,/Nenhum sinal confirmado nesta consulta parcial/);
});
test('Radar source/date are explicit and user content is escaped',()=>{
 const html=renderToStaticMarkup(createElement(RadarResults,{snapshot:{...snapshot,signals:[{...signal,title:'<script>alert(1)</script>',entity_type:'deal',entity_ref:'d',source:'deal_expected_close'}]},onOpen:()=>{}}));
 assert.match(html,/UTC/);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);
});

test('Radar UI exposes timestamped evidence for each recommendation without inventing missing fields',()=>{
 const fixtures:RadarSignalView[]=[
  {...signal,kind:'unanswered_proposal',entity_type:'quote',suggested_view:'proposals',evidence:{sent_at:'2026-10-18T12:00:00.000Z',viewed_at:null,waiting_hours:72}},
  {...signal,kind:'unattended_lead',entity_type:'conversation',suggested_view:'conversations',evidence:{waiting_since:'2026-10-21T08:00:00.000Z',last_message_at:'2026-10-21T08:00:00.000Z',sla_minutes:60,response_scope:'first_response'}},
  {...signal,evidence:{due_at:'2026-10-19T12:00:00.000Z'}},
  {...signal,entity_type:'deal',source:'deal_expected_close',evidence:{expected_close_on:'2026-10-15'}},
 ];
 const html=renderToStaticMarkup(createElement(RadarResults,{snapshot:{...snapshot,signals:fixtures.map((s,i)=>({...s,id:`r-${i}`}))},onOpen:()=>{}}));
 assert.equal((html.match(/<details/g)||[]).length,4);assert.match(html,/Envio registrado/);assert.match(html,/Não registrado/);
 assert.match(html,/SLA consultado/);assert.match(html,/60 min/);assert.match(html,/Primeira resposta registrada/);
 assert.match(html,/Prazo da tarefa/);assert.match(html,/2026-10-15/);assert.match(html,/UTC/);
 assert.doesNotMatch(html,/href=/);
});
