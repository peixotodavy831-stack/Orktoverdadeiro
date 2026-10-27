import {useState} from 'react';
import {planAcquisition,planLaunchCash} from '../../../backend/finance/launch-planning.js';
import type {FinanceAssumptions,FinanceScenarioKey} from '../../../backend/finance/finance-model';
import {formatBRL} from '../../utils/format.js';

const number=(value:string)=>value.trim()===''?null:Number(value);
const cents=(value:string)=>{const n=number(value);return n===null?null:Number.isFinite(n)&&n>=0?Math.round(n*100):NaN;};
const money=(value:number|null)=>value===null?'Indisponível':formatBRL(value/100);
const control='mt-1 min-h-11 w-full rounded-lg border border-zinc-500/30 bg-transparent px-3 text-sm';

/** Only mounted inside the authenticated founder finance surface. Session-only inputs. */
export function LaunchPlanningPanel({assumptions,scenario}:{assumptions:FinanceAssumptions;scenario:FinanceScenarioKey}){
 const [funnel,setFunnel]=useState({contacts:'',demo:'',paid:'',spend:'',hours:'',hourCost:''});
 const [collection,setCollection]=useState('');
 const [setup,setSetup]=useState('');
 const [companies,setCompanies]=useState(['','','']);
 const [extras,setExtras]=useState(['','','']);
 let acquisition:ReturnType<typeof planAcquisition>|null=null,cash:ReturnType<typeof planLaunchCash>|null=null,error='';
 try{
  if(['contacts','demo','paid','spend','hours'].every(key=>funnel[key as keyof typeof funnel].trim()!==''))
   acquisition=planAcquisition({contacts:Number(funnel.contacts),demoPercent:Number(funnel.demo),paidPercent:Number(funnel.paid),
    spendCents:cents(funnel.spend)!,hours:Number(funnel.hours),hourCostCents:cents(funnel.hourCost)});
  if(collection!==''&&setup!==''&&companies.every(value=>value!=='')&&extras.every(value=>value!==''))
   cash=planLaunchCash(assumptions,scenario,companies.map((value,i)=>({companies:Number(value),collectionPercent:Number(collection),extraOutflowCents:cents(extras[i])!})),cents(setup)!);
 }catch(cause){error=cause instanceof Error?cause.message:'Revise as premissas.';}
 return <section className="min-w-0 border-y border-zinc-500/25 py-6" aria-labelledby="launch-planning-title">
  <h2 id="launch-planning-title" className="text-lg font-semibold">Planejamento de lançamento · 30, 60 e 90 dias</h2>
  <p className="mt-2 max-w-[70ch] text-sm text-zinc-500">Simulações internas do fundador, baseadas nas premissas financeiras editadas acima. Não são clientes, recebimentos ou custos observados. Estes campos ficam somente nesta sessão e não alteram o ledger, os planos ou os gates.</p>
  <h3 className="mt-6 font-semibold">Funil de aquisição</h3>
  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
   {([['contacts','Contatos planejados','1'],['demo','Conversão para demonstração (%)','0.1'],['paid','Conversão de demonstração para contrato (%)','0.1'],['spend','Desembolso de marketing (R$)','0.01'],['hours','Horas do fundador','0.5'],['hourCost','Valor da hora (R$) · opcional','0.01']] as const).map(([key,label,step])=><label key={key} className="min-w-0 text-xs font-medium">{label}<input type="number" min="0" step={step} value={funnel[key]} onChange={event=>setFunnel(current=>({...current,[key]:event.target.value}))} className={control}/></label>)}
  </div>
  {acquisition?<dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2" aria-live="polite"><div><dt>Demonstrações / contratos simulados</dt><dd className="font-semibold">{acquisition.demos} / {acquisition.customers}</dd></div><div><dt>CAC de caixa / incluindo tempo</dt><dd className="font-semibold">{money(acquisition.cashCacCents)} / {money(acquisition.fullCacCents)}</dd></div></dl>:<p className="mt-3 text-xs text-zinc-500">Preencha o funil para calcular. Sem contratos simulados, o CAC fica indisponível. Sem valor da hora, o custo de tempo fica indeterminado.</p>}
  <h3 className="mt-6 font-semibold">Caixa acumulado</h3>
  <p className="mt-2 text-xs text-zinc-500">Receita recorrente e despesas vêm do modelo econômico existente. Informe empresas ativas em cada mês, percentual recebido e saídas adicionais. Reserva é uma destinação dentro do caixa, sem transferência ou despesa duplicada.</p>
  <div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-xs font-medium">Recebimento no mês (%)<input type="number" min="0" max="100" value={collection} onChange={event=>setCollection(event.target.value)} className={control}/></label><label className="text-xs font-medium">Configuração inicial (R$)<input type="number" min="0" step="0.01" value={setup} onChange={event=>setSetup(event.target.value)} className={control}/></label></div>
  <div className="mt-3 grid gap-3 md:grid-cols-3">{companies.map((value,index)=><div key={index} className="min-w-0"><h4 className="text-sm font-medium">Até {(index+1)*30} dias</h4><label className="mt-2 block text-xs">Empresas ativas<input type="number" min="0" step="1" value={value} onChange={event=>setCompanies(current=>current.map((item,i)=>i===index?event.target.value:item))} className={control}/></label><label className="mt-2 block text-xs">Saídas adicionais (R$)<input type="number" min="0" step="0.01" value={extras[index]} onChange={event=>setExtras(current=>current.map((item,i)=>i===index?event.target.value:item))} className={control}/></label></div>)}</div>
  {error&&<p className="mt-3 text-sm text-red-600 dark:text-red-300" role="alert">{error}</p>}
  {cash?<div className="mt-4 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-xs tabular-nums"><caption className="mb-2 text-left text-zinc-500">Cenário {scenario} · custos não informados continuam fora da estimativa. Não é previsão garantida.</caption><thead><tr>{['Mês','MRR','Recebido','Saídas','Caixa final','Reserva acumulada','Livre após reserva'].map(label=><th key={label} className="p-2">{label}</th>)}</tr></thead><tbody>{cash.map(row=><tr key={row.month} className="border-t border-zinc-500/25">{[String(row.month),money(row.mrrCents),money(row.collectionsCents),money(row.outflowCents),money(row.closingCents),money(row.reserveTargetCents),money(row.freeAfterReserveCents)].map((value,i)=><td key={i} className="p-2">{value}</td>)}</tr>)}</tbody></table></div>:<p className="mt-3 text-xs text-zinc-500">Preencha os três meses, inclusive saídas extras iguais a zero quando essa for sua hipótese. Valores ausentes não serão considerados zero.</p>}
 </section>;
}
