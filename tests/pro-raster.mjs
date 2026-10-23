import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
class ImageData {constructor(data,width,height){this.data=data;this.width=width;this.height=height}}
const context={window:{},ImageData,Uint8ClampedArray,Math,Number,Array,Error};
vm.runInNewContext(readFileSync('modules/pro-raster.js','utf8'),context);
const p=context.window.PhotosoapPro;
const input=new ImageData(new Uint8ClampedArray(8*8*4),8,8);
for(let k=0;k<input.data.length;k+=4){input.data[k]=k%64;input.data[k+1]=80;input.data[k+2]=100;input.data[k+3]=255}
const original=Array.from(input.data);
const outputs=[
p.blur(input,2),p.mask(input,[{x:4,y:4}],2,1),p.refineEdge(input,2),
p.heal(input,4,4,2),p.cloneStamp(input,{x:1,y:1},{x:5,y:5},2),
p.removeObject(input,{x:2,y:2,width:2,height:2}),
p.contentAwareFill(input,{x:2,y:2,width:2,height:2}),
p.frequencySeparation(input,2).low,p.frequencySeparation(input,2).high,
p.liquify(input,{x:4,y:4},{x:1,y:1},3),
p.perspective(input,[{x:0,y:0},{x:7,y:0},{x:7,y:7},{x:0,y:7}]),
p.smartFilter(input,[{type:'brightness',amount:10}])
];
for(const [index,out] of outputs.entries()){assert.equal(out.width,8,'width '+index);assert.equal(out.height,8,'height '+index);assert.equal(out.data.length,256,'pixels '+index)}
assert.deepEqual(Array.from(input.data),original,'operations must not mutate source');
assert.notDeepEqual(Array.from(outputs[1].data),original,'mask must change pixels');
assert.throws(()=>p.perspective(input,[]),/Four corners/);
assert.throws(()=>p.smartFilter(input,[{type:'unknown'}]),/Unknown filter/);
console.log('Phase 5 raster primitive tests passed');
