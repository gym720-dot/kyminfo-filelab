import { policyPages } from './policies.mjs';
import { writeFileSync, mkdirSync, appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

const root = resolve(import.meta.dirname, '..');
const domain = 'https://file.kyminfo.com';
const pages = [
  {slug:'', title:'키미 파일 | 사진 용량 줄이기·WebP 변환·엑셀 용량 분석', desc:'사진 용량 줄이기, 목표 KB 맞추기, 크기 조절, WebP 변환, 메타데이터 확인과 XLSX 용량 분석을 무료로 이용하세요. 파일은 브라우저 안에서 처리합니다.', mode:'compress', h1:'무거운 파일은 가볍게, 작업은 간단하게', lead:'사진과 엑셀 파일을 현재 브라우저에서 처리하세요. 회원가입과 파일 업로드 없이 바로 시작할 수 있습니다.', guide:'이미지를 선택하면 압축과 변환 옵션을 고를 수 있습니다. XLSX는 분석 또는 보존형 재압축을 선택하세요.', faq:[['선택한 파일이 서버로 전송되나요?','아니요. 파일 처리 코드는 브라우저에서 실행됩니다. 사이트 접속 과정의 일반적인 웹 요청은 별도로 발생합니다.'],['용량이 반드시 줄어드나요?','이미 최적화된 파일은 더 작아지지 않을 수 있습니다. 결과의 실제 크기를 확인하고 원본을 유지할 수 있습니다.']]},
  {slug:'image-compress', title:'사진 용량 줄이기 · JPG PNG WebP 압축 | 키미 파일', desc:'JPG·PNG·WebP 사진을 브라우저에서 압축하고 원본과 결과 용량을 비교하세요. 여러 사진을 처리해 ZIP으로 내려받을 수 있습니다.', mode:'compress', h1:'사진 용량 줄이기', lead:'JPG·PNG·WebP 파일을 간편하게 압축하고 전후 용량을 비교해 보세요.', guide:'사진을 선택하고 빠른 압축, 고화질, 강력 압축 또는 직접 설정을 고른 뒤 처리하세요. PNG는 화질 수치로 압축되지 않으며, WebP 변환이나 크기 축소가 효과적일 수 있습니다.', faq:[['사진이 더 커질 수도 있나요?','네. 원본 인코딩 상태에 따라 결과가 커질 수 있습니다. 이 경우 원본 크기와 결과 크기를 그대로 표시합니다.'],['압축하면 화질이 나빠지나요?','손실 압축은 화질을 줄일 수 있습니다. 중요한 사진은 미리보기를 확인하고 원본을 보관하세요.']]},
  {slug:'image-resize', title:'이미지 크기 조절 · 사진 픽셀 변경 | 키미 파일', desc:'사진 가로·세로 픽셀과 비율을 바꾸고 JPG·PNG·WebP로 저장하세요. 비율 유지와 일괄 처리 지원.', mode:'resize', h1:'이미지 크기 조절', lead:'사진의 가로·세로 픽셀을 바꾸고 필요한 크기로 다운로드하세요.', guide:'가로와 세로 중 하나만 입력하거나 비율 유지를 해제하고 둘 다 지정하세요. 큰 사진은 브라우저 메모리 한도 때문에 처리되지 않을 수 있습니다.', faq:[['비율을 유지할 수 있나요?','네. 비율 유지를 켜면 입력한 한쪽 길이에 맞추어 다른 길이를 계산합니다.'],['이미지가 흐려질 수 있나요?','원본보다 확대하면 픽셀이 보이거나 흐려질 수 있습니다.']]},
  {slug:'image-to-webp', title:'JPG PNG WebP 변환 · 이미지 형식 바꾸기 | 키미 파일', desc:'JPG·PNG·WebP 형식을 브라우저에서 서로 변환하세요. 투명 배경의 JPG 변환에는 배경색을 선택할 수 있습니다.', mode:'convert', h1:'이미지 형식 변환', lead:'JPG·PNG·WebP 형식을 바꾸고 용량과 투명도 변화를 확인하세요.', guide:'파일을 선택한 후 출력 형식을 고르세요. JPG는 투명 배경을 지원하지 않으므로 배경색으로 채웁니다. 지원하지 않는 출력 형식은 브라우저에서 검사해 알립니다.', faq:[['PNG를 JPG로 바꾸면 투명 배경은 어떻게 되나요?','선택한 배경색으로 채워집니다.'],['WebP 변환이 항상 더 작나요?','아닙니다. 실제 생성된 파일 크기를 확인하세요.']]},
  {slug:'image-under-100kb', title:'사진 100KB 이하로 줄이기 · 목표 용량 | 키미 파일', desc:'사진을 50KB, 100KB, 200KB 등 목표 크기에 맞춰 보세요. 품질과 해상도를 조정하며 달성 여부를 정확히 표시합니다.', mode:'target', h1:'사진을 목표 용량에 맞추기', lead:'100KB·200KB처럼 필요한 파일 크기를 정하고 가능한 설정을 찾아보세요.', guide:'목표 크기를 선택하세요. 품질만으로 부족하다면 해상도 축소를 허용할 수 있습니다. 제한된 횟수 안에 달성하지 못하면 실패를 알리고 가장 작은 결과를 보여줍니다.', faq:[['100KB가 반드시 가능한가요?','아닙니다. 복잡한 사진이나 큰 해상도는 허용한 화질·크기 범위에서 목표를 달성하지 못할 수 있습니다.'],['KB 기준은 무엇인가요?','이 도구는 1KB를 1024바이트로 계산합니다.']]},
  {slug:'image-metadata-remove', title:'사진 위치정보 확인·메타데이터 삭제 | 키미 파일', desc:'사진의 EXIF·GPS 등 확인 가능한 메타데이터를 살펴보고 재인코딩으로 제거하세요. 처리 전후 검사를 제공합니다.', mode:'metadata', h1:'사진 위치정보 확인·삭제', lead:'사진에 남은 촬영 정보와 위치정보를 확인하고 새 파일로 저장하세요.', guide:'파일을 선택하면 지원 가능한 EXIF 항목을 분석합니다. 삭제를 실행하면 이미지를 재인코딩하고 검출 가능한 메타데이터를 다시 검사합니다. 모든 비표준 정보를 완전히 삭제했다고 보장하지는 않습니다.', faq:[['원본 사진도 바뀌나요?','아니요. 원본을 덮어쓰지 않고 새 파일을 내려받습니다.'],['색감이 달라질 수 있나요?','네. 재인코딩 과정에서 색상 프로파일 등이 제거되면 화면 색감이 달라질 수 있습니다.']]},
  {slug:'excel-analyze', title:'엑셀 용량 분석 · XLSX 구성요소 확인 | 키미 파일', desc:'XLSX 파일의 시트·이미지·스타일·공유 문자열 등 용량 구성을 브라우저에서 읽기 전용으로 분석하세요.', mode:'excel-analyze', h1:'엑셀 용량 분석', lead:'XLSX 파일이 왜 무거운지 구성요소별로 확인하세요.', guide:'XLSX 파일을 선택해 분석하면 시트 이름과 내부 구성요소의 압축 해제 크기를 보여줍니다. 항목별 크기는 ZIP 파일의 전체 용량과 단순 합산되지 않습니다.', faq:[['엑셀 내용이 수정되나요?','분석은 읽기 전용이며 원본을 변경하지 않습니다.'],['XLS나 XLSM도 되나요?','현재는 XLSX만 지원합니다. 암호화 파일과 매크로 파일은 지원하지 않습니다.']]},
  {slug:'excel-optimize', title:'엑셀 XLSX 용량 줄이기 · 보존형 재압축 | 키미 파일', desc:'XLSX의 각 내부 항목을 유지하며 재압축하고 바이트 동일성을 검사합니다. 실제로 작아진 경우에만 결과 파일을 제공합니다.', mode:'excel-optimize', h1:'엑셀 파일 용량 줄이기', lead:'XLSX의 내부 항목을 바꾸지 않고 재압축이 가능한지 확인하세요.', guide:'XLSX 파일을 분석한 뒤 최적화를 누르세요. ZIP 내부 파일을 다시 압축하고 모든 내부 항목의 바이트 동일성을 검사합니다. 더 작아지지 않거나 검증에 실패하면 다운로드를 제공하지 않습니다. 중요한 문서는 Excel에서 열어 다시 확인하세요.', faq:[['수식과 셀 값이 유지되나요?','내부 파일의 바이트가 동일한지 검사합니다. 검증을 통과한 경우에만 결과를 제공하지만 실제 Excel 호환성까지 보장하지는 않습니다.'],['왜 용량이 줄지 않나요?','대부분 XLSX는 이미 ZIP으로 압축되어 있습니다. 이미 효율적인 파일은 추가 절감이 어렵습니다.']]},
  {slug:'guide', title:'이용 가이드 | 키미 파일', desc:'키미 파일에서 이미지 압축과 엑셀 분석을 사용하는 방법, 지원 형식과 제한 사항을 확인하세요.', h1:'이용 가이드', lead:'파일 처리 전 알아두면 좋은 사용법과 제한 사항입니다.', sections:[['이미지 작업','JPG·PNG·WebP 파일을 선택하고 원하는 도구의 옵션을 설정하세요. 처리 후 실제 결과 크기와 미리보기를 확인하고 개별 파일 또는 ZIP으로 저장할 수 있습니다. 움직이는 WebP, SVG, HEIC는 현재 지원하지 않습니다.'],['엑셀 작업','표준 XLSX 파일만 읽기 전용 분석합니다. 최적화는 검증 가능한 파일에 한해 내부 항목을 그대로 재압축합니다. 원본을 항상 별도로 보관하고 결과를 Excel에서 다시 열어 보세요.'],['브라우저 처리','선택한 파일 내용은 키미 파일 서버로 전송되지 않습니다. 큰 파일은 브라우저 메모리를 많이 사용하므로 모바일에서는 파일 수를 줄여 처리하세요.']]},
  {slug:'about', title:'사이트 소개 | 키미 파일', desc:'키미 파일의 목적과 무료 브라우저 파일 도구의 운영 원칙을 소개합니다.', h1:'키미 파일 소개', lead:'자주 쓰는 파일 작업을 간결하고 분명하게.', sections:[['서비스 목적','키미 파일은 사진 용량 줄이기, 이미지 형식 변환, 메타데이터 확인과 엑셀 구성 분석을 무료로 제공하는 도구입니다. 로그인 없이 사용할 수 있습니다.'],['처리 원칙','파일 자체는 현재 브라우저에서 읽고 처리합니다. 처리 결과를 자체 서버에 보관하지 않습니다. 용량 감소와 정보 삭제가 가능한 범위를 정확하게 보여주려고 합니다.'],['키미 도구 모음','키미 계산은 생활 계산기를, 키미 타임은 시간 도구를 제공합니다. 각 사이트는 같은 K 브랜드로 연결됩니다.']]},
 {...policyPages.privacy},
 {...policyPages.terms},
 {...policyPages.contact},
];
const tools = pages.filter(p => p.mode && p.slug);
const explanations = {
  'image-compress': [
    ['형식에 따라 압축 방식이 다릅니다','JPG와 WebP는 화질과 파일 크기를 절충할 수 있습니다. PNG는 이 화면의 화질 수치를 적용할 수 없는 무손실 형식입니다. PNG 파일이 이미 효율적이라면 WebP 변환이나 이미지 크기 조절을 검토하세요.'],
    ['결과가 원본보다 커질 때','이미 작은 사진을 다시 인코딩하면 오히려 용량이 늘 수 있습니다. 파일 목록에서 원본과 결과 바이트를 비교하고 필요하면 원본 파일을 계속 사용하세요. 사진을 다시 저장하면 원본 메타데이터와 색상 정보가 바뀔 수 있습니다.']
  ],
  'image-resize': [
    ['픽셀 크기를 고르는 방법','웹 게시용 사진은 표시할 영역의 픽셀 수에 맞추어 축소하면 불필요한 다운로드 용량을 줄일 수 있습니다. 원본보다 크게 확대해도 없던 세부 정보가 만들어지지는 않습니다.'],
    ['가로세로 비율','비율 유지를 켜면 한쪽 길이를 바탕으로 다른 길이를 계산합니다. 비율을 해제하고 두 값을 입력하면 이미지가 늘어나거나 눌릴 수 있으므로 결과 미리보기를 확인하세요.']
  ],
  'image-to-webp': [
    ['WebP를 선택할 때','WebP는 같은 사진을 더 작게 저장할 수 있는 경우가 많지만 반드시 그런 것은 아닙니다. 변환 후 화면에서 실제 파일 크기를 확인하세요. 움직이는 WebP는 프레임 손실을 막기 위해 이 도구에서 거절합니다.'],
    ['투명 배경과 JPG','PNG·WebP의 투명한 부분을 JPG로 바꾸면 투명도를 유지할 수 없습니다. 배경색을 먼저 선택하고 결과 이미지의 가장자리를 확인하세요. 브라우저가 요청한 형식을 실제로 생성했는지도 검사합니다.']
  ],
  'image-under-100kb': [
    ['목표 크기의 기준','화면의 KB는 1024바이트를 뜻합니다. 목표 용량은 각 파일에 별도로 적용됩니다. 프로그램은 품질을 몇 차례 조정하고, 사용자가 허용한 경우에만 해상도를 낮춥니다.'],
    ['달성하지 못하는 경우','사진 내용이 복잡하거나 출력 형식을 PNG로 유지하면 작은 목표를 충족하기 어려울 수 있습니다. 이 도구는 목표에 못 미친 결과를 성공으로 표시하지 않습니다. 화질이나 크기 설정을 바꾸거나 다른 형식을 선택해 다시 시도하세요.']
  ],
  'image-metadata-remove': [
    ['위치정보가 보이지 않아도','EXIF GPS가 감지되지 않았다는 것은 지원 범위의 검사 결과입니다. 이미지 형식의 모든 사설 태그나 비표준 정보를 완전히 검사했다는 뜻은 아닙니다. 민감한 사진은 공유 전 별도 도구로도 점검하세요.'],
    ['새 파일의 색감·방향','이 도구는 사진을 새 이미지로 다시 인코딩합니다. 원본은 그대로 두지만 색상 프로파일 등 일부 정보가 바뀌어 색감이 달라질 수 있습니다. 방향과 화질을 결과 미리보기에서 확인하세요.']
  ],
  'excel-analyze': [
    ['용량 표를 읽는 방법','워크시트 XML은 셀 내용과 구조, sharedStrings는 반복 문자열, styles는 서식을 담습니다. 이미지·미디어 항목이 크다면 삽입된 그림이 문서 용량의 주요 원인일 수 있습니다.'],
    ['표시 수치의 차이','항목별 수치는 압축을 푼 내부 파일의 크기입니다. XLSX 자체는 ZIP 패키지이므로 이 수치들을 더해도 실제 파일 크기와 일치하지 않습니다. 분석은 원본을 수정하지 않습니다.']
  ],
  'excel-optimize': [
    ['무엇을 바꾸는가','수식이나 셀 내용을 재작성하지 않고 ZIP 패키지의 압축만 다시 수행합니다. 내부 항목 이름·개수와 압축 해제 후의 바이트가 원본과 동일한지 검사합니다. 이 검사를 통과하고 파일이 작아진 경우에만 결과를 제공합니다.'],
    ['중요한 문서의 확인','ZIP 내부 바이트 동일성은 실제 Excel에서 모든 기능이 동일하게 작동한다는 보증과 같지 않습니다. 외부 연결이나 특수 확장이 있는 문서는 원본을 보관하고 Excel에서 직접 열어 수식·차트·인쇄 설정을 확인하세요. 전자서명·매크로·암호화 문서는 처리하지 않습니다.']
  ]
};
const escape = s => String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const path = slug => slug ? `/${slug}/` : '/';
const nav = [
  ['image-compress','이미지 압축'],['image-resize','크기 조절'],['image-to-webp','형식 변환'],
  ['image-metadata-remove','메타데이터'],['excel-analyze','엑셀 분석'],['guide','이용 안내']
];
function cards(current='') { return `<div class="tool-grid">${tools.filter(p => p.slug !== current).map(p => `<a class="tool-card" href="${path(p.slug)}"><h3>${escape(p.h1)}</h3><p>${escape(p.lead)}</p><span class="card-link">도구 열기 ↗</span></a>`).join('')}</div>`; }
function html(p) {
 p={...p,...policyPages[p.slug]};
 const canonical=domain+path(p.slug);
 const sections=p.sections?.map(([h,t])=>`<section class="content-card"><h2>${escape(h)}</h2><p>${escape(t)}</p>${''}</section>`).join('')||'';
 const policyExtra=policyPages[p.slug]?.extra||'';
 const faq=p.faq?.map(([q,a])=>`<details><summary>${escape(q)}</summary><p>${escape(a)}</p></details>`).join('')||'';
 const deep=explanations[p.slug]?.map(([h,t])=>`<div class="content-card"><h2>${escape(h)}</h2><p>${escape(t)}</p></div>`).join('')||'';
 const homeMore=`<section class="section"><div class="section-heading"><span class="eyebrow">WORK CLEARLY</span><h2>파일 작업 결과를 있는 그대로 보여줍니다</h2></div><div class="content-card"><h2>이미지와 엑셀을 한곳에서</h2><p>사진은 압축·크기 조절·형식 변환·목표 크기 맞추기를 제공합니다. XLSX는 어떤 구성요소가 용량을 차지하는지 읽기 전용으로 보여주고, 검증 가능한 문서만 내부 항목을 보존하며 재압축합니다.</p><p>이미 충분히 작은 파일은 결과가 커질 수 있고, 엑셀은 용량이 줄지 않을 수 있습니다. 두 경우 모두 실제 수치를 표시하고 원본을 유지할 수 있게 합니다.</p></div></section><section class="section"><div class="section-heading"><span class="eyebrow">FAQ</span><h2>이용 전에 알아두세요</h2></div><div class="faq-list">${faq}</div></section>`;
 const toolArea=p.mode?`<section class="workspace-section" aria-labelledby="work-title"><div class="section-heading"><span class="eyebrow">BROWSER TOOL</span><h2 id="work-title">여기에서 바로 시작하세요</h2><p>파일은 업로드되지 않고 이 브라우저에서 처리됩니다.</p></div><div id="tool-root" data-mode="${p.mode}"></div></section>`:'';
 const main=p.slug===''?`<div class="hero"><div><span class="eyebrow">KYMI FILE · FREE TOOLS</span><h1>${escape(p.h1)}</h1><p>${escape(p.lead)}</p><div class="hero-badges"><span>서버 업로드 없음</span><span>회원가입 없음</span><span>실제 결과 확인</span></div></div><div class="hero-art" aria-hidden="true"><div class="file-sheet"><span class="sheet-icon">K</span><div class="sheet-lines"><i></i><i></i><i></i></div><b>FILE · 01</b></div><div class="mini-sheet">− 42%</div></div></div>${toolArea}<section class="section"><div class="section-heading"><span class="eyebrow">FIND YOUR TOOL</span><h2>필요한 파일 도구를 선택하세요</h2><p>처리 방식과 지원 범위를 각 페이지에서 확인할 수 있습니다.</p></div>${cards()}</section>`: `<div class="page-intro"><div class="breadcrumbs"><a href="/">홈</a> <span>›</span> ${escape(p.h1)}</div><span class="eyebrow">${p.mode?.startsWith('excel')?'EXCEL TOOLS':p.mode?'IMAGE TOOLS':'KYMI FILE'}</span><h1>${escape(p.h1)}</h1><p>${escape(p.lead)}</p></div>${toolArea}`;
 const more=p.slug===''?homeMore:p.mode?`<section class="section"><div class="section-heading"><span class="eyebrow">HOW IT WORKS</span><h2>이용 방법과 주의사항</h2></div><div class="content-card"><p>${escape(p.guide)}</p><p>원본 파일은 덮어쓰지 않습니다. 결과 파일의 내용과 화질을 확인한 뒤 사용하세요.</p></div>${deep}</section>${faq?`<section class="section"><div class="section-heading"><span class="eyebrow">FAQ</span><h2>자주 묻는 질문</h2></div><div class="faq-list">${faq}</div></section>`:''}<section class="section"><div class="section-heading"><span class="eyebrow">MORE TOOLS</span><h2>다른 도구도 사용해 보세요</h2></div>${cards(p.slug)}</section>`:sections+policyExtra;
 const schema=JSON.stringify({'@context':'https://schema.org','@type':p.mode?'SoftwareApplication':'WebPage',name:p.h1,description:p.desc,url:canonical,inLanguage:'ko-KR',...(p.mode?{applicationCategory:'UtilitiesApplication',operatingSystem:'Web',offers:{'@type':'Offer',price:'0',priceCurrency:'KRW'}}:{})}).replaceAll('<','\\u003c');
 return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#f7f8fc"><meta name="google-site-verification" content="0DlnOeZZ_kog3CSXY6uLdI5A67mBCZHQwwUc4D_Ava0"><meta name="naver-site-verification" content="1cccb14538d93ebf4790c4a1707c498465c53c51"><title>${escape(p.title)}</title><meta name="description" content="${escape(p.desc)}"><link rel="canonical" href="${canonical}"><meta property="og:type" content="website"><meta property="og:locale" content="ko_KR"><meta property="og:title" content="${escape(p.title)}"><meta property="og:description" content="${escape(p.desc)}"><meta property="og:url" content="${canonical}"><link rel="icon" href="/favicon.svg?v=3" type="image/svg+xml"><link rel="stylesheet" href="/src/styles.css"><script type="application/ld+json">${schema}</script>${p.mode?'<script type="module" src="/src/main.tsx"></script>':''}<script src="/family-nav.js" defer></script></head><body><a class="skip-link" href="#main">본문으로 바로가기</a><header class="site-header"><div class="header-inner"><a class="brand" href="/" aria-label="키미 파일 홈"><span class="brand-mark" aria-hidden="true">K</span><span>키미 <em>파일</em></span></a><nav class="main-nav" aria-label="주요 메뉴">${nav.map(([s,l])=>`<a href="${path(s)}" ${p.slug===s?'aria-current="page"':''}>${l}</a>`).join('')}</nav><details class="mobile-menu"><summary aria-label="메뉴 열기">☰</summary><nav aria-label="모바일 메뉴">${nav.map(([s,l])=>`<a href="${path(s)}">${l}</a>`).join('')}</nav></details><details class="family-sites family-top"><summary>Family Sites <span aria-hidden="true">▾</span></summary><div class="family-list" role="group" aria-label="키미 패밀리 사이트"><a href="https://calc.kyminfo.com/">키미 계산</a><a href="https://clock.kyminfo.com/">키미 타임</a><a href="https://file.kyminfo.com/" aria-current="page">키미 파일</a><a href="https://text.kyminfo.com/">키미 텍스트</a><a href="https://code.kyminfo.com/">키미 코드</a></div></details></div></header><main id="main" class="page-shell">${main}${more}<div class="trust-note"><span aria-hidden="true">ⓘ</span><div><strong>파일은 현재 브라우저에서 처리됩니다.</strong><p>대용량 파일은 기기 메모리에 따라 실패할 수 있습니다. 원본을 보관하고 결과를 확인해 주세요.</p></div></div></main><footer class="site-footer"><div class="footer-inner"><div><a class="brand" href="/"><span class="brand-mark" aria-hidden="true">K</span><span>키미 파일</span></a><p>가볍고 분명한 무료 파일 도구</p></div><nav aria-label="사이트 정보"><a href="/about/">소개</a><a href="/guide/">이용 안내</a><a href="/privacy/">개인정보 안내</a><a href="/terms/">이용약관</a><a href="/contact/">문의</a></nav><p class="copyright">© 2026 키미 파일</p><details class="family-sites"><summary>Family Sites <span aria-hidden="true">⌄</span></summary><div class="family-list" role="group" aria-label="키미 패밀리 사이트"><a href="https://calc.kyminfo.com/">키미 계산</a><a href="https://clock.kyminfo.com/">키미 타임</a><a href="https://file.kyminfo.com/" aria-current="page">키미 파일</a><a href="https://text.kyminfo.com/">키미 텍스트</a><a href="https://code.kyminfo.com/">키미 코드</a></div></details></div></footer><!-- 광고는 kyminfo.com 애드센스 상태 확인 후 별도 구현합니다. 현재 광고 요청 없음. --></body></html>`;
}
const schemaHashes=[];
for(const p of pages){
  const d=resolve(root,p.slug); mkdirSync(d,{recursive:true});
  const output=html(p);
  writeFileSync(resolve(d,'index.html'),output,'utf8');
  const json=output.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
  if(json) schemaHashes.push(`'sha256-${createHash('sha256').update(json).digest('base64')}'`);
}
// Keep a real top-level 404 in the build, preventing Pages' SPA fallback.
// This page deliberately stays outside the sitemap and JSON-LD hash list.
const notFound = html({slug:'404',title:'페이지를 찾을 수 없습니다 | 키미 파일',desc:'요청한 페이지를 찾을 수 없습니다. 키미 파일 홈에서 필요한 도구를 찾아보세요.',h1:'페이지를 찾을 수 없습니다',lead:'주소가 바뀌었거나 존재하지 않는 페이지입니다. 상단 로고를 눌러 홈으로 이동해 주세요.'})
 .replace('<head>','<head><meta name="robots" content="noindex, follow">')
 .replace(/<link rel="canonical"[^>]*>/,'')
 .replace(/<meta property="og:url"[^>]*>/,'')
 .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/,'');
writeFileSync(resolve(root,'404.html'),notFound,'utf8');
writeFileSync(resolve(root,'public','robots.txt'),`User-agent: *\nAllow: /\nSitemap: ${domain}/sitemap.xml\n`);
writeFileSync(resolve(root,'public','sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map(p=>`  <url><loc>${domain+path(p.slug)}</loc></url>`).join('\n')}\n</urlset>\n`);
writeFileSync(resolve(root,'public','_headers'),`/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  X-Frame-Options: DENY\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n  Content-Security-Policy: default-src 'self'; script-src 'self' https://static.cloudflareinsights.com ${schemaHashes.join(' ')}; style-src 'self'; img-src 'self' blob: data:; worker-src 'self' blob:; connect-src 'self' https://cloudflareinsights.com; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'\n`);
// Host rules apply only to Pages preview domains; production remains indexable.
// Include both the project domain and deployment/branch preview domains.
const headersPath=resolve(root,'public','_headers');
// The security headers above are generated first; append host-specific rules.
appendFileSync(headersPath,`\nhttps://:project.pages.dev/*\n  X-Robots-Tag: noindex\n\nhttps://:version.:project.pages.dev/*\n  X-Robots-Tag: noindex\n`);
console.log(`Generated ${pages.length} static pages and a standalone 404.`);
