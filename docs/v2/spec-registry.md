## 레지스트리 목적

V2에서 레지스트리는 “폰트를 어떻게 찾았고, 어떤 근거로 배포 가능한지, 어떤 파일을 배포하는지”를 한 곳에 모은 **소스 오브 트루스**다.

원칙:

- 레지스트리 변경은 리뷰 가능한 텍스트(JSON/YAML)로 남긴다.
- 모든 결정(배포 포함)은 레지스트리 상태(`reviewStatus`)를 기준으로 한다.
- 네트워크에서 가져온 외부 텍스트(라이선스/소개)는 “증거”로 별도 보관하고, 레지스트리에는 참조(해시/경로/URL)만 둔다.

## 파일 레이아웃(제안)

- `data/v2/registry/fonts.json`
  - 폰트 엔트리들의 배열(또는 키드 딕셔너리)
- `data/v2/evidence/<fontId>/...`
  - 라이선스/소개/다운로드 페이지 원문 스냅샷(HTML/PDF/TXT)
- `data/v2/artifacts/<fontId>/original/...`
  - 원본 다운로드(가능하면 zip 그대로)
- `out/v2/packages/...`
  - 패키징 산출물(배포 후보)

## 스키마(핵심 필드)

### FontRecord (개별 폰트)

- `id`: 안정적인 내부 ID(불변)
- `slug`: 패키지/경로에 쓰는 식별자(소문자, 하이픈)
- `displayName`: 사람이 읽는 이름(한글/영문)
- `familyName`: CSS `font-family`로 사용할 이름(원문 기준)
- `version`: 레지스트리 엔트리 버전(데이터 버전; npm 버전과 분리 가능)
- `sources[]`:
  - `sourceUrl`: 출처(소개 페이지)
  - `downloadUrl`: 다운로드 링크(직접 또는 릴리즈)
  - `licenseUrl`: 라이선스/이용조건 링크
  - `discoveredAt`: 발견 시각
- `evidence[]`:
  - `kind`: `license` | `homepage` | `download_page` | `other`
  - `url`: 원문 URL
  - `capturedAt`: 캡처 시각
  - `sha256`: 스냅샷 해시
  - `path`: 저장 경로
- `license`:
  - `summary`: 짧은 요약(LLM 가능)
  - `redistributionAllowed`: 재배포 가능 여부(정책의 핵심)
  - `commercialUseAllowed`
  - `modificationAllowed`
  - `attributionRequired`
  - `restrictions[]`: 제한사항 텍스트(예: “CI/로고 사용 금지”)
  - `confidence`: `low|medium|high`
  - `reviewStatus`: `blocked|needs_review|approved`
  - `reviewNotes`: 검토 메모(사람)
- `artifacts[]`:
  - `kind`: `original_zip|ttf|otf|woff|woff2`
  - `sha256`, `size`, `path`, `sourceUrl`
- `quality`:
  - `validationStatus`: `pass|warn|fail`
  - `issues[]`: 품질 이슈(손상, 이름 불일치, 포맷 미지원 등)
  - `unicodeCoverage`: 범위/통계(선택)

## 상태 모델(승인 게이트)

- `blocked`: 정책상 배포 불가(또는 명확히 금지)
- `needs_review`: 자동 판정 불충분(증거 부족/애매함/검증 실패)
- `approved`: 정책 요건 충족 + 증거 확보 + 품질 검증 통과(또는 허용 가능한 경고)

## 레지스트리 변경 규칙(권장)

- 모든 `approved` 엔트리는 최소 1개 이상의 `license` 증거 스냅샷을 가진다.
- 모든 `artifacts[]`는 `sha256`를 가진다.
- 패키징은 “`approved` + 필요한 포맷 준비됨”을 만족한 엔트리만 대상으로 한다.

