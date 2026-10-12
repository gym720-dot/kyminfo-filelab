import {useEffect,useRef,useState} from 'react';
import {cropGeometry,headerPixels} from './lib/batch';
import {paintImage} from './lib/render';
export type CropPosition={x:number;y:number};
export const centeredCrop:CropPosition={x:0.5,y:0.5};
type Props={file:File;value:CropPosition;applied:CropPosition;width:number;height:number;rotation:number;format:string;background:string;disabled:boolean;onEdit:(p:CropPosition)=>void;onApply:()=>void;onDiscard:()=>void};
export default function CropEditor(p:Props){
  const canvas=useRef<HTMLCanvasElement>(null),bitmap=useRef<ImageBitmap|null>(null),drag=useRef<{id:number;x:number;y:number;crop:CropPosition}|null>(null);
  const [size,setSize]=useState<{width:number;height:number}|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
  const valid=Number.isInteger(p.width)&&Number.isInteger(p.height)&&p.width>0&&p.height>0&&p.width<=16000&&p.height<=16000&&p.width*p.height<=32_000_000;
  useEffect(()=>{let cancelled=false;setLoading(true);setSize(null);setError('');bitmap.current?.close();bitmap.current=null;
    (async()=>{try{const pixels=headerPixels(new Uint8Array(await p.file.slice(0,1024*1024).arrayBuffer()));if(pixels!==undefined&&pixels>32_000_000)throw Error('3,200만 픽셀 이하 이미지만 미리 볼 수 있습니다.');if(!('createImageBitmap' in window))throw Error('이 브라우저는 자르기 미리보기를 지원하지 않습니다.');const b=await createImageBitmap(p.file,{imageOrientation:'from-image'});if(cancelled){b.close();return;}if(b.width*b.height>32_000_000){b.close();throw Error('이미지가 미리보기 처리 한도를 넘었습니다.');}bitmap.current=b;setSize({width:b.width,height:b.height});}catch(e){if(!cancelled)setError(e instanceof Error?e.message:'미리보기를 읽지 못했습니다.');}finally{if(!cancelled)setLoading(false);}})();
    return()=>{cancelled=true;bitmap.current?.close();bitmap.current=null;};
  },[p.file]);
  const geometry=size&&valid?cropGeometry(size.width,size.height,p.width,p.height,p.rotation,p.value.x,p.value.y):null;
  useEffect(()=>{const c=canvas.current,b=bitmap.current;if(!c||!b||!valid)return;const ctx=c.getContext('2d');if(!ctx){setError('캔버스 미리보기를 만들 수 없습니다.');return;}const ratio=Math.min(1,700/p.width,420/p.height);c.width=Math.max(1,Math.round(p.width*ratio));c.height=Math.max(1,Math.round(p.height*ratio));ctx.clearRect(0,0,c.width,c.height);ctx.save();ctx.scale(c.width/p.width,c.height/p.height);paintImage(ctx,b,p.width,p.height,p.format,p.background,'cover',p.rotation,p.value.x,p.value.y);ctx.restore();},[size,valid,p.width,p.height,p.rotation,p.format,p.background,p.value.x,p.value.y]);
  const dirty=Math.abs(p.value.x-p.applied.x)>1e-7||Math.abs(p.value.y-p.applied.y)>1e-7;
  const move=(x:number,y:number)=>{if(!p.disabled)p.onEdit({x:Math.max(0,Math.min(1,x)),y:Math.max(0,Math.min(1,y))});};
  return <section className="crop-editor" aria-label="이미지 자르기 위치 미리보기">
    <h3>자르기 위치 미리보기</h3><p>이미지를 끌거나 방향키로 이동한 뒤 <strong>이 파일에 적용</strong>을 누르세요. 파일별로 설정하며 원본은 바뀌지 않습니다.</p>
    {loading&&<p role="status">원본 픽셀을 읽고 있습니다…</p>}{error&&<p role="alert" className="error-text">{error}</p>}{!valid&&<p role="status">출력 가로·세로를 각각 1~16,000px, 합계 3,200만 픽셀 이하로 입력하세요.</p>}
    {size&&valid&&!error&&<>
      <canvas ref={canvas} className="crop-canvas" tabIndex={p.disabled?-1:0} aria-label="자르기 위치 조절. 방향키로 이미지 이동, Shift와 함께 누르면 크게 이동합니다." aria-disabled={p.disabled}
        onPointerDown={e=>{if(p.disabled||!geometry)return;drag.current={id:e.pointerId,x:e.clientX,y:e.clientY,crop:{...p.value}};e.currentTarget.setPointerCapture(e.pointerId);e.currentTarget.focus();}}
        onPointerMove={e=>{const start=drag.current;if(p.disabled||!start||start.id!==e.pointerId||!geometry)return;const r=e.currentTarget.getBoundingClientRect();const dx=(e.clientX-start.x)*p.width/r.width,dy=(e.clientY-start.y)*p.height/r.height;move(geometry.overflowX?start.crop.x-dx/geometry.overflowX:p.value.x,geometry.overflowY?start.crop.y-dy/geometry.overflowY:p.value.y);}}
        onPointerUp={e=>{drag.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}}
        onPointerCancel={()=>{drag.current=null;}} onLostPointerCapture={()=>{drag.current=null;}}
        onKeyDown={e=>{if(p.disabled||!geometry||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const n=e.shiftKey ? 0.1 : 0.01;move(p.value.x+(geometry.overflowX?(e.key==='ArrowLeft'?n:e.key==='ArrowRight'?-n:0):0),p.value.y+(geometry.overflowY?(e.key==='ArrowUp'?n:e.key==='ArrowDown'?-n:0):0));}}/>
      <p className="small-hint">출력 {p.width.toLocaleString()}×{p.height.toLocaleString()}px · 회전 후 원본 {geometry!.rw}×{geometry!.rh}px에서 약 {Math.round(geometry!.sourceWidth)}×{Math.round(geometry!.sourceHeight)}px 선택 · 화면은 축소 미리보기입니다. 인코딩 화질·최종 용량은 실제 처리 결과에서 확인하세요.</p>
      <div className="options-grid"><label>가로 위치 {Math.round(p.value.x*100)}% (왼쪽→오른쪽)<input type="range" min="0" max="100" step="1" value={p.value.x*100} disabled={p.disabled||!geometry!.overflowX} onChange={e=>move(Number(e.target.value)/100,p.value.y)}/></label><label>세로 위치 {Math.round(p.value.y*100)}% (위→아래)<input type="range" min="0" max="100" step="1" value={p.value.y*100} disabled={p.disabled||!geometry!.overflowY} onChange={e=>move(p.value.x,Number(e.target.value)/100)}/></label></div>
      <div className="action-row"><button type="button" className="subtle-button" disabled={p.disabled} onClick={()=>move(.5,.5)}>가운데로</button><button type="button" className="primary-button" disabled={p.disabled||!dirty} onClick={p.onApply}>이 파일에 적용</button><button type="button" className="subtle-button" disabled={p.disabled||!dirty} onClick={p.onDiscard}>변경 취소</button><span role="status">{dirty?'적용 전 미리보기 · 아직 처리 설정에 반영되지 않았습니다.':'이 파일의 자르기 위치가 적용되어 있습니다.'}</span></div>
    </>}
  </section>;
}

