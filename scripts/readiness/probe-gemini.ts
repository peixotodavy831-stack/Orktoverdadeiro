import { getModelProvider, enforceServerGuardrails } from '../../backend/wiaos/model-provider.js';

// Exactly one synthetic request, no database, no customer data, no raw provider
// response or exception printed. The shell wrapper holds the key in memory.
async function main() {
  if (process.env.APP_ENV !== 'staging' || process.env.ORKTO_STAGING_SUPABASE_REF !== 'ghrjongiodziasupakrk'
    || process.env.WIA_STAGING_GEMINI_TESTS !== 'ON' || process.env.WIA_MODEL_PROVIDER !== 'gemini'
    || !process.env.GEMINI_API_KEY || process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') throw new Error('CONFIGURATION_REQUIRED');
  const started=performance.now();
  const message='Preciso de um orçamento, mas ainda não informei o serviço. Faça uma pergunta curta para esclarecer. Não invente preços.';
  const provider=getModelProvider({APP_ENV:'staging',WIA_STAGING_GEMINI_TESTS:'ON',WIA_MODEL_PROVIDER:'gemini',GEMINI_API_KEY:process.env.GEMINI_API_KEY,GEMINI_MODEL:'gemini-3.8-flash'},'standard');
  const result=enforceServerGuardrails(message,await provider.decide({message,context:{companyName:'Empresa sintética de teste'},sourceIds:[]}),[]);
  if(result.mode!=='live'||result.usage.provider!=='gemini'||result.decision.action!=='ask_clarification') throw new Error('VALIDATION_FAILED');
  console.log(JSON.stringify({phase:'GEMINI_SYNTHETIC_PROBE',status:'PASS',provider:'gemini',model:/^[a-z0-9_.:-]{1,100}$/i.test(result.usage.actualModel)?result.usage.actualModel:'REDACTED',duration_ms:Math.round(performance.now()-started),tokens:result.usage.totalTokens,externalActions:0,customerData:false}));
}
main().catch(()=>{console.error('GEMINI_SYNTHETIC_PROBE=FAIL_OR_CONFIGURATION_REQUIRED');process.exitCode=1;});
