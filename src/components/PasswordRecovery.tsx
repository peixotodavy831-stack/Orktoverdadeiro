import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { completePasswordRecovery } from '../lib/auth-flows';
import OrktoLogo from './OrktoLogo';

export default function PasswordRecovery({ onComplete }: { onComplete: () => void }) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const [complete, setComplete] = useState(false);
  const [needsSignOut, setNeedsSignOut] = useState(false);
  const leave = async () => {
    if (complete) { onComplete(); return; }
    if (pending) return;
    setPending(true);
    try {
      const result = await supabase.auth.signOut({ scope: 'global' });
      if (result.error) { setMessage('Não foi possível encerrar a sessão de recuperação. Verifique sua conexão e tente novamente.'); return; }
      onComplete();
    } catch { setMessage('Não foi possível encerrar a sessão de recuperação. Tente novamente.'); }
    finally { setPending(false); }
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (pending) return;
    setPending(true); setMessage('');
    try {
      if (needsSignOut) {
        const result = await supabase.auth.signOut({ scope: 'global' });
        if (result.error) { setMessage('Não foi possível encerrar as sessões. Verifique sua conexão e tente novamente.'); return; }
        setComplete(true); setMessage('Senha atualizada. Entre novamente com sua nova senha.'); return;
      }
      const result = await completePasswordRecovery(supabase.auth, password, confirmation);
      setMessage(result.message);
      if (result.status === 'complete' || result.status === 'signout_failed') { setPassword(''); setConfirmation(''); }
      setNeedsSignOut(result.status === 'signout_failed');
      setComplete(result.status === 'complete');
    } catch {
      setMessage('Não foi possível confirmar a operação. Verifique sua conexão e tente novamente.');
    } finally { setPending(false); }
  };
  return <main className="flex min-h-screen items-center justify-center bg-[#111111] px-5 py-12 text-white">
    <section aria-labelledby="recovery-heading" className="w-full max-w-sm space-y-6">
      <OrktoLogo size="sm" showSlogan={false} />
      <h1 id="recovery-heading" className="text-2xl font-semibold">Definir nova senha</h1>
      <p className="text-sm leading-6 text-zinc-400">Use uma senha única, preferencialmente gerada pelo seu gerenciador de senhas.</p>
      {message && <p role={complete ? 'status' : 'alert'} className="text-sm leading-6">{message}</p>}
      {complete ? <button autoFocus type="button" onClick={leave} className="min-h-11 w-full rounded-full bg-[#FF9F1C] px-5 text-sm font-semibold text-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#FF9F1C]">Voltar para entrar</button> :
        <form onSubmit={submit} aria-busy={pending} className="space-y-4">
          {!needsSignOut && <>
            <label className="block text-sm">Nova senha<input autoFocus type="password" name="new-password" autoComplete="new-password" required minLength={12} maxLength={256} value={password} onChange={event => setPassword(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 focus:border-[#FF9F1C] focus:outline-none" /></label>
            <label className="block text-sm">Confirmar nova senha<input type="password" name="confirm-password" autoComplete="new-password" required minLength={12} maxLength={256} value={confirmation} onChange={event => setConfirmation(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 focus:border-[#FF9F1C] focus:outline-none" /></label>
            <p className="text-xs text-zinc-400">Pelo menos 12 caracteres. A política do servidor também será verificada.</p>
          </>}
          <button disabled={pending} type="submit" className="min-h-11 w-full rounded-full bg-[#FF9F1C] px-5 text-sm font-semibold text-black disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#FF9F1C]">{pending ? 'Confirmando…' : needsSignOut ? 'Encerrar sessões' : 'Salvar nova senha'}</button>
          {!pending && !needsSignOut && <button type="button" onClick={leave} className="min-h-11 w-full rounded-full border border-zinc-700 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FF9F1C]">Voltar para entrar</button>}
        </form>}
    </section>
  </main>;
}
