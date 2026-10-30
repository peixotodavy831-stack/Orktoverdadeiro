import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright';
import path from 'node:path';

// Reuses the existing visual harness and Chromium dependency. All data is synthetic.
const phase=process.argv.includes('--before')?'before':'after';
const comments=process.argv.includes('--comments');
const realSystem=process.argv.includes('--real-system');
const only=process.argv.find(value=>value.startsWith('--only='))?.slice(7);
if(only)assert.match(only,/^[A-Za-z0-9-]+$/);
const base=new URL(process.env.ORKTO_UX_LAB_URL||'http://127.0.0.1:4181/tests/visual/index.html');
assert.equal(base.hostname,'127.0.0.1');assert.equal(base.protocol,'http:');assert.equal(base.pathname,'/tests/visual/index.html');
const out=path.resolve('docs/09_EXECUTION/evidence',realSystem?(process.argv.includes('--r2')?'real-system-2027/r2/browser':'real-system-2027/browser'):comments?'ux-comments-20261029':'ux-research-lab-20261028',only?`${phase}-recheck-${only}`:phase);
await mkdir(out,{recursive:true});
const report={phase,selectedCase:only||null,sourceSha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),workingTreeDirty:!!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),productBaseline:realSystem?'c4983ac':comments?'211ca3d':'c289f78',environment:'local_frontend_in_memory_fixture',providerE2E:false,physicalDevice:false,generatedAt:new Date().toISOString(),cases:[],matrix:[],blockedExternalHosts:[]};
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{})});
let current;
async function run(id,personas,width,height,fn){
  if(realSystem&&!id.startsWith('R8'))return;
  if(only && only!==id)return;
  if(comments&&!id.startsWith('R'))return;
  if(!comments&&id.startsWith('R'))return;
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
  const screenshotFile=`${id}-${report.sourceSha.slice(0,7)}-${Date.now()}.png`;
  try {await page.screenshot({path:path.join(out,screenshotFile),fullPage:false,timeout:15000,animations:'disabled'});current.screenshot={status:'PASS',file:screenshotFile};}
  catch(error){current.screenshot={status:'FAIL',error:String(error.message).slice(0,300)};}
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
 await run('R8-wia-recovered',[1],390,850,async page=>{
  let generated=0;page.on('request',request=>{if(new URL(request.url()).pathname==='/api/wia/route-agent')generated++;});
  await open(page,'wia',{scenario:'wia-recovered'});await page.getByText('Uma resposta foi recuperada da execução salva. Nenhuma nova análise foi solicitada.',{exact:true}).waitFor();
  assert.equal(await page.getByRole('list',{name:'Mensagens salvas'}).locator('li').count(),2);assert.equal(generated,0);
 });
 for(const width of [390,768,1440])await run(`R8-inbox-resume-${width}`,[4,6],width,850,async page=>{
  await open(page,'inbox');await page.getByText('Atualização periódica · use Atualizar para consultar agora',{exact:true}).waitFor();
  await open(page,'inbox',{thread:1});const composer=page.getByRole('textbox',{name:'Mensagem para Marina Costa',exact:true});
  await fill(composer,'Rascunho sintético preservado','Rascunho sem envio');
  // The harness implements fetch in memory; it emits no browser network Response event.
  await page.evaluate(()=>{window.__inboxResumeReads=0;const original=window.fetch.bind(window);window.fetch=(input,init)=>{const url=new URL(typeof input==='string'||input instanceof URL?String(input):input.url,location.origin);if(url.pathname.startsWith('/api/conversations/'))window.__inboxResumeReads++;return original(input,init);};window.dispatchEvent(new Event('online'));});
  await page.waitForFunction(()=>window.__inboxResumeReads>0);
  assert.equal(await composer.inputValue(),'Rascunho sintético preservado');current.externalSend='not_attempted';
 });
 await run('R8-wia-history-error',[1],390,850,async page=>{
  await open(page,'wia',{scenario:'error'});await page.getByRole('alert').filter({hasText:'Histórico indisponível na fixture.'}).waitFor();
  assert.equal(await page.getByRole('list',{name:'Mensagens salvas'}).count(),0);
 });
 await run('R8-wia-history-loading',[1],390,850,async page=>{
  await open(page,'wia',{scenario:'loading'});await page.getByText('Carregando conversa salva…',{exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Nova conversa',exact:true}).isEnabled(),false);
 });
 for(const width of [390,768,1440])await run(`R8-wia-persistent-chat-${width}`,[1,3],width,850,async page=>{
  await open(page,'wia');
  await page.getByRole('button',{name:'Nova conversa',exact:true}).waitFor();
  await fill(page.getByRole('textbox',{name:'Pergunta para a WIA'}),'Propostas pendentes','Pedido sintético');
  await click(page.getByRole('button',{name:'Consultar WIA',exact:true}),'Consultar fixture');
  await page.getByRole('list',{name:'Mensagens salvas'}).waitFor();
  assert.equal(await page.getByRole('list',{name:'Mensagens salvas'}).locator('li').count(),2);
  await page.reload();await page.getByRole('list',{name:'Mensagens salvas'}).waitFor();
  assert.equal(await page.getByRole('list',{name:'Mensagens salvas'}).locator('li').count(),2);
  await click(page.getByRole('button',{name:'Nova conversa',exact:true}),'Nova conversa independente');
  assert.equal(await page.getByRole('list',{name:'Mensagens salvas'}).count(),0);
  const select=page.getByRole('combobox',{name:'Selecionar conversa WIA'});
  await select.selectOption({index:1});await page.getByRole('list',{name:'Mensagens salvas'}).waitFor();
  assert.equal(await page.getByRole('list',{name:'Mensagens salvas'}).locator('li').count(),2);
  current.persistence='sessionStorage visual fixture only; database tested separately';
 });
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
  await open(page,'today',{approvalBacklog:1});const approval=page.locator('[aria-labelledby="today-attention-title"]').getByText('Ação da WIA aguarda aprovação',{exact:true});await approval.waitFor();
  current.observed={metric:await page.locator('.today-metric').filter({hasText:'Ações para revisar'}).innerText()};assert.match(current.observed.metric,/\b1\b/);await approval.scrollIntoViewIfNeeded();
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
 await run('R1-brand-home',[1],390,750,async page=>{
  await open(page,'create_quote');await click(page.getByRole('button',{name:'ORKTO, ir para Hoje',exact:true}),'Marca para início');await page.getByRole('heading',{name:'Hoje, sua operação em foco.'}).waitFor();
 });
 await run('R2-catalog-wia',[2],768,900,async page=>{
  await open(page,'catalog');await page.getByRole('heading',{name:'Catálogo da empresa'}).waitFor();await click(page.getByRole('button',{name:'Adicionar item',exact:true}),'Adicionar item sintético');await fill(page.locator('#service-model-name'),'Item sintético da empresa','Nome do item');await fill(page.locator('#service-model-price'),'100','Preço somente na fixture');await click(page.getByRole('button',{name:'Salvar item',exact:true}),'Salvar em memória');await page.getByText('Item sintético da empresa',{exact:true}).waitFor();current.persistence='in-memory catalog fixture only';assert.equal(await page.getByText('Desenvolvimento & Software',{exact:true}).count(),0);await click(page.getByRole('button',{name:'Organizar com a WIA'}),'Preparar oferta na WIA');assert.match(await page.getByPlaceholder('Descreva seu pedido para a WIA…').inputValue(),/catálogo/);
 });
 await run('R2b-catalog-short',[2],390,430,async page=>{
  await open(page,'catalog');await page.getByRole('combobox',{name:'Filtrar categoria'}).selectOption('Produtos');await page.getByRole('combobox',{name:'Filtrar categoria'}).selectOption('all');await click(page.getByRole('button',{name:'Adicionar item',exact:true}),'Abrir cadastro em tela curta');await fill(page.locator('#service-model-name'),'Item tela curta','Nome');await fill(page.locator('#service-model-price'),'100','Preço fictício');await click(page.getByRole('button',{name:'Salvar item',exact:true}),'Salvar item em tela curta');await page.getByText('Item tela curta',{exact:true}).waitFor();
 });
 await run('R3-reports-navigation',[3],1440,900,async page=>{
  await open(page,'catalog');if(!await page.getByRole('button',{name:'Relatórios',exact:true}).isVisible())await more(page);await click(page.getByRole('button',{name:'Relatórios',exact:true}),'Abrir Relatórios');await page.getByRole('heading',{name:'Relatórios',exact:true}).waitFor();await page.getByText('Selecione um relatório',{exact:true}).waitFor();
 });
 await run('R4-whatsapp-prerequisites',[4],390,850,async page=>{
  await open(page,'integrations');const connect=page.getByRole('button',{name:'Conectar meu WhatsApp',exact:true});await connect.waitFor();assert.equal(await connect.isEnabled(),false);await click(page.getByText('Como conectar meu WhatsApp?',{exact:true}),'Instruções de conexão');await page.getByText('Com a conexão liberada, clique em Conectar meu WhatsApp e continue na Meta.',{exact:true}).waitFor();current.providerE2E='NOT_TESTED; blocked configuration fixture';
 });
 await run('R5-team-invite',[5],1440,900,async page=>{
  await open(page,'team');await click(page.getByRole('button',{name:'Convidar pessoa',exact:true}),'Convidar pessoa');await fill(page.getByRole('textbox',{name:'E-mail da conta Google'}),'synthetic@example.invalid','E-mail sintético');await page.getByRole('combobox',{name:'Papel na empresa'}).selectOption('member');await click(page.getByRole('button',{name:'Gerar código de convite'}),'Registrar somente na fixture');await page.getByText(/Convite registrado. Nenhum e-mail foi enviado/).waitFor();assert.equal(await page.locator('#team-created-code').getAttribute('type'),'password');await click(page.getByRole('button',{name:'Concluir e atualizar lista'}),'Limpar código e listar convite');await page.getByText('synthetic@example.invalid',{exact:true}).waitFor();current.persistence='fixture only; no real invite or email';
 });
 await run('R5b-team-limit',[5],390,850,async page=>{
  await open(page,'team',{scenario:'team-limit'});await click(page.getByRole('button',{name:'Convidar pessoa',exact:true}),'Abrir formulário');await fill(page.getByRole('textbox',{name:'E-mail da conta Google'}),'synthetic@example.invalid','E-mail sintético');await click(page.getByRole('button',{name:'Gerar código de convite'}),'Tentar na fixture sem franquia');await page.getByRole('alert').filter({hasText:'Limite de pessoas ainda não configurado'}).waitFor();assert.equal(await page.locator('#team-created-code').count(),0);
 });
 await run('R5c-team-member',[5],390,850,async page=>{
  await open(page,'team',{teamMember:1});await page.getByRole('heading',{name:'Pessoas da empresa'}).waitFor();assert.equal(await page.getByRole('button',{name:'Convidar pessoa',exact:true}).count(),0);await click(page.getByText('Recebeu um convite?',{exact:true}),'Aceitação para conta autenticada');await page.locator('#team-received-code').waitFor();
 });
 await run('R6-settings-wia',[6],390,850,async page=>{
  await open(page,'settings');await page.getByRole('heading',{name:'Mensagens com a WIA'}).waitFor();assert.equal(await page.getByText('Notificação por WhatsApp (Template)',{exact:true}).count(),0);assert.equal(await page.getByText('Avisos e Lembretes (Simulado)',{exact:true}).count(),0);await click(page.getByRole('button',{name:'Preparar mensagem na WIA'}),'Abrir preparação WIA');assert.match(await page.getByPlaceholder('Descreva seu pedido para a WIA…').inputValue(),/rascunho de mensagem/);
 });
 await run('R7-rounded-command',[7],1440,900,async page=>{
  await open(page,'today');current.observed={radius:await page.getByRole('button',{name:'Abrir WIA',exact:true}).evaluate(el=>getComputedStyle(el).borderRadius)};assert.ok(parseFloat(current.observed.radius)>=22);
 });
 // Same DOM/layout cases in both rounds. Emulation is explicitly not physical iOS/Android.
 if(!only)for(const width of comments?[390,768,1440]:[320,360,390,430,768,1024,1440])for(const theme of ['dark','light'])for(const screen of realSystem?['wia','inbox']:comments?['today','catalog','settings','reports','team','integrations']:['today','clients','inbox','wia']){
  const context=await browser.newContext({viewport:{width,height:850},isMobile:width<1024,hasTouch:width<1024});await context.route('**/*',route=>new URL(route.request().url()).origin===base.origin?route.continue():route.abort());
  const page=await context.newPage();await open(page,screen,screen==='inbox'?{thread:1}:{});if(theme==='light'){await page.getByRole('button',{name:/Ativar tema claro|Claro/,exact:true}).first().click();await page.locator('html:not(.dark)').waitFor();}
  const data=await page.evaluate(()=>({width:innerWidth,documentWidth:document.documentElement.scrollWidth,theme:document.documentElement.classList.contains('dark')?'dark':'light'}));report.matrix.push({screen,...data,overflow:data.documentWidth>data.width});console.log(`MATRIX ${width} ${theme} ${screen}: ${data.documentWidth>data.width ? "OVERFLOW" : "PASS"}`);await context.close();
 }
}finally{
 report.blockedExternalHosts=[...new Set(report.blockedExternalHosts)];report.summary={pass:report.cases.filter(row=>row.status==='PASS').length,fail:report.cases.filter(row=>row.status==='FAIL').length};
 await writeFile(path.join(out,'journeys.json'),JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify({phase,...report.summary,cases:report.cases.map(row=>({id:row.id,status:row.status,error:row.error})),matrix:report.matrix.length},null,2));
 if((only&&report.cases.length!==1)||(phase==='after'&&report.summary.fail))process.exitCode=1;
}
