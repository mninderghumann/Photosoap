import { chromium, firefox, webkit, devices } from 'playwright';
import { spawn } from 'node:child_process';
import { createConnection } from 'node:net';
const engine=process.argv[2]||'chromium';
const browserType={chromium,firefox,webkit}[engine];
if(!browserType)throw Error('Unknown browser '+engine);
const server=spawn('python3',['-m','http.server','8765'],{stdio:'ignore'});
let browser;
try{
 // Wait for the local editor server to respond instead of relying on a fixed sleep.
 let ready=false;
 for(let attempt=0;attempt<40;attempt++){
  try{
   await new Promise((resolve,reject)=>{
    const socket=createConnection({host:'127.0.0.1',port:8765});
    socket.once('connect',()=>{socket.destroy();resolve()});
    socket.once('error',reject);
    socket.setTimeout(1000,()=>socket.destroy(new Error('Readiness timeout')));
   });
   ready=true;break
  }catch{}
  await new Promise(resolve=>setTimeout(resolve,250));
 }
 if(!ready)throw Error('Editor HTTP server did not become ready on port 8765');
 browser=await browserType.launch({headless:true});
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
    // Use the same deterministic accessible mobile selection path across engines.
    // CDP touch injection is sensitive to viewport scrolling on headless CI runners.

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
  const expected=mobile?[1000,700]:[Math.ceil(cropDebug.selection.x+cropDebug.selection.w)-Math.floor(cropDebug.selection.x),Math.ceil(cropDebug.selection.y+cropDebug.selection.h)-Math.floor(cropDebug.selection.y)];
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
  // Editable shape drag and corner resize must update geometry without flattening metadata.
  await page.evaluate(()=>{window.confirm=()=>true;document.getElementById('rectangle').click();document.querySelector('[data-tool="select"]').click()});
  const geometryBefore=await page.evaluate(()=>{const l=active();return {id:l.id,x:l.shapeData.x,y:l.shapeData.y,w:l.shapeData.w,h:l.shapeData.h}});
  const editorBox=await canvas.boundingBox();
  if(!editorBox)throw Error('Editor canvas missing for object transform test');
  const actualCanvasSize=await canvas.evaluate(c=>({width:c.width,height:c.height}));
  const pixelPoint=(x,y)=>({x:editorBox.x+x*editorBox.width/actualCanvasSize.width,y:editorBox.y+y*editorBox.height/actualCanvasSize.height});
  if(!mobile){
    const origin=pixelPoint(geometryBefore.x+geometryBefore.w/2,geometryBefore.y+geometryBefore.h/2);
    await page.mouse.move(origin.x,origin.y);await page.mouse.down();await page.mouse.move(origin.x+20,origin.y+15,{steps:5});await page.mouse.up();
    const moved=await page.evaluate(()=>{const d=active().shapeData;return {x:d.x,y:d.y,w:d.w,h:d.h}});
    if(moved.x===geometryBefore.x&&moved.y===geometryBefore.y)throw Error('Shape direct dragging did not move');
    const corner=pixelPoint(moved.x+moved.w,moved.y+moved.h);
    await page.mouse.move(corner.x,corner.y);await page.mouse.down();await page.mouse.move(corner.x+20,corner.y+15,{steps:5});await page.mouse.up();
    const resizedShape=await page.evaluate(()=>active().shapeData);
    if(resizedShape.w<=moved.w||resizedShape.h<=moved.h)throw Error('Shape corner resize failed');
  }
  // Vector rotation and flip must preserve editable metadata and undo history.
  // Keep rotated handles within the canvas: previous fixture extended beyond its bottom edge.
  await page.evaluate(()=>{const l=active(),d=l.shapeData;d.w=Math.min(d.w,120);d.h=Math.min(d.h,90);d.x=Math.round((canvas.width-d.w)/2)-l.x;d.y=Math.round((canvas.height-d.h)/2)-l.y;drawShapeLayer(l);refresh()});
  const transformCheck=await page.evaluate(()=>{
    const l=active(),d=l.shapeData;
    if(!d)return {error:'Missing editable shape'};
    const id=l.id,kind=d.kind,originalRotation=d.rotation||0,originalFlip=!!d.flipH;
    const oldPrompt=window.prompt;
    window.prompt=()=> '90';
    document.getElementById('rotateobject').click();
    window.prompt=()=> 'h';
    document.getElementById('flipobject').click();
    window.prompt=oldPrompt;
    const updated=active(),shape=updated.shapeData;
    return {sameLayer:updated.id===id,kind:shape?.kind,expectedKind:kind,rotation:shape?.rotation,expectedRotation:(originalRotation+90)%360,flip:shape?.flipH,expectedFlip:!originalFlip};
  });
  if(transformCheck.error||!transformCheck.sameLayer||transformCheck.kind!==transformCheck.expectedKind||transformCheck.rotation!==transformCheck.expectedRotation||transformCheck.flip!==transformCheck.expectedFlip)throw Error('Non-destructive vector transform regression: '+JSON.stringify(transformCheck));
  // Phase 2 final QA: rotated corner hit testing and pointer resizing.
  // The preceding pan test can leave the stage scrolled, clipping pointer handles.
  await canvas.evaluate(c=>{c.parentElement.scrollLeft=0;c.parentElement.scrollTop=0});
  await canvas.scrollIntoViewIfNeeded();
  await page.locator('[data-tool="select"]').click();
  if(!mobile){
    const rotated=await page.evaluate(()=>{const l=active(),d=l.shapeData;return {x:d.x+l.x,y:d.y+l.y,w:d.w,h:d.h,rotation:d.rotation||0}});
    const box=await canvas.boundingBox(),size=await canvas.evaluate(c=>({w:c.width,h:c.height}));
    const screen=(x,y)=>({x:box.x+x*box.width/size.w,y:box.y+y*box.height/size.h});
    const cx=rotated.x+rotated.w/2,cy=rotated.y+rotated.h/2,a=rotated.rotation*Math.PI/180;
    const point=(x,y)=>screen(cx+(x-cx)*Math.cos(a)-(y-cy)*Math.sin(a),cy+(x-cx)*Math.sin(a)+(y-cy)*Math.cos(a));
    const handle=point(rotated.x+rotated.w,rotated.y+rotated.h);
    await page.mouse.move(handle.x,handle.y);await page.mouse.down();
    const state=await page.evaluate(({x,y})=>({corner:objectResize?.corner,drag,tool,panMode,selected:active()?.id,locked:active()?.locked,hit:document.elementFromPoint(x,y)?.id,hitTag:document.elementFromPoint(x,y)?.tagName,hitClass:document.elementFromPoint(x,y)?.className,handle:{x,y},canvasRect:canvas.getBoundingClientRect().toJSON(),stageRect:canvas.parentElement.getBoundingClientRect().toJSON(),stageScroll:{x:canvas.parentElement.scrollLeft,y:canvas.parentElement.scrollTop},canvasSize:{w:canvas.width,h:canvas.height},scrollY:window.scrollY}),handle);
    await page.mouse.move(handle.x+20,handle.y+20,{steps:5});await page.mouse.up();
    const resized=await page.evaluate(()=>{const d=active().shapeData;return {w:d.w,h:d.h}});
    if(state.corner!=='se'||!state.drag||Math.abs(resized.w-rotated.w)<0.1&&Math.abs(resized.h-rotated.h)<0.1)throw Error('Rotated corner pointer regression: '+JSON.stringify({state,rotated,resized}));
    // Shift resizing must preserve the initial aspect ratio.
    const before=await page.evaluate(()=>{const l=active(),d=l.shapeData;return {x:d.x+l.x,y:d.y+l.y,w:d.w,h:d.h,rotation:d.rotation||0}});
    const c2x=before.x+before.w/2,c2y=before.y+before.h/2,rad=before.rotation*Math.PI/180;
    const corner=screen(c2x+(before.w/2)*Math.cos(rad)-(before.h/2)*Math.sin(rad),c2y+(before.w/2)*Math.sin(rad)+(before.h/2)*Math.cos(rad));
    await page.keyboard.down('Shift');await page.mouse.move(corner.x,corner.y);await page.mouse.down();
    const shiftState=await page.evaluate(()=>objectResize?.corner);
    await page.mouse.move(corner.x+30,corner.y+15,{steps:5});await page.mouse.up();await page.keyboard.up('Shift');
    const after=await page.evaluate(()=>{const d=active().shapeData;return {w:d.w,h:d.h}});
    if(shiftState!=='se'||Math.abs(after.w/before.w-after.h/before.h)>0.002)throw Error('Shift rotated resize aspect regression: '+JSON.stringify({shiftState,before,after}));
    // Pointer cancellation must clear the individual resize interaction.
    const latest=await page.evaluate(()=>{const l=active(),d=l.shapeData;return {x:d.x+l.x,y:d.y+l.y,w:d.w,h:d.h,rotation:d.rotation||0}});
    const ccx=latest.x+latest.w/2,ccy=latest.y+latest.h/2,ra=latest.rotation*Math.PI/180;
    const h=screen(ccx+(latest.w/2)*Math.cos(ra)-(latest.h/2)*Math.sin(ra),ccy+(latest.w/2)*Math.sin(ra)+(latest.h/2)*Math.cos(ra));
    await page.mouse.move(h.x,h.y);await page.mouse.down();
    const captured=await page.evaluate(()=>!!objectResize);
    await canvas.dispatchEvent('pointercancel');const cleared=await page.evaluate(()=>!objectResize&&!drag);
    await page.mouse.up();
    if(!captured||!cleared)throw Error('Individual resize cancellation regression: '+JSON.stringify({captured,cleared}));
    // Rotation metadata must remain intact after pointer edits.
    const finalRotation=await page.evaluate(()=>active().shapeData.rotation);
    if(finalRotation!==rotated.rotation)throw Error('Pointer resize changed rotation metadata');
  }
  const transformedLayerId=await page.evaluate(()=>active().id);
  // Recovery must preserve an existing session across reloads.
  await page.evaluate(()=>{window.confirm=()=>true;document.getElementById('rectangle').click()});
  await page.waitForTimeout(1600);
  const saved=await page.evaluate(()=>localStorage.getItem('photosoap-autosave-v1'));
  if(!saved)throw Error('Autosave was not written');
  const autosave=JSON.parse(saved);const savedDocument=autosave.version===3?autosave.pages?.[autosave.activePage]?.document:autosave;if(!savedDocument||!Array.isArray(savedDocument.layers))throw Error('Autosave document structure invalid');const savedCount=savedDocument.layers.length;
  // Restore prompt runs during page initialization, before evaluate() can override it.
  await page.addInitScript(()=>{window.confirm=()=>true});
  await page.reload();
  await page.waitForFunction(n=>document.querySelectorAll('#layers li').length===n,savedCount);
  const recovered=await page.locator('#layers li').count();
  if(recovered!==savedCount)throw Error('Autosave recovery failed: '+recovered+' / '+savedCount);
  const recoveredVector=await page.evaluate(id=>{const l=layers.find(item=>item.id===id);return l?{kind:l.shapeData?.kind,rotation:l.shapeData?.rotation,flip:l.shapeData?.flipH}:null},transformedLayerId);
  if(!recoveredVector||recoveredVector.kind!==transformCheck.expectedKind||recoveredVector.rotation!==transformCheck.expectedRotation||recoveredVector.flip!==transformCheck.expectedFlip)throw Error('Autosave lost editable vector transform metadata: '+JSON.stringify(recoveredVector));
  // Multi-page autosave must retain inactive page snapshots and active-page selection.
  await page.locator('#pageadd').click();
  await page.locator('#ellipse').click();
  await page.waitForTimeout(1700);
  const multiSaved=await page.evaluate(()=>JSON.parse(localStorage.getItem('photosoap-autosave-v1')));
  if(multiSaved.version!==3||multiSaved.pages.length!==2||multiSaved.activePage!==1||multiSaved.pages[0].document.layers.length!==savedCount||multiSaved.pages[1].document.layers.length!==1)throw Error('Multi-page autosave incorrect: '+JSON.stringify({version:multiSaved.version,pages:multiSaved.pages.map(p=>p.document.layers.length),active:multiSaved.activePage}));
  await page.reload();
  await page.waitForFunction(()=>document.querySelectorAll('#pagepicker option').length===2&&document.getElementById('pagepicker').value==='1'&&document.querySelectorAll('#layers li').length===1);
  await page.locator('#pagepicker').selectOption('0');
  await page.waitForFunction(n=>document.querySelectorAll('#layers li').length===n,savedCount);
  await page.locator('#pagepicker').selectOption('1');
  await page.waitForFunction(()=>document.querySelectorAll('#layers li').length===1);
  await page.locator('#pagepicker').selectOption('0');
  await page.waitForFunction(n=>document.querySelectorAll('#layers li').length===n,savedCount);
  // Restore the single-page fixture before the independent page-roundtrip tests below.
  await page.evaluate(()=>{pageRecords=[{name:'Page 1',snapshot:capture()}];pageIndex=0;pageSequence=1;updatePagePicker();scheduleAutosave()});
  // Rapid history clicks must not race asynchronous canvas restoration.
  await page.evaluate(()=>{document.getElementById('rectangle').click();document.getElementById('ellipse').click();document.getElementById('undo').click();document.getElementById('undo').click()});
  await page.waitForTimeout(700);
  const afterUndo=await page.locator('#layers li').count();
  if(afterUndo!==savedCount+1)throw Error('Rapid undo history corrupted: '+afterUndo);
  await page.locator('#redo').click();
  await page.waitForFunction(n=>document.querySelectorAll('#layers li').length===n,savedCount+2);
  // Verify a real file-input image import creates a decoded raster layer.
  const importedBefore=await page.locator('#layers li').count();
  const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=8;c.height=6;const x=c.getContext('2d');x.fillStyle='#ff0000';x.fillRect(0,0,8,6);return c.toDataURL('image/png').split(',')[1]});
  await page.locator('#file').setInputFiles({name:'sample.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
  await page.waitForFunction(n=>document.querySelectorAll('#layers li').length===n,importedBefore+1);
  const imported=await page.evaluate(()=>{const l=window.eval('layers').at(-1),d=l.canvas.getContext('2d').getImageData(Math.floor(l.canvas.width/2),Math.floor(l.canvas.height/2),1,1).data;return {name:l.name,pixel:[...d]}});
  if(imported.name!=='sample.png'||imported.pixel[0]<200||imported.pixel[3]!==255)throw Error('Decoded image import failed: '+JSON.stringify(imported));
  // JPEG EXIF orientation 6 must rotate the decoded image into portrait.
  // Construct a minimal JPEG with an EXIF orientation tag from a landscape canvas.
  const jpeg=await page.evaluate(()=>{
    const c=document.createElement('canvas');c.width=40;c.height=20;
    const x=c.getContext('2d');x.fillStyle='#f00';x.fillRect(0,0,20,20);x.fillStyle='#00f';x.fillRect(20,0,20,20);
    return c.toDataURL('image/jpeg',.95).split(',')[1];
  });
  const raw=Buffer.from(jpeg,'base64');
  const exif=Buffer.from([0xff,0xe1,0x00,0x22,0x45,0x78,0x69,0x66,0,0,0x49,0x49,0x2a,0,8,0,0,0,1,0,0x12,1,3,0,1,0,0,0,6,0,0,0,0,0,0,0]);
  const oriented=Buffer.concat([raw.subarray(0,2),exif,raw.subarray(2)]);
  const beforeJpeg=await page.locator('#layers li').count();
  await page.locator('#file').setInputFiles({name:'rotated.jpg',mimeType:'image/jpeg',buffer:oriented});
  await page.waitForFunction(n=>document.querySelectorAll('#layers li').length===n,beforeJpeg+1);
  const jpegResult=await page.evaluate(()=>{
    const l=window.eval('layers').at(-1),c=l.canvas,x=c.getContext('2d'),cx=c.width/2,cy=c.height/2;
    const pixel=(px,py)=>[...x.getImageData(Math.floor(px),Math.floor(py),1,1).data];
    return {top:pixel(cx,cy-c.height*.2),bottom:pixel(cx,cy+c.height*.2),left:pixel(cx-c.width*.2,cy),right:pixel(cx+c.width*.2,cy)};
  });
  // A rotated portrait should have color variation vertically, not horizontally.
  if(jpegResult.top[3]===0||jpegResult.bottom[3]===0||Math.abs(jpegResult.top[0]-jpegResult.bottom[0])<80)
    throw Error('JPEG EXIF orientation not applied: '+JSON.stringify(jpegResult));
  // Confirm the file input resets so importing the same image twice works.
  const beforeRepeat=await page.locator('#layers li').count();
  await page.locator('#file').setInputFiles({name:'sample.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
  await page.waitForFunction(n=>document.querySelectorAll('#layers li').length===n,beforeRepeat+1);
  const inputReset=await page.locator('#file').evaluate(el=>el.value==='');
  if(!inputReset)throw Error('Image file input was not reset after import');
  // A 6MP canvas with seven layers approaches the 48MP layer memory budget.
  const budget=await page.evaluate(()=>{
    const size=document.getElementById('resize'),oldPrompt=window.prompt;
    window.prompt=m=>m.includes('width')?'3000':'2000';
    size.click();window.prompt=oldPrompt;
    const before=document.querySelectorAll('#layers li').length;
    const oldAlert=window.alert;let message='';
    window.alert=m=>{message=m};
    for(let i=0;i<5;i++)document.getElementById('add').click();
    window.alert=oldAlert;
    return {before,after:document.querySelectorAll('#layers li').length,message};
  });
  if(budget.after>8||!budget.message.includes('Layer memory budget reached'))throw Error('Large canvas layer budget not enforced: '+JSON.stringify(budget));
  // Grouping and proportional scaling must preserve independent editable members.
  const groupCheck=await page.evaluate(()=>{
    const resize=document.getElementById('resize'),savedPrompt=window.prompt;
    window.prompt=message=>message.includes('width')?'800':'600';
    resize.click();window.prompt=savedPrompt;
    document.getElementById('rectangle').click();
    const first=active();
    if(!first?.shapeData)return {error:'Missing first vector after reducing canvas size'};
    const firstId=first.id;
    document.getElementById('ellipse').click();
    const second=active(),secondId=second.id;
    multiSelected=new Set([firstId,secondId]);
    document.getElementById('grouplayers').click();
    const id=active().groupId;
    const before=layers.filter(l=>l.groupId===id).map(l=>({id:l.id,w:(l.shapeData||l.elementData).w,h:(l.shapeData||l.elementData).h}));
    const previousPrompt=window.prompt;
    window.prompt=()=> '150';
    document.getElementById('scaleobject').click();
    window.prompt=previousPrompt;
    const after=layers.filter(l=>l.groupId===id).map(l=>({id:l.id,w:(l.shapeData||l.elementData).w,h:(l.shapeData||l.elementData).h}));
    return {id,firstId,secondId,before,after};
  });
  if(groupCheck.error||!groupCheck.id||groupCheck.before.length!==2||groupCheck.after.length!==2||groupCheck.after.some((v,i)=>Math.abs(v.w-groupCheck.before[i].w*1.5)>0.01||Math.abs(v.h-groupCheck.before[i].h*1.5)>0.01))throw Error('Grouped vector scaling regression: '+JSON.stringify(groupCheck));
  // Dragging the group bounding-box corner must resize both editable members.
  await page.locator('[data-tool="select"]').click();
  if(!mobile){
    const bounds=await page.evaluate(()=>{const l=active();return l?.groupId?groupBounds(l.groupId):null});
    if(!bounds||bounds.w<=0||bounds.h<=0)throw Error('Missing group bounds for handle test');
    const beforeDrag=await page.evaluate(()=>{const id=active().groupId;return layers.filter(l=>l.groupId===id).map(l=>({id:l.id,w:(l.shapeData||l.elementData).w,h:(l.shapeData||l.elementData).h}))});
    const box=await canvas.boundingBox(),size=await canvas.evaluate(c=>({w:c.width,h:c.height}));
    const toScreen=(x,y)=>({x:box.x+x*box.width/size.w,y:box.y+y*box.height/size.h});
    const handle=toScreen(bounds.x+bounds.w,bounds.y+bounds.h),target=toScreen(bounds.x+bounds.w+30,bounds.y+bounds.h+25);
    await page.mouse.move(handle.x,handle.y);await page.mouse.down();
    const hitState=await page.evaluate(()=>({tool,panMode,drag,groupResize:!!groupResize,objectResize:!!objectResize,selected:active()?.id}));
    await page.mouse.move(target.x,target.y,{steps:6});await page.mouse.up();
    const afterDrag=await page.evaluate(()=>{const id=active().groupId;return layers.filter(l=>l.groupId===id).map(l=>({id:l.id,w:(l.shapeData||l.elementData).w,h:(l.shapeData||l.elementData).h}))});
    if(afterDrag.length!==beforeDrag.length||afterDrag.some((v,i)=>v.w<=beforeDrag[i].w||v.h<=beforeDrag[i].h))throw Error('Group corner-handle resize regression: '+JSON.stringify({beforeDrag,afterDrag,hitState,bounds,handle,target,box,size}));
  }
  // Shift-drag must constrain group corner resizing to a uniform scale.
  if(!mobile){
    const before=await page.evaluate(()=>{const l=active(),g=groupBounds(l.groupId);return {g,members:layers.filter(v=>v.groupId===l.groupId).map(v=>({id:v.id,w:(v.shapeData||v.elementData).w,h:(v.shapeData||v.elementData).h}))}});
    const box=await canvas.boundingBox(),size=await canvas.evaluate(c=>({w:c.width,h:c.height}));
    const screen=(x,y)=>({x:box.x+x*box.width/size.w,y:box.y+y*box.height/size.h});
    const from=screen(before.g.x+before.g.w,before.g.y+before.g.h),to=screen(before.g.x+before.g.w+35,before.g.y+before.g.h+12);
    await page.keyboard.down('Shift');
    await page.mouse.move(from.x,from.y);await page.mouse.down();
    await page.mouse.move(to.x,to.y,{steps:5});await page.mouse.up();
    await page.keyboard.up('Shift');
    const after=await page.evaluate(()=>{const id=active().groupId;return layers.filter(v=>v.groupId===id).map(v=>({id:v.id,w:(v.shapeData||v.elementData).w,h:(v.shapeData||v.elementData).h}))});
    if(after.length!==before.members.length||after.some((v,i)=>Math.abs(v.w/before.members[i].w-v.h/before.members[i].h)>0.001||v.w<=before.members[i].w))throw Error('Shift-constrained group resize regression: '+JSON.stringify({before,after}));
  }
  // Batch regression 1: pointer cancellation must clear group resize state.
  if(!mobile){
    const g=await page.evaluate(()=>groupBounds(active().groupId));
    const box=await canvas.boundingBox(),size=await canvas.evaluate(c=>({w:c.width,h:c.height}));
    const x=box.x+(g.x+g.w)*box.width/size.w,y=box.y+(g.y+g.h)*box.height/size.h;
    await page.mouse.move(x,y);await page.mouse.down();
    const started=await page.evaluate(()=>!!groupResize);
    await canvas.dispatchEvent('pointercancel');
    const cleared=await page.evaluate(()=>!groupResize&&!drag);
    await page.mouse.up();
    if(!started||!cleared)throw Error('Group resize pointer cancellation regression: '+JSON.stringify({started,cleared}));
  }
  // Batch regression 2: grid snapping rounds a dragged group corner to grid coordinates.
  if(!mobile){
    await page.locator('#gridsize').fill('25');
    await page.locator('#snapgrid').check();
    const g=await page.evaluate(()=>groupBounds(active().groupId));
    const box=await canvas.boundingBox(),size=await canvas.evaluate(c=>({w:c.width,h:c.height}));
    const pt=(x,y)=>({x:box.x+x*box.width/size.w,y:box.y+y*box.height/size.h});
    const from=pt(g.x+g.w,g.y+g.h),to=pt(g.x+g.w+37,g.y+g.h+42);
    await page.mouse.move(from.x,from.y);await page.mouse.down();
    await page.mouse.move(to.x,to.y,{steps:5});await page.mouse.up();
    const updated=await page.evaluate(()=>groupBounds(active().groupId));
    if(Math.abs(updated.x+updated.w-Math.round((g.x+g.w+37)/25)*25)>1||Math.abs(updated.y+updated.h-Math.round((g.y+g.h+42)/25)*25)>1)throw Error('Group corner grid snapping regression: '+JSON.stringify({g,updated}));
    await page.locator('#snapgrid').uncheck();
  }
  // Batch regression 3: Shift-resizing keeps the opposite group corner anchored.
  if(!mobile){
    const before=await page.evaluate(()=>groupBounds(active().groupId));
    const box=await canvas.boundingBox(),size=await canvas.evaluate(c=>({w:c.width,h:c.height}));
    const pt=(x,y)=>({x:box.x+x*box.width/size.w,y:box.y+y*box.height/size.h});
    const from=pt(before.x+before.w,before.y+before.h),to=pt(before.x+before.w+22,before.y+before.h+49);
    await page.keyboard.down('Shift');await page.mouse.move(from.x,from.y);await page.mouse.down();
    await page.mouse.move(to.x,to.y,{steps:5});await page.mouse.up();await page.keyboard.up('Shift');
    const after=await page.evaluate(()=>groupBounds(active().groupId));
    if(Math.abs(after.x-before.x)>1||Math.abs(after.y-before.y)>1)throw Error('Shift group resize anchor drift: '+JSON.stringify({before,after}));
  }
  // Phase 2 batch of four: validate grouped geometry after repeated pointer transforms.
  const groupIntegrity=await page.evaluate(()=>{
    const id=active().groupId,items=layers.filter(l=>l.groupId===id);
    return {count:items.length,allEditable:items.every(l=>!!(l.shapeData||l.elementData)),
      allFinite:items.every(l=>{const d=l.shapeData||l.elementData;return [d.x,d.y,d.w,d.h].every(Number.isFinite)}),
      positive:items.every(l=>{const d=l.shapeData||l.elementData;return d.w>=1&&d.h>=1}),
      bounded:items.every(l=>{const d=l.shapeData||l.elementData;return d.w<=12000&&d.h<=12000&&Math.abs(d.x)<=12000&&Math.abs(d.y)<=12000})};
  });
  if(groupIntegrity.count<2)throw Error('Group membership lost during resizing: '+JSON.stringify(groupIntegrity));
  if(!groupIntegrity.allEditable)throw Error('Group vector metadata lost during resizing: '+JSON.stringify(groupIntegrity));
  if(!groupIntegrity.allFinite||!groupIntegrity.positive)throw Error('Group resize produced invalid dimensions: '+JSON.stringify(groupIntegrity));
  if(!groupIntegrity.bounded)throw Error('Group resize exceeded safe geometry limits: '+JSON.stringify(groupIntegrity));
  // Grid snapping applies only when enabled; exact numeric positions otherwise remain unchanged.
  await page.locator('#gridsize').fill('50');
  await page.locator('#snapgrid').check();
  await page.locator('#layerx').fill('73');
  await page.locator('#layery').fill('124');
  await page.locator('#applyposition').click();
  const snapped=await page.evaluate(()=>{const l=window.eval('layers').find(l=>l.id===window.eval('selected'));return [l.x,l.y]});
  if(snapped.join(',')!=='50,100')throw Error('Grid position snapping failed: '+snapped);
  await page.locator('#snapgrid').uncheck();
  // Free a layer slot after the memory-limit stress test before testing duplication.
  await page.locator('#delete').click();
  // Offset duplication preserves the source and selects the newly created layer.
  const beforeDuplicate=await page.evaluate(()=>({count:window.eval('layers').length,source:(()=>{const l=window.eval('layers').find(l=>l.id===window.eval('selected'));return [l.x,l.y]})()}));
  await page.locator('#duplicateoffset').fill('24');
  await page.locator('#offsetduplicate').click();
  const duplicateResult=await page.evaluate(()=>({count:window.eval('layers').length,active:(()=>{const l=window.eval('layers').find(l=>l.id===window.eval('selected'));return [l.x,l.y]})()}));
  if(duplicateResult.count!==beforeDuplicate.count+1||duplicateResult.active[0]!==beforeDuplicate.source[0]+24||duplicateResult.active[1]!==beforeDuplicate.source[1]+24)throw Error('Offset duplication failed: '+JSON.stringify(duplicateResult));
  // Phase 2 numeric positioning sets exact coordinates and supports undo.
  await page.locator('#layerx').fill('37');
  await page.locator('#layery').fill('-18');
  await page.locator('#applyposition').click();
  const positioned=await page.evaluate(()=>{const l=window.eval('layers').find(l=>l.id===window.eval('selected'));return [l.x,l.y]});
  if(positioned.join(',')!=='37,-18')throw Error('Precise layer positioning failed: '+positioned);
  // Phase 2 layer alignment is undoable and respects locked layers.
  const alignBefore=await page.evaluate(()=>{const l=window.eval('layers').find(l=>l.id===window.eval('selected'));return {x:l.x,y:l.y}});
  await page.locator('#alignlayer').selectOption('right');
  await page.locator('#applyalign').click();
  const alignAfter=await page.evaluate(()=>{const l=window.eval('layers').find(l=>l.id===window.eval('selected'));return {x:l.x,y:l.y}});
  if(alignAfter.x!==0)throw Error('Layer right alignment failed: '+JSON.stringify({alignBefore,alignAfter}));
  // Dragging with grid snap enabled must land on exact grid coordinates.
  if(!mobile){
  await page.locator('#snapgrid').check();
  await page.locator('[data-tool="move"]').click();
  await page.evaluate(()=>{window.eval('panMode=false');document.getElementById('canvas').scrollIntoView({block:'center'})});
  const box=await canvas.boundingBox();
  const sx=box.x+box.width*.4,sy=box.y+box.height*.4;
  await page.mouse.move(sx,sy);
  await page.mouse.down();
  await page.mouse.move(sx+17,sy+23,{steps:4});
  await page.mouse.up();
  const dragSnap=await page.evaluate(()=>{const l=window.eval('layers').find(l=>l.id===window.eval('selected'));return [l.x,l.y]});
  if(dragSnap.some(v=>v%50!==0))throw Error('Drag grid snapping failed: '+dragSnap);
  await page.locator('#snapgrid').uncheck();
  }
  // Phase 2 design preset must resize all layers and remain undoable.
  await page.locator('#preset').selectOption('1200x628');
  await page.locator('#applypreset').click();
  const presetResult=await page.evaluate(()=>({size:[canvas.width,canvas.height],layers:window.eval('layers').map(l=>[l.canvas.width,l.canvas.height])}));
  if(presetResult.size.join('x')!=='1200x628'||presetResult.layers.some(d=>d.join('x')!=='1200x628'))throw Error('Design preset resize failed: '+JSON.stringify(presetResult));
  // Multi-page project roundtrip: independent snapshots, names and active-page selection.
  await page.locator('#pageadd').click();
  await page.locator('#pagepicker').selectOption('0');
  await page.waitForFunction(()=>window.eval('pageIndex')===0);
  await page.locator('#pageduplicate').click();
  await page.waitForFunction(()=>window.eval('pageIndex')===2);
  const pages=await page.evaluate(()=>{
    rememberPage();
    const data={format:'photosoap',version:3,activePage:pageIndex,pages:pageRecords.map(p=>({name:p.name,document:p.snapshot}))};
    return {count:data.pages.length,active:data.activePage,valid:data.pages.every(p=>validateDocument(p.document).version===2)};
  });
  if(pages.count!==3||pages.active!==2||!pages.valid)throw Error('Multi-page project serialization failed: '+JSON.stringify(pages));
  // Validate standalone multi-page PDF structure and JPEG object payloads.
  const pdfCheck=await page.evaluate(()=>{
    const jpg=Uint8Array.from([255,216,255,217]);
    const blob=pdfBytes([{width:320,height:240,bytes:jpg},{width:640,height:480,bytes:jpg}]);
    return blob.arrayBuffer().then(buffer=>{
      const bytes=new Uint8Array(buffer),text=new TextDecoder('latin1').decode(bytes);
      return {mime:blob.type,prefix:text.slice(0,8),pages:(text.match(/\/Type \/Page \/Parent/g)||[]).length,images:(text.match(/\/Subtype \/Image/g)||[]).length,mediaBoxes:text.includes('/MediaBox [0 0 320 240]')&&text.includes('/MediaBox [0 0 640 480]'),xref:text.includes('xref')&&text.includes('startxref'),trailer:text.includes('%%EOF'),jpeg:bytes.filter((v,i)=>v===255&&bytes[i+1]===216).length};
    });
  });
  if(pdfCheck.mime!=='application/pdf'||!pdfCheck.prefix.startsWith('%PDF-1.4')||pdfCheck.pages!==2||pdfCheck.images!==2||!pdfCheck.mediaBoxes||!pdfCheck.xref||!pdfCheck.trailer||pdfCheck.jpeg!==2)throw Error('Multi-page PDF structure invalid: '+JSON.stringify(pdfCheck));
  // Large-file bounds: reject documents exceeding the 16MP canvas budget.
  const bounds=await page.evaluate(()=>{
    try{validateDocument({format:'photosoap',version:2,width:6000,height:6000,layers:[]});return false}
    catch{return true}
  });
  if(!bounds)throw Error('Large image pixel limit not enforced');
  // Reject malformed project metadata without changing the active editor.
  const schema=await page.evaluate(()=>{
    const current=window.eval('layers').map(l=>l.id);
    const valid={format:'photosoap',version:2,width:10,height:10,selected:1,layers:[{id:1,name:'A',data:'data:image/png;base64,AAAA',x:0,y:0,opacity:1,brightness:100,contrast:100}]};
    const rejects=patch=>{try{validateDocument({...valid,...patch});return false}catch{return true}};
    const checks={
      duplicateIds:rejects({layers:[valid.layers[0],{...valid.layers[0]}]}),
      unknownSelection:rejects({selected:2}),
      unsupportedVersion:rejects({version:99}),
      oversizedLayerName:rejects({layers:[{...valid.layers[0],name:'x'.repeat(201)}]}),
      negativeOpacity:rejects({layers:[{...valid.layers[0],opacity:-.1}]}),
      invalidData:rejects({layers:[{...valid.layers[0],data:'not-an-image'}]}),
      invalidVisibility:rejects({layers:[{...valid.layers[0],visible:'false'}]}),
      invalidLock:rejects({layers:[{...valid.layers[0],locked:1}]}),
      legacyDefaults:(()=>{const normalized=validateDocument({...valid,format:undefined,version:1});return normalized.version===2&&normalized.layers[0].visible===true&&normalized.layers[0].locked===false})()
    };
    return {checks,unchanged:JSON.stringify(current)===JSON.stringify(window.eval('layers').map(l=>l.id))};
  });
  if(!schema.unchanged||Object.values(schema.checks).some(ok=>!ok))throw Error('Document validation regression: '+JSON.stringify(schema));
  // Phase 2 acceptance: five pointer-state and cursor invariants.
  const interactionQA=await page.evaluate(()=>{
    const c=document.querySelector('#canvas');
    const before={group:groupResize,object:objectResize,move:objectMove,drag,cursor:c.style.cursor};
    c.dispatchEvent(new PointerEvent('pointercancel',{bubbles:true,pointerId:91}));
    const cancel={group:groupResize===null,object:objectResize===null,move:objectMove===null,drag:drag===false,cursor:c.style.cursor==='crosshair'};
    c.style.cursor='move';
    c.dispatchEvent(new PointerEvent('pointerleave',{bubbles:false,pointerId:92}));
    const leave=c.style.cursor==='crosshair';
    return {cancel,leave,before};
  });
  if(!interactionQA.cancel.group)throw Error('Pointer cancellation left group resize active: '+JSON.stringify(interactionQA));
  if(!interactionQA.cancel.object)throw Error('Pointer cancellation left object resize active: '+JSON.stringify(interactionQA));
  if(!interactionQA.cancel.move||!interactionQA.cancel.drag)throw Error('Pointer cancellation left move or drag active: '+JSON.stringify(interactionQA));
  if(!interactionQA.cancel.cursor)throw Error('Pointer cancellation did not reset cursor: '+JSON.stringify(interactionQA));
  if(!interactionQA.leave)throw Error('Pointer leave did not reset idle cursor: '+JSON.stringify(interactionQA));
  // Phase 2 final acceptance: five UI state and interaction checks.
  const finalQA=await page.evaluate(()=>{
    const c=document.querySelector('#canvas'),l=active();
    const previous=tool;
    tool='move';c.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerId:201,clientX:0,clientY:0}));
    const moveCursor=c.style.cursor==='move';
    tool='select';panMode=true;c.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerId:202,clientX:0,clientY:0}));
    const panCursor=c.style.cursor==='grab';
    panMode=false;
    c.style.cursor='move';c.dispatchEvent(new PointerEvent('pointerleave',{pointerId:203}));
    const leaveCursor=c.style.cursor==='crosshair';
    c.dispatchEvent(new PointerEvent('pointercancel',{pointerId:204}));
    const cancelClears=!drag&&!groupResize&&!objectResize&&!objectMove;
    const hiddenGuard=!!l&&typeof l.visible==='boolean';
    tool=previous;
    return {moveCursor,panCursor,leaveCursor,cancelClears,hiddenGuard};
  });
  for(const [name,ok] of Object.entries(finalQA))if(!ok)throw Error('Phase 2 final acceptance '+name+': '+JSON.stringify(finalQA));
  // Phase 3: seven adjustment controls must persist, validate and render safely.
  const adjustmentQA=await page.evaluate(()=>{
    const specs={saturation:[0,200,100],grayscale:[0,100,0],sepia:[0,100,0],hue:[0,360,0],blur:[0,20,0],invert:[0,100,0],warmth:[0,100,0]};
    const l=active(),wasLocked=l.locked,results={};l.locked=false;
    for(const [name,[min,max,neutral]] of Object.entries(specs)){
      const input=document.getElementById(name),label=document.getElementById(name+'val');
      const before=l[name],sample=Math.min(max,Math.max(min,neutral+1));
      input.value=String(sample);input.dispatchEvent(new Event('input',{bubbles:true}));
      const changed=l[name]===sample,shown=label.textContent.includes(String(sample));
      const saved=capture(),persisted=saved.layers.find(v=>v.id===l.id)?.[name]===sample;
      const validated=validateDocument(saved).layers.find(v=>v.id===l.id)?.[name]===sample;
      l[name]=before;input.value=String(before??neutral);label.textContent=String(before??neutral)+(name==='hue'?'°':name==='blur'?'px':'%');
      results[name]={ok:!!input&&changed&&shown&&persisted&&validated,changed,shown,persisted,validated,locked:l.locked,selected:active()?.id,layer:l.id,value:l[name],sample};
    }
    l.locked=wasLocked;refresh();return results;
  });
  for(const [name,ok] of Object.entries(adjustmentQA))if(!ok.ok)throw Error('Phase 3 adjustment regression '+name+': '+JSON.stringify(adjustmentQA));
  // Phase 3 release gate: feather must not modify lower-layer source pixels.
  const featherQA=await page.evaluate(()=>{
    const original=capture();
    const top=active();
    if(!top)return {error:'No active layer'};
    const snapshots=layers.map(l=>({id:l.id,pixels:Array.from(l.canvas.getContext('2d').getImageData(0,0,Math.min(4,l.canvas.width),Math.min(4,l.canvas.height)).data)}));
    const previous=top.feather??0;
    top.feather=20;
    refresh();
    const serialized=capture();
    const saved=serialized.layers.find(l=>l.id===top.id);
    const normalized=validateDocument(serialized).layers.find(l=>l.id===top.id);
    const unchanged=snapshots.every(before=>{const l=layers.find(item=>item.id===before.id);return !!l&&JSON.stringify(before.pixels)===JSON.stringify(Array.from(l.canvas.getContext('2d').getImageData(0,0,Math.min(4,l.canvas.width),Math.min(4,l.canvas.height)).data))});
    top.feather=previous;refresh();
    return {unchanged,persisted:saved?.feather===20,validated:normalized?.feather===20,originalValid:validateDocument(original).version===2};
  });
  if(Object.values(featherQA).some(v=>v!==true))throw Error('Phase 3 feather isolation/persistence regression: '+JSON.stringify(featherQA));
  // Phase 3: PNG export must encode the rendered document dimensions.
  const pngQA=await page.evaluate(()=>{
    const output=document.getElementById('canvas');
    const url=output.toDataURL('image/png');
    const raw=atob(url.split(',')[1]);
    const bytes=Uint8Array.from(raw.slice(0,24),ch=>ch.charCodeAt(0));
    const signature=[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v);
    const view=new DataView(bytes.buffer);
    return {signature,mime:url.startsWith('data:image/png;base64,'),width:view.getUint32(16)===output.width,height:view.getUint32(20)===output.height};
  });
  if(Object.values(pngQA).some(v=>v!==true))throw Error('Phase 3 PNG export regression: '+JSON.stringify(pngQA));
  // Verify the user-facing PNG export action, not just canvas encoding.
  const pngDownload=page.waitForEvent('download');
  await page.locator('#save').click();
  const download=await pngDownload;
  const filename=download.suggestedFilename();
  if(!filename.toLowerCase().endsWith('.png'))throw Error('PNG export download filename invalid: '+filename);
  const exportFailure=await download.failure();
  if(exportFailure)throw Error('PNG export download failed: '+exportFailure);
  // Phase 4: each supported blend mode must render and survive document validation.
  const blendQA=await page.evaluate(()=>{
    const modes=['source-over','multiply','screen','overlay','darken','lighten','color-dodge','color-burn','hard-light','soft-light','difference','exclusion','hue','saturation','color','luminosity'];
    const layer=active();
    if(!layer)return {error:'No active layer'};
    const original=layer.blendMode;
    const results=[];
    try{
      for(let i=0;i<modes.length;i++){
        layer.blendMode=i;
        render(false);
        const saved=capture();
        const accepted=validateDocument(saved);
        const probe=document.createElement('canvas');probe.width=probe.height=1;
        const p=probe.getContext('2d');
        p.fillStyle='rgb(60,120,180)';p.fillRect(0,0,1,1);
        p.globalCompositeOperation=modes[i];
        const supported=p.globalCompositeOperation===modes[i];
        p.fillStyle='rgb(200,80,40)';p.fillRect(0,0,1,1);
        const pixel=[...p.getImageData(0,0,1,1).data];
        results.push({mode:modes[i],accepted:accepted.version===2&&saved.layers.some(l=>l.id===layer.id&&l.blendMode===i),supported,pixelValid:pixel.every(Number.isFinite)&&pixel[3]===255,composited:pixel.slice(0,3).some((v,j)=>v!==[60,120,180][j]),uiRange:document.getElementById('blendMode').max==='15',label:(refresh(),document.getElementById('blendModeval').textContent===modes[i].split('-').map(w=>w[0].toUpperCase()+w.slice(1)).join(' ').replace('Source Over','Normal'))});
      }
    }finally{layer.blendMode=original;render(false)}
    return results;
  });
  if(!Array.isArray(blendQA)||blendQA.length!==16||blendQA.some(v=>!v.accepted||!v.supported||!v.pixelValid||!v.composited||!v.uiRange||!v.label))throw Error('Phase 4 blend mode regression: '+JSON.stringify(blendQA));
  const resetQA=await page.evaluate(()=>{
    const l=active();if(!l)return {error:'No active layer'};
    const old=l.blendMode,oldLocked=l.locked;
    try{
      l.locked=false;l.blendMode=2;refresh();
      document.getElementById('resetBlendMode').click();
      const reset=l.blendMode===0;
      l.blendMode=3;l.locked=true;refresh();
      document.getElementById('resetBlendMode').click();
      return {reset,lockedPreserved:l.blendMode===3};
    }finally{l.locked=oldLocked;l.blendMode=old;refresh()}
  });
  if(!resetQA.reset||!resetQA.lockedPreserved)throw Error('Blend reset regression: '+JSON.stringify(resetQA));
  const selectorQA=await page.evaluate(()=>{
    const l=active();if(!l)return {error:'No active layer'};
    const old=l.blendMode,locked=l.locked;
    try{
      l.locked=false;refresh();
      const el=document.getElementById('blendModeSelect');
      const count=el.options.length;
      el.value='9';el.dispatchEvent(new Event('change',{bubbles:true}));
      const selected=l.blendMode===9&&document.getElementById('blendMode').value==='9';
      l.locked=true;refresh();
      el.value='4';el.dispatchEvent(new Event('change',{bubbles:true}));
      return {count,selected,lockedPreserved:l.blendMode===9};
    }finally{l.locked=locked;l.blendMode=old;refresh()}
  });
  if(selectorQA.count!==16||!selectorQA.selected||!selectorQA.lockedPreserved)throw Error('Blend selector regression: '+JSON.stringify(selectorQA));
  const keyboardQA=await page.evaluate(()=>{
    const l=active();if(!l)return {error:'No active layer'};
    const old=l.blendMode,locked=l.locked;
    try{
      l.locked=false;l.blendMode=4;refresh();
      const el=document.getElementById('blendModeSelect');
      el.dispatchEvent(new KeyboardEvent('keydown',{key:'End',bubbles:true,cancelable:true}));
      const end=l.blendMode===15;
      el.dispatchEvent(new KeyboardEvent('keydown',{key:'Home',bubbles:true,cancelable:true}));
      const home=l.blendMode===0;
      l.locked=true;l.blendMode=5;refresh();
      el.dispatchEvent(new KeyboardEvent('keydown',{key:'End',bubbles:true,cancelable:true}));
      return {end,home,lockedPreserved:l.blendMode===5};
    }finally{l.locked=locked;l.blendMode=old;refresh()}
  });
  if(!keyboardQA.end||!keyboardQA.home||!keyboardQA.lockedPreserved)throw Error('Blend keyboard regression: '+JSON.stringify(keyboardQA));
  const maskToggleQA=await page.evaluate(()=>{
    const l=active();if(!l)return {error:'No active layer'};
    const old=l.opacityMaskEnabled,locked=l.locked;
    try{
      l.locked=false;l.opacityMaskEnabled=true;refresh();
      document.getElementById('toggleOpacityMask').click();
      const disabled=l.opacityMaskEnabled===false&&document.getElementById('toggleOpacityMask').getAttribute('aria-pressed')==='false';
      const persisted=capture().layers.find(x=>x.id===l.id).opacityMaskEnabled===false;
      l.locked=true;document.getElementById('toggleOpacityMask').click();
      return {disabled,persisted,lockedPreserved:l.opacityMaskEnabled===false};
    }finally{l.locked=locked;l.opacityMaskEnabled=old;refresh()}
  });
  if(!maskToggleQA.disabled||!maskToggleQA.persisted||!maskToggleQA.lockedPreserved)throw Error('Mask toggle regression: '+JSON.stringify(maskToggleQA));
  const maskResetQA=await page.evaluate(()=>{
    const l=active();if(!l)return {error:'No active layer'};
    const old=l.opacityMask,oldEnabled=l.opacityMaskEnabled,locked=l.locked;
    try{
      l.locked=false;l.opacityMask=65;l.opacityMaskEnabled=false;refresh();
      document.getElementById('resetOpacityMask').click();
      const cleared=l.opacityMask===0&&l.opacityMaskEnabled===true;
      const persisted=capture().layers.find(x=>x.id===l.id).opacityMask===0;
      l.opacityMask=40;l.locked=true;refresh();
      document.getElementById('resetOpacityMask').click();
      return {cleared,persisted,lockedPreserved:l.opacityMask===40};
    }finally{l.opacityMask=old;l.opacityMaskEnabled=oldEnabled;l.locked=locked;refresh()}
  });
  if(!maskResetQA.cleared||!maskResetQA.persisted||!maskResetQA.lockedPreserved)throw Error('Mask reset regression: '+JSON.stringify(maskResetQA));
  const selectionMaskQA=await page.evaluate(()=>{
    const l=active();if(!l)return {error:'No active layer'};
    const previous=l.selectionMask,locked=l.locked,previousSelection=selection;
    try{
      l.locked=false;selection={x:l.x+12,y:l.y+15,w:40,h:35};refresh();
      document.getElementById('maskFromSelection').click();
      const created=!!l.selectionMask&&l.selectionMask.w===40&&l.selectionMask.h===35;
      const persisted=!!capture().layers.find(x=>x.id===l.id).selectionMask;
      l.locked=true;document.getElementById('removeSelectionMask').click();
      const protectedLayer=!!l.selectionMask;
      l.locked=false;document.getElementById('removeSelectionMask').click();
      return {created,persisted,protectedLayer,removed:!l.selectionMask};
    }finally{l.selectionMask=previous;l.locked=locked;selection=previousSelection;refresh()}
  });
  if(Object.values(selectionMaskQA).some(v=>v!==true))throw Error('Selection mask regression: '+JSON.stringify(selectionMaskQA));
  const invertMaskQA=await page.evaluate(()=>{
    const l=active();if(!l)return {error:'No active layer'};
    const previous=l.selectionMask,locked=l.locked;
    try{
      l.locked=false;l.selectionMask={x:5,y:5,w:20,h:20};refresh();
      document.getElementById('invertSelectionMask').click();
      const inverted=l.selectionMask.inverted===true;
      const persisted=capture().layers.find(x=>x.id===l.id).selectionMask.inverted===true;
      l.locked=true;document.getElementById('invertSelectionMask').click();
      const protectedLayer=l.selectionMask.inverted===true;
      l.locked=false;document.getElementById('invertSelectionMask').click();
      return {inverted,persisted,protectedLayer,reversible:l.selectionMask.inverted===false};
    }finally{l.selectionMask=previous;l.locked=locked;refresh()}
  });
  if(Object.values(invertMaskQA).some(v=>v!==true))throw Error('Invert selection mask regression: '+JSON.stringify(invertMaskQA));
  const selectionMaskFeatherQA=await page.evaluate(()=>{
    const l=active();if(!l)return {error:'No active layer'};
    const old=l.selectionMask,locked=l.locked;
    try{
      l.locked=false;l.selectionMask={x:10,y:10,w:40,h:40,feather:0};refresh();
      const el=document.getElementById('selectionMaskFeather');
      el.value='12';el.dispatchEvent(new Event('input',{bubbles:true}));
      const changed=l.selectionMask.feather===12;
      const persisted=capture().layers.find(x=>x.id===l.id).selectionMask.feather===12;
      l.locked=true;el.value='25';el.dispatchEvent(new Event('input',{bubbles:true}));
      return {changed,persisted,lockedPreserved:l.selectionMask.feather===12};
    }finally{l.selectionMask=old;l.locked=locked;refresh()}
  });
  if(Object.values(selectionMaskFeatherQA).some(v=>v!==true))throw Error('Mask feather regression: '+JSON.stringify(selectionMaskFeatherQA));
  const maskBatchQA=await page.evaluate(()=>{
    const l=active();if(!l)return {error:'no layer'};
    const old=l.selectionMask,locked=l.locked;
    try{
      l.locked=false;l.selectionMask={x:20,y:20,w:60,h:60,feather:12};refresh();
      document.getElementById('toggleSelectionMask').click();
      const disabled=l.selectionMask.enabled===false;
      document.getElementById('toggleSelectionMask').click();
      const enabled=l.selectionMask.enabled===true;
      document.getElementById('resetSelectionFeather').click();
      const reset=l.selectionMask.feather===0;
      document.getElementById('expandSelectionMask').click();
      const expanded=l.selectionMask.x===15&&l.selectionMask.w===70;
      document.getElementById('contractSelectionMask').click();
      const contracted=l.selectionMask.x===20&&l.selectionMask.w===60;
      const saved=capture().layers.find(x=>x.id===l.id).selectionMask.enabled===true;
      l.locked=true;document.getElementById('expandSelectionMask').click();
      const lockProtected=l.selectionMask.w===60;
      return {disabled,enabled,reset,expanded,contracted,saved,lockProtected};
    }finally{l.selectionMask=old;l.locked=locked;refresh()}
  });
  if(Object.values(maskBatchQA).some(v=>v!==true))throw Error('Mask batch regression: '+JSON.stringify(maskBatchQA));
  const clippingMaskQA=await page.evaluate(()=>{
    const original=capture();
    try{
      const below=active();if(!below)return {error:'No layer'};
      const top=layer('Clip QA');layers.push(top);selected=top.id;refresh();
      document.getElementById('toggleClippingMask').click();
      const enabled=top.clipToBelow===true;
      const saved=capture().layers.find(x=>x.id===top.id).clipToBelow===true;
      top.locked=true;document.getElementById('toggleClippingMask').click();
      const locked=top.clipToBelow===true;
      top.locked=false;document.getElementById('toggleClippingMask').click();
      return {enabled,saved,locked,reversible:top.clipToBelow===false};
    }finally{restore(original)}
  });
  if(Object.values(clippingMaskQA).some(v=>v!==true))throw Error('Clipping mask regression: '+JSON.stringify(clippingMaskQA));
  // Phase 5: exercise real raster UI, selection dimensions, reversible filter and restore.
  const rasterQA=await page.evaluate(()=>{
    const l=window.eval('active()'),panel=document.getElementById('proRasterAction');
    if(!l||!panel)return {error:'Missing raster controls'};
    const c=l.canvas.getContext('2d'),before=c.getImageData(0,0,1,1).data[0];
    const original=window.eval('capture()');
    panel.value='smartFilter';
    document.getElementById('proRasterRadius').value='30';
    document.getElementById('proRasterApply').click();
    const saved=window.eval('capture()').layers.find(x=>x.id===l.id).proFilterOriginal;
    const after=c.getImageData(0,0,1,1).data[0];
    document.getElementById('proRasterResetFilter').click();
    const restored=c.getImageData(0,0,1,1).data[0];
    const reset=window.eval('capture()').layers.find(x=>x.id===l.id).proFilterOriginal;
    window.eval('restore')(original);
    return {saved:typeof saved==='string'&&saved.startsWith('data:image/png;base64,'),changed:after!==before,restored:restored===before,reset:reset===undefined};
  });
  if(Object.values(rasterQA).some(v=>v!==true))throw Error('Raster UI regression: '+JSON.stringify(rasterQA));
  if(errors.length)throw Error(errors.join('; '));
  console.log(engine,mobile?'mobile':'desktop',result);
  await context.close();
 }
}finally{if(browser)await browser.close();server.kill()}
