# noonnu-fonts v2 리뉴얼: 아키텍처 스케치(초안)

## 목표
수집(ingest) → 검사(inspect) → 정규화(normalize) → 검증(validate) → 패키징(package) → 배포(publish) → 업데이트 감지(update)를 “소스 독립적”이고 “결정적”으로 만든다.

## 데이터 모델(초안)
- **Source**: 출처(홈페이지/릴리즈/배포 페이지)
- **Asset**: 실제 파일(woff2/ttf/otf 등). 해시/크기/다운로드 URL/라이선스 근거 포함
- **Face**: 패밀리 내 개별 스타일(Weight/Italic/Variable axes)
- **Family**: npm 패키지 단위(패밀리 통합)
- **Manifest**: 위 모델을 JSON으로 고정한 레지스트리(=git에 저장되는 핵심)

## 파이프라인(초안)
1. **ingest**: 소스 커넥터가 URL을 수집하고 Asset을 다운로드/기록
2. **inspect**: 폰트 파일 내부 메타데이터 추출(이름/웨이트/이탤릭/축 등)
3. **normalize**: 규칙 기반으로 Family/Face를 묶고 표준화(애매하면 review 큐)
4. **package**: Family 단위로 npm 패키지 산출물 생성
5. **publish**: 변경된 패키지만 버전 bump 후 publish
6. **update**: 주기적으로 해시 변경을 감지해 파이프라인 재실행

## 저장 정책(초안)
- git: `manifest/`, `docs/`, `tools/`(후속)만 저장
- 바이너리: 외부 스토리지(CAS) + sha256 참조

# noonnu-fonts v2 리뉴얼: 아키텍처 스케치(초안)

## 목표
수집(ingest) → 정규화(normalize) → 검증(validate) → 패키징(package) → 배포(publish) → 모니터링(update) 흐름을 “소스 독립적”이고 “결정적”으로 만든다.

## 핵심 개념(데이터 모델, 초안)
- **Source**: 폰트 출처(홈페이지/릴리즈/배포 페이지)
- **Asset**: 실제 폰트 파일(woff2/ttf/otf 등). 해시/크기/다운로드 URL/라이선스 근거 포함
- **Face**: 패밀리 내 스타일 단위(Weight/Italic/Variable axes)
- **Family**: npm 배포 단위(사용자 관점의 1개 폰트)
- **Manifest**: 위 모델을 JSON으로 고정한 레지스트리 파일(=git에 저장되는 핵심)

## 파이프라인(초안)
1. **ingest**
   - 소스별 커넥터가 URL을 수집하고 파일을 다운로드
   - 다운로드 결과를 Asset으로 기록(sha256 포함)
2. **inspect**
   - 폰트 파일 내부 메타데이터 추출(패밀리/서브패밀리/OS/2 weight/italic/axes 등)
3. **normalize**
   - 규칙 기반으로 Family/Face를 묶고 이름/웨이트를 표준화
   - 충돌/애매한 케이스는 “검토 큐”로 분리(LLM은 제안만)
4. **package**
   - Family 단위로 npm 패키지 산출물 생성(`index.css`, `fonts/*`, README)
5. **publish**
   - 변경된 패키지만 버전 bump 후 publish
6. **update**
   - 주기적으로 소스 업데이트 감지(해시 변경) → 파이프라인 재실행

## 저장소 정책(초안)
- git: `manifest/`(JSON), `tools/`(CLI), `docs/`만 저장
- 바이너리: 외부 스토리지에 저장하고 해시로 참조

