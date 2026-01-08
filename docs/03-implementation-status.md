# 구현 상태 (v2)

## Status
- **Phase**: MVP 구현 착수 (Step 0)
- **Current**: Docs 완료, 코드 없음
- **Next**: 로컬 CLI 스캐폴딩 & 결정적 sha256 구현

## Roadmap (MVP)
### 1. Core (Determinism & SSOT) - **우선순위 1**
- [ ] **Step 0**: 프로젝트 스캐폴딩 (TS, lint, deps)
- [ ] **Step 1**: 결정적 Zip 래핑 & sha256 계산기 (재현성 핵심)
- [ ] **Step 2**: 폰트 메타 추출(opentype.js) & `fonts/*.yml` 생성기
- [ ] **Step 3**: `registry/sources.lock.json` 갱신 로직

### 2. Discovery (Local)
- [ ] **Step 4**: `scripts/discover.ts` 통합 (입력: URL/File → 출력: SSOT)

### 3. Build & Release
- [ ] **Step 5**: `scripts/build.ts` (SSOT → woff2/css → npm pack)

### 4. CI/CD & R2
- [ ] **Step 6**: GitHub Actions & R2 연동

## Current Context
- **Code**: `null`
- **SSOT**: 미생성
- **Verification**: `scripts/verify-determinism.ts` 예정
