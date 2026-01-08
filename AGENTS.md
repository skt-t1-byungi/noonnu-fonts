# AGENTS.md (v2 Rules)

"사람 + 에이전트" 협업을 위한 최소 규칙.

## 0. Quick Checklist (토큰 효율)
- **변경 전**: `docs/00-02` 확인 → 필요한 경우만 문서 갱신(중복 설명 금지)
- **변경 후**: `docs/03-implementation-status.md`에 상태/다음 단계 1줄이라도 반영
- **검증**: 코드 변경 시 재현 가능한 `node` 스크립트/테스트/CI 중 1개를 반드시 추가
- **요약**: PR/커밋 메시지는 5줄 이내(링크로 대체, 로그/장문 금지)

## 1. Docs: "Show, Don't Tell"
- **예시 우선**: 추상적 설명 대신 **파일 구조, JSON 스키마, 코드**를 먼저 제시한다.
- **DRY**: 중복 금지.
- **가독성**: 짧은 문장, 불렛 포인트 위주.

## 2. Comm: "Proposal > Question"
- **제안 우선**: "어떻게 할까요?" 대신 **"A안(추천)으로 초안을 짰습니다"**라고 접근한다.
- **구체적 답**: 모호한 질문보다 구체적인 Default Action을 제시한다.

## 3. Work: Small & Verifiable
- **작은 반복**: 작업을 잘게 쪼개서 정리(tidy up)하듯 진행한다.
- **Context Cleaning**: 작업 전 관련 문서를 먼저 정리(현행화)한다.
- **CLI First**: UI보다 **CLI/스크립트(입출력 고정)**부터 만든다.

## 4. Verification: Automated
- **검증 장치 필수**: 코드 변경 시 `node` 스크립트, 테스트, CI 중 하나를 반드시 남긴다.
- **재현 가능**: 사람이 따라 할 수 있는 명령어/체크리스트를 명시한다.

## 5. Constraints: TS & Common Sense
- **Lang**: TypeScript.
- **SoT = 사람의 결정**: "폰트 패밀리" 정의는 **사람의 판단 + 근거**를 따른다 (알고리즘 X).
- **LLM 역할**: 모호한 케이스 정리, 제안, 문서화 보조.
- **Determinism**: 산출물(JSON, 패키지)의 재현성에만 적용.

## 6. Code: Minimal Implementation (Tool > Code)
- **Buy over Build**: 검증된 도구/라이브러리 적극 활용 → "내가 유지할 코드" 최소화.
- **Thin Glue**: 강한 도구들을 얇게 연결하는 접착제 코드(glue code)만 작성한다.
- **Practical**: 설정/옵션 최소화(기본값 우선), 검증은 단일 커맨드로.
- **Geeky**: 작은 함수, 빠른 실패(early return), 명시적 타입.

## 7. Context: v2 Only
- `master` 건드리지 않음. `v2` 브랜치만 사용.
- `docs/` 현행화 필수:
  - `00-problem.md`: Why
  - `01-requirements.md`: What
  - `02-architecture.md`: How (Schema/Structure)
- 상태/작업 단계는 `docs/03-implementation-status.md`에 단일 진실로 유지(README/PR에 복붙 금지)

## 8. Complexity: Simplest First
- **Flat Model**: 필연적 이유 없으면 `id`나 계층을 나누지 않는다.
- **확장 자제**: 현재 문제만 푼다.

