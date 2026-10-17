import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const scratch=mkdtempSync(join(root,'.tmp-edge-typecheck-'));
try {
  const runtime=join(scratch,'runtime.d.ts');
  // The handlers use only these Deno APIs. This is compile-time coverage, not a deployment/runtime test.
  writeFileSync(runtime,'declare const Deno: { env: { get(name:string):string|undefined }; serve(handler:(request:Request)=>Response|Promise<Response>):void };');
  const result=spawnSync(process.execPath,[fileURLToPath(import.meta.resolve('typescript/bin/tsc')),
    '--noEmit','--target','ES2022','--module','ESNext','--moduleResolution','bundler','--allowImportingTsExtensions','--skipLibCheck',
    runtime,'supabase/functions/orkto-core-mutations/index.ts','supabase/functions/orkto-billing-webhook/index.ts'],{cwd:root,stdio:'inherit'});
  process.exitCode=result.status??1;
} finally {rmSync(scratch,{recursive:true,force:true});}
