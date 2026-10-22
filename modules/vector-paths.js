'use strict';
window.PhotosoapVectorPaths=Object.freeze({
 distance(a,b){return Math.hypot(b.x-a.x,b.y-a.y)},
 quadratic(a,control,b,t){const u=1-t;return {x:u*u*a.x+2*u*t*control.x+t*t*b.x,y:u*u*a.y+2*u*t*control.y+t*t*b.y}},
 cubic(a,c1,c2,b,t){const u=1-t;return {x:u*u*u*a.x+3*u*u*t*c1.x+3*u*t*t*c2.x+t*t*t*b.x,y:u*u*u*a.y+3*u*u*t*c1.y+3*u*t*t*c2.y+t*t*t*b.y}}
});
