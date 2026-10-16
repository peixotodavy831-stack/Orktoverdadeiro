import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';

declare global {var Deno:{env:{get(name:string):string|undefined};serve(handler:(request:Request)=>Response|Promise<Response>):void};}
const values:Record<string,string|undefined>={};let handler:(request:Request)=>Response|Promise<Response>;
const originalFetch=globalThis.fetch;let outbound=0;
const token='synthetic-webhook-token-32-characters-only';
before(async()=>{
 globalThis.Deno={env:{get:name=>values[name]},serve:callback=>{handler=callback;}};
 globalThis.fetch=(async()=>{outbound++;throw new Error('External calls forbidden in fixture');}) as typeof fetch;
 await import('../supabase/functions/orkto-billing-webhook/index.ts');
});
after(()=>{globalThis.fetch=originalFetch;});
const request=(body:string,received=token)=>new Request('https://fixture.invalid/billing',{method:'POST',headers:{'asaas-access-token':received},body});
test('billing webhook fails closed without dedicated secret before provider or database access',async()=>{
 assert.equal((await handler(request('{}'))).status,503);assert.equal(outbound,0);
});
test('billing webhook rejects wrong dedicated token before any persistence',async()=>{
 values.ASAAS_WEBHOOK_SECRET=token;
 assert.equal((await handler(request('{}','invalid'))).status,401);assert.equal(outbound,0);
});
test('valid token cannot enable missing sandbox configuration',async()=>{
 assert.equal((await handler(request('{}'))).status,503);assert.equal(outbound,0);
});
test('sandbox webhook rejects malformed or oversized events before creating a database client',async()=>{
 Object.assign(values,{APP_ENV:'staging',ASAAS_ENVIRONMENT:'sandbox',ORKTO_BILLING_SANDBOX_ENABLED:'ON',
  ASAAS_API_KEY:'fixture-sandbox-key',SUPABASE_URL:'https://ghrjongiodziasupakrk.supabase.co'});
 assert.equal((await handler(request('{'))).status,400);
 assert.equal((await handler(request('null'))).status,400);
 assert.equal((await handler(request('[]'))).status,400);
 assert.equal((await handler(request('x'.repeat(33000)))).status,413);
 assert.equal(outbound,0);
});
test('sandbox webhook cannot run against production even with a correct token',async()=>{
 values.APP_ENV='production';
 assert.equal((await handler(request('{}'))).status,503);assert.equal(outbound,0);
});
