import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { googleCallbackMessage, pilotRedirect } from '../lib/google-pilot';
import OrktoLogo from './OrktoLogo';
import { ArrowLeft, ArrowUpRight, LoaderCircle, ShieldCheck } from 'lucide-react';

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
  return <main className="orkto-access">
    <header className="orkto-access-header">
      <a href="/" aria-label="ORKTO — página inicial"><OrktoLogo size="md" /></a>
      <a className="orkto-access-back" href="/"><ArrowLeft size={16} aria-hidden="true" /> Voltar ao início</a>
    </header>
    <div className="orkto-access-layout">
      <section className="orkto-access-intro" aria-labelledby="access-intro-title">
        <h1 id="access-intro-title">Sua operação.<br /><span>Um novo ritmo.</span></h1>
        <p>Conversas, clientes e propostas conectados. Entre para continuar de onde parou.</p>
        <div className="orkto-access-flow" aria-hidden="true">
          <span>Converse</span><span>Organize</span><span>Avance <ArrowUpRight size={18} /></span>
        </div>
      </section>
      <section aria-labelledby="pilot-auth-title" className="orkto-access-panel">
        <div className="orkto-access-emblem" aria-hidden="true"><img src="/brand/orkto-symbol.svg" width="44" height="44" alt="" /></div>
        <h2 id="pilot-auth-title">Bem-vindo à ORKTO</h2>
        <p className="orkto-access-description">Use sua conta Google para acessar seu espaço de trabalho.</p>
        <button type="button" disabled={checking || !available || pending} aria-busy={checking || pending}
          onClick={signIn} className="orkto-access-google">
          {checking || pending ? <LoaderCircle size={20} className="orkto-access-spinner" aria-hidden="true" /> : <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z"/><path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.05.96-3.38.96-2.61 0-4.82-1.76-5.61-4.12H3.05v2.59A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.39 13.92a6 6 0 0 1 0-3.84V7.49H3.05a10 10 0 0 0 0 9.02l3.34-2.59Z"/><path fill="#EA4335" d="M12 5.96c1.47 0 2.79.51 3.83 1.51l2.87-2.87A9.62 9.62 0 0 0 12 2a10 10 0 0 0-8.95 5.49l3.34 2.59C7.18 7.72 9.39 5.96 12 5.96Z"/></svg>}
          {pending ? 'Conectando ao Google…' : checking ? 'Verificando autenticação…' : 'Continuar com Google'}
        </button>
        {!checking && !available && <p role="status" className="orkto-access-notice">Configuração de autenticação necessária. O piloto ainda não está disponível.</p>}
        {message && <p role="alert" className="orkto-access-error">{message}</p>}
        <div className="orkto-access-security"><ShieldCheck size={19} aria-hidden="true" /><p>Acesso por convite aprovado.<br /><span>Senhas e recuperação ficam no Google.</span></p></div>
        <p className="orkto-access-legal">Consulte nossos <a href="/termos.html">Termos</a> e a <a href="/privacidade.html">Privacidade</a>.</p>
      </section>
    </div>
    <footer className="orkto-access-footer">Operação com inteligência. Decisões com você.</footer>
  </main>;
}
