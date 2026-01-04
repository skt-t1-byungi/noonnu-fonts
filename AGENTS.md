# AGENTS.md

이 파일은 “사람 + 코딩 에이전트”가 v2 리뉴얼을 **작고 검증 가능한 단계**로 진행하기 위한 최소 규칙집입니다.

## 1. Documentation Style: "Show, Don't Tell" (중요)
- **실체 우선(Concrete Examples)**: 추상적인 설명보다 **실제 파일 구조, JSON 스키마 예시, 코드 스니펫**을 먼저 보여준다. 읽는 사람이 머릿속으로 상상하게 만들지 마라.
- **중복 금지(DRY)**: 문서 내/문서 간에 같은 내용을 복사-붙여넣기 하지 않는다. 중복은 혼란의 원인이다.
- **가독성**: 불렛 포인트와 짧은 문장 위주로 작성한다.

## 2. Communication: "Proposal over Questions"
- **질문 폭탄 금지**: "이건 어떻게 할까요?"만 나열하지 않는다.
- **제안 우선**: "A안(추천)과 B안이 있습니다. A안으로 진행할까요?" 또는 "**A안으로 초안을 작성했습니다.** 수정이 필요하면 말씀해주세요."와 같이 **구체적인 답(Default)**을 들고 접근한다.

## 3. Working Style: small + verifiable iterations
- 한 번에 큰 작업을 하지 말고, **작은 범위**로 쪼개서 “정리(tidy up)”하듯 쌓는다.
- 작업 전, **Context Cleaning**: 관련 문서를 읽고 중복이나 노이즈가 있다면 먼저 정리한 뒤 본 작업을 시작한다.
- 새로 만드는 기능은 가능하면 **CLI/스크립트**부터 시작(입력→출력 고정).
- 출력은 **구조화된 산출물**(스키마/JSON/CLI 출력) 위주로 한다.

## 4. Self-verification (agent must do)
- 코드 변경 후, 최소 1개의 “자동 검증 장치”를 남긴다.
  - 우선순위: `node`로 실행 가능한 스모크 테스트(샘플 입력 파일/fixture 포함) → 단위 테스트 → CI
- 검증 방법은 사람이 재현 가능하게 **명령/입출력/체크리스트**로 남긴다.

## 5. Language & architecture constraints
- 구현 언어: **TypeScript**
- 설계 원칙:
  - 규칙 기반(deterministic) 우선 → 애매한 케이스만 LLM 보조(문구/설명 제안)
  - 바이너리 폰트는 git에 직접 커밋하지 않는 방향을 지향(메타/매니페스트 중심)

## 6. Code style (minimal / small / geeky)
- 작은 함수, 작은 파일, 빠른 실패(early return)
- 불필요한 추상화 금지(“나중에 필요해질지도” X)
- 명시적인 타입/이름 선호(매직 값/암묵적 동작 최소화)

## 7. Repo context & Docs
- 브랜치: `v2`에서만 작업. `master`는 의도 없이 손대지 말 것.
- `docs/` 역할:
  - `docs/00-problem-statement.md`: 문제정의/목표/비목표(왜 하는가)
  - `docs/01-requirements.md`: 요구사항/정책(무엇이 맞는가)
  - `docs/02-architecture-sketch.md`: 데이터모델/파이프라인 설계(구체적 예시 포함)
- **현행화**: 코드/정책이 바뀌면 관련 `docs/`도 **같은 변경에서** 같이 고친다.
