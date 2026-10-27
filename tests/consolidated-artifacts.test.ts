import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ArtifactSignature} from '../src/components/ArtifactSignature.js';
import {artifactSignaturePrintHtml} from '../src/product/artifact-signature.js';
import {visiblePrivateInstructions} from '../src/product/private-instruction-state.js';

test('public and printed signatures use first-party symbol and wordmark without tracking',()=>{
 for(const html of [renderToStaticMarkup(createElement(ArtifactSignature)),renderToStaticMarkup(createElement(ArtifactSignature,{dark:true})),artifactSignaturePrintHtml()]){
  assert.match(html,/Criado com/);assert.match(html,/orkto-symbol\.svg/);assert.match(html,/orkto-wordmark\.svg/);
  assert.doesNotMatch(html,/https?:|<script|<iframe|onclick=|token|workspace/i);
 }
});

test('private instructions disappear on confirmed read; history remains available until expiry',()=>{
 const now=Date.parse('2026-10-27T12:00:00Z');
 const rows=[
  {id:'unread',read_at:null,expires_at:'2026-10-28T12:00:00Z'},
  {id:'read',read_at:'2026-10-27T11:59:00Z',expires_at:'2026-10-28T12:00:00Z'},
  {id:'expired',read_at:null,expires_at:'2026-10-27T12:00:00Z'},
  {id:'invalid',read_at:null,expires_at:'invalid'},
 ];
 assert.deepEqual(visiblePrivateInstructions(rows,false,now).map(row=>row.id),['unread']);
 assert.deepEqual(visiblePrivateInstructions(rows,true,now).map(row=>row.id),['unread','read']);
 assert.equal(rows.length,4);assert.equal(rows[0].read_at,null);
 assert.deepEqual(visiblePrivateInstructions([{...rows[0],read_at:'2026-10-27T12:00:01Z'}],false,now),[]);
});
