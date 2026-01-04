# noonnu-fonts v2 리뉴얼: 아키텍처 스케치(단순화 초안)

v2의 1차 목표는 “정답 판정 알고리즘”이 아니라, **사람의 결정(커먼센스)을 지속적으로 누적/재사용**할 수 있는 정본(SoT)을 만드는 것입니다.
LLM은 폰트 메타데이터로 자동 정답을 맞히기 위한 엔진이 아니라, **모호한 지점을 큐로 관리하고 결정/근거를 문서화하는 보조**입니다.

- **정본(SoT)**: `manifest/<family>.json` + `review-queue/*.json`
- **핵심은 “결정 + 근거”**: 폰트 메타데이터는 정답이 아니라 evidence(증거)다.
- **식별자는 가능한 한 “해시(sha256)”로 대체**한다(파일 동일성/변경 감지용).
- `id`는 **Family에만 1개** 둔다(=패키지명/파일명/레지스트리 키).
- Deterministic은 “판정”이 아니라, **정본/패키징 산출물의 재현성**에만 적용한다.

## 목표
“하나의 폰트(패밀리)”를 규칙으로 자동 판정하려 하지 않고,
- 모호한 케이스를 **리뷰 큐로 축적**하고
- LLM의 제안을 참고해 **사람이 결정**하며
- 결정과 근거가 **재사용/추적 가능**하도록 남기는 것.

부수 목표는 다음과 같다.
- git에는 정본(JSON)만 저장하고, 바이너리는 외부에 두어 레포를 가볍게 유지한다.
- `manifest/<family>.json`만으로 패키징을 재현 가능하게 만든다.

## 핵심 개념(최소 데이터 모델)
- **FamilyManifest**: npm 배포 단위(사용자 관점의 1개 폰트 패밀리)에 대한 정본. 핵심은 `files[]` + `decision` + `evidence`.
- **FontFileRecord**: 폰트 파일 1개에 대한 최소 레코드. `sha256`로 동일성을 관리한다.
- **ReviewItem**: “이걸 같은 패밀리로 묶을까?” 같은 **모호 지점**을 다루는 큐 항목. LLM 제안 + 사람 결정을 저장한다.

## 저장 정책(원칙)
- **git에 커밋되는 것**: `manifest/`(JSON), `tools/`(CLI), `docs/` (+ 필요 시 락파일/스키마)
- **git에 커밋하지 않는 것**: 폰트 바이너리(woff/ttf/otf 등), 빌드 산출물(패키지/압축 아카이브 등)
- **바이너리 저장**: 외부 스토리지(CAS; Content Addressed Storage)에 저장하고 **sha256**로 참조한다.

## 1) 디렉토리 구조 (Directory Structure)

```
repo/
├── manifest/               # [Source of Truth] 패밀리 단위 Manifest JSON
│   ├── pretendard.json
│   ├── nanum-gothic.json
│   └── ...
├── review-queue/            # 모호 케이스 큐(LLM 제안 + 사람 결정)
│   ├── 2026-01-04-pretendard-vs-pretendard-jp.json
│   └── ...
├── tools/                  # CLI / 파이프라인 엔트리포인트(구현은 TS)
│   └── ...                 # (후속: review-queue 관리 / package / publish)
└── docs/
```

> 참고: npm 배포용 패키지(`packages/@noonnu/*`)는 **빌드 시 생성되는 산출물**이며, 원칙적으로 git 정본이 아니다.

## 2) Manifest 스키마(예시)

아래 예시는 “단순함”을 우선하는 1차 스키마입니다. 핵심은 폰트 메타의 완전성이 아니라,
**사람의 결정과 근거가 재사용 가능하게 남는 것**입니다.

- **결정성 규칙**:
  - `family.id`는 패키지명과 1:1 (`@noonnu/<family.id>`)
  - `files[]`는 `(filename, format, sha256)`로 정렬한다(후속 정책으로 고정)
  - 폰트 내부 메타데이터 추출값은 정규화된 필드로 강제하지 않고, `evidence[]`에 원문으로 남길 수 있다.

### 예시: `manifest/pretendard.json` (축약본)

```json
{
  "schemaVersion": 1,
  "family": {
    "id": "pretendard",
    "displayName": "Pretendard",
    "cssFamily": "Pretendard"
  },
  "license": {
    "status": "ok",
    "spdx": "OFL-1.1",
    "evidenceUrl": "https://github.com/orioncactus/pretendard/blob/main/LICENSE",
    "notes": ""
  },
  "decision": {
    "summary": "Pretendard는 Regular~Bold(및 Italic 포함)를 하나의 패밀리로 배포한다.",
    "rationale": "사용자 관점에서 같은 폰트 패밀리로 인지되며, 업스트림도 동일 패밀리로 배포한다.",
    "decidedAt": "2026-01-04T12:00:00Z"
  },
  "evidence": [
    {
      "type": "link",
      "label": "Upstream",
      "url": "https://github.com/orioncactus/pretendard"
    }
  ],
  "files": [
    {
      "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "bytes": 345600,
      "format": "woff2",
      "filename": "Pretendard-Regular.woff2",
      "origin": {
        "downloadUrl": "https://github.com/orioncactus/pretendard/releases/download/v1.3.9/Pretendard-Regular.woff2",
        "collectedAt": "2026-01-04T12:00:00Z"
      }
    }
  ]
}
```

### 예시: `review-queue/pretendard-vs-pretendard-jp.json` (축약본)

```json
{
  "schemaVersion": 1,
  "status": "open",
  "question": "Pretendard와 Pretendard JP를 같은 패밀리로 묶을까?",
  "candidates": {
    "families": ["pretendard", "pretendard-jp"],
    "fontSha256": ["..."]
  },
  "evidence": [
    {
      "type": "manual_note",
      "source": "FontTools/otfinfo/기타 수동 도구 결과",
      "text": "name table에서 family/subfamily가 유사하나, 일부 glyph 범위/서브패밀리 네이밍이 다름"
    }
  ],
  "llmSuggestion": {
    "proposal": "split",
    "rationale": "JP 표기는 사용자가 별도 폰트로 인지할 가능성이 높음. 혼합 시 기대하지 않은 glyph 변화가 발생할 수 있음.",
    "followups": ["glyph coverage 차이 확인", "업스트림의 배포 의도(README/릴리즈 노트) 확인"]
  },
  "humanDecision": null,
  "createdAt": "2026-01-04T12:00:00Z"
}
```

## 3) 파이프라인(단순화 초안)

## 3) 운영 흐름(최소)

1. **수집(collect)**
   - 사람이 다운로드 URL(또는 로컬 파일)을 확보한다.
   - 파일의 `sha256/bytes/format/filename`만 기록한다.
2. **모호 케이스 등록(queue)**
   - “같은 패밀리로 묶을지/갈라야 할지” 애매하면 `review-queue/*.json`을 만든다.
   - 수동 도구 결과(원문)와 링크를 `evidence[]`로 첨부한다.
3. **LLM 제안(suggest)**
   - LLM은 `proposal(merge/split/keep)` + `rationale` + `followups`를 작성한다.
4. **사람 결정(decide)**
   - 사람이 결정을 확정하고, 그 결정을 `manifest/<family>.json`의 `decision/evidence/files[]`로 반영한다.
5. **패키징/배포(package/publish)**
   - 배포는 `manifest/<family>.json`만을 입력으로 재현 가능하게 수행한다.

## 4) 버전/변경 감지(원칙)
- 변경 감지는 **`files[].sha256` 변화**를 1차 기준으로 한다.
- v2 초기에는 복잡한 규칙을 피하기 위해, **변경이 있으면 patch bump**로 시작한다.
