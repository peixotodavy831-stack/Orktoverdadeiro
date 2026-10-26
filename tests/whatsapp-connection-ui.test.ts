import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {whatsappConnectionPresentation,type WhatsAppConnectionSnapshot} from '../src/product/whatsapp-connection-state.js';
import {WhatsAppConnectionPanel} from '../src/product/screens/whatsapp-connection-panel.js';
const snapshot:WhatsAppConnectionSnapshot={state:'connected',connected:true,runtimeConfigured:true,
 connection:{status:'connected',verified_at:'2020-01-01T00:00:00Z',display_phone_number:'Synthetic number',verified_name:'Synthetic company',coexistence_state:'unknown',service_mode:'manual'},controls:{human_takeover:false}};
test('WhatsApp UI refuses stale saved connected claims and exposes recovery',()=>{
 assert.equal(whatsappConnectionPresentation(snapshot).verified,false);
 const html=renderToStaticMarkup(createElement(WhatsAppConnectionPanel,{snapshot,canManage:true,busy:false,error:'',onConnect:()=>{},onVerify:()=>{},onMode:()=>{}}));
 assert.match(html,/Atenção necessária/);assert.match(html,/Reconectar conta/);assert.match(html,/Verificar conexão/);
 assert.doesNotMatch(html,/Conectado oficialmente/);assert.match(html,/Mídias, templates/);
});
test('fresh point-in-time verification does not claim real delivery',()=>{
 const fresh={...snapshot,connection:{...snapshot.connection!,verified_at:new Date().toISOString()}};
 assert.equal(whatsappConnectionPresentation(fresh).verified,true);
 assert.equal(whatsappConnectionPresentation({...fresh,runtimeConfigured:false}).verified,false);
 const html=renderToStaticMarkup(createElement(WhatsAppConnectionPanel,{snapshot:fresh,canManage:false,busy:false,error:'',onConnect:()=>{},onVerify:()=>{},onMode:()=>{}}));
 assert.match(html,/Recebimento, envio e entrega precisam de validação/);assert.match(html,/disabled/);
});
