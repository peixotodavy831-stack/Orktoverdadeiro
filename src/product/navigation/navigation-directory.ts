import {primaryNavigation,secondaryNavigation,type NavigationSection} from './navigation-config.js';

/** Reuses registered destinations; does not create routes or change authorization. */
export const navigationDirectory:NavigationSection[]=[
  {label:'Vender e acompanhar',items:primaryNavigation.slice(1,2).flatMap(section=>section.items)},
  {label:'Empresa e conta',items:primaryNavigation.slice(2).flatMap(section=>section.items)},
  {label:'Ajuda e registros',items:secondaryNavigation},
];

const aliases:Record<string,string>={
  clients:'pessoas contatos cliente',proposals:'orçamento orçamentos proposta',catalog:'produtos serviços preços',
  reports:'resultados relatório análise',integrations:'whatsapp conectar conexão meta',team:'pessoas usuários permissões',
  billing:'assinatura plano pagamento pulsos consumo',settings:'empresa configuração preferências',profile:'conta foto nome',
  audit:'histórico registro auditoria',help:'suporte ajuda como usar',
};
const normalized=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
export function filterNavigationDirectory(query:string):NavigationSection[]{
  const words=normalized(query).split(/\s+/).filter(Boolean);
  return navigationDirectory.map(section=>({...section,items:section.items.filter(item=>{
    const searchable=normalized(`${item.label} ${aliases[item.id]||''}`);
    return words.every(word=>searchable.includes(word));
  })})).filter(section=>section.items.length>0);
}
