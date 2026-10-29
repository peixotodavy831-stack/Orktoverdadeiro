import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
const out=path.resolve('docs/09_EXECUTION/evidence/ux-research-lab-20261028/visual-review');await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});const records=[];
for(const [screen,width,height,theme]of [['today',320,850,'dark'],['today',390,850,'light'],['wia',768,950,'dark'],['clients',768,950,'light'],['today',1024,900,'light'],['today',1440,1000,'dark'],['wia',1440,1000,'light'],['clients',390,430,'dark']]){
 const c=await browser.newContext({viewport:{width,height},isMobile:width<1024,hasTouch:width<1024});await c.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:4181'?r.continue():r.abort());const p=await c.newPage();
 await p.goto(`http://127.0.0.1:4181/tests/visual/index.html?screen=${screen}&theme=${theme}&scenario=uxlab`,{waitUntil:'domcontentloaded',timeout:15000});await p.locator('[data-visual-screen]').waitFor();await p.locator(theme==='dark'?'html.dark':'html:not(.dark)').waitFor();
 let modalSaveReachable=null;
 if(height===430){await p.getByRole('button',{name:'Novo Cliente',exact:true}).click();await p.locator('#new-client-name').fill('Cliente sintético');await p.locator('#new-client-phone').fill('11000000000');const save=p.getByRole('dialog').getByRole('button',{name:'Salvar Registro'});await save.scrollIntoViewIfNeeded();modalSaveReachable=await save.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));});}
 const file=`${screen}-${width}-${height}-${theme}.png`;await p.screenshot({path:path.join(out,file)});records.push({screen,width,height,theme,file,modalSaveReachable,documentWidth:await p.evaluate(()=>document.documentElement.scrollWidth)});await c.close();
}
await browser.close();await writeFile(path.join(out,'captures.json'),JSON.stringify({sourceSha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),environment:'local_frontend_in_memory_fixture',physicalDevice:false,generatedAt:new Date().toISOString(),records},null,2));console.log(JSON.stringify(records));
