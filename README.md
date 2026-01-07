# noonnu-fonts (v2)

한글 폰트를 **자동으로 발견(눈누/KOGL/공유마당) → R2 아카이브 → npm 웹폰트 패키지로 배포**하는 MVP 파이프라인.

운영: **자동 PR 생성 → (필요 시 수정) → merge 즉시 publish**  
브랜치: 레포 규칙상 **`v2` 브랜치만 사용**

## Docs
- `docs/00-problem.md`: Why (문제정의)
- `docs/01-requirements.md`: What (요구사항/정책/SSOT)
- `docs/02-architecture.md`: How (구조/워크플로/출력)

## SSOT
- `fonts/<id>.yml`
- `registry/sources.lock.json`
- `registry/rejected.json`

