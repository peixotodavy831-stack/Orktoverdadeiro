import assert from 'node:assert/strict';
import { test } from 'node:test';
import { executeTrustedT0 } from '../supabase/functions/orkto-core-mutations/_shared/wia-trusted.js';
import { routeT0Request } from '../supabase/functions/orkto-core-mutations/_shared/wia-t0.js';

const workspaceA='11111111-1111-4111-8111-111111111111';
const workspaceB='22222222-2222-4222-8222-222222222222';

function fakeRead(rows: Record<string,unknown>[]) {
  const filters: Array<(row:Record<string,unknown>)=>boolean>=[];
  const query={
    select() { return this; },
    eq(key:string,value:unknown) { filters.push(row=>row[key]===value); return this; },
    in(key:string,values:unknown[]) { filters.push(row=>values.includes(row[key])); return this; },
    is(key:string,value:unknown) { filters.push(row=>row[key]===value); return this; },
    gte(key:string,value:string) { filters.push(row=>String(row[key])>=value); return this; },
    lt(key:string,value:string) { filters.push(row=>String(row[key])<value); return this; },
    or() { return this; },
    order() { return this; },
    limit(n:number) { return Promise.resolve({data:rows.filter(row=>filters.every(filter=>filter(row))).slice(0,n),error:null}); },
    maybeSingle() { return Promise.resolve({data:rows.find(row=>filters.every(filter=>filter(row)))||null,error:null}); },
  };
  return query;
}

test('trusted T0 query derives quote evidence from the authorized workspace', async () => {
  const rows=[
    {id:'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',workspace_id:workspaceA,status:'pending',total:10},
    {id:'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb',workspace_id:workspaceB,status:'pending',total:999},
  ];
  const db={from(table:string) { assert.equal(table,'quotes'); return fakeRead(rows); }};
  const route=routeT0Request('Mostre os orçamentos abertos');
  assert.equal(route?.name,'get_open_quotes');
  const result=await executeTrustedT0(db,workspaceA,route!);
  assert.deepEqual(result.sourceIds,[`quote:${rows[0].id}`]);
  assert.match(result.decision.messageDraft,/1 orçamento\(s\) aberto\(s\)/);
  assert.doesNotMatch(result.decision.messageDraft,/999/);
  assert.equal(result.decision.action,'answer');
  assert.equal(result.decision.requiresApproval,false);
  assert.equal(result.toolExecutions[0]?.status,'succeeded');
});

test('unsupported model prompts never become caller-supplied execution evidence', () => {
  assert.equal(routeT0Request('Escreva uma mensagem para este cliente'),null);
  assert.equal(routeT0Request('Mostre aprovações pendentes')?.name,'get_pending_approvals');
});
