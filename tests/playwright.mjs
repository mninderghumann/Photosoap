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
  const frame=page.frameLocator('#app');
  const canvas=frame.locator('#canvas');
  await frame.locator('[data-tool="select"]').click();
  const box=await canvas.boundingBox();
  if(!box)throw Error('Canvas not visible');
  const from={x:box.x+box.width*.2,y:box.y+box.height*.2};
  const to={x:box.x+box.width*.6,y:box.y+box.height*.6};
  await page.mouse.move(from.x,from.y);
  await page.mouse.down();
  await page.mouse.move(to.x,to.y,{steps:8});
  await page.mouse.up();
  const dims=await canvas.evaluate(c=>{const s=window.eval('selection');return {w:s?.w,h:s?.h}});
  if(Math.abs(dims.w-400)>3||Math.abs(dims.h-280)>3)throw Error('Real pointer selection failed: '+JSON.stringify(dims));
  page.on('dialog',dialog=>dialog.accept());
  await frame.locator('#crop').click();
  const cropped=await canvas.evaluate(c=>[c.width,c.height]);
  if(Math.abs(cropped[0]-400)>4||Math.abs(cropped[1]-280)>4)throw Error('Crop dimensions failed: '+cropped);
  console.log(engine,mobile?'mobile':'desktop','real pointer crop',cropped.join('x'));
  if(errors.length)throw Error(errors.join('; '));
  console.log(engine,mobile?'mobile':'desktop',result);
  await context.close();
 }
}finally{await browser.close();server.kill()}
