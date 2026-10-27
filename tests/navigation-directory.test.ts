import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {filterNavigationDirectory,navigationDirectory} from '../src/product/navigation/navigation-directory.js';
import {primaryNavigation,secondaryNavigation,getActiveNavigationId} from '../src/product/navigation/navigation-config.js';

test('More preserves each registered secondary destination exactly once',()=>{
  const expected=[...primaryNavigation.slice(1).flatMap(section=>section.items),...secondaryNavigation];
  const actual=navigationDirectory.flatMap(section=>section.items);
  assert.deepEqual(actual.map(item=>item.id).sort(),expected.map(item=>item.id).sort());
  assert.equal(new Set(actual.map(item=>item.id)).size,expected.length);
  for(const item of expected)assert.equal(actual.find(row=>row.id===item.id)?.view,item.view);
  assert.ok(actual.every(item=>item.view!=='internal_finance'));
});
test('search understands accents and task names without changing the registry',()=>{
  const original=JSON.stringify(navigationDirectory);
  const ids=(query:string)=>filterNavigationDirectory(query).flatMap(section=>section.items.map(item=>item.id));
  assert.deepEqual(ids(' ORÇAMENTO '),['proposals']);
  assert.deepEqual(ids('whatsapp'),['integrations']);
  assert.deepEqual(ids('pulsos'),['billing']);
  assert.deepEqual(ids('configuração'),['settings']);
  assert.deepEqual(ids('pessoas'),['clients','team']);
  assert.deepEqual(ids('xxxxxxxxxxx'),[]);
  assert.deepEqual(ids('   '),navigationDirectory.flatMap(section=>section.items.map(item=>item.id)));
  assert.equal(JSON.stringify(navigationDirectory),original);
});
test('old detail routes retain their existing active destination',()=>{
  for(const route of ['create_quote','quote_detail','quotes'])assert.equal(getActiveNavigationId(route),'proposals');
  assert.equal(getActiveNavigationId('conversation'),'inbox');
  assert.equal(getActiveNavigationId('internal_finance'),'finance');
});
test('simplicity branch cannot deploy automatically',()=>{
  const config=JSON.parse(readFileSync('vercel.json','utf8'));
  assert.equal(config.git.deploymentEnabled['feat/orkto-simplicity-revolution'],false);
});
