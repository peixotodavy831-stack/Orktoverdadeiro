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
