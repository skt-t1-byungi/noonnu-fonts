# Requirements

## 1. Package Unit (Family)
- **1 Package = 1 Family**: 여러 웨이트/스타일을 하나로 묶음.
- **Naming**: 외부 라벨에 의존하지 않는 결정적 이름 사용.

## 2. Quality: Human Decision as SoT
- **SoT = Decision**: 폰트 내부 메타데이터는 "증거"일 뿐, "정답"이 아님.
- **LLM Role**:
  - 모호성 정리 및 제안 (Merge/Split/Keep).
  - 결정 근거 문서화(Drafting).
- **Automation**: "판정"이 아닌 "재현(배포)"에 집중.

## 3. Storage
- **Git**: 메타데이터(JSON), 코드, 문서만 저장.
- **Binary**: 외부 스토리지(CAS) 저장 + `sha256` 참조.

## 4. Versioning
- **Trigger**: 파일 해시(`files[].sha256`) 또는 패키지 구성 변경.
- **Contents**: `index.css`, `fonts/*`, `README.md`(출처/라이선스).

## 5. Compliance
- **Safety First**: 라이선스 불분명 시 배포 중단(Review Queue).
- **Evidence**: README에 출처/라이선스 명시 필수.
