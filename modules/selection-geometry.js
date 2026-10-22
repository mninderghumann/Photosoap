'use strict';
window.PhotosoapSelectionGeometry=Object.freeze({
 normalize(a,b){const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y);return {x,y,w:Math.abs(b.x-a.x),h:Math.abs(b.y-a.y)}},
 intersect(a,b){const x=Math.max(a.x,b.x),y=Math.max(a.y,b.y),r=Math.min(a.x+a.w,b.x+b.w),t=Math.min(a.y+a.h,b.y+b.h);return {x,y,w:Math.max(0,r-x),h:Math.max(0,t-y)}},
 contains(r,p){return p.x>=r.x&&p.y>=r.y&&p.x<r.x+r.w&&p.y<r.y+r.h}
});
