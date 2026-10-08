# 키미 파일랩

file.kyminfo.com에 배포할 한국어 파일 도구입니다. 기존 키미 계산랩·키미 타임의 K 로고와 카드형 디자인을 이어갑니다. 회원가입, 자체 DB, 파일 업로드 API는 없습니다.

## 현재 기능

- JPG·PNG·WebP 이미지 압축, 크기 조절, 형식 변환, 목표 용량 맞추기
- EXIF/GPS 확인 및 재인코딩 후 검출 가능한 항목 재검사
- 여러 이미지 순차 처리, 결과 비교, 개별·ZIP 다운로드
- XLSX 읽기 전용 용량 분석
- 검증 가능한 XLSX의 보존형 ZIP 재압축: 내부 항목 이름·수·바이트를 전후 비교하고 실제로 작아진 경우에만 제공
- 13개의 정적 검색 페이지, 사이트맵, robots.txt, 보안 헤더

## 로컬 실행

Node.js 22 이상과 pnpm 11이 필요합니다. 프로젝트 폴더에서 pnpm install, pnpm dev를 순서대로 실행하고 http://localhost:5173/ 을 엽니다. 프로덕션 빌드는 pnpm build이며 결과는 dist 폴더에 생성됩니다. 페이지 내용을 수정했다면 scripts/generate.mjs를 실행하거나 다시 빌드하세요.

## Cloudflare Pages 배포 준비

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
- 이미지 30MB/개·50개, XLSX 20MB/개·10개. XLSX 압축 해제 합계는 120MB 이하입니다. 큰 파일은 브라우저 메모리 상태에 따라 더 작은 경우에도 실패할 수 있습니다.
- PNG에는 손실 화질 슬라이더가 적용되지 않습니다. 목표 크기는 달성하지 못할 수 있습니다.
- 이미지 재인코딩 시 메타데이터·색상 프로파일이 달라질 수 있습니다. 모든 비표준 메타데이터 제거를 보증하지 않습니다.
- XLSX 최적화는 ZIP 내부 항목의 바이트 동일성을 검증합니다. Excel에서의 모든 기능 호환성까지 보증하지 않습니다. 원본을 보관하고 실제 Excel에서 열어 확인해야 합니다. 이미 효율적인 문서는 더 작아지지 않아 결과 다운로드를 제공하지 않습니다.
- 모바일에서 많은 파일을 한 번에 선택하면 기기 메모리 부족으로 브라우저가 중단될 수 있습니다.

## 검증

scripts/make-fixtures.py는 Pillow·openpyxl이 있는 환경에서 예제 이미지와 XLSX를 만듭니다. 테스트 파일은 tests/fixtures 폴더에 생성되며 Git에는 포함되지 않습니다. 브라우저에서 이미지 처리·XLSX 분석·재압축·다운로드를 확인하고, 내려받은 XLSX를 Excel 또는 openpyxl에서 다시 열어 확인합니다.

## 라이브러리

- React, React DOM: MIT
- JSZip: MIT 또는 GPL-3.0-or-later 중 MIT 조건 선택
- ExifReader: MPL-2.0. 원본 라이브러리는 https://github.com/mattiasw/ExifReader 에서 제공합니다. 라이브러리 원본을 수정하지 않았습니다.
- Vite, TypeScript: 개발 도구. 라이선스는 각 패키지에 따릅니다.

## 다음 확장

파일명 일괄 변경, 텍스트 워터마크, 브라우저별 대용량 성능 개선은 핵심 기능의 안정성 확인 후 추가합니다.
