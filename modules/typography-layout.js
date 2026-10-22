'use strict';
window.PhotosoapTypographyLayout=Object.freeze({
 lineHeight(fontSize,multiplier=1.2){return Math.max(1,fontSize)*Math.max(.5,multiplier)},
 wrap(ctx,text,maxWidth){if(!ctx||!Number.isFinite(maxWidth)||maxWidth<=0)return [String(text??'')];const lines=[];for(const paragraph of String(text??'').split('\n')){let line='';for(const word of paragraph.split(/\s+/)){const next=line?line+' '+word:word;if(line&&ctx.measureText(next).width>maxWidth){lines.push(line);line=word}else line=next}lines.push(line)}return lines}
});
