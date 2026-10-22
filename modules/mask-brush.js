'use strict';
// Non-destructive mask stroke geometry. Coordinates are layer-local.
window.PhotosoapMaskBrush=Object.freeze({
 pointsBetween(a,b,spacing=2){if(!a||!b||![a.x,a.y,b.x,b.y].every(Number.isFinite))return [];const d=Math.hypot(b.x-a.x,b.y-a.y),n=Math.max(1,Math.ceil(d/Math.max(.5,spacing)));return Array.from({length:n+1},(_,i)=>({x:a.x+(b.x-a.x)*i/n,y:a.y+(b.y-a.y)*i/n}));},
 paint(ctx,points,radius,mode='hide'){if(!ctx||!Array.isArray(points)||!Number.isFinite(radius)||radius<=0)return;ctx.save();ctx.globalCompositeOperation=mode==='reveal'?'source-over':'destination-out';ctx.fillStyle='#fff';for(const p of points){if(!Number.isFinite(p.x)||!Number.isFinite(p.y))continue;ctx.beginPath();ctx.arc(p.x,p.y,radius,0,Math.PI*2);ctx.fill()}ctx.restore()}
});
