import test from 'node:test';
import assert from 'node:assert/strict';
import {readMetaBody,metaMessageFingerprint} from '../supabase/functions/orkto-meta-webhook/event-boundary.ts';

test('Meta content is part of the durable fingerprint; same ID with changed text is a conflict, not a duplicate',async()=>{
 const base={eventId:'message:synthetic',phoneNumberId:'123456',wabaId:'654321',from:'5511999990000',type:'text',at:'2026-10-19T00:00:00Z',text:'synthetic one'};
 const first=await metaMessageFingerprint(base);
 assert.match(first,/^[a-f0-9]{64}$/);assert.equal(first,await metaMessageFingerprint({...base}));
 assert.notEqual(first,await metaMessageFingerprint({...base,text:'synthetic two'}));
 assert.notEqual(first,await metaMessageFingerprint({...base,phoneNumberId:'234567'}));
 assert.ok(!first.includes('synthetic'));
});

test('Meta body stops at one MiB without relying on Content-Length, cancels stream and releases reader',async()=>{
 let cancelled=false;
 const stream=new ReadableStream<Uint8Array>({start(controller){controller.enqueue(new Uint8Array(700000));controller.enqueue(new Uint8Array(700000));},cancel(){cancelled=true;}});
 assert.equal(await readMetaBody(stream),null);assert.equal(cancelled,true);assert.equal(stream.locked,false);
});

test('Meta body preserves exact bytes for signature verification and releases reader on stream failure',async()=>{
 const bytes=new TextEncoder().encode(' {"synthetic":true} ');
 const stream=new ReadableStream<Uint8Array>({start(controller){controller.enqueue(bytes.slice(0,4));controller.enqueue(bytes.slice(4));controller.close();}});
 assert.deepEqual(await readMetaBody(stream),bytes);assert.equal(stream.locked,false);
 assert.deepEqual(await readMetaBody(null),new Uint8Array());
 const broken=new ReadableStream<Uint8Array>({start(controller){controller.error(new Error('synthetic failure'));}});
 await assert.rejects(readMetaBody(broken));assert.equal(broken.locked,false);
});
