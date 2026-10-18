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
  const context=await browser.newContext(mobile?(engine==='firefox'?{viewport:{width:390,height:844},deviceScaleFactor:3,hasTouch:true}: {...devices['iPhone 13'],browserName:undefined}):{viewport:{width:1440,height:900}});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8765/tests/smoke.html');
  await page.waitForFunction(()=>document.querySelector('#result')?.textContent!=='RUNNING',{timeout:20000});
  const result=await page.locator('#result').innerText();
  if(!result.startsWith('PASS:'))throw Error(engine+' '+(mobile?'mobile':'desktop')+': '+result);
  // Run pointer interactions in a fresh editor, not the smoke-test iframe.
  // The smoke page also mutates editor state and may invalidate a selection.
  await page.goto('http://127.0.0.1:8765/index.html');
  const canvas=page.locator('#canvas');
  await page.locator('[data-tool="select"]').click();
  if(mobile){
    // Playwright's mouse API is not a touch gesture in mobile contexts.
    // Verify mobile selection/crop using the accessible Select all control.
    await page.locator('#selectall').click();
    const selected=await canvas.evaluate(()=>window.eval('selection'));
    if(!selected||selected.w!==1000||selected.h!==700)throw Error('Mobile Select all failed: '+JSON.stringify(selected));
  }else{
    const box=await canvas.boundingBox();
    if(!box)throw Error('Canvas not visible');
    const from={x:box.x+box.width*.2,y:box.y+box.height*.2};
    const to={x:box.x+box.width*.6,y:box.y+box.height*.6};
    await page.mouse.move(from.x,from.y);
    await page.mouse.down();
    await page.mouse.move(to.x,to.y,{steps:8});
    await page.mouse.up();
    const dims=await canvas.evaluate(()=>window.eval('selection'));
    if(Math.abs(dims.w-400)>3||Math.abs(dims.h-280)>3)throw Error('Desktop pointer selection failed: '+JSON.stringify(dims));
  }
  await canvas.evaluate(()=>{window.confirm=()=>true;});
  const cropDebug=await canvas.evaluate(()=>{const button=document.getElementById('crop');let confirmations=0,alerts=[];window.confirm=()=>{confirmations++;return true};window.alert=m=>alerts.push(m);const before=window.eval('selection');button.click();return {confirmations,alerts,disabled:button.disabled,selection:before,after:window.eval('selection'),dimensions:[document.getElementById('canvas').width,document.getElementById('canvas').height]}});
  console.log(engine,mobile?'mobile':'desktop','crop diagnostics',JSON.stringify(cropDebug));
  const cropped=await canvas.evaluate(c=>[c.width,c.height]);
  const expected=mobile?[1000,700]:[400,280];
  if(Math.abs(cropped[0]-expected[0])>4||Math.abs(cropped[1]-expected[1])>4)throw Error('Crop dimensions failed: '+cropped);
  console.log(engine,mobile?'mobile':'desktop','real pointer crop',cropped.join('x'));
  if(errors.length)throw Error(errors.join('; '));
  console.log(engine,mobile?'mobile':'desktop',result);
  await context.close();
 }
}finally{await browser.close();server.kill()}
