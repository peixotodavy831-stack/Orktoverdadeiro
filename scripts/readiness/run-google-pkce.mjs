import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {googlePkceContexts,probeGoogleBrowser} from './google-pkce-contexts.mjs';
import {GOOGLE_AB_TARGET as T,runGoogleAbTransport} from './google-ab-transport.mjs';
import {validateStagingPreviewDeployment} from './staging-e2e-config.mjs';

// Existing authenticated CLI performs read-only deployment inspection. No env
// pulls, cloud configuration or auth files copied into this executor.
export function bindGooglePreviewInspection(deployment, deployments, project){
  if(project?.id!=='prj_KZm12jmZIKL3Tqnk2I9DBa9MabKc'
    ||project?.name!=='orkto-staging'||project?.accountId!=='team_7mNnmcZNv9miOp7pl7otO6wE'
    ||deployment?.name!==project.name||deployment.projectId&&deployment.projectId!==project.id
    ||deployment.project?.id&&deployment.project.id!==project.id
    ||!Array.isArray(deployments)||!deployments.some(d=>d.url===deployment.url&&d.name===project.name))throw new Error('PREVIEW_INSPECTION_UNAVAILABLE');
  const identity={deployment:{...deployment,projectId:project.id},deployments};
  if(!validateInspection(identity))throw new Error('PREVIEW_INSPECTION_UNAVAILABLE');
  return identity;
}
const validateInspection=identity=>validateStagingPreviewDeployment(T.preview,identity.deployment,identity.deployments,T.sha).ok;

export async function inspectGooglePreview(){
  const run=args=>spawnSync(process.platform==='win32'?'vercel.cmd':'vercel',args,{
      encoding:'utf8',shell:process.platform==='win32',timeout:60_000,
      env:Object.fromEntries(Object.entries(process.env).filter(([k])=>/^(path|systemroot|windir|temp|tmp|comspec|localappdata|appdata|userprofile|node_use_system_ca)$/i.test(k))),
    });
  const result=run(['inspect',new URL(T.preview).hostname,'--format=json']);
  const list=run(['list','prj_KZm12jmZIKL3Tqnk2I9DBa9MabKc','--format=json','--limit','100']);
  const project=run(['api','/v9/projects/prj_KZm12jmZIKL3Tqnk2I9DBa9MabKc?teamId=team_7mNnmcZNv9miOp7pl7otO6wE','--method','GET']);
  if(result.status!==0||list.status!==0||project.status!==0)throw new Error('PREVIEW_INSPECTION_UNAVAILABLE');
  try{return bindGooglePreviewInspection(JSON.parse(result.stdout),JSON.parse(list.stdout).deployments,JSON.parse(project.stdout));}
  catch{throw new Error('PREVIEW_INSPECTION_UNAVAILABLE');}
}

async function main(){
  if(process.argv.slice(2).length!==1)throw new Error('EXPLICIT_MODE_REQUIRED');
  const mode=process.argv[2];
  if(mode==='--probe'){console.log(JSON.stringify(await probeGoogleBrowser()));return;}
  if(mode!=='--login'||process.env.ORKTO_GOOGLE_PKCE_APPROVED_EXECUTION!=='1')throw new Error('EXPLICIT_LOGIN_REQUIRED');
  const publicKey=process.env.ORKTO_STAGING_PUBLISHABLE_KEY;
  const executor=googlePkceContexts({publicKey,verifyDeployment:inspectGooglePreview,
    onPhase:event=>console.log(JSON.stringify(event))});
  try{
    const report=await runGoogleAbTransport({publicKey,verifyDeployment:inspectGooglePreview,
      acquireContexts:executor.acquireContexts,naturalExpiry:true,revokeCurrentSessions:true,
      oidcToken:process.env.VERCEL_OIDC_TOKEN});
    console.log(JSON.stringify(report));
    if(report.records.some(v=>v.status==='FAIL'||v.status==='BLOCKED_EXTERNAL'))process.exitCode=2;
  }finally{await executor.close();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  // No raw SDK/Playwright/CLI errors (they can contain callback URLs or headers).
  main().catch(()=>{console.log(JSON.stringify({scope:'GOOGLE_PKCE_RUNNER',status:'BLOCKED_EXTERNAL',
    reason:'ACQUISITION_OR_CONFIGURATION_REQUIRED',readyForProductionCandidate:'NO'}));process.exitCode=2;});
}
