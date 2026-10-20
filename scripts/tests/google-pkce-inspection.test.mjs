import test from 'node:test';
import assert from 'node:assert/strict';
import {bindGooglePreviewInspection} from '../readiness/run-google-pkce.mjs';
import {GOOGLE_AB_TARGET as T} from '../readiness/google-ab-transport.mjs';

const project={id:'prj_KZm12jmZIKL3Tqnk2I9DBa9MabKc',name:'orkto-staging',accountId:'team_7mNnmcZNv9miOp7pl7otO6wE'};
const deployment={name:'orkto-staging',url:new URL(T.preview).hostname,target:'staging',readyState:'READY'};
const list=[{...deployment,state:'READY',meta:{githubCommitSha:T.sha}}];

test('CLI inspection binds explicit staging to authenticated project/team and scoped deployment list',()=>{
  const identity=bindGooglePreviewInspection(deployment,list,project);
  assert.equal(identity.deployment.projectId,project.id);
  assert.equal(identity.deployment.target,'staging');
});

test('missing or inconsistent project, scope, SHA, host and environment never start OAuth',()=>{
  const refused=(d=deployment,l=list,p=project)=>assert.throws(()=>bindGooglePreviewInspection(d,l,p),/^Error: PREVIEW_INSPECTION_UNAVAILABLE$/);
  refused(deployment,list,null);
  for(const patch of [{id:'production'},{accountId:'other-team'},{name:'orkto'}])refused(deployment,list,{...project,...patch});
  for(const patch of [{projectId:'production'},{project:{id:'production'}},{name:'orkto'},{target:'production'},{readyState:'BLOCKED'},{url:'another-staging.vercel.app'}])refused({...deployment,...patch});
  refused(deployment,[]);
  refused(deployment,[{...list[0],meta:{githubCommitSha:'b'.repeat(40)}}]);
});
