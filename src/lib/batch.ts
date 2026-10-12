import {safeName} from './common';
export function batchName(original:string,index:number,prefix:string,suffix:string,padding:number,start=1):string {
  if(!Number.isInteger(start)||start<1||start>999999||!Number.isInteger(index)||index<0)throw Error('파일 시작 번호는 1~999,999 사이 정수로 입력하세요.');
  const cleaned=original.replace(/[\\/\x00-\x1f<>:"|?*]/g,'-'),dot=cleaned.lastIndexOf('.'),ext=dot>0?cleaned.slice(dot).slice(0,10):'',stem=safeName(dot>0?cleaned.slice(0,dot):cleaned);
  const base=safeName(`${prefix}${stem}${suffix}${padding>0?'-'+String(index+start).padStart(Math.min(6,padding),'0'):''}`);
  return base.slice(0,120-ext.length)+ext;
}
export function uniqueNames(names:string[]):string[]{const used=new Set<string>();return names.map(source=>{let name=safeName(source);const dot=name.lastIndexOf('.'),stem=dot>0?name.slice(0,dot):name,ext=dot>0?name.slice(dot):'';let n=2;while(used.has(name.toLowerCase())){const suffix=`-${n++}`;name=`${stem.slice(0,120-ext.length-suffix.length)}${suffix}${ext}`;}used.add(name.toLowerCase());return name;});}
export function cropGeometry(sw:number,sh:number,width:number,height:number,rotation:number,cropX=0.5,cropY=0.5){
  if(![sw,sh,width,height].every(n=>Number.isFinite(n)&&n>0)||![0,90,180,270].includes(rotation)||![cropX,cropY].every(Number.isFinite))throw Error('이미지 크기와 자르기 위치를 확인하세요.');
  const rotated=rotation===90||rotation===270,rw=rotated?sh:sw,rh=rotated?sw:sh;
  const scale=Math.max(width/rw,height/rh),overflowX=Math.max(0,rw*scale-width),overflowY=Math.max(0,rh*scale-height);
  const x=Math.min(1,Math.max(0,cropX)),y=Math.min(1,Math.max(0,cropY));
  return {rw,rh,scale,overflowX,overflowY,cropX:x,cropY:y,left:overflowX*x/scale,top:overflowY*y/scale,sourceWidth:width/scale,sourceHeight:height/scale};
}
export function drawGeometry(sw:number,sh:number,width:number,height:number,fit:'stretch'|'contain'|'cover',rotation:number,cropX=0.5,cropY=0.5){
  if(![sw,sh,width,height].every(n=>Number.isFinite(n)&&n>0)||![0,90,180,270].includes(rotation))throw Error('이미지 크기와 회전값을 확인하세요.');
  const rotated=rotation===90||rotation===270,rw=rotated?sh:sw,rh=rotated?sw:sh;
  const scale=fit==='cover'?Math.max(width/rw,height/rh):Math.min(width/rw,height/rh);
  const crop=fit==='cover'?cropGeometry(sw,sh,width,height,rotation,cropX,cropY):null;
  return {x:width/2+(crop?(0.5-crop.cropX)*crop.overflowX:0),y:height/2+(crop?(0.5-crop.cropY)*crop.overflowY:0),radians:rotation*Math.PI/180,drawWidth:fit==='stretch'?(rotated?height:width):sw*scale,drawHeight:fit==='stretch'?(rotated?width:height):sh*scale};
}
// Header-only estimate avoids allocating oversized decoded bitmaps where dimensions are present.
export function headerPixels(b:Uint8Array):number|undefined {
  const u32=(n:number)=>((b[n]*2**24)+(b[n+1]<<16)+(b[n+2]<<8)+b[n+3]);
  if(b.length>=24&&b[0]===137&&b[1]===80)return u32(16)*u32(20);
  if(b[0]===255&&b[1]===216){let i=2;while(i+9<b.length){if(b[i++]!==255)break;while(b[i]===255)i++;const m=b[i++];if(m===218||m===217)break;if(m===1||(m>=208&&m<=215))continue;const len=(b[i]<<8)+b[i+1];if(len<2)break;if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(m))return ((b[i+3]<<8)+b[i+4])*((b[i+5]<<8)+b[i+6]);i+=len;}}
  if(b.length>=30&&String.fromCharCode(...b.slice(12,16))==='VP8X')return (1+b[24]+(b[25]<<8)+(b[26]<<16))*(1+b[27]+(b[28]<<8)+(b[29]<<16));
  return undefined;
}
