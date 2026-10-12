import ExifReader from 'exifreader';
import { fileSignature, resultName } from './common';
import {drawGeometry,headerPixels} from './batch';

export type ImageMode = 'compress' | 'resize' | 'convert' | 'target' | 'metadata';
export type OutputFormat = 'jpeg' | 'png' | 'webp';
export interface ImageSettings {
  mode: ImageMode;
  format: OutputFormat | 'original';
  preset: 'quick' | 'high' | 'strong' | 'custom';
  quality: number;
  width: number;
  height: number;
  keepRatio: boolean;
  targetKB: number;
  allowResize: boolean;
  background: string;
  fit?: 'stretch'|'contain'|'cover';
  rotation?: 0|90|180|270;
}
export interface ImageResult {
  blob: Blob;
  name: string;
  sourceWidth: number;
  sourceHeight: number;
  width: number;
  height: number;
  format: OutputFormat;
  reached?: boolean;
  note: string;
}

const mime = (format: OutputFormat) => `image/${format}`;
const ext = (format: OutputFormat) => format === 'jpeg' ? 'jpg' : format;
const qualityFor = (s: ImageSettings) => s.preset === 'high' ? 0.91 : s.preset === 'strong' ? 0.58 : s.preset === 'quick' ? 0.79 : Math.max(0.1, Math.min(1, s.quality / 100));

async function decode(file: File): Promise<ImageBitmap> {
  if (!('createImageBitmap' in window)) throw new Error('이 브라우저는 이미지 처리에 필요한 기능을 지원하지 않습니다.');
  return createImageBitmap(file, { imageOrientation: 'from-image' });
}

async function toBlob(canvas: HTMLCanvasElement, format: OutputFormat, quality: number): Promise<Blob> {
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, mime(format), quality));
  if (!blob || blob.type !== mime(format)) throw new Error('이 브라우저에서는 선택한 형식으로 저장할 수 없습니다.');
  return blob;
}

function draw(bitmap: ImageBitmap, width: number, height: number, format: OutputFormat, background: string,fit:'stretch'|'contain'|'cover'='stretch',rotation=0): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', {alpha: format !== 'jpeg'});
  if (!ctx) throw new Error('이미지 캔버스를 만들 수 없습니다.');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  if (format === 'jpeg' || fit==='contain') {
    ctx.fillStyle = /^#[0-9a-fA-F]{6}$/.test(background) ? background : '#ffffff';
    ctx.fillRect(0, 0, width, height);
  }
  const g=drawGeometry(bitmap.width,bitmap.height,width,height,fit,rotation);
  ctx.translate(g.x,g.y);ctx.rotate(g.radians);
  ctx.drawImage(bitmap,-g.drawWidth/2,-g.drawHeight/2,g.drawWidth,g.drawHeight);
  return canvas;
}

async function animatedWebp(file: File): Promise<boolean> {
  const bytes = new Uint8Array(await file.slice(0, 128).arrayBuffer());
  for (let i = 12; i < bytes.length - 4; i++) {
    if (bytes[i] === 65 && bytes[i+1] === 78 && bytes[i+2] === 73 && bytes[i+3] === 77) return true;
  }
  return bytes[12] === 86 && bytes[13] === 80 && bytes[14] === 56 && bytes[15] === 88 && !!(bytes[20] & 2);
}

export async function inspectMetadata(file: File): Promise<string[]> {
  const kind = await fileSignature(file);
  if (!kind || kind === 'zip') throw new Error('JPG, PNG, WebP 이미지만 분석할 수 있습니다.');
  try {
    const tags = await ExifReader.load(file);
    const wanted: [string,string][] = [['GPSLatitude','GPS 위도'],['GPSLongitude','GPS 경도'],['DateTimeOriginal','촬영 날짜'],['Make','카메라 제조사'],['Model','카메라 모델'],['Orientation','방향 정보'],['Software','처리 소프트웨어']];
    const rows = wanted.flatMap(([key,label]) => {
      const tag = tags[key] as {description?: string | number} | undefined;
      return tag?.description != null ? [`${label}: ${String(tag.description).slice(0,100)}`] : [];
    });
    return rows.length ? rows : ['지원 범위에서 표시할 EXIF·GPS 항목이 감지되지 않았습니다.'];
  } catch {
    return ['이 형식의 메타데이터를 읽지 못했습니다. 검출되지 않았다는 뜻은 아닙니다.'];
  }
}

export async function processImage(file: File, s: ImageSettings, signal?: AbortSignal): Promise<ImageResult> {
  const kind = await fileSignature(file);
  if (!kind || kind === 'zip') throw new Error('JPG, PNG, WebP 이미지만 처리할 수 있습니다.');
  if (file.size > 30 * 1024 * 1024) throw new Error('이미지는 한 파일당 30MB 이하만 처리합니다.');
  if (kind === 'webp' && await animatedWebp(file)) throw new Error('움직이는 WebP는 프레임 보존을 위해 처리하지 않습니다.');
  const pixels=headerPixels(new Uint8Array(await file.slice(0,1024*1024).arrayBuffer()));
  if(pixels!==undefined&&pixels>32_000_000)throw new Error('이미지는 3,200만 픽셀 이하로 줄여 주세요. 디코딩 전 크기 검사에서 중단했습니다.');
  const bitmap = await decode(file);
  try {
    if (signal?.aborted) throw new Error('작업이 취소되었습니다.');
    if (bitmap.width * bitmap.height > 32_000_000) throw new Error('이미지 픽셀 수가 3,200만 픽셀 처리 한도를 넘었습니다.');
    const original = kind as OutputFormat;
    const format = s.format === 'original' ? original : s.format;
    const rotated=s.rotation===90||s.rotation===270;
    const naturalWidth=rotated?bitmap.height:bitmap.width,naturalHeight=rotated?bitmap.width:bitmap.height;
    let width = naturalWidth;
    let height = naturalHeight;
    if (s.mode === 'resize') {
      const w = Number(s.width), h = Number(s.height);
      if (![w,h].every(n => Number.isFinite(n) && Number.isInteger(n) && n >= 0 && n <= 16000)) throw new Error('가로·세로는 0부터 16000까지의 정수로 입력해 주세요.');
      if (s.keepRatio) {
        if (w > 0 && h > 0) throw new Error('비율 유지 시 가로 또는 세로 한쪽만 입력해 주세요.');
        if (w > 0) { width = w; height = Math.round(naturalHeight * width / naturalWidth); }
        else if (h > 0) { height = h; width = Math.round(naturalWidth * height / naturalHeight); }
        else throw new Error('가로 또는 세로 크기를 입력해 주세요.');
      } else {
        if (w < 1 || h < 1) throw new Error('비율 유지를 끄면 가로와 세로를 모두 입력해 주세요.');
        width = w; height = h;
      }
    }
    if (width < 1 || height < 1 || width * height > 32_000_000) throw new Error('출력 이미지 크기가 허용 범위를 벗어났습니다.');
    let canvas = draw(bitmap, width, height, format, s.background,s.fit,s.rotation);
    const normalQuality = qualityFor(s);
    let blob = await toBlob(canvas, format, normalQuality);
    let reached: boolean | undefined;
    if (s.mode === 'target') {
      const goal = Math.round(s.targetKB * 1024);
      if (goal < 1024 || goal > 30 * 1024 * 1024) throw new Error('목표 크기는 1KB부터 30MB까지 입력해 주세요.');
      let best = blob;
      let bestW = width, bestH = height;
      const consider = (candidate:Blob) => {
        const fits=candidate.size<=goal, bestFits=best.size<=goal;
        if ((fits && !bestFits) || (fits && bestFits && candidate.size>best.size) || (!fits && !bestFits && candidate.size<best.size)) {
          best=candidate;bestW=width;bestH=height;
        }
      };
      const rounds = s.allowResize ? 4 : 1;
      for (let round = 0; round < rounds; round++) {
        if (signal?.aborted) throw new Error('작업이 취소되었습니다.');
        if (format !== 'png') {
          let lo = 0.3, hi = 0.95;
          for (let attempt = 0; attempt < 8; attempt++) {
            if (signal?.aborted) throw new Error('작업이 취소되었습니다.');
            const q = (lo + hi) / 2;
            const candidate = await toBlob(canvas, format, q);
            consider(candidate);
            if (candidate.size > goal) hi = q; else lo = q;
          }
        } else consider(blob);
        if (best.size <= goal) break;
        if (!s.allowResize || round === rounds - 1) break;
        width = Math.max(1, Math.round(width * 0.8));
        height = Math.max(1, Math.round(height * 0.8));
        canvas = draw(bitmap, width, height, format, s.background,s.fit,s.rotation);
        blob = await toBlob(canvas, format, normalQuality);
        consider(blob);
      }
      blob = best; width = bestW; height = bestH;
      reached = blob.size <= goal;
    }
    if (signal?.aborted) throw new Error('작업이 취소되었습니다.');
    let note = blob.size > file.size ? '결과가 원본보다 큽니다. 원본 유지 또는 변환 결과 다운로드를 선택하세요.' : '처리가 완료되었습니다. 화질과 내용을 확인해 주세요.';
    if (s.mode === 'target') note = reached ? '설정한 목표 용량 이하로 만들었습니다.' : '허용한 설정에서는 목표 용량을 달성하지 못했습니다. 현재 결과를 확인하거나 해상도 축소를 허용해 주세요.';
    if (s.mode === 'metadata') {
      const report = await inspectMetadata(new File([blob], 'result.' + ext(format), {type:mime(format)}));
      note = report.some(x => x.startsWith('GPS')) ? '처리 후에도 GPS 항목이 감지됩니다. 다운로드 전 확인해 주세요.' : '처리 후 지원 범위에서 GPS 항목이 검출되지 않았습니다. 모든 비표준 메타데이터 제거를 보장하지는 않습니다.';
    }
    return {blob, name:resultName(file.name, s.mode === 'metadata' ? '-정보삭제' : '-키미파일', ext(format)), sourceWidth:bitmap.width, sourceHeight:bitmap.height, width, height, format, reached, note};
  } finally {
    bitmap.close();
  }
}
