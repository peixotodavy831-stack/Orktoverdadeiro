export function isGooglePilot(mode: unknown): boolean { return mode === 'google_pilot'; }

// Callback payloads never become displayed messages or log fields.
export function googleCallbackMessage(url: string): string | null {
  try {
    const parsed = new URL(url);
    const params = new URLSearchParams(parsed.hash.slice(1));
    const error = parsed.searchParams.get('error') || params.get('error');
    if (error === 'access_denied') return 'Entrada com Google cancelada ou não autorizada.';
    if (error || parsed.searchParams.has('error_code') || params.has('error_code')) {
      return 'Não foi possível validar o retorno do Google. Inicie uma nova entrada.';
    }
  } catch { return 'Endereço de autenticação inválido.'; }
  return null;
}

export function cleanOAuthCallback(url: string): string {
  const parsed = new URL(url);
  for (const key of ['code','state','error','error_code','error_description']) parsed.searchParams.delete(key);
  // Never keep an unexpected implicit token fragment in a PKCE pilot URL.
  if (/access_token|refresh_token|error|type=recovery/.test(parsed.hash)) parsed.hash = '';
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

export function pilotRedirect(origin: string, supabaseUrl: string): string {
  const url = new URL(origin);
  if (url.protocol !== 'https:' || url.username || url.password || url.port
    || !/^orkto-staging(?:-[a-z0-9-]+)?\.vercel\.app$/.test(url.hostname)
    || new URL(supabaseUrl).origin !== 'https://ghrjongiodziasupakrk.supabase.co') {
    throw new Error('PILOT_CONFIGURATION_REQUIRED');
  }
  return `${url.origin}/`;
}
