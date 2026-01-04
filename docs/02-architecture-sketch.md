# Architecture (Simplified)

## Core Concept
**"Human Decision as Code"**.
자동 판정 대신, **사람의 결정(Manifest)**을 SoT로 삼아 재현 가능한 배포를 수행한다.

- **SoT**: `manifest/<family>.json` + `review-queue/*.json`
- **ID**: Family 당 1개.
- **Reference**: Binary는 외부 저장, `sha256`로 참조.

## 1. Directory Structure
```
repo/
├── manifest/               # [SoT] Family Manifest
│   ├── pretendard.json
│   └── ...
├── review-queue/           # Ambiguous Cases (LLM Suggestion + Human Decision)
│   ├── 2026-01-04-pretendard-vs-jp.json
│   └── ...
├── tools/                  # CLI (TS)
└── docs/
```

## 2. Manifest Schema (Example)
**핵심**: `decision` + `evidence` + `files[]` (Deterministic).

### `manifest/pretendard.json`
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
    "evidenceUrl": "https://...",
    "notes": ""
  },
  "decision": {
    "summary": "Regular~Bold 통합 패키징",
    "rationale": "사용자 인지 기준 동일 패밀리.",
    "decidedAt": "2026-01-04T12:00:00Z"
  },
  "files": [
    {
      "sha256": "e3b0c44...",
      "format": "woff2",
      "filename": "Pretendard-Regular.woff2",
      "origin": { "downloadUrl": "..." }
    }
  ]
}
```

### `review-queue/pretendard-vs-jp.json`
```json
{
  "status": "open",
  "question": "Pretendard vs JP: Merge or Split?",
  "candidates": { "families": ["pretendard", "pretendard-jp"] },
  "evidence": [ { "type": "manual_note", "text": "Glyph range diff" } ],
  "llmSuggestion": {
    "proposal": "split",
    "rationale": "Distinct usage patterns expected.",
    "followups": ["Check glyph coverage"]
  }
}
```

## 3. Workflow (Minimal)
1. **Collect**: URL/File 확보 -> `sha256` 기록.
2. **Queue**: 애매하면 `review-queue` 등록 (Evidence 첨부).
3. **Suggest (LLM)**: `proposal` + `rationale` 작성.
4. **Decide (Human)**: 결정 확정 -> `manifest` 반영.
5. **Publish**: `manifest` 기반 재현적 배포 (Patch bump priority).
