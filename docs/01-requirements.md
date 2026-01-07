# 요구사항 (What)

이 문서는 **MVP 구현의 “고정 요구사항”**만 정의한다. 고도화(큐/복잡한 판정/렌더 QA)는 제외한다.

---

## Done 기준 (Definition of Done)
- **Discovery** 워크플로가 돌아 신규 폰트 발견 시 PR이 생성된다.
- **중복/거절**(sha256 또는 upstreamUrl)인 경우 PR이 생성되지 않는다.
- PR merge 시 **즉시 build + npm publish** 된다.
- PR close(merge 아님) 시 **R2 객체 삭제 + `rejected.json` 갱신**이 된다.
- zip 1개에 family가 여러 개면 `fonts/*.yml` 여러 개가 생성되고 **각각 별도 패키지**로 publish 된다.
- `faces`는 **반드시 PostScriptName(psName)** 으로 지정된다.

---

## SSOT (레포에 남는 진실의 원천)
1) `fonts/<id>.yml` : 패키지 레시피  
2) `registry/sources.lock.json` : 원본 장부(sha256 → R2 key)  
3) `registry/rejected.json` : 거절 기록(sha256/url)

추가로 MVP 캐시로 `registry/seen-urls.json`(옵션)을 둘 수 있다. 후보 폴더(`candidates/`)는 만들지 않는다.

---

## 핵심 정책 (확정)

### 원본 보관 (R2)
- 다운로드 결과가 **ZIP이면**: 원본 ZIP을 **그대로** 저장(재압축/정규화 금지).
- ZIP이 아니면(ttf/otf 단일 등): **정규화 ZIP으로 래핑**해서 저장.
  - zip 내부 구조(최소):
    - `input/<originalfilename>.ttf|otf`
    - (선택) `meta/source.json` (url, retrievedAt)
- R2 Key(결정적): `sources/<sha256>.zip`

### 다운로드 링크 선택 (MVP)
- 후보 중 **`.zip` 우선**, 없으면 `.otf`, `.ttf`.
- 여러 개면 **가능하면 Content-Length 큰 것 우선**, 어려우면 첫 번째.

### 패키징
- zip을 풀고 ttf/otf만 대상으로 메타를 읽어 **family 그룹핑**
- family 그룹마다 **패키지 1개**
- `faces`는 **psName 기반**(파일명 기반 금지)
- weight/style은 자동 추정 초안 생성(Regular=400, Bold=700 등), PR에서 수정 가능

### 배포
- PR merge 즉시 build → npm publish

### 반복 PR 방지 (MVP 최소)
PR 생성 직전(또는 업로드 전) 체크:
- `sources.lock.json`에 같은 sha256 있으면 스킵
- `rejected.json`에 같은 sha256 있으면 스킵
- `rejected.json`에 같은 upstreamUrl 있으면 스킵

### Cleanup (주기 GC 없음)
- PR close 이벤트에서 `merged=false`이면:
  - PR이 올린 R2 객체 삭제
  - 동시에 `rejected.json`에 `{sha256, upstreamUrl, rejectedAt}` append(중복이면 스킵)
- 삭제 안전장치:
  - main 브랜치 `sources.lock.json`에 sha256이 존재하면 삭제하지 않음

---

## PR 본문 메타 (필수)
discover가 생성하는 PR body에 아래 라인을 **그대로 포함**해야 한다(파싱/cleanup/필터에 사용).

```text
R2_KEYS:
- sources/<sha256>.zip

SHA256:
- <sha256>

UPSTREAM_URL: <pageUrl>
DOWNLOAD_URL: <downloadUrl>
```

---

## 파일 포맷 스펙 (SSOT)

### `registry/sources.lock.json` (최소)
```json
{
  "sources": [
    {
      "sha256": "hex",
      "r2Key": "sources/<sha256>.zip",
      "url": "https://upstream/page-or-download",
      "retrievedAt": "ISO8601"
    }
  ]
}
```

### `registry/rejected.json` (최소)
```json
{
  "rejected": [
    {
      "sha256": "hex",
      "upstreamUrl": "https://...",
      "rejectedAt": "ISO8601",
      "reason": "optional"
    }
  ]
}
```

### `fonts/<id>.yml` (MVP 최소)
```yaml
id: gyeonggi-batang
packageName: "@kfonts/gyeonggi-batang"

source:
  sha256: "SOURCE_ZIP_SHA256"

family:
  en: "Gyeonggi Batang"
  ko: "경기바탕"  # optional

faces:
  - psName: "GyeonggiBatang-Regular"
    weight: 400
    style: normal
  - psName: "GyeonggiBatang-Bold"
    weight: 700
    style: normal
```

---

## 워크플로/스크립트 요구사항 (요약)
- `scripts/discover.ts`: 스캔→다운로드→(필요 시 래핑)→sha256→중복/거절 필터→R2 업로드→`fonts/*.yml`+registry 업데이트→PR 생성
- `scripts/build.ts`: main push 시 R2에서 원본 fetch→manifest 기반 파일 선택→woff2/css/pkg 생성→npm publish
- `cleanup.yml`: PR close(merge 아님) 시 PR body 파싱→안전 체크→R2 삭제→`rejected.json` 갱신 커밋

---

## 최소 환경변수 요구사항
- **GitHub**: PR 생성/커밋/머지 후 작업을 위한 토큰
- **R2**: endpoint/bucket/access key/secret
- **npm**: publish를 위한 토큰
- (선택) **LLM API**: 다운로드 링크 추출/네이밍 초안
