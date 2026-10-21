import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {wiaRuntimeLabel} from '../src/product/screens/wia-runtime-label.js';
// Source-contract checks complement the real browser fixture interactions.
const read=(path:string)=>readFileSync(path,'utf8');
test('Today and WIA source keep handoff separate from submission',()=>{
 const wia=read('src/product/screens/wia-workspace.tsx');
 const today=read('src/product/screens/today-v2-page.tsx');
 assert.match(wia,/useState\(initialMessage\)/);
 assert.match(wia,/ainda não cadastra clientes ou negócios por comando livre/);
 assert.match(wia,/Os atalhos preenchem o pedido/);
 assert.match(today,/onOpenWia\(wiaMessage.trim\(\)/);
 assert.doesNotMatch(today,/route-agent/);
});
test('WIA configuration never claims verified model availability',()=>{
 assert.match(wiaRuntimeLabel('configured_not_verified'),/ainda precisam de validação/);
 assert.match(wiaRuntimeLabel('configuration_required'),/não configurado/);
 for(const value of [null,undefined,'ready','malformed']) assert.match(wiaRuntimeLabel(value),/Não foi possível confirmar/);
});
test('Mobile dock source keeps five named destinations and the sidebar breakpoint',()=>{
 const nav=read('src/product/navigation/mobile-navigation.tsx');
 for(const label of ['Hoje','Inbox','Negócios','WIA','Mais módulos']) assert.ok(nav.includes(label));
 assert.match(nav,/lg:hidden/);assert.doesNotMatch(nav,/md:hidden/);
 assert.match(nav,/hideDock = currentView === 'conversation'/);
});
test('Frontend publication stays disabled while review is local',()=>{
 const config=JSON.parse(read('vercel.json'));
 assert.equal(config.git.deploymentEnabled['codex/orkto-mobile-ux-2027'],false);
 assert.equal(config.git.deploymentEnabled['feat/orkto-radar-2027'],false);
});
