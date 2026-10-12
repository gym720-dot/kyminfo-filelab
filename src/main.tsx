import {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import './styles.css';
import {fileSignature,formatBytes,saveBlob,safeName} from './lib/common';
import {batchName,uniqueNames,headerPixels} from './lib/batch';
import type {ExcelReport,ExcelOptimized} from './lib/excel';
import type {ImageResult,ImageMode,ImageSettings,OutputFormat} from './lib/image';
import CropEditor,{centeredCrop,type CropPosition} from './CropEditor';

type Mode=ImageMode|'excel-analyze'|'excel-optimize';
type Result=ImageResult|ExcelOptimized;
type Row={id:string;file:File;kind?:string|null;sourceUrl?:string;resultUrl?:string;status:'대기'|'처리 중'|'완료'|'실패'|'취소';error?:string;result?:Result;report?:ExcelReport;metadata?:string[];progress?:number};
const imageModes:Mode[]=['compress','resize','convert','target','metadata'];
const isImage=(mode:Mode)=>imageModes.includes(mode);
const labels:Record<Mode,string>={compress:'이미지 압축',resize:'크기 조절',convert:'형식 변환',target:'목표 용량',metadata:'위치정보 삭제','excel-analyze':'엑셀 분석','excel-optimize':'엑셀 최적화'};
const displayFormat=(format:string)=>format==='jpeg'?'JPG':format.toUpperCase();
const initialSettings:ImageSettings={mode:'compress',format:'original',preset:'quick',quality:80,width:0,height:0,keepRatio:true,targetKB:100,allowResize:false,background:'#ffffff'};

function App({startMode,home}:{startMode:Mode;home:boolean}) {
  const [mode,setMode]=useState<Mode>(startMode);
  const [settings,setSettings]=useState<ImageSettings>({...initialSettings,mode:isImage(startMode)?startMode as ImageMode:'compress',format:startMode==='convert'||startMode==='target'?'webp':'original'});
  const [rows,setRows]=useState<Row[]>([]);
  const [notice,setNotice]=useState('');
  const [busy,setBusy]=useState(false);
  const [zipBusy,setZipBusy]=useState(false);
  const [zipProgress,setZipProgress]=useState(0);
  const [prefix,setPrefix]=useState('');const [suffix,setSuffix]=useState('');const [padding,setPadding]=useState(0);
  const [startIndex,setStartIndex]=useState(1);
  const [selectedPreview,setSelectedPreview]=useState('');
  const [cropPreviewId,setCropPreviewId]=useState('');
  const [crops,setCrops]=useState<Record<string,CropPosition>>({});
  const [cropDrafts,setCropDrafts]=useState<Record<string,CropPosition>>({});
  const working=useRef(false),adding=useRef(false);
  const [compare,setCompare]=useState(50);
  const [dragging,setDragging]=useState(false);
  const input=useRef<HTMLInputElement>(null);
  const controller=useRef<AbortController|null>(null);
  const objectUrls=useRef(new Set<string>());
  const fileCount=useRef(0);
  const dragDepth=useRef(0);
  const update=(id:string,patch:Partial<Row>)=>setRows(prev=>prev.map(r=>r.id===id?{...r,...patch}:r));
  const makeUrl=(blob:Blob)=>{const url=URL.createObjectURL(blob);objectUrls.current.add(url);return url;};
  const clear=()=>{if(adding.current||working.current)return;controller.current?.abort();setRows([]);setCrops({});setCropDrafts({});setCropPreviewId('');for(const url of objectUrls.current)URL.revokeObjectURL(url);objectUrls.current.clear();setNotice('목록을 비웠습니다.');};
  useEffect(()=>()=>{controller.current?.abort();for(const url of objectUrls.current)URL.revokeObjectURL(url);},[]);
  async function addFiles(files:File[]) {
    if(working.current||adding.current)return;
    adding.current=true;
    const accepted:Row[]=[];
    try {
    const max=isImage(mode)?50:10, perFile=isImage(mode)?30:20;
    if(rows.length+files.length>max){setNotice(`한 번에 최대 ${max}개까지 선택할 수 있습니다.`);return;}
    const totalLimit=isImage(mode)?150:80;
    if(rows.reduce((sum,row)=>sum+row.file.size,0)+files.reduce((sum,file)=>sum+file.size,0)>totalLimit*1024*1024){setNotice(`한 번에 선택한 파일의 합계는 ${totalLimit}MB 이하로 줄여 주세요.`);return;}
    for(const file of files){
      if([...rows,...accepted].some(r=>r.file.name===file.name&&r.file.size===file.size&&r.file.lastModified===file.lastModified)){setNotice('동일 이름·크기·수정시각 파일은 중복 추가하지 않습니다.');continue;}
      const sig=await fileSignature(file);
      if(file.size>perFile*1024*1024){setNotice(`${safeName(file.name)}: ${perFile}MB 한도를 넘었습니다.`);continue;}
      if(isImage(mode)?!['jpeg','png','webp'].includes(sig||''):sig!=='zip'||!/\.xlsx$/i.test(file.name)){setNotice(`${safeName(file.name)}: 지원하지 않는 형식입니다.`);continue;}
      if(isImage(mode)){const pixels=headerPixels(new Uint8Array(await file.slice(0,1024*1024).arrayBuffer()));if(pixels!==undefined&&pixels>32_000_000){setNotice(`${safeName(file.name)}: 3,200만 픽셀 한도를 넘었습니다.`);continue;}}
      const id=`${Date.now()}-${fileCount.current++}`;
      accepted.push({id,file,kind:sig,status:'대기',sourceUrl:isImage(mode)?makeUrl(file):undefined});
    }
    setRows(prev=>[...prev,...accepted]);
    if(accepted.length) setNotice(`${accepted.length}개 파일을 추가했습니다.`);
    }catch{for(const r of accepted){if(r.sourceUrl){URL.revokeObjectURL(r.sourceUrl);objectUrls.current.delete(r.sourceUrl);}}setNotice('파일 정보를 읽지 못했습니다. 파일을 다시 선택하거나 다른 파일로 시도하세요.');}finally{adding.current=false;}
  }
  function switchMode(next:Mode) {
    if(busy||zipBusy||adding.current||working.current)return;
    clear();setMode(next);setSettings({...initialSettings,mode:isImage(next)?next as ImageMode:'compress',format:next==='convert'||next==='target'?'webp':'original'});setNotice('');
  }
  useEffect(()=>{
    const paste=(event:ClipboardEvent)=>{
      if(!isImage(mode)||!event.clipboardData?.files.length)return;
      const files=Array.from(event.clipboardData.files).filter(f=>f.type.startsWith('image/'));
      if(files.length){event.preventDefault();void addFiles(files);}
    };
    window.addEventListener('paste',paste);
    return ()=>window.removeEventListener('paste',paste);
  });
  async function run(ids?:string[]){
    if(working.current||adding.current)return;
    if(mode==='resize'&&!settings.keepRatio&&settings.fit==='cover'&&dirtyCropIds.length){setNotice('미리보기에서 바꾼 자르기 위치를 파일별로 적용하거나 변경 취소한 뒤 처리해 주세요.');return;}
    if(padding&&(!Number.isInteger(startIndex)||startIndex<1||startIndex>999999)){setNotice('파일 시작 번호는 1~999,999 사이 정수로 입력하세요.');return;}
    const pending=rows.filter(r=>(ids?ids.includes(r.id):true));
    if(!pending.length){setNotice('처리할 파일을 먼저 선택해 주세요.');return;}
    working.current=true;
    const abort=new AbortController();controller.current=abort;setBusy(true);setNotice('');
    const snapshot={...settings,mode:mode as ImageMode};
    const cropSnapshot={...crops};
    const names=pending.map(row=>plannedNames[rows.findIndex(r=>r.id===row.id)]);
    try {
    for(const row of pending){
      if(abort.signal.aborted)break;
      if(row.resultUrl){URL.revokeObjectURL(row.resultUrl);objectUrls.current.delete(row.resultUrl);}
      update(row.id,{status:'처리 중',error:undefined,progress:0,result:undefined,resultUrl:undefined,report:undefined,metadata:undefined});
      try{
        if(isImage(mode)){
          const {inspectMetadata,processImage}=await import('./lib/image');
          const metadata=mode==='metadata'?await inspectMetadata(row.file):undefined;
          const crop=cropSnapshot[row.id]||centeredCrop;
          const result=await processImage(row.file,{...snapshot,cropX:crop.x,cropY:crop.y},abort.signal);
          const name=names[pending.indexOf(row)],extension=result.name.slice(result.name.lastIndexOf('.'));
          result.name=name.replace(/\.[^.]+$/,'')+extension;
          const resultUrl=makeUrl(result.blob);
          update(row.id,{status:'완료',result,resultUrl,metadata,progress:100});
        }else{
          const {analyzeExcel,optimizeExcel}=await import('./lib/excel');
          const report=await analyzeExcel(row.file);
          update(row.id,{report,progress:mode==='excel-optimize'?35:100});
          if(mode==='excel-optimize'){
            const result=await optimizeExcel(row.file,abort.signal,p=>update(row.id,{progress:p}));
            update(row.id,{status:'완료',report,result,progress:100});
          }else update(row.id,{status:'완료',report,progress:100});
        }
      }catch(e){update(row.id,{status:abort.signal.aborted?'취소':'실패',error:abort.signal.aborted?'작업을 취소했습니다. 다시 처리할 수 있습니다.':e instanceof Error?e.message:'처리하지 못했습니다.'});}
    }
    if(abort.signal.aborted){const ids=new Set(pending.map(r=>r.id));setRows(prev=>prev.map(r=>ids.has(r.id)&&r.status==='대기'?{...r,status:'취소'}:r));setNotice('취소했습니다. 완료한 결과는 유지되며 취소한 파일은 다시 처리할 수 있습니다.');}
    }finally{working.current=false;setBusy(false);controller.current=null;}
  }
  function remove(row:Row){
    if(adding.current||working.current)return;
    if(row.sourceUrl){URL.revokeObjectURL(row.sourceUrl);objectUrls.current.delete(row.sourceUrl);}
    if(row.resultUrl){URL.revokeObjectURL(row.resultUrl);objectUrls.current.delete(row.resultUrl);}
    setRows(prev=>prev.filter(r=>r.id!==row.id));
    setCrops(prev=>{const next={...prev};delete next[row.id];return next;});
    setCropDrafts(prev=>{const next={...prev};delete next[row.id];return next;});
  }
  async function zipResults(){
    if(working.current||adding.current)return;
    const done=rows.filter(r=>r.result?.blob);
    if(!done.length){setNotice('ZIP에 넣을 처리 결과가 없습니다.');return;}
    working.current=true;setZipBusy(true);setZipProgress(0);setNotice('ZIP 파일을 생성하고 있습니다…');
    try{
      const JSZip=(await import('jszip')).default;
      const total=done.reduce((sum,row)=>sum+row.result!.blob.size,0);
      if(total>200*1024*1024) throw new Error('ZIP 총 크기가 200MB를 넘습니다.');
      const zip=new JSZip();
      const names=uniqueNames(done.map(r=>r.result!.name));
      for(const [i,row] of done.entries()){
        zip.file(names[i],row.result!.blob);
      }
      const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}},p=>setZipProgress(Math.floor(p.percent)));
      saveBlob(blob,'키미파일-결과.zip');setNotice(`${done.length}개 결과를 ZIP으로 저장했습니다.`);
    }catch(e){setNotice(e instanceof Error?e.message:'ZIP 생성에 실패했습니다. 개별 다운로드를 이용해 주세요.');}finally{working.current=false;setZipBusy(false);}
  }
  const done=rows.filter(r=>r.status==='완료'), originals=done.reduce((v,r)=>v+r.file.size,0), outputs=done.reduce((v,r)=>v+(r.result?.blob.size||r.file.size),0);
  const pngOnly=settings.format==='png'||(settings.format==='original'&&rows.length>0&&rows.every(r=>r.kind==='png'));
  const previewRows=rows.filter(r=>r.sourceUrl&&r.resultUrl);
  const firstPreview=previewRows.find(r=>r.id===selectedPreview)||previewRows[0];
  const changedDimensions=firstPreview?.result&&'width'in firstPreview.result&&(firstPreview.result.width!==firstPreview.result.sourceWidth||firstPreview.result.height!==firstPreview.result.sourceHeight);
  const cropRow=rows.find(r=>r.id===cropPreviewId)||rows[0];
  const dirtyCropIds=rows.filter(r=>{const a=crops[r.id]||centeredCrop,b=cropDrafts[r.id]||a;return Math.abs(a.x-b.x)>1e-7||Math.abs(a.y-b.y)>1e-7;}).map(r=>r.id);
  const validStart=Number.isInteger(startIndex)&&startIndex>=1&&startIndex<=999999;
  const plannedNames=uniqueNames(rows.map((row,i)=>{const format=settings.format==='original'?row.kind:settings.format,extension=format==='jpeg'?'jpg':format;return isImage(mode)?batchName(row.file.name.replace(/\.[^.]+$/,'')+'.'+extension,i,prefix,suffix,padding,validStart?startIndex:1):row.file.name;}));
  return <div className="app-shell">
    {home&&<div className="mode-tabs" role="tablist" aria-label="도구 종류"><button role="tab" aria-selected={isImage(mode)} className={isImage(mode)?'active':''} onClick={()=>switchMode('compress')}>이미지 도구</button><button role="tab" aria-selected={!isImage(mode)} className={!isImage(mode)?'active':''} onClick={()=>switchMode('excel-analyze')}>엑셀 도구</button></div>}
    <div className="upload-card">
      <div className="upload-heading"><div><span className="eyebrow">{isImage(mode)?'IMAGE WORKSPACE':'EXCEL WORKSPACE'}</span><h3>{labels[mode]}</h3><p>{isImage(mode)?'JPG · PNG · WebP':'XLSX'} · 한 파일당 최대 {isImage(mode)?'30':'20'}MB · {isImage(mode)?'최대 50개 · 합계 150MB':'최대 10개 · 합계 80MB'}</p></div><span className="privacy-pill">↗ 파일 전송 없음</span></div>
      <div className={`drop-zone${dragging?' dragging':''}`} onDragEnter={e=>{e.preventDefault();dragDepth.current++;setDragging(true);}} onDragLeave={e=>{e.preventDefault();dragDepth.current=Math.max(0,dragDepth.current-1);if(!dragDepth.current)setDragging(false);}} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();dragDepth.current=0;setDragging(false);if(!busy)void addFiles(Array.from(e.dataTransfer.files));}}><div className="drop-symbol" aria-hidden="true">＋</div><strong>파일을 끌어놓거나 선택해 주세요</strong><p>선택한 파일은 현재 브라우저에서 처리됩니다.</p><button type="button" className="primary-button" disabled={busy||zipBusy} onClick={()=>input.current?.click()}>파일 선택하기</button><input ref={input} className="sr-only" aria-label="처리할 파일 선택" type="file" accept={isImage(mode)?'image/jpeg,image/png,image/webp':'.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'} multiple onChange={e=>{if(!busy)void addFiles(Array.from(e.currentTarget.files||[]));e.currentTarget.value='';}} /></div>
      {isImage(mode)&&<p className="small-hint">클립보드 이미지는 Ctrl+V로 붙여넣을 수도 있습니다. 움직이는 WebP는 지원하지 않습니다.</p>}
    </div>
    {rows.length>0&&<div className="options-card"><fieldset disabled={busy||zipBusy} className="settings-fieldset"><legend>처리 설정</legend>
      {isImage(mode)&&<div className="options-grid">
        {mode!=='metadata'&&<label>출력 형식<select value={settings.format} onChange={e=>setSettings({...settings,format:e.target.value as OutputFormat|'original'})}><option value="original">원본 형식</option><option value="jpeg">JPG</option><option value="png">PNG</option><option value="webp">WebP</option></select></label>}
        {mode==='compress'&&!pngOnly&&<><label>압축 방식<select value={settings.preset} onChange={e=>setSettings({...settings,preset:e.target.value as ImageSettings['preset']})}><option value="quick">빠른 압축</option><option value="high">고화질</option><option value="strong">강력 압축</option><option value="custom">직접 설정</option></select></label>{settings.preset==='custom'&&<label>화질 {settings.quality}%<input type="range" min="30" max="100" value={settings.quality} onChange={e=>setSettings({...settings,quality:Number(e.target.value)})}/></label>}</>}
        {mode==='resize'&&<><label>가로(px)<input type="number" min="0" max="16000" value={settings.width||''} onChange={e=>setSettings({...settings,width:Number(e.target.value),height:settings.keepRatio?0:settings.height})}/></label><label>세로(px)<input type="number" min="0" max="16000" value={settings.height||''} onChange={e=>setSettings({...settings,height:Number(e.target.value),width:settings.keepRatio?0:settings.width})}/></label><label className="check-label"><input type="checkbox" checked={settings.keepRatio} onChange={e=>setSettings({...settings,keepRatio:e.target.checked,height:e.target.checked&&settings.width?0:settings.height})}/> 원본 비율 유지</label><p className="option-note">비율 유지 시 가로 또는 세로 한쪽만, 해제 시 두 값을 입력해 주세요.</p></>}
        {mode==='target'&&<><label>목표 용량 (KB)<input type="number" min="1" max="30720" value={settings.targetKB} onChange={e=>setSettings({...settings,targetKB:Number(e.target.value)})}/></label><div className="preset-row">{[50,100,200,300,500,1024].map(n=><button type="button" key={n} className={settings.targetKB===n?'selected':''} onClick={()=>setSettings({...settings,targetKB:n})}>{n===1024?'1MB':n+'KB'}</button>)}</div><label className="check-label"><input type="checkbox" checked={settings.allowResize} onChange={e=>setSettings({...settings,allowResize:e.target.checked})}/> 필요하면 해상도 축소 허용</label></>}
        {mode==='resize'&&<><label>맞춤 방식<select value={settings.fit||'stretch'} onChange={e=>setSettings({...settings,fit:e.target.value as ImageSettings['fit'],keepRatio:e.target.value==='cover'?false:settings.keepRatio})}><option value="stretch">입력 크기대로 (비율 유지 권장)</option><option value="contain">전체 보존 + 배경 여백</option><option value="cover">자르기 위치를 골라 채우기</option></select></label><label>회전<select value={settings.rotation||0} onChange={e=>setSettings({...settings,rotation:Number(e.target.value) as ImageSettings['rotation']})}><option value="0">회전 없음</option><option value="90">90도</option><option value="180">180도</option><option value="270">270도</option></select></label><div className="preset-row">{[[1000,1000,'상품 1000×1000'],[1080,1350,'4:5'],[1080,1920,'9:16'],[1920,1080,'16:9']].map(([w,h,label])=><button type="button" key={label} onClick={()=>setSettings({...settings,width:Number(w),height:Number(h),keepRatio:false,fit:label==='상품 1000×1000'?'contain':'cover',format:label==='상품 1000×1000'?'jpeg':settings.format,background:'#ffffff'})}>{label}</button>)}</div><p className="option-note">일반 이미지 규격입니다. 특정 쇼핑몰의 등록 규정 충족을 보장하지 않습니다. 자르기는 가장자리 내용이 사라질 수 있습니다. 아래 미리보기에서 파일별 위치를 확인하세요.</p></>}
        {(settings.format==='jpeg'||settings.fit==='contain')&&<label>투명 부분·여백 배경색<input type="color" value={settings.background} onChange={e=>setSettings({...settings,background:e.target.value})}/></label>}
        {settings.format==='jpeg'&&<p className="option-note">JPG로 저장하면 투명 부분은 선택한 배경색으로 채워집니다.</p>}
        {pngOnly&&mode==='compress'&&<p className="option-note">PNG에는 화질 설정이 적용되지 않습니다. 더 작은 파일이 필요하면 WebP 변환 또는 크기 축소를 선택하세요.</p>}
        {mode==='metadata'&&<p className="option-note">재인코딩 후 검출 가능한 EXIF·GPS를 다시 검사합니다. 색상 프로파일이나 일부 비표준 정보는 별도로 확인해 주세요.</p>}
      </div>}
      {!isImage(mode)&&<p className="option-note">{mode==='excel-analyze'?'분석은 읽기 전용이며 원본을 변경하지 않습니다.':'내부 항목의 바이트를 비교하고 실제로 작아진 경우에만 결과를 제공합니다. 전자서명·매크로·암호화 파일은 제외합니다.'}</p>}
      {isImage(mode)&&<div className="options-grid"><label>파일명 접두사<input value={prefix} maxLength={30} onChange={e=>setPrefix(e.target.value)}/></label><label>파일명 접미사<input value={suffix} maxLength={30} onChange={e=>setSuffix(e.target.value)}/></label><label>일련번호 자리수<select value={padding} onChange={e=>setPadding(Number(e.target.value))}><option value={0}>추가 안 함</option><option value={2}>01</option><option value={3}>001</option><option value={4}>0001</option></select></label><label>시작 번호<input type="number" min="1" max="999999" step="1" value={startIndex} disabled={!padding} onChange={e=>setStartIndex(Number(e.target.value))}/></label><p className="option-note">파일명은 처리 시 적용됩니다. 같은 이름은 ZIP에서 구분하며 원본 파일은 변경하지 않습니다. 재시도해도 목록에서의 번호를 유지합니다.</p>{padding>0&&!validStart&&<p role="alert">시작 번호는 1~999,999 사이 정수로 입력하세요.</p>}<details className="planned-names"><summary>새 설정으로 처리할 파일명 미리보기 ({rows.length}개)</summary><ol>{plannedNames.map((name,i)=><li key={rows[i].id}>{name}</li>)}</ol><p className="small-hint">현재 다운로드 파일명은 최근 처리 결과 기준입니다. 새 이름은 다시 처리한 뒤 적용됩니다.</p></details></div>}
      {mode==='resize'&&!settings.keepRatio&&settings.fit==='cover'&&cropRow&&<div className="crop-workspace"><label>자르기 미리보기 파일<select value={cropRow.id} onChange={e=>setCropPreviewId(e.target.value)}>{rows.map(r=><option key={r.id} value={r.id}>{r.file.name}</option>)}</select></label>{busy||zipBusy?<p>처리 중에는 미리보기 메모리를 해제합니다.</p>:<CropEditor file={cropRow.file} value={cropDrafts[cropRow.id]||crops[cropRow.id]||centeredCrop} applied={crops[cropRow.id]||centeredCrop} width={settings.width} height={settings.height} rotation={settings.rotation||0} format={settings.format==='original'?(cropRow.kind||'png'):settings.format} background={settings.background} disabled={busy||zipBusy} onEdit={position=>setCropDrafts(prev=>({...prev,[cropRow.id]:position}))} onApply={()=>{const position=cropDrafts[cropRow.id]||crops[cropRow.id]||centeredCrop;setCrops(prev=>({...prev,[cropRow.id]:{...position}}));setNotice('이 파일의 자르기 위치를 적용했습니다. 파일 처리하기로 결과를 생성하세요.');}} onDiscard={()=>setCropDrafts(prev=>{const next={...prev};delete next[cropRow.id];return next;})}/>}<p role="status" className="small-hint">적용 전 자르기 변경 {dirtyCropIds.length}개 · 아직 적용하지 않은 다른 파일의 변경도 유지됩니다.</p>{dirtyCropIds.length>0&&<button type="button" className="subtle-button" onClick={()=>setCropDrafts({})}>모든 파일의 적용 전 변경 취소</button>}</div>}
      </fieldset><div className="action-row"><button className="primary-button" disabled={busy||zipBusy} onClick={()=>void run()}>{busy?'처리 중…':mode==='excel-analyze'?'용량 분석하기':mode==='excel-optimize'?'분석 후 안전하게 최적화':done.length?'전체 다시 처리':'파일 처리하기'}</button>{busy&&<button className="subtle-button" onClick={()=>controller.current?.abort()}>작업 취소</button>}{rows.some(r=>r.status==='실패')&&<button className="subtle-button" disabled={busy||zipBusy} onClick={()=>void run(rows.filter(r=>r.status==='실패').map(r=>r.id))}>실패한 파일만 재시도</button>}{rows.some(r=>r.status==='취소')&&<button className="subtle-button" disabled={busy||zipBusy} onClick={()=>void run(rows.filter(r=>r.status==='취소').map(r=>r.id))}>취소한 파일 이어서 처리</button>}<button className="subtle-button" disabled={busy||zipBusy} onClick={clear}>목록 비우기</button></div>
    </div>}
    {notice&&<p className="notice" role="status">{notice}</p>}
    {rows.length>0&&<p role="status" className="batch-status">전체 {rows.length}개 · 완료 {done.length} · 실패 {rows.filter(r=>r.status==='실패').length} · 처리 중 {rows.filter(r=>r.status==='처리 중').length} · 취소 {rows.filter(r=>r.status==='취소').length} · 대기 {rows.filter(r=>r.status==='대기').length}{zipBusy?` / ZIP ${zipProgress}%`:''}</p>}
    {rows.length>0&&<section className="results-section" aria-label="파일 결과">
      <div className="results-head"><h3>파일 목록 <span>{rows.length}개</span></h3>{rows.some(r=>r.result?.blob)&&<button className="subtle-button" disabled={busy||zipBusy} onClick={()=>void zipResults()}>완료 파일 ZIP 다운로드 ↓</button>}</div>
      <div className="file-list">{rows.map(row=><article className="file-row" key={row.id}>
        <div className="file-row-top">
          {row.sourceUrl?<img loading="lazy" decoding="async" src={row.sourceUrl} alt="" className="file-thumb"/>:<span className="excel-thumb" aria-hidden="true">X</span>}
          <div className="file-name"><strong title={row.file.name}>{row.file.name}</strong><span>원본 {formatBytes(row.file.size)} · {row.result&&'reached'in row.result&&row.result.reached===false?'결과 생성됨 · 목표 미달':row.status}</span></div>
          <button className="icon-button" disabled={busy||zipBusy} aria-label={`${row.file.name} 제거`} onClick={()=>remove(row)}>×</button>
        </div>
        {row.error&&<p className="file-error" role="alert">{row.error}</p>}
        {row.metadata&&<div className="metadata-list"><strong>원본에서 확인한 항목</strong>{row.metadata.map((m,i)=><span key={i}>{m}</span>)}</div>}
        {row.report&&<div className="excel-report"><strong>시트 {row.report.sheets.length}개 · 내부 압축 해제 크기 {formatBytes(row.report.totalUnpacked)}</strong><p>시트: {row.report.sheets.join(', ')||'확인 불가'}</p><p>가장 큰 구성 분류: {row.report.dominant}</p><details><summary>용량이 큰 내부 항목 보기</summary><ul>{row.report.parts.slice(0,12).map(p=><li key={p.name}><span>{p.group} · {p.name}</span><b>{formatBytes(p.bytes)}</b></li>)}</ul><small>이 크기는 압축 해제 후 크기이며 XLSX 파일 전체 크기와 합산되지 않습니다.</small></details></div>}
        {row.result&&<div className="result-line"><div><strong>{formatBytes(row.file.size)} → {formatBytes(row.result.blob.size)}</strong><small>{row.result.blob.size<=row.file.size?`${((1-row.result.blob.size/row.file.size)*100).toFixed(1)}% 감소`:`${((row.result.blob.size/row.file.size-1)*100).toFixed(1)}% 증가`}</small>{'width'in row.result&&<small className="result-spec">{row.result.sourceWidth}×{row.result.sourceHeight} {displayFormat(String(row.kind))} → {row.result.width}×{row.result.height} {displayFormat(row.result.format)}</small>}</div><div className="result-actions">{row.result.blob.size>row.file.size&&<button className="subtle-button" onClick={()=>saveBlob(row.file,row.file.name)}>원본 저장</button>}<button className="download-button" onClick={()=>saveBlob(row.result!.blob,row.result!.name)}>결과 다운로드 ↓</button></div></div>}
        {row.result&&'note'in row.result&&<p className="result-note">{row.result.note}</p>}
        {row.status==='실패'&&!busy&&<button className="text-button" onClick={()=>void run([row.id])}>다시 시도 ↗</button>}
      </article>)}</div>
    </section>}
    {firstPreview?.sourceUrl&&firstPreview.resultUrl&&<section className="preview-section"><div className="results-head"><h3>이미지 전후 비교</h3><span>{changedDimensions?'크기가 달라 나란히 표시합니다':'슬라이더를 움직여 확인하세요'}</span></div><label>비교할 파일<select value={firstPreview.id} onChange={e=>setSelectedPreview(e.target.value)}>{previewRows.map(r=><option key={r.id} value={r.id}>{r.file.name}</option>)}</select></label>{changedDimensions?<div className="preview-pair"><figure><img src={firstPreview.sourceUrl} alt="원본 미리보기"/><figcaption>원본</figcaption></figure><figure><img src={firstPreview.resultUrl} alt="처리 후 미리보기"/><figcaption>결과</figcaption></figure></div>:<><div className="compare-box"><img src={firstPreview.resultUrl} alt="처리 후 미리보기"/><img className="compare-source" style={{clipPath:`inset(0 ${100-compare}% 0 0)`}} src={firstPreview.sourceUrl} alt="원본 미리보기"/><div className="compare-divider" style={{left:`${compare}%`}}/><span className="compare-label before-label">원본</span><span className="compare-label after-label">결과</span></div><label className="compare-range">비교 위치 <input type="range" min="0" max="100" value={compare} onChange={e=>setCompare(Number(e.target.value))}/></label></>}<details><summary>100% 픽셀 크기로 비교 (가로·세로 이동 가능)</summary><div className="pixel-pair"><figure><figcaption>원본 100%</figcaption><div><img src={firstPreview.sourceUrl} alt="원본 100% 픽셀"/></div></figure><figure><figcaption>결과 100%</figcaption><div><img src={firstPreview.resultUrl} alt="결과 100% 픽셀"/></div></figure></div></details><p className="small-hint">화질 설정 수치는 품질 보존율이 아닙니다. 글자·윤곽·투명도와 색상을 결과 이미지에서 확인하세요.</p></section>}
    {done.length>0&&<div className="summary-card"><div><span>완료 파일</span><strong>{done.length}개</strong></div><div><span>원본 합계</span><strong>{formatBytes(originals)}</strong></div><div><span>결과 합계</span><strong>{formatBytes(outputs)}</strong></div><div><span>전체 차이</span><strong>{formatBytes(Math.abs(originals-outputs))} {outputs<=originals?'감소':'증가'}</strong></div></div>}
  </div>;
}

const root=document.getElementById('tool-root');
if(root){
  const mode=(root.dataset.mode||'compress') as Mode;
  createRoot(root).render(<App startMode={mode} home={location.pathname==='/'} />);
}
