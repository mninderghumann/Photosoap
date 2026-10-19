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
  if(mobile&&engine==='chromium'){
    const box=await canvas.boundingBox();
    const session=await context.newCDPSession(page);
    const start={x:Math.round(box.x+box.width*.2),y:Math.round(box.y+box.height*.2)};
    const finish={x:Math.round(box.x+box.width*.6),y:Math.round(box.y+box.height*.6)};
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...start,id:1}]});
    for(let i=1;i<=8;i++)await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:Math.round(start.x+(finish.x-start.x)*i/8),y:Math.round(start.y+(finish.y-start.y)*i/8),id:1}]});
    await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    const selected=await canvas.evaluate(()=>window.eval('selection'));
    if(!selected||selected.w<100||selected.h<100)throw Error('Chromium real touch selection failed: '+JSON.stringify(selected));
  }else if(mobile){
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
    // Resize the lower-right selection handle using a real pointer gesture.
    await page.mouse.move(to.x,to.y);
    await page.mouse.down();
    await page.mouse.move(to.x+60,to.y+35,{steps:8});
    await page.mouse.up();
    const resized=await canvas.evaluate(()=>window.eval('selection'));
    if(resized.w<=dims.w+40||resized.h<=dims.h+20||Math.abs(resized.x-dims.x)>2||Math.abs(resized.y-dims.y)>2)throw Error('Selection corner handle resize failed: '+JSON.stringify({before:dims,after:resized}));
  }
  await canvas.evaluate(()=>{window.confirm=()=>true;});
  const cropDebug=await canvas.evaluate(()=>{const button=document.getElementById('crop');let confirmations=0,alerts=[];window.confirm=()=>{confirmations++;return true};window.alert=m=>alerts.push(m);const before=window.eval('selection');button.click();return {confirmations,alerts,disabled:button.disabled,selection:before,after:window.eval('selection'),dimensions:[document.getElementById('canvas').width,document.getElementById('canvas').height]}});
  console.log(engine,mobile?'mobile':'desktop','crop diagnostics',JSON.stringify(cropDebug));
  const cropped=await canvas.evaluate(c=>[c.width,c.height]);
  const expected=mobile?(engine==='chromium'?[400,280]:[1000,700]):[465,318];
  if(Math.abs(cropped[0]-expected[0])>4||Math.abs(cropped[1]-expected[1])>4)throw Error('Crop dimensions failed: '+cropped);
  console.log(engine,mobile?'mobile':'desktop','real pointer crop',cropped.join('x'));
  // Zoomed canvas must map pointer positions to document pixels, not CSS pixels.
  if(!mobile){
    await page.locator('#zoom').fill('50');
    await page.locator('[data-tool="select"]').click();
    const z=await canvas.boundingBox();
    await page.mouse.move(z.x+z.width*.1,z.y+z.height*.1);
    await page.mouse.down();
    await page.mouse.move(z.x+z.width*.4,z.y+z.height*.4,{steps:6});
    await page.mouse.up();
    const mapped=await canvas.evaluate(()=>window.eval('selection'));
    if(Math.abs(mapped.w-cropped[0]*.3)>4||Math.abs(mapped.h-cropped[1]*.3)>4)throw Error('Zoom pointer mapping failed: '+JSON.stringify(mapped));
    await page.locator('#fit').click();
  }
  if(!mobile){
    // Cropped test canvas is only ~401px wide; narrow viewport to force real overflow.
    await page.setViewportSize({width:850,height:700});
    await page.locator('#zoom').fill('150');
    const beforePan=await page.evaluate(()=>{const c=document.getElementById('canvas'),v=c.parentElement;v.scrollLeft=0;v.scrollTop=0;return {scroll:[v.scrollLeft,v.scrollTop],layers:window.eval('layers').map(l=>[l.id,l.x,l.y])}});
    await page.locator('#pan').click();
    const panBox=await canvas.boundingBox();
    await page.mouse.move(panBox.x+panBox.width*.5,panBox.y+panBox.height*.5);
    await page.mouse.down();
    await page.mouse.move(panBox.x+panBox.width*.5-70,panBox.y+panBox.height*.5-50,{steps:5});
    await page.mouse.up();
    const afterPan=await page.evaluate(()=>{const c=document.getElementById('canvas'),v=c.parentElement;return {scroll:[v.scrollLeft,v.scrollTop],layers:window.eval('layers').map(l=>[l.id,l.x,l.y])}});
    if(JSON.stringify(beforePan.layers)!==JSON.stringify(afterPan.layers))throw Error('Pan changed layer coordinates');
    if(afterPan.scroll[0]===beforePan.scroll[0]&&afterPan.scroll[1]===beforePan.scroll[1])throw Error('Pan did not scroll viewport: '+JSON.stringify({beforePan,afterPan}));
    await page.locator('#pan').click();
    await page.locator('#fit').click();
    await page.setViewportSize({width:1440,height:900});
  }
  // Recovery must preserve an existing session across reloads.
  await page.evaluate(()=>{window.confirm=()=>true;document.getElementById('rectangle').click()});
  await page.waitForTimeout(1600);
  const saved=await page.evaluate(()=>localStorage.getItem('photosoap-autosave-v1'));
  if(!saved)throw Error('Autosave was not written');
  const savedCount=JSON.parse(saved).layers.length;
  // Restore prompt runs during page initialization, before evaluate() can override it.
  await page.addInitScript(()=>{window.confirm=()=>true});
  await page.reload();
  await page.waitForFunction(n=>document.querySelectorAll('#layers li').length===n,savedCount);
  const recovered=await page.locator('#layers li').count();
  if(recovered!==savedCount)throw Error('Autosave recovery failed: '+recovered+' / '+savedCount);
  // Rapid history clicks must not race asynchronous canvas restoration.
  await page.evaluate(()=>{document.getElementById('rectangle').click();document.getElementById('ellipse').click();document.getElementById('undo').click();document.getElementById('undo').click()});
  await page.waitForTimeout(700);
  const afterUndo=await page.locator('#layers li').count();
  if(afterUndo!==savedCount+1)throw Error('Rapid undo history corrupted: '+afterUndo);
  await page.locator('#redo').click();
  await page.waitForFunction(n=>document.querySelectorAll('#layers li').length===n,savedCount+2);
  // Pixel budget prevents excessive full-size canvas allocations.
  const budget=await page.evaluate(()=>{
    const size=document.getElementById('resize'),oldPrompt=window.prompt;
    window.prompt=m=>m.includes('width')?'6000':'2500';
    size.click();window.prompt=oldPrompt;
    const before=document.querySelectorAll('#layers li').length;
    const oldAlert=window.alert;let message='';
    window.alert=m=>{message=m};
    for(let i=0;i<5;i++)document.getElementById('add').click();
    window.alert=oldAlert;
    return {before,after:document.querySelectorAll('#layers li').length,message};
  });
  if(budget.after!==budget.before||!budget.message.includes('Layer memory budget reached'))throw Error('Large canvas layer budget not enforced: '+JSON.stringify(budget));
  // Large-file bounds: reject documents exceeding the 16MP canvas budget.
  const bounds=await page.evaluate(()=>{
    try{validateDocument({format:'photosoap',version:2,width:6000,height:6000,layers:[]});return false}
    catch{return true}
  });
  if(!bounds)throw Error('Large image pixel limit not enforced');
  if(errors.length)throw Error(errors.join('; '));
  console.log(engine,mobile?'mobile':'desktop',result);
  await context.close();
 }
}finally{await browser.close();server.kill()}
