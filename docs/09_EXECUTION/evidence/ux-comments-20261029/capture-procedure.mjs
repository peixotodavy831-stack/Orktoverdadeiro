import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
const out=path.resolve('docs/09_EXECUTION/evidence/ux-comments-20261029/visual-review');await mkdir(out,{recursive:true});const browser=await chromium.launch({headless:true});const records=[];
for(const [screen,width,height,theme]of [['catalog',1440,1000,'dark'],['catalog',390,850,'dark'],['catalog',768,950,'light'],['team',1440,1000,'light'],['team',390,950,'light'],['settings',1440,1100,'dark'],['reports',1440,1000,'light'],['integrations',390,1000,'dark'],['today',1440,1000,'light']]){
 const c=await browser.newContext({viewport:{width,height},isMobile:width<1024,hasTouch:width<1024});await c.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:4181'?r.continue():r.abort());const p=await c.newPage();await p.goto(`http://127.0.0.1:4181/tests/visual/index.html?screen=${screen}&theme=${theme}&scenario=uxlab`,{waitUntil:'domcontentloaded',timeout:15000});await p.locator('[data-visual-screen]').waitFor();await p.locator(theme==='dark'?'html.dark':'html:not(.dark)').waitFor();
 if(screen==='catalog')await p.getByRole('heading',{name:'Catálogo da empresa'}).waitFor();
 if(screen==='team'){await p.getByRole('button',{name:'Convidar pessoa',exact:true}).click();await p.locator('#team-invite-email').focus();}
 if(screen==='settings')await p.getByRole('heading',{name:'Mensagens com a WIA'}).scrollIntoViewIfNeeded();
 if(screen==='reports')await p.getByText('Selecione um relatório',{exact:true}).waitFor();
 if(screen==='integrations')await p.getByText('Como conectar meu WhatsApp?',{exact:true}).click();
 if(screen==='today')await p.getByText('Franquia não configurada',{exact:true}).waitFor();
 const file=`${screen}-${width}-${theme}.png`;await p.screenshot({path:path.join(out,file),timeout:15000,animations:'disabled'});records.push({screen,width,height,theme,file,documentWidth:await p.evaluate(()=>document.documentElement.scrollWidth)});await c.close();
}await browser.close();await writeFile(path.join(out,'captures.json'),JSON.stringify({sourceSha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),environment:'local_in_memory_fixture',providerE2E:false,records},null,2));console.log('CAPTURES',records.length);
