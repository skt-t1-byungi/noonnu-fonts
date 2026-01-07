# 아키텍처 (How, MVP)

이 프로젝트는 “한글 폰트 디스커버리 → R2 아카이브 → npm 웹폰트 퍼블리싱”을 **PR 단위로 자동화**한다.

> 브랜치 운영: 레포 규칙에 따라 **`v2` 브랜치만 사용**한다. 아래 문서에서 “main”은 “`v2`”로 읽는다.

---

## 1) 레포 구조
```text
repo/
  fonts/                         # [SSOT] 패키지 레시피 (family/psName 기준)
    <id>.yml
  registry/                      # [SSOT] 원본 장부 + 거절 기록 + (옵션) URL 캐시
    sources.lock.json
    rejected.json
    seen-urls.json               # optional (MVP 캐시)
  scripts/
    discover.ts                  # schedule: PR 생성
    build.ts                     # push(v2): build + publish
    pack.ts                      # optional: build에서 호출
  .github/workflows/
    discovery.yml
    release.yml
    cleanup.yml
  docs/
```

---

## 2) 데이터/SSOT 모델

### 2.1 `fonts/<id>.yml` (패키지 레시피)
- **입력**: `source.sha256` (원본 zip의 sha256)
- **family**: 표시용(영문/한글), 자동 초안 가능
- **faces**: 빌드가 선택할 폰트 집합. **psName으로만 지정**(파일명 금지)

### 2.2 `registry/sources.lock.json` (원본 장부)
- sha256 → R2 key(`sources/<sha256>.zip`) 매핑
- `url`은 upstream page 또는 download url 중 하나(최소 1개)
- `retrievedAt`은 **장부에만** 기록(원본 zip 내부에 timestamp를 넣지 않음)

### 2.3 `registry/rejected.json` (거절 기록)
- 중복 PR 방지 필터에 사용: sha256 또는 upstreamUrl 매치 시 스킵

### 2.4 `registry/seen-urls.json` (옵션, MVP 캐시)
가장 단순한 형태(권장):
```json
{ "seen": ["https://detail/page/1", "https://detail/page/2"] }
```
- 발견한 상세 페이지 URL은 **결과와 무관하게**(PR 생성/스킵 모두) 추가한다.
- MVP에서는 크기 관리/GC를 하지 않는다.

---

## 3) R2 아카이브 규칙 (결정적)

### 3.1 R2 key
`sources/<sha256>.zip`

### 3.2 sha256 계산
- 다운로드 결과가 zip이면: **다운로드한 zip 바이트 그대로**에 대해 sha256 계산.
- zip이 아니면: 아래 “정규화 zip 래핑”으로 만든 **결정적 zip 바이트**에 대해 sha256 계산.

### 3.3 정규화 zip 래핑 (zip이 아닐 때만)
목표: “같은 입력 파일이면 같은 zip/sha256”이 되게 한다(중복 PR 방지).

- zip 내부 구조(최소):
  - `input/<originalfilename>.ttf|otf`
  - (선택) `meta/source.json` (권장: `{"url":"..."}` 만; timestamp는 넣지 않음)
- zip 생성 규칙(결정적):
  - 파일 순서 고정, timestamp 고정(예: epoch), 불필요한 메타데이터 금지

---

## 4) 워크플로 3종

### 4.1 Discovery: `discovery.yml` + `scripts/discover.ts`
트리거:
- `schedule` (매일)
- `workflow_dispatch`

출력:
- 신규 “원본 1건”마다 PR 1개

동작(요약):
1) 눈누/KOGL/공유마당 목록 스캔 → 신규 상세 페이지 URL 찾기
2) 상세 페이지에서 다운로드 링크 후보 추출(LLM 또는 간단 파서)
3) 링크 선택(zip 우선)
4) 다운로드 → (필요 시) 정규화 zip 래핑 → sha256
5) **반복 PR 방지 필터**(업로드/PR 생성 전):
   - `sources.lock.json`에 sha256 있으면 종료
   - `rejected.json`에 sha256 있으면 종료
   - `rejected.json`에 upstreamUrl 있으면 종료
6) R2 업로드(이미 존재하면 스킵): `sources/<sha256>.zip`
7) zip 풀기 → `.ttf/.otf`만 스캔 → 폰트 메타 추출(psName, familyName 등)
8) family별 그룹핑 → 그룹마다 `fonts/<id>.yml` 생성(초안)
9) `registry/sources.lock.json` append/update
10) PR 생성(필수 PR body 메타 포함)

PR body 필수 메타:
```text
R2_KEYS:
- sources/<sha256>.zip

SHA256:
- <sha256>

UPSTREAM_URL: <pageUrl>
DOWNLOAD_URL: <downloadUrl>
```

---

### 4.2 Release: `release.yml` + `scripts/build.ts`
트리거:
- `push` to `v2` (PR merge 직후)

동작(요약):
1) 변경된 `fonts/*.yml` 파악(또는 전체 스캔 후 신규/변경만 처리)
2) 각 manifest의 `source.sha256`로 `sources.lock.json`에서 `r2Key` 조회
3) R2에서 zip 다운로드 (동일 sha 공유 시 1회만 fetch/scan 캐시 가능)
4) zip 풀기 → 폰트 파일 메타(psName) 인덱싱
5) manifest의 `faces[].psName`에 해당하는 폰트 파일만 선택
6) woff2 변환 + CSS 생성 + npm 패키지 구조 생성
7) npm publish

---

### 4.3 Cleanup: `cleanup.yml` (PR close 시)
트리거:
- `pull_request.closed`

조건:
- `merged == false` 인 경우만 실행

동작(요약):
1) PR body에서 `R2_KEYS`, `SHA256`, `UPSTREAM_URL` 파싱
2) `v2` 브랜치의 `registry/sources.lock.json`을 읽어 sha256 존재 여부 확인
   - 존재하면 삭제하지 않음(안전장치)
3) 존재하지 않으면 R2에서 `R2_KEYS` 삭제
4) `registry/rejected.json`에 `{sha256, upstreamUrl, rejectedAt}` append(중복이면 스킵)
5) 봇 커밋으로 `registry/rejected.json` 업데이트를 `v2`에 반영

---

## 5) npm 패키지 출력 구조 (MVP 제안)
목표: 소비자가 아래처럼 쓸 수 있어야 한다.
- `import "@kfonts/<pkg>/css"`

빌드 산출물(예시):
```text
packages/<id>/
  package.json
  README.md
  dist/
    index.css
    files/
      <psName>.woff2
```

`package.json` 최소 요건(예시):
```json
{
  "name": "@kfonts/gyeonggi-batang",
  "version": "0.1.0",
  "private": false,
  "files": ["dist", "README.md"],
  "style": "dist/index.css",
  "exports": {
    "./css": "./dist/index.css"
  }
}
```

CSS는 `@font-face`를 생성하고, `src: url("./files/<...>.woff2") format("woff2")` 형태로 로컬 파일을 참조한다.

---

## 6) 버전 정책 (MVP 제안: 자동 patch bump)
MVP에서는 레포에 별도 버전 SSOT를 두지 않고, publish 시점에 npm에서 최신 버전을 조회해 **patch + 1**로 발행한다.

- 첫 발행: `0.1.0`
- 이후: `npm view <name> version` 결과가 있으면 `x.y.(z+1)`
- 아직 없으면 `0.1.0`

> 이 방식은 “changesets 도입”보다 설정이 단순하고, “merge 즉시 publish”와 잘 맞는다.

---

## 7) LLM 사용 범위 (MVP 제한)
- 허용:
  - 상세 페이지에서 다운로드 링크 후보 추출
  - `id/packageName/family 표기` 초안 생성
- 금지:
  - 최종 패밀리 판정/복잡한 매칭/후보 큐 운영

