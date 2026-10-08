import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import { resolveCoreMutationEndpoint } from './core-mutation-client.js';

const TOKEN=/^[A-Za-z0-9_-]{43}$/;

function endpoint(env:NodeJS.ProcessEnv) {
  const core=resolveCoreMutationEndpoint(env);
  return core?.replace(/\/orkto-core-mutations$/,'/orkto-public-proposals')||null;
}

export async function invokePublicProposal(req:Request,res:Response,command:'READ'|'VIEW'|'ACCEPT'|'REJECT',token:string,payload:Record<string,unknown>={}) {
  const target=endpoint(process.env); const publishableKey=process.env.VITE_SUPABASE_ANON_KEY?.trim();
  if(!target||!publishableKey) return res.status(503).json({error:'Serviço de propostas indisponível.',category:'CONFIGURATION_REQUIRED'});
  if(!TOKEN.test(token)) return res.status(404).json({error:'Esta proposta não está disponível.'});
  try{
    const result=await fetch(target,{method:'POST',headers:{'content-type':'application/json',apikey:publishableKey,
      'x-request-id':req.requestId||crypto.randomUUID()},body:JSON.stringify({command,token,...payload}),signal:AbortSignal.timeout(10_000)});
    const body=await result.json() as {code?:string;data?:any};
    if(!result.ok){
      const code=body.code||'INTERNAL_ERROR';
      const status=result.status>=400&&result.status<500?result.status:503;
      const message=code==='STALE'?'A proposta foi alterada ou encerrada. Solicite a versão atualizada.':
        code==='CONFLICT'?'A proposta já foi atualizada.':'Esta proposta não está disponível.';
      return res.status(status).json({error:message,category:code,requestId:req.requestId});
    }
    return body.data;
  }catch{
    return res.status(503).json({error:'Não foi possível confirmar a operação. Tente novamente.',category:'gateway_unavailable',requestId:req.requestId});
  }
}
