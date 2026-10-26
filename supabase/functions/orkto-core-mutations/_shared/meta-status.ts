export function metaConnectionStatus(connection:{status:string;verified_at?:string|null;webhook_subscribed_at?:string|null;last_error_category?:string|null}|null,runtimeConfigured:boolean,now=Date.now()) {
 if(!runtimeConfigured)return {state:'configuration_required',connected:false};
 if(!connection)return {state:'not_connected',connected:false};
 if(connection.status==='revoked')return {state:'disconnected',connected:false};
 if(connection.last_error_category==='authentication')return {state:'authentication_error',connected:false};
 const verified=Date.parse(connection.verified_at||'');
 const subscribed=Date.parse(connection.webhook_subscribed_at||'');
 const fresh=Number.isFinite(verified)&&verified<=now&&now-verified<5*60_000;
 if(connection.status==='connected'&&fresh&&Number.isFinite(subscribed)&&subscribed<=now&&!connection.last_error_category)
  return {state:'connected',connected:true};
 return {state:'attention_required',connected:false};
}
