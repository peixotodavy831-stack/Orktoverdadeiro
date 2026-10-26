export interface WhatsAppConnectionSnapshot {
 state:string;connected:boolean;runtimeConfigured:boolean;
 connection:{status?:string;display_phone_number:string|null;verified_name:string|null;coexistence_state:string;
  service_mode:'manual'|'assisted'|'controlled';verified_at:string|null;last_error_category?:string|null}|null;
 controls:{human_takeover:boolean}|null;
}
export function whatsappConnectionPresentation(value:WhatsAppConnectionSnapshot,now=Date.now()) {
 const labels:Record<string,string>={not_connected:'Não conectado',configuration_required:'Aguardando configuração',
  connected:'Conta e número verificados',attention_required:'Atenção necessária',authentication_error:'Erro de autenticação',disconnected:'Desconectado'};
 let state=value.state;
 const checked=Date.parse(value.connection?.verified_at||'');
 if(!value.runtimeConfigured)state='configuration_required';
 else if(state==='connected'&&(!value.connected||!value.connection||!Number.isFinite(checked)||checked>now||now-checked>=300000))state='attention_required';
 if(!labels[state])state='attention_required';
 return {state,label:labels[state],verified:state==='connected'};
}
