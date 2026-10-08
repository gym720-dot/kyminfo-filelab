import assert from 'node:assert/strict';
import {readFile, mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from 'playwright-core';
import JSZip from 'jszip';
import ExifReader from 'exifreader';

const root=resolve(import.meta.dirname,'..');
const fixture=n=>resolve(root,'tests','fixtures',n);
const actual=n=>resolve(root,'tests','actual',n);
const base=process.argv[3]||process.env.TEST_URL||'http://localhost:5173';
await mkdir(resolve(root,'tests','actual'),{recursive:true});
const browser=await chromium.launch({channel:process.argv[2]||process.env.BROWSER_CHANNEL||'chrome',headless:true});
const failures=[];
let count=0;

async function scenario(name,fn){
  const page=await browser.newPage({acceptDownloads:true});
  const foreign=[];
  page.on('request',r=>{if(!r.url().startsWith(base)&&!r.url().startsWith(`blob:${base}/`))foreign.push(r.url());});
  try {await fn(page);assert.deepEqual(foreign,[],`unexpected outbound requests: ${foreign}`);console.log(`PASS ${name}`);count++;}
  catch(e){failures.push(`${name}: ${e.stack||e}`);console.error(`FAIL ${name}: ${e.message||e}`);}
  finally{await page.close();}
}
async function upload(page,route,name){
  await page.goto(`${base}/${route}/`);
  await page.locator('input[type=file]').setInputFiles(fixture(name));
  await page.locator('.file-row').first().waitFor();
}
async function runTool(page){
  await page.locator('.action-row .primary-button').click();
  await page.locator('.file-row .result-line, .file-row .file-error, .file-row .excel-report').first().waitFor({timeout:30000});
  await page.waitForFunction(()=>![...document.querySelectorAll('.file-row')].some(e=>e.textContent?.includes('처리 중')),{timeout:30000});
}
async function download(page,name){
  const pending=page.waitForEvent('download');
  await page.locator('.file-row .download-button').first().click();
  const item=await pending;const path=actual(name);
  await item.saveAs(path);return {path,bytes:await readFile(path),suggested:item.suggestedFilename()};
}
async function imageInfo(page,bytes){
  return page.evaluate(async base64=>{
    const data=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));
    const blob=new Blob([data]);const bitmap=await createImageBitmap(blob);
    const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;
    const ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0);
    const pixel=(x,y)=>Array.from(ctx.getImageData(x,y,1,1).data);
    const out={width:bitmap.width,height:bitmap.height,pixel0:pixel(0,0),pixelMiddle:pixel(Math.floor(bitmap.width/2),Math.floor(bitmap.height/2))};
    bitmap.close();return out;
  },bytes.toString('base64'));
}
async function sameXlsxParts(source,result){
  const [a,b]=await Promise.all([JSZip.loadAsync(source,{checkCRC32:true}),JSZip.loadAsync(result,{checkCRC32:true})]);
  const allNames=Object.keys(a.files).sort();
  assert.deepEqual(Object.keys(b.files).sort(),allNames);
  const names=allNames.filter(n=>!a.files[n].dir);
  for(const n of allNames)assert.equal(b.files[n].dir,a.files[n].dir,n);
  for(const n of names){assert.deepEqual(await b.files[n].async('uint8array'),await a.files[n].async('uint8array'),n);}
  return names.length;
}

try{
  await scenario('cards and static pages',async page=>{
    for(const route of ['','image-compress','image-resize','image-to-webp','image-under-100kb','image-metadata-remove','excel-analyze','excel-optimize','guide','about','privacy','terms','contact']){
      const response=await page.goto(`${base}/${route?route+'/':''}`);assert.equal(response.status(),200,route);
      assert.equal(await page.locator('link[rel=canonical]').count(),1,route);
      assert.equal(await page.locator('.tool-tag').count(),0,route);
    }
  });
  await scenario('JPG compression and changed settings rerun',async page=>{
    await upload(page,'image-compress','sample.jpg');await runTool(page);
    const first=await download(page,'compressed.jpg');assert.ok(first.bytes.length<(await readFile(fixture('sample.jpg'))).length);
    assert.deepEqual([...first.bytes.subarray(0,3)],[255,216,255]);
    const image=await imageInfo(page,first.bytes);assert.deepEqual([image.width,image.height],[1100,720]);
    assert.equal(await page.locator('.compare-range').count(),1);
    await page.locator('.options-grid select').nth(1).selectOption('strong');await runTool(page);
    const second=await download(page,'compressed-strong.jpg');assert.ok(second.bytes.length<first.bytes.length);
  });
  await scenario('PNG original format remains valid',async page=>{
    await upload(page,'image-compress','sample.png');await runTool(page);
    const out=await download(page,'compressed.png');assert.deepEqual([...out.bytes.subarray(0,8)],[137,80,78,71,13,10,26,10]);
    const image=await imageInfo(page,out.bytes);assert.equal(image.width,1100);assert.equal(image.height,720);
  });
  await scenario('resize by width',async page=>{
    await upload(page,'image-resize','sample.jpg');await page.locator('input[type=number]').nth(0).fill('550');await runTool(page);
    const out=await download(page,'resize-width.jpg');const image=await imageInfo(page,out.bytes);assert.deepEqual([image.width,image.height],[550,360]);
    assert.equal(await page.locator('.preview-pair figure').count(),2);
  });
  await scenario('resize by height',async page=>{
    await upload(page,'image-resize','sample.jpg');await page.locator('input[type=number]').nth(1).fill('360');await runTool(page);
    const out=await download(page,'resize-height.jpg');const image=await imageInfo(page,out.bytes);assert.deepEqual([image.width,image.height],[550,360]);
  });
  await scenario('resize exact dimensions and invalid empty input',async page=>{
    await upload(page,'image-resize','sample.jpg');await page.locator('.check-label input').check();
    await page.locator('.check-label input').uncheck();
    await page.locator('input[type=number]').nth(0).fill('400');await page.locator('input[type=number]').nth(1).fill('300');await runTool(page);
    const out=await download(page,'resize-exact.jpg');const image=await imageInfo(page,out.bytes);assert.deepEqual([image.width,image.height],[400,300]);
    await page.locator('input[type=number]').nth(1).fill('');await runTool(page);assert.match(await page.locator('.file-error').innerText(),/모두 입력/);
  });
  await scenario('transparent PNG to JPG uses chosen background',async page=>{
    await upload(page,'image-to-webp','transparent.png');await page.locator('.options-grid select').selectOption('jpeg');
    await page.locator('input[type=color]').fill('#0000ff');await runTool(page);
    const out=await download(page,'transparent-blue.jpg');assert.match(out.suggested,/\.jpg$/);
    const image=await imageInfo(page,out.bytes);assert.ok(image.pixel0[2]>240&&image.pixel0[0]<20&&image.pixel0[1]<20,JSON.stringify(image.pixel0));
    assert.ok(image.pixelMiddle[0]>230&&image.pixelMiddle[2]<30,JSON.stringify(image.pixelMiddle));
  });
  await scenario('transparent PNG to WebP keeps alpha',async page=>{
    await upload(page,'image-to-webp','transparent.png');await runTool(page);
    const out=await download(page,'transparent.webp');assert.equal(out.bytes.toString('ascii',8,12),'WEBP');
    const image=await imageInfo(page,out.bytes);assert.equal(image.pixel0[3],0);assert.equal(image.pixelMiddle[3],255);
  });
  await scenario('JPG to PNG',async page=>{
    await upload(page,'image-to-webp','sample.jpg');await page.locator('.options-grid select').selectOption('png');await runTool(page);
    const out=await download(page,'converted.png');assert.deepEqual([...out.bytes.subarray(0,8)],[137,80,78,71,13,10,26,10]);
  });
  await scenario('WebP to PNG and JPG',async page=>{
    await upload(page,'image-to-webp','transparent.webp');
    await page.locator('.options-grid select').selectOption('png');await runTool(page);
    const png=await download(page,'webp-to-png.png');assert.deepEqual([...png.bytes.subarray(0,8)],[137,80,78,71,13,10,26,10]);
    assert.equal((await imageInfo(page,png.bytes)).pixel0[3],0);
    await page.locator('.options-grid select').selectOption('jpeg');await runTool(page);
    const jpg=await download(page,'webp-to-jpg.jpg');assert.deepEqual([...jpg.bytes.subarray(0,3)],[255,216,255]);
  });
  await scenario('50KB goal reached and 1KB goal failure clearly reported',async page=>{
    await upload(page,'image-under-100kb','sample.jpg');await page.locator('input[type=number]').fill('50');await runTool(page);
    const out=await download(page,'target-50kb.webp');assert.ok(out.bytes.length<=50*1024,out.bytes.length);
    await page.locator('input[type=number]').fill('1');await runTool(page);
    assert.match(await page.locator('.result-note').innerText(),/달성하지 못했습니다/);
    assert.match(await page.locator('.file-name span').innerText(),/목표 미달/);
  });
  await scenario('target can reduce dimensions when explicitly allowed',async page=>{
    await upload(page,'image-under-100kb','sample.jpg');
    await page.locator('input[type=number]').fill('10');await page.locator('.check-label input').check();await runTool(page);
    const out=await download(page,'target-resized.webp');const image=await imageInfo(page,out.bytes);
    assert.ok(image.width<1100&&image.height<720,JSON.stringify(image));
    assert.ok(out.bytes.length<=10*1024,out.bytes.length);
  });
  await scenario('EXIF/GPS detected then removed in downloadable JPG',async page=>{
    await upload(page,'image-metadata-remove','with-gps.jpg');await runTool(page);
    assert.match(await page.locator('.metadata-list').innerText(),/GPS|카메라 제조사/);
    const out=await download(page,'metadata-removed.jpg');const tags=ExifReader.load(out.bytes);
    assert.equal(tags.GPSLatitude,undefined);assert.equal(tags.GPSLongitude,undefined);assert.equal(tags.Make,undefined);
    assert.equal((await imageInfo(page,out.bytes)).width,1100);
  });
  await scenario('animated WebP rejected without silent frame loss',async page=>{
    await upload(page,'image-compress','animated.webp');await runTool(page);
    assert.match(await page.locator('.file-error').innerText(),/움직이는 WebP/);
  });
  await scenario('EXIF orientation and tiny image are handled',async page=>{
    await upload(page,'image-compress','oriented.jpg');await runTool(page);
    const out=await download(page,'oriented-output.jpg');const image=await imageInfo(page,out.bytes);
    assert.deepEqual([image.width,image.height],[40,80]);
    await page.locator('.action-row .subtle-button').last().click();
    await page.locator('input[type=file]').setInputFiles(fixture('tiny.jpg'));await runTool(page);
    const tiny=await download(page,'tiny-output.jpg');assert.deepEqual([(await imageInfo(page,tiny.bytes)).width,(await imageInfo(page,tiny.bytes)).height],[1,1]);
    assert.equal(await page.locator('.result-actions .subtle-button').count(),1);
  });
  await scenario('corrupt image fails without a download',async page=>{
    await upload(page,'image-compress','corrupt.jpg');await runTool(page);
    assert.equal(await page.locator('.download-button').count(),0);
    assert.equal(await page.locator('.file-error').count(),1);
  });
  await scenario('batch ZIP has two valid unique names',async page=>{
    await page.goto(`${base}/image-compress/`);
    await page.locator('input[type=file]').setInputFiles([fixture('sample.jpg'),fixture('sample.jpg')]);await runTool(page);
    const pending=page.waitForEvent('download');await page.locator('.results-head .subtle-button').click();const item=await pending;
    const path=actual('batch.zip');await item.saveAs(path);
    const zip=await JSZip.loadAsync(await readFile(path),{checkCRC32:true});const names=Object.keys(zip.files).filter(n=>!zip.files[n].dir);
    assert.equal(names.length,2);assert.notEqual(names[0],names[1]);
    for(const n of names){const b=await zip.files[n].async('uint8array');assert.deepEqual([...b.subarray(0,3)],[255,216,255]);}
  });
  await scenario('XLSX read-only analysis',async page=>{
    await upload(page,'excel-analyze','sample.xlsx');await runTool(page);
    assert.match(await page.locator('.excel-report').innerText(),/한글 시트/);
    assert.equal(await page.locator('.download-button').count(),0);
  });
  await scenario('XLSX optimization preserves every uncompressed part',async page=>{
    await upload(page,'excel-optimize','stored.xlsx');await runTool(page);
    const out=await download(page,'optimized.xlsx');const before=await readFile(fixture('stored.xlsx'));
    assert.ok(out.bytes.length<before.length);assert.ok(await sameXlsxParts(before,out.bytes)>3);
    assert.match(await page.locator('.excel-report').innerText(),/한글 시트/);
  });
  await scenario('XLSX explicit ZIP directory entries stay present',async page=>{
    await upload(page,'excel-optimize','stored-with-dirs.xlsx');await runTool(page);
    const out=await download(page,'optimized-with-dirs.xlsx');
    assert.ok(await sameXlsxParts(await readFile(fixture('stored-with-dirs.xlsx')),out.bytes)>3);
  });
  await scenario('complex XLSX preserves charts images hidden sheet and formulas',async page=>{
    await upload(page,'excel-optimize','complex-stored.xlsx');await runTool(page);
    const out=await download(page,'complex-optimized.xlsx');
    assert.ok(out.bytes.length<(await readFile(fixture('complex-stored.xlsx'))).length);
    assert.ok(await sameXlsxParts(await readFile(fixture('complex-stored.xlsx')),out.bytes)>10);
  });
  await scenario('invalid XLSX safely rejected',async page=>{
    await upload(page,'excel-analyze','invalid.xlsx');await runTool(page);
    assert.match(await page.locator('.file-error').innerText(),/ZIP|손상/);
  });
  await scenario('macro disguised as XLSX and ZIP bomb rejected',async page=>{
    await upload(page,'excel-optimize','macro-disguised.xlsx');await runTool(page);
    assert.match(await page.locator('.file-error').innerText(),/매크로/);
    await page.locator('.action-row .subtle-button').last().click();
    await page.locator('input[type=file]').setInputFiles(fixture('bomb.xlsx'));await runTool(page);
    assert.match(await page.locator('.file-error').innerText(),/과도한 압축률/);
  });
}finally{await browser.close();}
console.log(`${count} passed, ${failures.length} failed`);
if(failures.length){for(const failure of failures)console.error(failure);process.exitCode=1;}
