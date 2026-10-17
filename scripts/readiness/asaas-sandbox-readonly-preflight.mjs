import {pathToFileURL} from 'node:url';

const channels=['emailEnabledForProvider','smsEnabledForProvider','emailEnabledForCustomer',
  'smsEnabledForCustomer','phoneCallEnabledForCustomer','whatsappEnabledForCustomer'];

/** A notification snapshot is not proof of historical delivery or future provider settings. */
export function assessSandboxNotifications(snapshot) {
  if(!snapshot||snapshot.hasMore!==false||!Array.isArray(snapshot.data)||snapshot.data.length===0)
    return {status:'BLOCKED_EXTERNAL',reason:'COMPLETE_NOTIFICATION_SNAPSHOT_REQUIRED'};
  for(const row of snapshot.data){
    if(!row||typeof row.id!=='string'||typeof row.enabled!=='boolean')
      return {status:'BLOCKED_EXTERNAL',reason:'NOTIFICATION_SCHEMA_UNVERIFIED'};
    if(row.enabled===false)continue;
    if(channels.some(key=>typeof row[key]!=='boolean'))
      return {status:'BLOCKED_EXTERNAL',reason:'NOTIFICATION_SCHEMA_UNVERIFIED'};
    if(channels.some(key=>row[key]!==false))return {status:'FAIL',reason:'EXTERNAL_NOTIFICATION_ENABLED'};
    if(Object.entries(row).some(([key,value])=>/enabled/i.test(key)&&key!=='enabled'&&!channels.includes(key)&&value!==false))
      return {status:'BLOCKED_EXTERNAL',reason:'UNKNOWN_NOTIFICATION_CHANNEL'};
  }
  return {status:'PASS',reason:'CURRENT_CUSTOMER_NOTIFICATION_SNAPSHOT_DISABLED',checked:snapshot.data.length};
}

/** GET-only. Credentials must be supplied in memory by an authorized secret-store operator. */
export async function preflightAsaasSandbox({env={},approvedCustomer,fetchImpl=fetch,executionMode='STAGING'}={}) {
  const result={scope:'ASAAS_SANDBOX_READ_ONLY_PREFLIGHT',executionMode,readyForProductionCandidate:'NO'};
  const blocked=reason=>({...result,status:'BLOCKED_EXTERNAL',reason});
  if(!['STAGING','FIXTURE'].includes(executionMode))return blocked('EXECUTION_MODE_REQUIRED');
  if(env.APP_ENV!=='staging'||env.ASAAS_ENVIRONMENT!=='sandbox'
    ||env.SUPABASE_URL!=='https://ghrjongiodziasupakrk.supabase.co')return blocked('EXACT_STAGING_ENVIRONMENT_REQUIRED');
  if(!approvedCustomer||approvedCustomer.exclusivelySynthetic!==true||approvedCustomer.ownerApproved!==true
    ||!/^cus_[A-Za-z0-9_-]{1,100}$/.test(approvedCustomer.id||''))return blocked('APPROVED_TEST_CUSTOMER_REQUIRED');
  if(typeof env.ASAAS_API_KEY!=='string'||!env.ASAAS_API_KEY||env.ASAAS_API_KEY.includes('_prod_'))return blocked('SANDBOX_SECRET_STORE_KEY_REQUIRED');
  if(executionMode==='STAGING'&&fetchImpl!==fetch)return blocked('REAL_HTTP_TRANSPORT_REQUIRED');
  async function get(path){
    const response=await fetchImpl(`https://api-sandbox.asaas.com/v3${path}`,{method:'GET',redirect:'manual',
      signal:AbortSignal.timeout(10_000),headers:{access_token:env.ASAAS_API_KEY,'User-Agent':'ORKTO-readiness-readonly/1.0'}});
    if(response.status!==200)throw new Error('PROVIDER_READ_UNAVAILABLE');
    const reader=response.body?.getReader();if(!reader)throw new Error('PROVIDER_READ_UNAVAILABLE');
    let size=0;const chunks=[];
    try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;
      if(size>65_536){await reader.cancel();throw new Error('PROVIDER_READ_UNAVAILABLE');}chunks.push(value);}}
    finally{reader.releaseLock();}
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    return JSON.parse(new TextDecoder().decode(bytes));
  }
  try{
    const customer=await get(`/customers/${approvedCustomer.id}`);
    if(customer?.id!==approvedCustomer.id||customer.deleted===true)return blocked('CUSTOMER_IDENTITY_NOT_VERIFIED');
    const snapshot=await get(`/customers/${approvedCustomer.id}/notifications`);
    if(Array.isArray(snapshot?.data)&&snapshot.data.some(row=>row?.customer!==undefined&&row.customer!==approvedCustomer.id))
      return blocked('CUSTOMER_NOTIFICATION_MISMATCH');
    return {...result,...assessSandboxNotifications(snapshot)};
  }catch{return blocked('PROVIDER_READ_UNAVAILABLE');}
}

if(typeof process!=='undefined'&&process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  process.stdout.write(JSON.stringify(await preflightAsaasSandbox())+'\n');process.exitCode=2;
}
