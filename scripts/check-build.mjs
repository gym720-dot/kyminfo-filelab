import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const dist=resolve(import.meta.dirname,'../dist');
const read=p=>readFileSync(resolve(dist,p),'utf8');
const sitemap=read('sitemap.xml');
const urls=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
assert.equal(urls.length,13,'Sitemap should contain the 13 normal pages');
assert.equal(new Set(urls).size,urls.length,'Duplicate sitemap URL');
assert.ok(!urls.some(url=>/\/404\/?$/.test(url)),'404 must stay outside the sitemap');
const headers=read('_headers');
for(const rule of ['https://:project.pages.dev/*','https://:version.:project.pages.dev/*'])assert.ok(headers.includes(rule+'\n  X-Robots-Tag: noindex'),'Missing preview noindex rule');
assert.ok(!headers.includes('https://file.kyminfo.com/'),'Production must not receive preview noindex');
const titles=new Set(),descriptions=new Set();let references=0;
for(const [file,url] of [...urls.map(url=>[new URL(url).pathname.slice(1)+'index.html',url]),['404.html',null]]){
 const html=read(file),title=html.match(/<title>([^<]+)<\/title>/)?.[1];
 assert.ok(title&&!titles.has(title),`${file}: title missing/duplicate`);titles.add(title);
 assert.equal([...html.matchAll(/<h1(?:\s[^>]*)?>/g)].length,1,`${file}: expected one H1`);
 if(url){
  const description=html.match(/<meta name="description" content="([^"]+)"/)?.[1];
  assert.ok(description&&!descriptions.has(description),`${file}: description missing/duplicate`);descriptions.add(description);
  assert.ok(html.includes(`<link rel="canonical" href="${url}"`),`${file}: canonical mismatch`);
  assert.ok(!/name="robots"[^>]*noindex/.test(html),`${file}: normal page is noindex`);
 }else{
  assert.ok(html.includes('name="robots" content="noindex, follow"'),'404 must be noindex');
  assert.ok(!html.includes('rel="canonical"'),'404 must not claim a normal canonical');
 }
 assert.ok(!/src="[^"\n]*(googlesyndication|doubleclick|google-analytics)/.test(html),`${file}: unexpected ad/GA script`);
 for(const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)){
  JSON.parse(m[1]);const hash=createHash('sha256').update(m[1]).digest('base64');assert.ok(headers.includes(`'sha256-${hash}'`),`${file}: schema CSP hash missing`);
 }
 for(const m of html.matchAll(/(?:href|src)="(\/[^"#]*)"/g)){
  const path=m[1].split(/[?#]/)[0];let target=resolve(dist,'.'+path);
  if(existsSync(target)&&statSync(target).isDirectory())target=resolve(target,'index.html');
  assert.ok(existsSync(target),`${file}: broken local reference ${path}`);references++;
 }
}
console.log(`Static check passed: 14 HTML pages, 13 sitemap URLs, ${references} local references, 404/noindex/CSP verified`);
