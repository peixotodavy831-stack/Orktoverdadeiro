import { commercialPlan, validateCommercialPrice } from './commercial-catalog.ts';
import { canCreateCheckout } from './subscription-policy.ts';

export interface SubscriptionProcessor {
  update(providerId:string,input:{status:'ACTIVE'|'INACTIVE';nextDueDate?:string}):Promise<void>;
  cancel(providerId:string):Promise<void>;
  create(input:{customerRef:string;bindingId:string;planKey:string;priceVersion:number;priceCents:number;nextDueDate:string}):Promise<{providerId:string;state:'pending'}>;
  read(providerId:string):Promise<{providerId:string;status:string;valueCents:number;customerRef:string;bindingId:string}>;
  payment(paymentId:string):Promise<{id:string;subscriptionId:string;customerRef:string;valueCents:number;status:string;dueDate:string}>;
}
/** Sandbox only. Credentials are injected server-side; no production endpoint exists here. */
export function asaasSandbox(env:Record<string,string|undefined>,send:typeof fetch=fetch):SubscriptionProcessor {
  if(!canCreateCheckout(env)||!env.ASAAS_API_KEY||env.ASAAS_API_KEY.includes('_prod_'))throw new Error('BILLING_CONFIGURATION_REQUIRED');
  async function request(path:string,body?:unknown,method=body?'POST':'GET') {
    let result:Response;
    try {result=await send(`https://api-sandbox.asaas.com/v3${path}`,{method,
      headers:{'content-type':'application/json',access_token:env.ASAAS_API_KEY!,'User-Agent':'ORKTO-sandbox/1.0'},
      body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(10_000),redirect:'error'});}
    catch {throw new Error('BILLING_PROVIDER_UNAVAILABLE');}
    if(!result.ok)throw new Error('BILLING_PROVIDER_REJECTED');
    const raw=await result.text();if(raw.length>65_536)throw new Error('BILLING_PROVIDER_INVALID');
    try{return JSON.parse(raw);}catch{throw new Error('BILLING_PROVIDER_INVALID');}
  }
  return {
    async update(id,input) {
      if(env.ORKTO_BILLING_SANDBOX_LIFECYCLE_ENABLED!=='ON')throw new Error('BILLING_CONFIGURATION_REQUIRED');
      if(!/^sub_[A-Za-z0-9_-]{1,100}$/.test(id)||!['ACTIVE','INACTIVE'].includes(input.status)
        ||Object.keys(input).some(k=>!['status','nextDueDate'].includes(k))
        ||(input.status==='ACTIVE'&&!input.nextDueDate)
        ||(input.nextDueDate&&(!/^\d{4}-\d{2}-\d{2}$/.test(input.nextDueDate)
          ||new Date(`${input.nextDueDate}T00:00:00Z`).toISOString().slice(0,10)!==input.nextDueDate
          ||input.nextDueDate<new Date().toISOString().slice(0,10))))throw new Error('BILLING_INVALID_REQUEST');
      const row=await request(`/subscriptions/${id}`,{...input,updatePendingPayments:false},'PUT');
      if(row.id!==id||row.status!==input.status)throw new Error('BILLING_PROVIDER_INVALID');
    },
    async cancel(id) {
      if(env.ORKTO_BILLING_SANDBOX_LIFECYCLE_ENABLED!=='ON')throw new Error('BILLING_CONFIGURATION_REQUIRED');
      if(!/^sub_[A-Za-z0-9_-]{1,100}$/.test(id))throw new Error('BILLING_INVALID_REQUEST');
      const row=await request(`/subscriptions/${id}`,undefined,'DELETE');
      if(row.id!==id||row.deleted!==true)throw new Error('BILLING_PROVIDER_INVALID');
    },
    async payment(id) {
      if(!/^pay_[A-Za-z0-9_-]{1,100}$/.test(id))throw new Error('BILLING_INVALID_REQUEST');
      const row=await request(`/payments/${id}`);
      if(row.id!==id||typeof row.subscription!=='string'||typeof row.customer!=='string'||!Number.isFinite(row.value)
        ||typeof row.status!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(row.dueDate))throw new Error('BILLING_PROVIDER_INVALID');
      return {id,subscriptionId:row.subscription,customerRef:row.customer,valueCents:Math.round(row.value*100),status:row.status,dueDate:row.dueDate};
    },
    async create(input) {
      if(!validateCommercialPrice(input.planKey,input.priceCents,input.priceVersion)||!commercialPlan(input.planKey)
        ||!/^cus_[A-Za-z0-9_-]{1,100}$/.test(input.customerRef)||!/^\d{4}-\d{2}-\d{2}$/.test(input.nextDueDate)
        ||!/^orkto-sub:[0-9a-f-]{36}$/.test(input.bindingId))throw new Error('BILLING_INVALID_REQUEST');
      const row=await request('/subscriptions',{customer:input.customerRef,billingType:'UNDEFINED',cycle:'MONTHLY',
        value:input.priceCents/100,nextDueDate:input.nextDueDate,externalReference:input.bindingId});
      if(!/^sub_[A-Za-z0-9_-]{1,100}$/.test(row.id))throw new Error('BILLING_PROVIDER_INVALID');
      return {providerId:row.id,state:'pending'};
    },
    async read(id) {
      if(!/^sub_[A-Za-z0-9_-]{1,100}$/.test(id))throw new Error('BILLING_INVALID_REQUEST');
      const row=await request(`/subscriptions/${id}`);
      if(row.id!==id||!Number.isFinite(row.value)||typeof row.status!=='string'||typeof row.customer!=='string'||typeof row.externalReference!=='string')throw new Error('BILLING_PROVIDER_INVALID');
      return {providerId:id,status:row.deleted===true?'DELETED':row.status,valueCents:Math.round(row.value*100),customerRef:row.customer,bindingId:row.externalReference};
    },
  };
}
