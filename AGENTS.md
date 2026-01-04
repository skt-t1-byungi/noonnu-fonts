# AGENTS.md

이 파일은 “사람 + 코딩 에이전트”가 v2 리뉴얼을 **작고 검증 가능한 단계**로 진행하기 위한 최소 규칙집입니다.

## Repo context (minimal)
- 브랜치: `v2`에서만 작업. `master`는 의도 없이 손대지 말 것.
- 목표(요약): 눈누 의존을 줄이고, 폰트 파일 메타데이터 기반으로 **패밀리 통합** 패키징/업데이트/배포를 자동화한다.

## Working style: small + verifiable iterations
- 한 번에 큰 작업을 하지 말고, **작은 범위**로 쪼개서 “정리(tidy up)”하듯 쌓는다.
- 새로 만드는 기능은 가능하면 **CLI/스크립트**부터 시작(입력→출력 고정).
- 출력은 **구조화된 산출물**(스키마/JSON/CLI 출력) 위주로 한다.

## Self-verification (agent must do)
- 코드 변경 후, 최소 1개의 “자동 검증 장치”를 남긴다.
  - 우선순위: `node`로 실행 가능한 스모크 테스트(샘플 입력 파일/fixture 포함) → 단위 테스트 → CI
- 검증 방법은 사람이 재현 가능하게 **명령/입출력/체크리스트**로 남긴다.

## Language & architecture constraints
- 구현 언어: **TypeScript**
- 설계 원칙:
  - 규칙 기반(deterministic) 우선 → 애매한 케이스만 LLM 보조(문구/설명 제안)
  - 바이너리 폰트는 git에 직접 커밋하지 않는 방향을 지향(메타/매니페스트 중심)

## Code style (minimal / small / geeky)
- 작은 함수, 작은 파일, 빠른 실패(early return)
- 불필요한 추상화 금지(“나중에 필요해질지도” X)
- 명시적인 타입/이름 선호(매직 값/암묵적 동작 최소화)
- 포맷: 가능한 한 단순하게(프로젝트에 formatter 도입 시 규칙을 여기에 추가)

## “Don’t waste context”
- 긴 배경 설명은 `docs/`로, 에이전트 실행 규칙은 이 파일로.
- `docs/` 역할:
  - `docs/00-problem-statement.md`: 문제정의/목표/비목표(왜 하는가)
  - `docs/01-requirements.md`: 요구사항/정책(무엇이 맞는가)
  - `docs/02-architecture-sketch.md`: 데이터모델/파이프라인 초안(어떻게 할 것인가)
- 현행화: 코드/정책이 바뀌면 관련 `docs/`도 **같은 변경에서** 같이 고친다(배포 단위, 산출물, 저장 정책, 파이프라인 단계, LLM 사용 범위 등).

