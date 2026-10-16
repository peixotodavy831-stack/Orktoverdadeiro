import type {SubscriptionProcessor} from './asaas-sandbox.ts';

export const SUBSCRIPTION_EVENTS=new Set(['SUBSCRIPTION_CREATED','SUBSCRIPTION_UPDATED','SUBSCRIPTION_INACTIVATED','SUBSCRIPTION_DELETED']);

/** Only an authoritative provider read (or a successful DELETE receipt) can record state. */
export async function reconcileSandboxSubscription(db:any,processor:SubscriptionProcessor,id:string,eventKey:string) {
  const row=await processor.read(id);
  if(!['ACTIVE','INACTIVE','DELETED'].includes(row.status))throw new Error('BILLING_RECONCILIATION_REQUIRED');
  const result=await db.rpc('orkto_observe_subscription',{p_provider_id:id,p_event_key:eventKey,
    p_customer:row.customerRef,p_reference:row.bindingId,p_amount:row.valueCents,p_status:row.status});
  if(result.error||!['RECORDED','REPLAY','RECORDED_POLICY_REQUIRED'].includes(result.data))throw new Error('BILLING_RECONCILIATION_REQUIRED');
  return result.data as string;
}

/** Reserve before network I/O. Unknown outcomes require reconciliation, never an automatic resend. */
export async function changeSandboxSubscription(db:any,processor:SubscriptionProcessor,input:{workspaceId:string;actorId:string;
  bindingId:string;key:string;operation:'cancel'|'update';changes:{status?:'ACTIVE'|'INACTIVE';nextDueDate?:string}}) {
  const reserved=await db.rpc('orkto_reserve_subscription_command',{p_workspace:input.workspaceId,p_actor:input.actorId,
    p_binding:input.bindingId,p_key:input.key,p_operation:input.operation,p_changes:input.changes});
  if(reserved.error||!reserved.data)throw new Error('BILLING_COMMAND_CONFLICT');
  const command=reserved.data;
  if(!command.execute)return command.state==='succeeded'?'REPLAY':'RECONCILIATION_REQUIRED';
  try {
    // Identity, price and tenant must match before any provider mutation.
    await reconcileSandboxSubscription(db,processor,command.providerId,`pre:${command.id}`);
    if(input.operation==='cancel') {
      await processor.cancel(command.providerId);
      const observed=await db.rpc('orkto_observe_subscription',{p_provider_id:command.providerId,p_event_key:`cmd:${command.id}`,
        p_customer:command.customerRef,p_reference:`orkto-sub:${input.bindingId}`,p_amount:command.priceCents,p_status:'DELETED'});
      if(observed.error)throw new Error('BILLING_RECONCILIATION_REQUIRED');
    } else {
      await processor.update(command.providerId,input.changes as {status:'ACTIVE'|'INACTIVE';nextDueDate?:string});
      await reconcileSandboxSubscription(db,processor,command.providerId,`cmd:${command.id}`);
    }
    const saved=await db.rpc('orkto_finish_subscription_command',{p_id:command.id,p_state:'succeeded'});
    if(saved.error||saved.data!==true)throw new Error('BILLING_RECONCILIATION_REQUIRED');
    return 'RECORDED_POLICY_REQUIRED';
  } catch {
    await db.rpc('orkto_finish_subscription_command',{p_id:command.id,p_state:'unknown'});
    throw new Error('BILLING_RECONCILIATION_REQUIRED');
  }
}
