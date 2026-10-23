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

const edgeFill=p.removeObject(input,{x:0,y:0,width:3,height:3});
assert.equal(edgeFill.data.length,input.data.length,'border touching fill must be safe');
assert.deepEqual(Array.from(edgeFill.data.slice((7*8+7)*4,(7*8+7)*4+4)),original.slice((7*8+7)*4,(7*8+7)*4+4),'pixels outside fill must be preserved');
const allFill=p.removeObject(input,{x:0,y:0,width:8,height:8});
assert.equal(allFill.data.length,input.data.length,'full-canvas fill must not throw');

const checker=new ImageData(new Uint8ClampedArray(12*12*4),12,12);
for(let y=0;y<12;y++)for(let x=0;x<12;x++){const k=(y*12+x)*4;checker.data[k]=(x<6?20:220);checker.data[k+1]=70;checker.data[k+2]=90;checker.data[k+3]=255}
const warped=p.perspective(checker,[{x:2,y:0},{x:11,y:0},{x:11,y:11},{x:2,y:11}]);
assert.equal(warped.data[(4*12+0)*4],20,'perspective samples the left source edge');
assert.equal(warped.data[(4*12+5)*4],220,'perspective maps output through displaced corners');
assert.deepEqual(Array.from(checker.data.slice(0,4)),[20,70,90,255],'perspective must preserve input');
const separated=p.frequencySeparation(checker,2);
assert.equal(separated.low.width,12);
assert.equal(separated.high.width,12);
assert.notDeepEqual(Array.from(separated.high.data),Array.from(checker.data),'high frequency layer should be encoded separately');
console.log('Phase 5 raster primitive tests passed');
