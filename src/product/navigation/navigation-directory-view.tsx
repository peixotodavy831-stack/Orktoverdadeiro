import {useId,useState} from 'react';
import {Plus,Search,X} from 'lucide-react';
import {OrktoIcon} from '../icons/orkto-icon';
import type {ProductView} from '../types';
import {getActiveNavigationId} from './navigation-config';
import {filterNavigationDirectory} from './navigation-directory';

export function NavigationDirectory({currentView,onNavigate}:{currentView:ProductView;onNavigate:(view:ProductView)=>void}){
  const [query,setQuery]=useState('');
  const inputId=useId();
  const sections=filterNavigationDirectory(query);
  const activeId=getActiveNavigationId(currentView);
  return <div className="orkto-navigation-directory min-w-0 space-y-4">
    <button type="button" onClick={()=>onNavigate('create_quote')} className="orkto-product-primary flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold"><Plus size={18} aria-hidden="true"/>Nova proposta</button>
    <div>
      <label htmlFor={inputId} className="mb-2 block text-xs font-medium orkto-product-muted">Buscar em Mais</label>
      <div className="flex items-center gap-2 rounded-lg border px-3 orkto-product-border orkto-product-surface">
        <Search size={16} className="shrink-0 orkto-product-muted" aria-hidden="true"/>
        <input id={inputId} type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Clientes, propostas, equipe…" className="min-h-11 min-w-0 flex-1 bg-transparent text-base outline-none lg:text-sm"/>
        {query&&<button type="button" aria-label="Limpar busca" onClick={()=>setQuery('')} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md orkto-product-muted"><X size={16}/></button>}
      </div>
    </div>
    {sections.length===0?<p role="status" className="py-3 text-sm orkto-product-muted">Nenhuma função encontrada. Tente outro nome ou limpe a busca.</p>:sections.map(section=><section key={section.label} aria-label={section.label}>
      <h3 className="mb-1 px-2 text-xs font-medium orkto-product-subtle">{section.label}</h3>
      <ul className="space-y-0.5">{section.items.map(item=>{
        const disabled=item.availability!=='available'||!item.view;
        return <li key={item.id}><button type="button" disabled={disabled} aria-current={activeId===item.id?'page':undefined} onClick={()=>item.view&&onNavigate(item.view)} title={disabled?item.hint:undefined} className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-2 text-left text-sm ${activeId===item.id?'orkto-product-nav-active font-semibold':'orkto-product-muted hover:orkto-product-surface-muted'} ${disabled?'cursor-not-allowed opacity-60':''}`}>
          <OrktoIcon name={item.icon} size={18}/><span className="min-w-0 flex-1 break-words">{item.label}</span>{disabled&&<span className="text-xs">Em breve</span>}
        </button></li>;
      })}</ul>
    </section>)}
  </div>;
}
