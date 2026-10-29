import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright';
import path from 'node:path';

// Reuses the existing visual harness and Chromium dependency. All data is synthetic.
const phase=process.argv.includes('--before')?'before':'after';
const only=process.argv.find(value=>value.startsWith('--only='))?.slice(7);
if(only)assert.match(only,/^[A-Za-z0-9-]+$/);
const base=new URL(process.env.ORKTO_UX_LAB_URL||'http://127.0.0.1:4181/tests/visual/index.html');
assert.equal(base.hostname,'127.0.0.1');assert.equal(base.protocol,'http:');assert.equal(base.pathname,'/tests/visual/index.html');
const out=path.resolve('docs/09_EXECUTION/evidence/ux-research-lab-20261028',only?`${phase}-recheck-${only}`:phase);
await mkdir(out,{recursive:true});
const report={phase,selectedCase:only||null,sourceSha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),productBaseline:'c289f78',environment:'local_frontend_in_memory_fixture',providerE2E:false,physicalDevice:false,generatedAt:new Date().toISOString(),cases:[],matrix:[],blockedExternalHosts:[]};
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{})});
let current;
async function run(id,personas,width,height,fn){
  if(only && only!==id)return;
  const context=await browser.newContext({viewport:{width,height},isMobile:width<1024,hasTouch:width<1024});
  await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin===base.origin||url.protocol==='data:')return route.continue();report.blockedExternalHosts.push(url.hostname);return route.abort();});
  const page=await context.newPage();page.setDefaultTimeout(5000);page.setDefaultNavigationTimeout(15000);
  current={id,personas,width,height,actions:[],pageErrors:[],status:'PASS',startedAt:new Date().toISOString()};
  page.on('pageerror',error=>current.pageErrors.push({name:error.name}));
  page.on('console',message=>{if(message.type()==='error'&&/TypeError|ReferenceError|calling ReactDOMClient.createRoot/.test(message.text()))current.pageErrors.push({name:'ReactConsoleError'});});
  const started=Date.now();
  try{await fn(page);assert.equal(current.pageErrors.length,0,'Frontend page errors');}
  catch(error){current.status='FAIL';current.error=String(error.message).slice(0,800);}
  current.automationDurationMs=Date.now()-started;current.interactions=current.actions.length;
  await page.screenshot({path:path.join(out,`${id}.png`),fullPage:false}).catch(()=>{});
  report.cases.push(current);console.log(`${id}: ${current.status}${current.error ? ' · '+current.error : ''}`);await context.close();
}
async function open(page,screen,extra={}){
  const url=new URL(base);url.searchParams.set('screen',screen);url.searchParams.set('theme','dark');url.searchParams.set('scenario','uxlab');for(const[key,value]of Object.entries(extra))url.searchParams.set(key,String(value));
  await page.goto(url.toString(),{waitUntil:'domcontentloaded'});
  await page.locator('[data-visual-screen]').waitFor();await page.locator('html.dark').waitFor();
}
async function click(locator,label){await locator.click();current.actions.push({kind:'click',target:label});}
async function fill(locator,value,label){await locator.fill(value);current.actions.push({kind:'fill',target:label});}
async function press(locator,key,label){await locator.press(key);current.actions.push({kind:'key',target:label,key});}
async function more(page){await click(page.getByRole('button',{name:/^Mais( módulos)?$/}), 'Mais');}
const dialog=page=>page.getByRole('dialog');

try{
 await run('A-first-entry',[1,8],390,850,async page=>{
  await open(page,'today');await page.getByRole('heading',{name:'Hoje, sua operação em foco.'}).waitFor();
  current.login='NOT_TESTED: synthetic frontend session; no Google login';
  await more(page);await fill(page.getByRole('searchbox',{name:'Buscar em Mais'}),'orçamento','Buscar em Mais');
  await dialog(page).getByRole('button',{name:'Propostas',exact:true}).waitFor();
 });
 await run('B-client-create-history',[1,3],390,850,async page=>{
  await open(page,'clients');await click(page.getByRole('button',{name:'Novo Cliente',exact:true}),'Novo Cliente');
  await fill(page.locator('#new-client-name'),'Cliente Sintético Lab','Nome');
  await fill(page.locator('#new-client-phone'),'11000000000','Telefone sintético');
  await click(dialog(page).getByRole('button',{name:'Salvar Registro',exact:true}),'Salvar Registro');
  await page.getByRole('heading',{name:'Cliente Sintético Lab',exact:true}).waitFor();await fill(page.getByRole('textbox',{name:'Buscar clientes',exact:true}),'Cliente Sintético Lab','Buscar cliente criado');
  await click(page.getByRole('button',{name:'Histórico',exact:true}),'Histórico do cliente criado');
  await dialog(page).getByText('Cliente Sintético Lab',{exact:true}).waitFor();current.persistence='in-memory fixture only';
 });
 await run('C-conversation-draft',[4,6],390,850,async page=>{
  await open(page,'inbox',{thread:1});const composer=page.getByRole('textbox',{name:'Mensagem para Marina Costa',exact:true});
  await composer.waitFor();await page.locator('[aria-label="Conversa selecionada"]').getByText('Consegue me confirmar o prazo da proposta?',{exact:true}).waitFor();
  await fill(composer,'Texto sintético não enviado','Resposta em preparação');assert.equal(await composer.inputValue(),'Texto sintético não enviado');current.externalSend='not_attempted';
 });
 await run('D-proposal-save-review',[2,3],1440,900,async page=>{
  await open(page,'create_quote');await fill(page.locator('#quote-client-name'),'Cliente Proposta Lab','Cliente');await fill(page.locator('#quote-client-phone'),'11000000000','Telefone sintético');
  await click(page.getByRole('button',{name:'Próximo Passo',exact:true}),'Próximo Passo');
  await fill(page.getByPlaceholder('Nome (Ex: Landing Page Premium ou Consultoria UX)'),'Serviço sintético','Nome do item');
  await fill(page.getByRole('spinbutton',{name:'Valor unitário do item 1'}),'100','Valor unitário');
  await click(page.getByRole('button',{name:'Próximo Passo',exact:true}),'Próximo Passo');await click(page.getByRole('button',{name:'Gerar Orçamento Agora',exact:true}),'Salvar proposta sintética');
  await page.locator('[data-visual-screen="quote_detail"]').waitFor();await page.getByText(/LAB-2027/).first().waitFor();current.persistence='in-memory fixture; App-compatible callback opens detail';
 });
 await run('E-wia-preparation',[8,9],1440,900,async page=>{
  await open(page,'wia');await fill(page.getByPlaceholder('Descreva seu pedido para a WIA…'),'Quais propostas aguardam retorno?','Pedido WIA sintético');
  await click(page.getByRole('button',{name:'Consultar WIA',exact:true}),'Enviar pedido à fixture');
  await page.getByText('Existe uma ação para sua revisão. Preparação não significa execução.',{exact:true}).waitFor();
  await click(page.getByRole('button',{name:'Revisar aprovações →',exact:true}),'Revisar aprovações');await page.getByRole('button',{name:'Aprovar e criar tarefa interna',exact:true}).first().waitFor();current.inference='fixture only; no model call';
 });
 await run('F-radar-context',[5,9],1440,900,async page=>{
  await open(page,'today');const radar=page.locator('[aria-labelledby="today-radar-title"]');await radar.getByRole('listitem').first().waitFor();
  await click(radar.getByText('Evidências da recomendação',{exact:true}).first(),'Evidências');await click(radar.getByRole('button',{name:'Abrir conversa',exact:true}).first(),'Abrir contexto');
  await page.getByRole('textbox',{name:'Mensagem para Marina Costa',exact:true}).waitFor();
 });
 await run('G-consumption-plans-settings',[2,5],390,850,async page=>{
  await open(page,'today');await page.getByText('Franquia não configurada',{exact:true}).waitFor();await more(page);
  await fill(page.getByRole('searchbox',{name:'Buscar em Mais'}),'pulsos','Pesquisar consumo');await click(dialog(page).getByRole('button',{name:'Plano & Cobrança',exact:true}),'Plano e cobrança');
  await page.getByRole('heading',{name:/Plano.*cobrança/i}).first().waitFor();await page.getByText(/79,90/).first().waitFor();
  await more(page);await click(dialog(page).getByRole('button',{name:'Configurações',exact:true}),'Configurações');await page.getByRole('heading',{name:/Configurações/i}).first().waitFor();current.checkout='not_executed';
 });
 await run('H-whatsapp-state-failure',[4,8],390,850,async page=>{
  await open(page,'integrations');await page.getByRole('button',{name:'Conectar meu WhatsApp',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Conectar meu WhatsApp',exact:true}).isEnabled(),false);
  await open(page,'inbox',{thread:1});const composer=page.getByRole('textbox',{name:'Mensagem para Marina Costa',exact:true});await fill(composer,'Teste sem saída externa','Rascunho');
  await click(page.getByRole('button',{name:'Enviar mensagem para Marina Costa',exact:true}),'Enviar somente à fixture503');await page.getByRole('alert').waitFor();assert.equal(await composer.inputValue(),'Teste sem saída externa');current.externalSend='intercepted fixture503; never provider';
 });
 await run('UX01-client-modal-focus',[10],390,850,async page=>{
  await open(page,'clients');await click(page.getByRole('button',{name:'Novo Cliente',exact:true}),'Novo Cliente');await dialog(page).waitFor();
  current.observed=await dialog(page).evaluate(element=>({focusInside:element.contains(document.activeElement)}));assert.equal(current.observed.focusInside,true);
  await dialog(page).getByRole('button',{name:'Salvar Registro'}).focus();
  await press(page.locator(':focus'),'Tab','Conter foco no diálogo');assert.equal(await dialog(page).evaluate(element=>element.contains(document.activeElement)),true);
  await press(page.locator(':focus'),'Escape','Fechar com Escape');await dialog(page).waitFor({state:'hidden'});assert.equal(await page.getByRole('button',{name:'Novo Cliente',exact:true}).evaluate(element=>element===document.activeElement),true);
 });
 await run('UX02-client-modal-short',[6,7],390,430,async page=>{
  await open(page,'clients');await click(page.getByRole('button',{name:'Novo Cliente',exact:true}),'Novo Cliente');
  current.observed=await dialog(page).evaluate(element=>({overflow:getComputedStyle(element).overflowY,scrollHeight:element.scrollHeight,clientHeight:element.clientHeight}));
  assert.ok(['auto','scroll'].includes(current.observed.overflow)||current.observed.scrollHeight<=current.observed.clientHeight,'Clipped form needs user-scrollable dialog');
  await fill(page.locator('#new-client-name'),'Cliente Tela Curta','Nome');await fill(page.locator('#new-client-phone'),'11000000000','Telefone');await click(dialog(page).getByRole('button',{name:'Salvar Registro'}),'Salvar em viewport curto');
  await page.getByText('Cliente Tela Curta',{exact:true}).first().waitFor();current.virtualKeyboard='NOT_TESTED: reduced viewport only';
 });
 await run('UX03-client-edit-labels',[10],1440,900,async page=>{
  await open(page,'clients');await click(page.getByRole('button',{name:'Histórico',exact:true}),'Histórico');await click(page.getByRole('button',{name:'Editar Cadastro',exact:true}),'Editar Cadastro');
  current.observed=await dialog(page).evaluate(element=>({unlabelled:Array.from(element.querySelectorAll('input,textarea')).filter(input=>!input.labels?.length&&!input.getAttribute('aria-label')&&!input.getAttribute('aria-labelledby')).length}));assert.equal(current.observed.unlabelled,0);
 });
 await run('UX04-old-approval',[2,5],1440,900,async page=>{
  await open(page,'today',{approvalBacklog:1});await page.locator('[aria-labelledby="today-attention-title"]').getByText('Ação da WIA aguarda aprovação',{exact:true}).waitFor();
 });
 await run('UX05-review-context',[2,5],1440,900,async page=>{
  await open(page,'today');await click(page.getByRole('button',{name:'Revisar ação',exact:true}).first(),'Revisar ação de Hoje');await page.getByRole('navigation',{name:'Seções da WIA'}).getByRole('button',{name:/^Aprovações/}).waitFor();
  current.observed={pressed:await page.getByRole('navigation',{name:'Seções da WIA'}).getByRole('button',{name:/^Aprovações/}).getAttribute('aria-pressed')};assert.equal(current.observed.pressed,'true');
 });
 await run('UX06-draft-switch',[4],1440,900,async page=>{
  await open(page,'inbox');await fill(page.getByRole('textbox',{name:'Mensagem para Marina Costa',exact:true}),'Rascunho entre atendimentos','Rascunho Marina');
  await click(page.getByRole('button',{name:/^Caio — fixture/}),'Abrir Caio');await page.getByRole('textbox',{name:'Mensagem para Caio — fixture',exact:true}).waitFor();
  await click(page.getByRole('button',{name:/^Marina Costa, WhatsApp/}),'Voltar Marina');current.observed={draft:await page.getByRole('textbox',{name:'Mensagem para Marina Costa',exact:true}).inputValue()};assert.equal(current.observed.draft,'Rascunho entre atendimentos');
 });
 await run('UX07-radar-more',[9],1440,900,async page=>{
  await open(page,'today',{radarMany:1});const radar=page.locator('[aria-labelledby="today-radar-title"]');await radar.getByRole('listitem').first().waitFor();
  const expand=radar.getByRole('button',{name:/Ver mais|Ver todos/});if(await expand.count())await click(expand,'Expandir prioridades');current.observed={signals:await radar.getByRole('listitem').count()};assert.equal(current.observed.signals,9);
 });
 await run('UX08-mobile-enter',[7],390,850,async page=>{
  await open(page,'inbox',{thread:1});const composer=page.getByRole('textbox',{name:'Mensagem para Marina Costa',exact:true});await fill(composer,'Primeira linha','Rascunho');await press(composer,'Enter','Quebra de linha no toque');
  current.observed=await composer.evaluate(element=>({value:element.value,attempts:Number(document.documentElement.dataset.uxlabSendAttempts||0),coarse:matchMedia('(pointer:coarse)').matches}));assert.equal(current.observed.attempts,0);assert.ok(current.observed.value.includes('\n'));
 });
 await run('UX09-edit-escape-reset',[10],1440,900,async page=>{
  await open(page,'clients');await click(page.getByRole('button',{name:'Novo Cliente',exact:true}),'Novo Cliente');
  await fill(page.locator('#new-client-name'),'Cliente B Sintético','Nome B');await fill(page.locator('#new-client-phone'),'11000000001','Telefone B');
  await click(dialog(page).getByRole('button',{name:'Salvar Registro'}),'Salvar B somente em memória');
  const search=page.getByRole('textbox',{name:'Buscar clientes',exact:true});await fill(search,'Marina Costa','Buscar A');
  await click(page.getByRole('button',{name:'Histórico',exact:true}),'Histórico A');await click(page.getByRole('button',{name:'Editar Cadastro',exact:true}),'Editar A');
  await fill(page.locator('#edit-client-name'),'Alteração não salva','Alterar A sem salvar');await press(page.locator('#edit-client-name'),'Escape','Cancelar edição pelo teclado');await dialog(page).waitFor({state:'hidden'});
  await fill(search,'Cliente B Sintético','Buscar B');await click(page.getByRole('button',{name:'Histórico',exact:true}),'Histórico B');
  await dialog(page).getByRole('heading',{name:'Cliente B Sintético',exact:true}).waitFor();assert.equal(await page.locator('#edit-client-name').count(),0);current.persistence='B unchanged; A edit discarded; in-memory only';
 });
 await run('UX10-desktop-enter',[4,10],1440,900,async page=>{
  await open(page,'inbox');const composer=page.getByRole('textbox',{name:'Mensagem para Marina Costa',exact:true});
  await fill(composer,'Parágrafo','Rascunho desktop');await press(composer,'Shift+Enter','Nova linha desktop');assert.ok((await composer.inputValue()).includes('\n'));
  await composer.dispatchEvent('keydown',{key:'Enter',isComposing:true});assert.equal(await page.evaluate(()=>Number(document.documentElement.dataset.uxlabSendAttempts||0)),0);
  await press(composer,'Enter','Enviar à fixture503 pelo teclado');await page.getByRole('alert').waitFor();assert.equal(await page.evaluate(()=>Number(document.documentElement.dataset.uxlabSendAttempts||0)),1);assert.ok((await composer.inputValue()).includes('Parágrafo'));current.externalSend='fixture503 only; never provider';
 });
 // Same DOM/layout cases in both rounds. Emulation is explicitly not physical iOS/Android.
 if(!only)for(const width of [320,360,390,430,768,1024,1440])for(const theme of ['dark','light'])for(const screen of ['today','clients','inbox','wia']){
  const context=await browser.newContext({viewport:{width,height:850},isMobile:width<1024,hasTouch:width<1024});await context.route('**/*',route=>new URL(route.request().url()).origin===base.origin?route.continue():route.abort());
  const page=await context.newPage();await open(page,screen,screen==='inbox'?{thread:1}:{});if(theme==='light'){await page.getByRole('button',{name:/Ativar tema claro|Claro/,exact:true}).first().click();await page.locator('html:not(.dark)').waitFor();}
  const data=await page.evaluate(()=>({width:innerWidth,documentWidth:document.documentElement.scrollWidth,theme:document.documentElement.classList.contains('dark')?'dark':'light'}));report.matrix.push({screen,...data,overflow:data.documentWidth>data.width});console.log(`MATRIX ${width} ${theme} ${screen}: ${data.documentWidth>data.width ? "OVERFLOW" : "PASS"}`);await context.close();
 }
}finally{
 report.blockedExternalHosts=[...new Set(report.blockedExternalHosts)];report.summary={pass:report.cases.filter(row=>row.status==='PASS').length,fail:report.cases.filter(row=>row.status==='FAIL').length};
 await writeFile(path.join(out,'journeys.json'),JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify({phase,...report.summary,cases:report.cases.map(row=>({id:row.id,status:row.status,error:row.error})),matrix:report.matrix.length},null,2));
 if((only&&report.cases.length!==1)||(phase==='after'&&report.summary.fail))process.exitCode=1;
}
