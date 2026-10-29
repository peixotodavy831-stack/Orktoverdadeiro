import {useState, type FormEvent} from 'react';

type Request = (path: string, init?: RequestInit) => Promise<any>;
export function TeamInvitations({role, request, onRefresh}: {role: string; request: Request; onRefresh: () => void}) {
  const [open,setOpen]=useState(false),[email,setEmail]=useState(''),[inviteRole,setInviteRole]=useState('member');
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[code,setCode]=useState(''),[received,setReceived]=useState(''),[notice,setNotice]=useState('');
  const canInvite=role==='owner'||role==='admin';
  const create=async(event:FormEvent)=>{
    event.preventDefault();if(busy)return;setBusy(true);setError('');setNotice('');setCode('');
    try {
      const result=await request('/api/team/invites',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email.trim(),role:inviteRole})});
      if(typeof result?.invitePath!=='string')throw new Error('O servidor não confirmou o código do convite. Confira os convites registrados antes de repetir.');
      const link=new URL(result.invitePath,window.location.origin),token=link.searchParams.get('token');
      if(link.origin!==window.location.origin||link.pathname!=='/join-workspace'||!token||!/^[-_A-Za-z0-9]{32,200}$/.test(token))throw new Error('O convite retornado não pôde ser confirmado. Confira a lista antes de repetir.');
      setCode(token);setNotice('Convite registrado. Nenhum e-mail foi enviado. Compartilhe o código por um canal de sua escolha.');
    } catch(cause) {setError(cause instanceof Error?cause.message:'Não foi possível confirmar o convite. Confira a lista antes de repetir.');}
    finally {setBusy(false);}
  };
  const accept=async(event:FormEvent)=>{
    event.preventDefault();if(busy)return;setBusy(true);setError('');setNotice('');
    try {const result=await request('/api/team/invites/accept',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:received.trim()})});if(result?.success!==true)throw new Error('O servidor não confirmou a aceitação.');setReceived('');setNotice('Convite aceito pelo servidor. Atualize a equipe para consultar seus vínculos.');}
    catch(cause){setError(cause instanceof Error?cause.message:'Não foi possível aceitar o convite.');}finally{setBusy(false);}
  };
  const control='min-h-11 w-full rounded-xl border px-3 py-2 orkto-product-control orkto-product-border';
  return <div className="mt-4 space-y-4">
    <p className="text-sm leading-6 orkto-product-muted">O convite é para um e-mail e papel específicos. A pessoa entra com a conta Google autorizada e aceita o código em Equipe. Convites não liberam acesso ao piloto nem substituem os limites do plano.</p>
    {canInvite&&<button type="button" disabled={busy} onClick={()=>{setOpen(value=>!value);setCode('');setError('');setNotice('');}} aria-expanded={open} className="min-h-11 rounded-full px-5 orkto-product-primary">{open?'Fechar convite':'Convidar pessoa'}</button>}
    {canInvite&&open&&!code&&<form onSubmit={event=>void create(event)} className="max-w-lg space-y-3" aria-label="Convidar pessoa">
      <label className="block text-sm" htmlFor="team-invite-email">E-mail da conta Google</label><input id="team-invite-email" type="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} className={control}/>
      <label className="block text-sm" htmlFor="team-invite-role">Papel na empresa</label><select id="team-invite-role" value={inviteRole} onChange={e=>setInviteRole(e.target.value)} className={control}><option value="member">Membro</option><option value="manager">Gestor</option>{role==='owner'&&<option value="admin">Administrador</option>}</select>
      <p className="text-xs leading-5 orkto-product-muted">O servidor verifica seu papel, o plano e o limite de pessoas antes de registrar. Proprietário não é oferecido por convite.</p><button type="submit" disabled={busy} className="min-h-11 rounded-full px-5 orkto-product-primary">{busy?'Registrando…':'Gerar código de convite'}</button>
    </form>}
    {code&&<div className="max-w-lg space-y-3"><label htmlFor="team-created-code" className="block text-sm">Código do convite · mantenha privado</label><input id="team-created-code" type="password" autoComplete="off" readOnly value={code} className={control}/><button type="button" className="min-h-11 rounded-full border px-4 orkto-product-border" onClick={()=>{void (navigator.clipboard ? navigator.clipboard.writeText(code) : Promise.reject(new Error('CLIPBOARD_UNAVAILABLE'))).then(()=>setNotice('Código copiado. Nenhum e-mail foi enviado.')).catch(()=>setError('Não foi possível copiar. Verifique a permissão da área de transferência.'));}}>Copiar código</button><button type="button" className="min-h-11 px-4" onClick={()=>{setCode('');setOpen(false);setNotice('');onRefresh();}}>Concluir e atualizar lista</button></div>}
    <details className="border-t pt-3 orkto-product-border"><summary className="min-h-11 cursor-pointer font-semibold">Recebeu um convite?</summary><form onSubmit={event=>void accept(event)} className="max-w-lg space-y-3"><p className="text-sm orkto-product-muted">Entre com o mesmo e-mail convidado. Cole somente o código de convite, nunca senha ou token de sessão.</p><label htmlFor="team-received-code" className="block text-sm">Código recebido</label><input id="team-received-code" type="password" autoComplete="off" minLength={32} maxLength={200} required value={received} onChange={e=>setReceived(e.target.value)} className={control}/><button type="submit" disabled={busy} className="min-h-11 rounded-full border px-4 orkto-product-border">Aceitar convite</button></form></details>
    {notice&&<p role="status" className="text-sm leading-6">{notice}</p>}{error&&<p role="alert" className="text-sm leading-6">{error}</p>}
  </div>;
}
