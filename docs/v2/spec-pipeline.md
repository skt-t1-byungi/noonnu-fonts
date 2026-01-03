## 파이프라인 목표

V2 파이프라인은 “자동으로 많이”가 아니라, **안전하게(라이선스) + 재현 가능하게(해시) + 고품질로(검증/변환)**를 목표로 한다.

## 단계 정의

### Stage A: Discover (후보 발견)

- 입력:
  - 키워드, 카테고리, 시드 URL 리스트, 또는 검색 API 결과
- 출력:
  - `FontCandidate[]`
- 최소 포함 필드:
  - `displayName`, `sourceUrl`, `licenseUrl(가능하면)`, `downloadUrl(가능하면)`

### Stage B: Harvest Evidence (증거 수집)

- 동작:
  - `sourceUrl/licenseUrl/downloadUrl`의 원문을 스냅샷으로 저장
  - 저장물에 `sha256`를 부여하고 레지스트리에 연결
- 실패 처리:
  - 일시적 실패는 재시도/백오프
  - 영구 실패는 `needs_review`로 보내고 사유 기록

### Stage C: License Classification (정책 필드 채움)

- 입력:
  - 증거 원문 텍스트(HTML → 텍스트 추출 포함)
- 출력:
  - `license.*` 필드 + `reviewStatus`
- 규칙:
  - “재배포 가능”이 명확히 확인되지 않으면 기본값은 `needs_review`
  - LLM 사용 시에는 반드시 “근거 URL/스냅샷 경로”를 함께 기록

### Stage D: Fetch Artifacts (원본 다운로드/고정)

- 동작:
  - 다운로드 링크에서 원본(zip/otf/ttf)을 받아 `artifacts`로 등록
  - `sha256/size` 고정
- 주의:
  - 자동 다운이 약관 위반일 수 있는 경우 `blocked`로 분기(정책에서 정의)

### Stage E: Validate Fonts (품질 검증)

검증 예시(초기 목표):

- 파일 파싱 가능 여부(손상/비정상)
- `name` 테이블(패밀리/서브패밀리) 존재 및 정합성
- 웹 배포 권장 포맷(woff2) 준비 여부(없으면 변환 단계로)

### Stage F: Transform (옵션: 변환/서브셋)

고품질 퍼블리싱을 위해 권장(선택):

- `ttf/otf` → `woff2` 변환
- 필요 시 `unicode-range` 기반 분리/서브셋(번들 크기 최적화)
- 가변폰트(variable) 유지 전략

### Stage G: Package (패키지 생성)

- 산출물:
  - `index.css` (font-face 정의 + 파일 참조)
  - `fonts/*` (woff2 중심)
  - `meta.json` (레지스트리 핵심 요약)
  - `LICENSE.md` 또는 `LICENSE.txt` (가능하면 원문/요약 + 링크)
  - `EVIDENCE.md` (증거 링크/해시)
  - `README.md` (설치/사용/주의)
  - `example.png` (렌더링 스냅샷)

### Stage H: Publish (배포)

- 원칙:
  - `reviewStatus=approved`만 배포
  - 배포 시점에 레지스트리 스냅샷(태그/아티팩트)도 함께 저장
- 정책:
  - 라이선스 변경/배포 중단 감지 시 `deprecate`/`unpublish` 규칙 문서화

## 실행 모드(운영)

- `dry-run`: 네트워크/파일 다운로드 없이 레지스트리 검증만
- `ci-weekly`: Discover→(Review 대기 생성)까지만 자동, Publish는 승인 후 실행
- `local-review`: 증거 확인/라이선스 판정/승인 처리

