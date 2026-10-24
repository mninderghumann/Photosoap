'use strict';
// Non-destructive raster preview. All effects use the original source alpha as their mask.
window.PhotosoapLayerStyles={
 apply(source,styles){
  const out=document.createElement('canvas');out.width=source.width;out.height=source.height;
  const ctx=out.getContext('2d',{willReadFrequently:true});ctx.drawImage(source,0,0);
  const w=out.width,h=out.height;if(!w||!h)return out;
  const original=ctx.getImageData(0,0,w,h).data;
  const alpha=(x,y)=>x<0||y<0||x>=w||y>=h?0:original[(y*w+x)*4+3]/255;
  const rgb=hex=>{const m=/^#([\da-f]{6})$/i.exec(hex||'');return m?[0,2,4].map(i=>parseInt(m[1].slice(i,i+2),16)):[118,84,221]};
  for(const st of styles||[]){
   if(!st||st.enabled===false)continue;
   const {kind}=st,first=rgb(st.color),second=rgb(st.second||'#ffcc44');
   const size=Math.max(1,Math.min(100,Math.round(Number(st.size)||8)));
   const strength=Math.max(0,Math.min(1,Number(st.strength??.7)));
   if(!strength)continue;
   const image=ctx.getImageData(0,0,w,h),p=image.data;
   for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const i=(y*w+x)*4,mask=alpha(x,y);
    if(!mask&&kind!=='outerGlow')continue;
    const left=alpha(x-size,y),right=alpha(x+size,y),top=alpha(x,y-size),bottom=alpha(x,y+size);
    let amount=strength*mask,col=first;
    if(kind==='gradient'){const t=x/Math.max(1,w-1);col=first.map((v,j)=>v*(1-t)+second[j]*t)}
    else if(kind==='pattern'){col=((Math.floor(x/size)+Math.floor(y/size))%2)?second:first}
    else if(kind==='innerShadow')amount*=1-(left+top)/2;
    else if(kind==='innerGlow')amount*=1-(left+right+top+bottom)/4;
    else if(kind==='outerGlow'){
     const nearby=(alpha(x-size,y)+alpha(x+size,y)+alpha(x,y-size)+alpha(x,y+size))/4;
     amount=strength*Math.max(0,nearby-mask);
     if(amount<=0)continue;
     const oldA=p[i+3]/255,newA=oldA+amount*(1-oldA);
     for(let j=0;j<3;j++)p[i+j]=Math.round((p[i+j]*oldA+first[j]*amount*(1-oldA))/Math.max(newA,1e-6));
     p[i+3]=Math.round(newA*255);continue;
    }else if(kind==='bevel'){const v=((left+top)-(right+bottom))/2;amount*=Math.abs(v);col=v>=0?second:first}
    else if(kind==='satin')amount*=.5+.5*Math.sin((x+y)/size*Math.PI);
    else if(kind==='stroke')amount*=1-Math.min(left,right,top,bottom);
    else if(kind!=='color')continue;
    amount=Math.max(0,Math.min(1,amount));
    for(let j=0;j<3;j++)p[i+j]=Math.round(p[i+j]*(1-amount)+col[j]*amount);
   }
   ctx.putImageData(image,0,0);
  }
  return out;
 }
};
