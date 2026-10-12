# 키미 파일

file.kyminfo.com에서 운영하는 한국어 파일 도구입니다. 기존 키미 계산·키미 타임의 K 로고와 카드형 디자인을 이어갑니다. 회원가입, 자체 DB, 파일 업로드 API는 없습니다.

## 현재 기능

- JPG·PNG·WebP 이미지 압축, 크기 조절, 형식 변환, 목표 용량 맞추기
- EXIF/GPS 확인 및 재인코딩 후 검출 가능한 항목 재검사
- 여러 이미지 순차 처리, 결과 비교, 개별·ZIP 다운로드
- XLSX 읽기 전용 용량 분석
- 검증 가능한 XLSX의 보존형 ZIP 재압축: 내부 항목 이름·수·바이트를 전후 비교하고 실제로 작아진 경우에만 제공
- 13개의 정적 검색 페이지, 사이트맵, robots.txt, 보안 헤더

## 로컬 실행

Node.js 22 이상과 pnpm 11이 필요합니다. 프로젝트 폴더에서 pnpm install, pnpm dev를 순서대로 실행하고 http://localhost:5173/ 을 엽니다. 프로덕션 빌드는 pnpm build이며 결과는 dist 폴더에 생성됩니다. 페이지 내용을 수정했다면 scripts/generate.mjs를 실행하거나 다시 빌드하세요.

## Cloudflare Pages 배포 설정

GitHub 저장소에 이 폴더를 올린 뒤 Cloudflare Pages에서 연결합니다.

| 설정 | 값 |
|---|---|
| 프로덕션 브랜치 | main |
| 빌드 명령 | pnpm build |
| 출력 디렉터리 | dist |
| 환경 변수 | PNPM_VERSION=11.25.0, NODE_VERSION=22 |

Pages 사용자 정의 도메인에 file.kyminfo.com을 추가한 뒤 가비아 DNS에 file CNAME을 해당 Pages 프로젝트의 pages.dev 주소로 연결합니다. 기존 @, blog, calc, clock 레코드는 변경하지 않습니다. 도메인 연결 후 HTTPS, 페이지별 canonical, sitemap.xml, robots.txt를 확인합니다.

## 개인정보와 광고

선택한 파일의 바이트는 브라우저의 Canvas·JavaScript·JSZip·ExifReader에서 처리합니다. 파일 자체를 서버, 광고, 분석 서비스로 전송하는 코드는 없습니다. 정적 사이트 접속에는 호스팅 업체의 통상적인 요청 기록이 발생할 수 있습니다.

광고 및 GA4 스크립트는 현재 없습니다. kyminfo.com의 AdSense 상태를 확인한 뒤 필요한 동의 처리·개인정보 고지를 먼저 갱신하고 업로드·실행·다운로드 컨트롤과 떨어진 곳에 광고를 추가합니다. 광고 승인·검색 순위·수익은 보장하지 않습니다.

## 실제 제한

- 움직이는 WebP, SVG, HEIC, XLS, XLSM, XLSB, 암호화 XLSX는 지원하지 않습니다.
- 이미지 30MB/개·50개·선택 합계 150MB, XLSX 20MB/개·10개·선택 합계 80MB. XLSX 압축 해제 합계는 120MB 이하입니다. 큰 파일은 브라우저 메모리 상태에 따라 더 작은 경우에도 실패할 수 있습니다.
- PNG에는 손실 화질 슬라이더가 적용되지 않습니다. 목표 크기는 달성하지 못할 수 있습니다.
- 이미지 재인코딩 시 메타데이터·색상 프로파일이 달라질 수 있습니다. 모든 비표준 메타데이터 제거를 보증하지 않습니다.
- XLSX 최적화는 ZIP 내부 파일·폴더의 이름과 종류, 압축 해제 후 파일 바이트의 동일성을 검증합니다. ZIP 컨테이너의 압축 방식 등은 바뀌며 Excel에서의 모든 기능 호환성까지 보증하지 않습니다. 원본을 보관하고 실제 Excel에서 열어 확인해야 합니다. 이미 효율적인 문서는 더 작아지지 않아 결과 다운로드를 제공하지 않습니다.
- 모바일에서 많은 파일을 한 번에 선택하면 기기 메모리 부족으로 브라우저가 중단될 수 있습니다.
- 작업 취소는 브라우저가 현재 디코딩·압축 호출을 마친 뒤 반영될 수 있습니다. 긴 작업을 별도 Worker로 옮기는 것은 후속 개선 과제입니다.

## 검증

scripts/make-fixtures.py는 Pillow·openpyxl이 있는 환경에서 예제 이미지와 XLSX를 만듭니다. 테스트 파일은 tests/fixtures 폴더에 생성되며 Git에는 포함되지 않습니다. 개발 서버가 실행 중일 때 `pnpm test:e2e`로 Chrome 브라우저 시나리오를 실행합니다. Edge는 `node scripts/e2e.mjs msedge`로 검사할 수 있습니다. 내려받은 결과는 tests/actual에 저장되며 `python scripts/verify-outputs.py`로 Pillow·openpyxl을 통한 독립적인 파일 열기 검사를 합니다.

2026-10-08 기준 Chrome·Edge와 프로덕션 빌드 미리보기에서 23개 시나리오가 각각 통과했습니다. JPG·PNG·WebP 변환, 투명도와 배경색, 가로·세로 크기 변경, 목표 KB와 미달 안내, EXIF/GPS 제거, 회전 방향, 손상 파일·움직이는 WebP 거절, 중복 파일명 ZIP, XLSX 분석·재압축·폴더 보존·매크로 위장·압축 폭탄 거절을 검증했습니다. 결과 이미지 16개와 ZIP, XLSX 3개는 Pillow·openpyxl로 다시 열어 확인했습니다. `pnpm audit --prod`에서 알려진 취약점은 보고되지 않았습니다. 실제 Microsoft Excel 데스크톱, Firefox·Safari 및 모바일 기기의 실행 검증은 아직 하지 않았습니다.

## 라이브러리

- React, React DOM: MIT
- JSZip: MIT 또는 GPL-3.0-or-later 중 MIT 조건 선택
- ExifReader: MPL-2.0. 원본 라이브러리는 https://github.com/mattiasw/ExifReader 에서 제공합니다. 라이브러리 원본을 수정하지 않았습니다.
- Vite, TypeScript: 개발 도구. 라이선스는 각 패키지에 따릅니다.

## 다음 확장

긴 작업의 Worker 처리와 즉시 취소, 모바일 기기의 대용량 성능 검증이 우선입니다. 파일명 일괄 변경과 텍스트 워터마크는 핵심 도구의 안정성 확인 후 검토합니다. 공개 전에는 실제 Excel 데스크톱에서 최적화 결과를 열고, iOS Safari·Android Chrome에서도 큰 파일과 다운로드 동작을 확인해야 합니다.


## 운영 기준선

2026-10-12 운영 확인: HTTPS 배포, Google·네이버 소유확인 및 사이트맵 제출은 완료한 상태입니다. Google URL Inspection에서 홈페이지 색인 PASS를 확인했습니다. 하위 페이지 전체 색인이나 네이버 검색 노출을 보장하는 의미는 아닙니다. Cloudflare Web Analytics가 활성화되어 있으며 개인정보 안내에 반영되어 있습니다. 계산 입력·문서·파일 내용은 통계로 전송하지 않습니다. 광고는 비활성입니다. 운영 점검 증빙은 개발 작업 공간의 `outputs/phase0-2026-10-12/REPORT.md`에 보관합니다.

## 2026-10-12 검색 오류 수정

생성기가 만드는 최상위 `404.html`을 Vite 입력에 포함했습니다. 없는 주소의 SPA 폴백을 방지하고, 404 페이지는 사이트맵에서 제외하며 noindex를 표시합니다. 빌드 후 `scripts/check-build.mjs`로 14개 HTML·13개 사이트맵 URL·내부 참조·CSP·미리보기 noindex를 확인합니다. Pages 미리보기 호스트에만 noindex 응답 규칙을 적용합니다.

## 2026-10-12 개선 검토

[로컬 변경·검증 범위](IMPLEMENTATION-2026-10-12.md). 0단계 이후 추가 개선은 운영 미배포이며 실제 브라우저/결과물 검증은 남아 있습니다.
