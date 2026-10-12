import {drawGeometry} from './batch';
/** Shared by the crop preview and downloaded image, with identical crop/rotation maths. */
export function paintImage(ctx:CanvasRenderingContext2D,source:CanvasImageSource & {width:number;height:number},width:number,height:number,format:string,background:string,fit:'stretch'|'contain'|'cover'='stretch',rotation=0,cropX=0.5,cropY=0.5){
  ctx.save();ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  if(format==='jpeg'||fit==='contain'){ctx.fillStyle=/^#[0-9a-fA-F]{6}$/.test(background)?background:'#ffffff';ctx.fillRect(0,0,width,height);}
  const g=drawGeometry(source.width,source.height,width,height,fit,rotation,cropX,cropY);
  ctx.translate(g.x,g.y);ctx.rotate(g.radians);ctx.drawImage(source,-g.drawWidth/2,-g.drawHeight/2,g.drawWidth,g.drawHeight);ctx.restore();
}
