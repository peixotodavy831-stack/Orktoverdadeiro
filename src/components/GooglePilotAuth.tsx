import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { googleCallbackMessage, pilotRedirect } from '../lib/google-pilot';
import OrktoLogo from './OrktoLogo';

export default function GooglePilotAuth({ initialError }: { initialError?: string | null }) {
  const [pending, setPending] = useState(false);
  const [available, setAvailable] = useState(false);
  const [checking, setChecking] = useState(true);
  const [message, setMessage] = useState<string | null>(() => initialError || googleCallbackMessage(window.location.href));
  const inFlight = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    let mounted = true;
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    Promise.resolve().then(() => pilotRedirect(window.location.origin, url)).then(() =>
      fetch(`${url}/auth/v1/settings`, { headers: { apikey: key }, signal: controller.signal }))
      .then(async response => {
        if (!response.ok) throw new Error('UNAVAILABLE');
        const settings = await response.json();
        // A provider flag alone is not Google-only. Refuse a mixed Auth setup.
        if (mounted) setAvailable(settings?.external?.google === true
          && Object.entries(settings?.external || {}).every(([name, enabled]) => name === 'google' || enabled !== true)
          && settings?.disable_signup !== true);
      }).catch(() => { if (mounted) setMessage('Autenticação indisponível. Tente novamente.'); })
      .finally(() => { window.clearTimeout(timeout); if (mounted) setChecking(false); });
    return () => { mounted = false; controller.abort(); window.clearTimeout(timeout); };
  }, []);
  const signIn = async () => {
    if (inFlight.current || !available) return;
    inFlight.current = true; setPending(true); setMessage(null);
    try {
      const redirectTo = pilotRedirect(window.location.origin, import.meta.env.VITE_SUPABASE_URL);
      const { error } = await supabase.auth.signInWithOAuth({ provider: 'google',
        options: { redirectTo, scopes: 'openid email profile', queryParams: { prompt: 'select_account' } } });
      if (error) throw new Error('OAUTH_FAILED');
    } catch {
      setMessage('Não foi possível iniciar a entrada com Google. Tente novamente.');
      inFlight.current = false; setPending(false);
    }
  };
  return <main className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-100 px-6 py-12">
    <section aria-labelledby="pilot-auth-title" className="w-full max-w-sm space-y-6">
      <OrktoLogo size="lg" showSlogan={false} />
      <h1 id="pilot-auth-title" className="text-3xl font-semibold">Entre na ORKTO</h1>
      <p className="text-zinc-300">O piloto fechado utiliza sua conta Google. O acesso depende de convite aprovado.</p>
      <button type="button" disabled={checking || !available || pending} aria-busy={pending}
        onClick={signIn} className="w-full rounded-xl bg-brand-orange text-zinc-950 px-5 py-3 font-semibold disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-orange">
        {pending ? 'Conectando ao Google…' : checking ? 'Verificando autenticação…' : 'Continuar com Google'}
      </button>
      {!checking && !available && <p role="status" className="text-sm text-zinc-300">Configuração de autenticação necessária. O piloto ainda não está disponível.</p>}
      {message && <p role="alert" className="text-sm text-red-300">{message}</p>}
      <p className="text-sm text-zinc-400">Senhas e recuperação de conta são administradas pelo Google.</p>
    </section>
  </main>;
}
