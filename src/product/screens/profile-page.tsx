import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, Building2, Check, KeyRound, LogOut, Mail, Save, ShieldCheck, UserRound } from 'lucide-react';
import type { UserProfile } from '../../types';
import { LoadingState, PageHeader } from '../ui/shared-states';

interface ProfilePageProps {
  profile: UserProfile | null;
  account: { displayName?: string | null; email?: string | null; photoURL?: string | null };
  onSave: (displayName: string, idempotencyKey: string) => Promise<string>;
  onOpenSettings: () => void;
  onSignOut: () => void;
}

function googleAvatar(value?: string | null) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (url.hostname === 'googleusercontent.com' || url.hostname.endsWith('.googleusercontent.com')) ? url.href : undefined;
  } catch { return undefined; }
}

export default function ProfilePage({ profile, account, onSave, onOpenSettings, onSignOut }: ProfilePageProps) {
  const savedName = profile?.displayName || account.displayName || '';
  const [name, setName] = useState(savedName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const operation = useRef<{ name: string; key: string } | null>(null);
  const inFlight = useRef(false);
  useEffect(() => { setName(savedName); }, [savedName]);
  const dirty = name.trim() !== savedName;
  const avatar = googleAvatar(account.photoURL);
  const [avatarFailed, setAvatarFailed] = useState(false);
  useEffect(() => { setAvatarFailed(false); }, [avatar]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (inFlight.current || !dirty) return;
    const value = name.trim();
    if (!value || value.length > 100 || /[\u0000-\u001f\u007f]/u.test(value)) {
      setError('Informe um nome de até 100 caracteres, sem caracteres de controle.');
      return;
    }
    if (operation.current?.name !== value) operation.current = { name: value, key: crypto.randomUUID() };
    inFlight.current = true; setSaving(true); setError(''); setSaved(false);
    try {
      const canonicalName = await onSave(value, operation.current.key);
      setName(canonicalName); setSaved(true); operation.current = null;
    } catch { setError('Não foi possível confirmar a atualização. Tente novamente; sua alteração continua neste formulário.'); }
    finally { inFlight.current = false; setSaving(false); }
  };

  return <div className="orkto-product mx-auto w-full max-w-[1100px] space-y-7 px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:py-8">
    <PageHeader title="Meu perfil" description="Sua identidade na ORKTO. Cuide dos seus dados pessoais e do acesso à sua conta." />
    {!profile ? <LoadingState rows={3} label="Carregando seu perfil" /> : <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(260px,1fr)]">
      <section className="rounded-2xl border p-5 sm:p-7 orkto-product-surface orkto-product-border" aria-labelledby="profile-personal-title">
        <div className="mb-7 flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border text-xl font-semibold orkto-product-border orkto-product-surface-muted">
            {avatar && !avatarFailed ? <img src={avatar} alt="" referrerPolicy="no-referrer" width={64} height={64} className="h-full w-full object-cover" onError={() => setAvatarFailed(true)} /> : <UserRound size={28} aria-hidden="true" />}
          </div>
          <div className="min-w-0"><h2 id="profile-personal-title" className="text-lg font-semibold">Dados pessoais</h2><p className="mt-1 text-sm orkto-product-muted">Foto fornecida pela sua conta Google.</p></div>
        </div>
        <form onSubmit={event => { void submit(event); }} className="space-y-6" aria-busy={saving}>
          <div><label htmlFor="profile-display-name" className="mb-2 block text-sm font-medium">Nome de exibição</label><input id="profile-display-name" name="displayName" autoComplete="name" required maxLength={100} disabled={saving} value={name} onChange={event => { setName(event.target.value); setError(''); setSaved(false); }} aria-describedby="profile-name-help" className="orkto-product-control w-full rounded-xl px-3 py-3 text-sm disabled:opacity-60" /><p id="profile-name-help" className="mt-2 text-xs leading-5 orkto-product-muted">Como você aparece na ORKTO. Alterar esse nome não modifica sua conta Google.</p></div>
          <div><label htmlFor="profile-email" className="mb-2 flex items-center gap-2 text-sm font-medium"><Mail size={15} aria-hidden="true" />E-mail de acesso</label><input id="profile-email" type="email" readOnly value={account.email || ''} aria-describedby="profile-email-help" className="orkto-product-control w-full rounded-xl px-3 py-3 text-sm" /><p id="profile-email-help" className="mt-2 text-xs leading-5 orkto-product-muted">Vinculado ao Google. A identidade de acesso não pode ser alterada por este formulário.</p></div>
          {error && <p role="alert" className="rounded-xl border p-3 text-sm leading-6" style={{ color: 'var(--orkto-critical)', borderColor: 'var(--orkto-critical)' }}>{error}</p>}
          {saved && <p role="status" className="flex items-center gap-2 text-sm" style={{ color: 'var(--orkto-success)' }}><Check size={17} aria-hidden="true" />Seu perfil foi atualizado.</p>}
          <div className="flex flex-wrap items-center gap-3 border-t pt-5 orkto-product-border"><button type="submit" disabled={!dirty || saving || !name.trim()} className="orkto-product-primary inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"><Save size={16} aria-hidden="true" />{saving ? 'Salvando…' : 'Salvar alterações'}</button>{dirty && <button type="button" disabled={saving} onClick={() => { setName(savedName); setError(''); setSaved(false); operation.current = null; }} className="min-h-11 rounded-xl px-3 text-sm orkto-product-muted">Descartar alterações</button>}</div>
        </form>
      </section>
      <div className="space-y-6">
        <section className="rounded-2xl border p-5 sm:p-6 orkto-product-surface orkto-product-border" aria-labelledby="profile-security-title"><ShieldCheck size={22} className="mb-4" style={{ color: 'var(--orkto-brand-text)' }} aria-hidden="true" /><h2 id="profile-security-title" className="text-base font-semibold">Acesso e segurança</h2><p className="mt-2 text-sm leading-6 orkto-product-muted">Você entra com o Google. Senha e verificação em duas etapas são gerenciadas na sua conta Google.</p><a href="https://myaccount.google.com/security" target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold" style={{ color: 'var(--orkto-brand-text)' }}><KeyRound size={16} aria-hidden="true" />Segurança do Google <span className="sr-only">(abre em nova aba)</span><ArrowRight size={15} aria-hidden="true" /></a><button type="button" disabled={saving} onClick={onSignOut} className="mt-3 flex min-h-11 w-full items-center gap-2 rounded-xl border px-3 text-sm orkto-product-border orkto-product-muted"><LogOut size={16} aria-hidden="true" />Sair desta sessão</button></section>
        <section className="rounded-2xl border p-5 sm:p-6 orkto-product-surface orkto-product-border" aria-labelledby="profile-company-title"><Building2 size={22} className="mb-4" aria-hidden="true" /><h2 id="profile-company-title" className="text-base font-semibold">Sua empresa</h2><p className="mt-2 break-words text-sm font-medium">{profile.companyName || 'Empresa ainda não configurada'}</p>{profile.profession && <p className="mt-1 break-words text-sm orkto-product-muted">{profile.profession}</p>}<p className="mt-3 text-xs leading-5 orkto-product-muted">Dados comerciais, identidade da empresa e propostas são gerenciados em Configurações, conforme suas permissões.</p><button type="button" onClick={onOpenSettings} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold" style={{ color: 'var(--orkto-brand-text)' }}>Abrir configurações <ArrowRight size={15} aria-hidden="true" /></button></section>
      </div>
    </div>}
  </div>;
}
