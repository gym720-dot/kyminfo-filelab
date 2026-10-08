import JSZip from 'jszip';
import {fileSignature, resultName} from './common';

export interface ExcelPart {name:string; bytes:number; group:string}
export interface ExcelReport {sheets:string[]; parts:ExcelPart[]; totalUnpacked:number; dominant:string}
export interface ExcelOptimized {blob:Blob; name:string; before:number; after:number; checked:number}
const MAX_FILE = 20 * 1024 * 1024;
const MAX_UNPACKED = 120 * 1024 * 1024;
const MAX_ENTRIES = 2000;

function u16(v:DataView, p:number) {return v.getUint16(p,true);}
function u32(v:DataView, p:number) {return v.getUint32(p,true);}

// Read the ZIP central directory before inflating any entry. ZIP64 and multi-disk
// files are intentionally unsupported so size limits cannot silently be bypassed.
async function limits(file:File):Promise<void> {
  if (file.size > MAX_FILE) throw new Error('XLSX 파일은 20MB 이하만 처리합니다.');
  if (await fileSignature(file) !== 'zip') throw new Error('표준 XLSX ZIP 파일이 아닙니다.');
  const tailLength = Math.min(file.size, 65557);
  const tail = new Uint8Array(await file.slice(file.size-tailLength).arrayBuffer());
  const tailView = new DataView(tail.buffer);
  let eocd=-1;
  for(let i=tail.length-22;i>=0;i--) if(u32(tailView,i)===0x06054b50){eocd=i;break;}
  if(eocd<0) throw new Error('ZIP 끝 정보를 찾지 못했습니다.');
  const entries=u16(tailView,eocd+10);
  const dirSize=u32(tailView,eocd+12), dirOffset=u32(tailView,eocd+16);
  if(entries===0xffff || dirSize===0xffffffff || dirOffset===0xffffffff) throw new Error('ZIP64 형식은 지원하지 않습니다.');
  if(entries<3 || entries>MAX_ENTRIES) throw new Error('XLSX 내부 파일 수가 허용 범위를 벗어났습니다.');
  if(dirOffset+dirSize>file.size) throw new Error('ZIP 구조가 손상되었습니다.');
  const central=new DataView(await file.slice(dirOffset,dirOffset+dirSize).arrayBuffer());
  let pos=0, total=0;
  for(let i=0;i<entries;i++) {
    if(pos+46>central.byteLength || u32(central,pos)!==0x02014b50) throw new Error('ZIP 목록이 손상되었습니다.');
    const flags=u16(central,pos+8), method=u16(central,pos+10);
    const compressed=u32(central,pos+20), unpacked=u32(central,pos+24);
    const nameLength=u16(central,pos+28), extra=u16(central,pos+30), comment=u16(central,pos+32);
    if(flags&1) throw new Error('암호화된 XLSX는 지원하지 않습니다.');
    if(method!==0 && method!==8) throw new Error('지원하지 않는 ZIP 압축 방식입니다.');
    if(compressed===0xffffffff || unpacked===0xffffffff) throw new Error('ZIP64 항목은 지원하지 않습니다.');
    if(unpacked>MAX_UNPACKED || (compressed>0 && unpacked/compressed>500)) throw new Error('과도한 압축률 또는 크기의 내부 파일이 있습니다.');
    total+=unpacked;
    if(total>MAX_UNPACKED) throw new Error('압축 해제 크기가 120MB를 넘습니다.');
    pos+=46+nameLength+extra+comment;
  }
  if(pos>central.byteLength) throw new Error('ZIP 목록 길이가 올바르지 않습니다.');
}

async function load(file:File):Promise<JSZip> {
  if(!/\.xlsx$/i.test(file.name)) throw new Error('현재는 .xlsx 파일만 지원합니다.');
  await limits(file);
  let zip:JSZip;
  try {zip=await JSZip.loadAsync(file,{checkCRC32:true,createFolders:false});}
  catch {throw new Error('XLSX ZIP 구조나 CRC 검증에 실패했습니다. 암호화·손상 파일은 지원하지 않습니다.');}
  const names=Object.keys(zip.files);
  if(names.some(n=>n.includes('..') || n.startsWith('/') || n.includes('\\'))) throw new Error('안전하지 않은 ZIP 경로가 있습니다.');
  if(!zip.file('[Content_Types].xml') || !zip.file('xl/workbook.xml') || !zip.file('_rels/.rels')) throw new Error('필수 XLSX 구성요소가 없습니다.');
  if(names.some(n=>/vbaProject|_xmlsignatures|digitalSignature/i.test(n))) throw new Error('매크로 또는 전자서명 구성요소가 있어 처리하지 않습니다.');
  return zip;
}

function group(name:string):string {
  if(/^xl\/media\//.test(name)) return '이미지·미디어';
  if(/^xl\/worksheets\//.test(name)) return '워크시트';
  if(/^xl\/styles/.test(name)) return '스타일';
  if(/^xl\/sharedStrings/.test(name)) return '공유 문자열';
  if(/^xl\/charts\//.test(name)) return '차트';
  if(/^xl\//.test(name)) return '기타 엑셀 구성';
  return '기타 패키지 구성';
}

export async function analyzeExcel(file:File):Promise<ExcelReport> {
  const zip=await load(file);
  const parts:ExcelPart[]=[];
  let total=0;
  for(const [name,entry] of Object.entries(zip.files)) {
    if(entry.dir) continue;
    const bytes=(await entry.async('uint8array')).byteLength;
    total+=bytes;
    if(total>MAX_UNPACKED) throw new Error('압축 해제 크기가 120MB를 넘습니다.');
    parts.push({name,bytes,group:group(name)});
  }
  const workbook=await zip.file('xl/workbook.xml')!.async('string');
  if(workbook.length>2_000_000) throw new Error('통합 문서 정보가 너무 큽니다.');
  const xml=new DOMParser().parseFromString(workbook,'application/xml');
  if(xml.querySelector('parsererror')) throw new Error('통합 문서 XML을 읽지 못했습니다.');
  const sheets=Array.from(xml.getElementsByTagName('sheet')).map(el=>el.getAttribute('name')||'이름 없음');
  const groups=new Map<string,number>();
  for(const p of parts) groups.set(p.group,(groups.get(p.group)||0)+p.bytes);
  const dominant=[...groups].sort((a,b)=>b[1]-a[1])[0]?.[0]||'확인 불가';
  return {sheets,parts:parts.sort((a,b)=>b.bytes-a.bytes),totalUnpacked:total,dominant};
}

// JSZip reuses already-compressed input entries during generateAsync. Therefore
// a fresh archive is assembled from uncompressed bytes, then every entry is
// compared byte-for-byte with the original before offering a download.
export async function optimizeExcel(file:File, signal?:AbortSignal, onProgress?:(p:number)=>void):Promise<ExcelOptimized> {
  const source=await load(file);
  const names=Object.keys(source.files).filter(n=>!source.files[n].dir);
  const fresh=new JSZip();
  let checked=0;
  for(const name of names) {
    if(signal?.aborted) throw new Error('작업이 취소되었습니다.');
    const bytes=await source.files[name].async('uint8array');
    fresh.file(name,bytes,{binary:true,compression:'DEFLATE',compressionOptions:{level:9},createFolders:false});
    checked++;
    onProgress?.(Math.round(checked/names.length*45));
  }
  if(signal?.aborted) throw new Error('작업이 취소되었습니다.');
  const output=await fresh.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:9},platform:'DOS'},meta=>onProgress?.(45+Math.round(meta.percent*.25)));
  if(output.size>=file.size) throw new Error('이미 효율적으로 압축되어 추가 용량 감소가 어렵습니다. 원본을 유지해 주세요.');
  const verified=await JSZip.loadAsync(output,{checkCRC32:true,createFolders:false});
  const resultNames=Object.keys(verified.files).filter(n=>!verified.files[n].dir);
  if(resultNames.length!==names.length || names.some(n=>!verified.file(n))) throw new Error('내부 항목 수 또는 이름이 일치하지 않아 결과를 제공하지 않습니다.');
  checked=0;
  for(const name of names) {
    if(signal?.aborted) throw new Error('작업이 취소되었습니다.');
    const [a,b]=await Promise.all([source.files[name].async('uint8array'),verified.files[name].async('uint8array')]);
    if(a.length!==b.length || a.some((byte,i)=>byte!==b[i])) throw new Error('내부 항목의 바이트가 달라 결과를 제공하지 않습니다.');
    checked++;
    onProgress?.(70+Math.round(checked/names.length*30));
  }
  return {blob:output,name:resultName(file.name,'-키미파일랩','xlsx'),before:file.size,after:output.size,checked};
}
