import { useEffect, useState } from 'react';

function safeImage(value?: string | null, googleOnly = false): string | undefined {
  if (!value || value.length > 2_000_000) return;
  if (!googleOnly && /^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(value)) return value;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return;
    if (googleOnly && url.hostname !== 'googleusercontent.com' && !url.hostname.endsWith('.googleusercontent.com')) return;
    return url.href;
  } catch { return; }
}

export function WorkspaceIdentity({companyName,userName,companyLogo,photoUrl,onOpenProfile,collapsed=false}:{companyName?:string|null;userName?:string|null;companyLogo?:string|null;photoUrl?:string|null;onOpenProfile:()=>void;collapsed?:boolean}) {
  const logo=safeImage(companyLogo);
  const photo=safeImage(photoUrl,true);
  const [logoFailed,setLogoFailed]=useState(false);
  const [photoFailed,setPhotoFailed]=useState(false);
  useEffect(()=>setLogoFailed(false),[logo]);
  useEffect(()=>setPhotoFailed(false),[photo]);
  const useLogo=Boolean(logo&&!logoFailed);
  const usePhoto=Boolean(photo&&!photoFailed);
  const label=companyName||'Sua empresa';
  return <button type="button" onClick={onOpenProfile} title="Abrir meu perfil" aria-label={collapsed?'Abrir meu perfil':undefined} className={`orkto-workspace-identity flex min-h-12 w-full items-center gap-3 rounded-xl p-2 text-left hover:orkto-product-surface-muted ${collapsed?'justify-center':''}`}>
    <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-sm font-semibold orkto-product-border orkto-product-surface-muted">
      {useLogo?<img src={logo} alt="" width={40} height={40} className="h-full w-full rounded-xl object-contain p-1" referrerPolicy="no-referrer" onError={()=>setLogoFailed(true)} />:usePhoto?<img src={photo} alt="" width={40} height={40} className="h-full w-full rounded-xl object-cover" referrerPolicy="no-referrer" onError={()=>setPhotoFailed(true)} />:<span aria-hidden="true">{(userName||label).trim().slice(0,1).toLocaleUpperCase('pt-BR')}</span>}
      {useLogo&&usePhoto&&<img src={photo} alt="" width={18} height={18} className="absolute -bottom-1 -right-1 h-[18px] w-[18px] rounded-full border-2 object-cover orkto-product-border" referrerPolicy="no-referrer" onError={()=>setPhotoFailed(true)} />}
    </span>
    {!collapsed&&<span className="min-w-0"><span className="block truncate text-xs font-semibold">{userName||'Sua conta'}</span><span className="mt-1 block truncate text-[11px] orkto-product-subtle" title={label}>{label}</span></span>}
  </button>;
}
