import { chromium, firefox, webkit, devices } from 'playwright';
import { spawn } from 'node:child_process';
const engine=process.argv[2]||'chromium';
const browserType={chromium,firefox,webkit}[engine];
if(!browserType)throw Error('Unknown browser '+engine);
const server=spawn('python3',['-m','http.server','8765'],{stdio:'ignore'});
const browser=await browserType.launch({headless:true});
try{
 await new Promise(resolve=>setTimeout(resolve,1200));
 for(const mobile of [false,true]){
  const context=await browser.newContext(mobile?{...devices['iPhone 13'],browserName:undefined}:{viewport:{width:1440,height:900}});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8765/tests/smoke.html');
  await page.waitForFunction(()=>document.querySelector('#result')?.textContent!=='RUNNING',{timeout:20000});
  const result=await page.locator('#result').innerText();
  if(!result.startsWith('PASS:'))throw Error(engine+' '+(mobile?'mobile':'desktop')+': '+result);
  if(errors.length)throw Error(errors.join('; '));
  console.log(engine,mobile?'mobile':'desktop',result);
  await context.close();
 }
}finally{await browser.close();server.kill()}
