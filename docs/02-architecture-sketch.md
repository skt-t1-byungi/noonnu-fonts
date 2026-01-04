# noonnu-fonts v2 리뉴얼: 아키텍처 스케치(초안)

**원본 설계 형태(데이터 모델: Source/Asset/Face/Family/Manifest, 파이프라인: ingest→inspect→normalize→validate→package→publish→update, 저장 정책: git에는 manifest/docs/tools만)**를 유지하면서, “읽히는 문서”를 위해 **파일 구조와 JSON 예시**를 추가합니다.

## 목표
수집(ingest) → 검사(inspect) → 정규화(normalize) → 검증(validate) → 패키징(package) → 배포(publish) → 업데이트 감지(update)를 “소스 독립적”이고 “결정적(deterministic)”으로 만든다.

## 핵심 개념(데이터 모델)
- **Source**: 폰트 출처(홈페이지/릴리즈/배포 페이지). 출처 URL과 라이선스 근거를 가진다.
- **Asset**: 실제 폰트 파일(woff2/ttf/otf 등). 해시/크기/다운로드 정보/라이선스 근거를 가진다.
- **Face**: 패밀리 내 스타일 단위(Weight/Italic/Variable axes). 어떤 Asset이 어떤 Face를 제공하는지 연결한다.
- **Family**: npm 배포 단위(사용자 관점의 1개 폰트 패밀리).
- **Manifest**: 위 모델을 JSON으로 고정한 레지스트리 파일(=git에 저장되는 핵심).

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
├── tools/                  # CLI / 파이프라인 엔트리포인트(구현은 TS)
│   └── ...                 # (후속: ingest/inspect/normalize/package/publish/update)
└── docs/
```

> 참고: npm 배포용 패키지(`packages/@noonnu/*`)는 **빌드 시 생성되는 산출물**이며, 원칙적으로 git 정본이 아니다.

## 2) Manifest 스키마(예시)

### 예시: `manifest/pretendard.json` (개념을 보여주기 위한 축약본)

```json
{
  "family": {
    "id": "pretendard",
    "displayName": "Pretendard",
    "license": {
      "spdx": "OFL-1.1",
      "evidenceUrl": "https://github.com/orioncactus/pretendard/blob/main/LICENSE"
    }
  },
  "sources": [
    {
      "id": "github-orioncactus-pretendard",
      "type": "github_release",
      "homepageUrl": "https://github.com/orioncactus/pretendard",
      "evidence": {
        "collectedAt": "2026-01-04T12:00:00Z",
        "licenseUrl": "https://github.com/orioncactus/pretendard/blob/main/LICENSE"
      }
    }
  ],
  "assets": [
    {
      "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "bytes": 345600,
      "format": "woff2",
      "filename": "Pretendard-Regular.woff2",
      "sourceId": "github-orioncactus-pretendard",
      "downloadUrl": "https://github.com/orioncactus/pretendard/releases/download/v1.3.9/Pretendard-Regular.woff2"
    }
  ],
  "faces": [
    {
      "id": "pretendard-normal-400",
      "weight": 400,
      "style": "normal",
      "variableAxes": [],
      "assetSha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    }
  ]
}
```

## 3) 파이프라인(초안)

1. **ingest**
   - 소스 커넥터가 URL을 수집하고 파일을 다운로드
   - 다운로드 결과를 Asset으로 기록(sha256 포함) + 출처/라이선스 근거를 함께 남김
2. **inspect**
   - 폰트 파일 내부 메타데이터 추출(패밀리/서브패밀리/OS/2 weight/italic/axes 등)
3. **normalize**
   - 규칙 기반으로 Family/Face를 묶고 이름/웨이트를 표준화
   - 충돌/애매한 케이스는 “검토 필요” 상태로 분리(LLM은 제안만)
4. **validate**
   - 라이선스/재배포 가능성/메타데이터 일관성 등 정책 위반 여부를 판단
5. **package**
   - Family 단위로 npm 패키지 산출물 생성(`index.css`, `fonts/*` 또는 빌드 시 포함, `README.md`)
6. **publish**
   - 변경된 패키지만 버전 bump 후 publish
7. **update**
   - 주기적으로 소스 업데이트 감지(해시 변경) → 파이프라인 재실행

## 4) 버전/변경 감지(원칙)
- 변경 감지는 **Asset sha256 변화**를 1차 기준으로 한다.
- 버전 증가는 “실제 폰트 파일(해시) 변화”와 “패키지 구성 변화”에 의해 결정되어야 한다. (세부 semver 매핑은 후속 문서/정책으로 확정)
