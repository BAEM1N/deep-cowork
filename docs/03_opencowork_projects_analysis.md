# OpenCowork 유사 프로젝트 분석
> 작성일: 2026-04-01

---

## 발견된 주요 프로젝트

| 프로젝트 | GitHub | 스택 | 특징 |
|----------|--------|------|------|
| **OpenWork** (LangChain 공식) | `langchain-ai/openwork` | TypeScript | Deep Agents 기반 공식 오픈소스 Cowork 대안 |
| **OpenWork** (different-ai) | `different-ai/openwork` | TypeScript | `npx openwork`으로 실행, 멀티모델 |
| **Open-Claude-Cowork** (Composio) | `composiohq/open-claude-cowork` | Electron + Node.js | 500+ SaaS 연동, Claude Agent SDK |
| **OpenCowork** (AIDotNet) | `AIDotNet/OpenCowork` | TypeScript + Python | Lead + 팀 패턴, 메시징 연동 |
| **OpenCowork** (cowork-studio) | `cowork-studio/OpenCowork` | Python | Plan-based ReAct, 13개 코어 툴 |
| **Open-Claude-Cowork** (DevAgentForge) | `DevAgentForge/Open-Claude-Cowork` | TypeScript | Claude Code 설정 재사용 |
| **openCowork** (CHANGGELY) | `CHANGGELY/openCowork` | Next.js + FastAPI | 스크린샷 기반 멀티모달 |

---

## 핵심 발견: SDK만으론 안 되는 이유

### SDK가 제공하는 것 vs 직접 만들어야 하는 것

| 영역 | SDK 제공 | 직접 구현 필요 |
|------|---------|---------------|
| **실행 엔진** | LangGraph 런타임 | - |
| **서브에이전트** | SubAgent 클래스 | 역할별 시스템 프롬프트 설계 |
| **파일시스템** | FilesystemBackend | 에이전트 간 정보 규약 |
| **계획 도구** | TodoListMiddleware | 태스크 분해 프롬프트 패턴 |
| **메모리** | MemoryMiddleware | 무엇을 기억할지 판단 로직 |
| **조율** | AsyncSubAgentMiddleware | 에이전트 간 협업 프로토콜 |
| **품질 게이트** | HumanInTheLoopMiddleware | 언제 멈추고 승인받을지 규칙 |
| **스킬 발견** | SkillsMiddleware | SKILL.md 작성, 발동 조건 설계 |

> **결론: SDK는 "배관(plumbing)"이고, 실제 지능은 프롬프트 설계에서 나온다.**

---

## 프롬프트 설계 — 3가지 핵심 패턴

### 패턴 1. 시스템 프롬프트는 길고 구체적이어야 한다

일반적인 오해: "당신은 리서처입니다. 조사해주세요."
실제 Cowork 수준:

```
You are an expert research assistant capable of conducting thorough,
multi-step investigations.

PLANNING: Break complex tasks into subtasks using the write_todos tool
RESEARCH: Use search tools extensively before drawing conclusions
DELEGATION: Spawn sub-agents for specialized tasks using the task tool
DOCUMENTATION: Maintain notes in the virtual filesystem

When you receive a task:
1. First create a plan (use write_todos, even for simple tasks)
2. Identify parallelizable units
3. Delegate to sub-agents or tools
4. Synthesize and verify results

[Few-shot example]
Task: 경쟁사 3개사 제품 분석
Approach:
  1. write_todos: [회사A 조사, 회사B 조사, 회사C 조사, 종합 분석]
  2. spawn: researcher_A, researcher_B, researcher_C (병렬)
  3. 각 결과를 /workspace/findings/ 에 저장
  4. 종합 보고서 생성
```

**핵심:** 도구 사용법을 few-shot으로 가르쳐야 한다.

---

### 패턴 2. SKILL.md — 점진적 능력 공개

```
~/.claude/skills/
├── market-research/
│   └── SKILL.md        ← 메타데이터 + 트리거 조건
├── code-review/
│   └── SKILL.md
└── report-generation/
    ├── SKILL.md
    ├── reference.md    ← 필요할 때만 읽힘
    └── template.md     ← 필요할 때만 읽힘
```

**SKILL.md 구조:**
```yaml
---
name: market-research
description: 시장 조사 및 경쟁사 분석. 사용자가 시장 분석, 경쟁사 조사,
             트렌드 파악을 요청할 때 사용. [250자 이내 — 이게 발동 조건]
allowed-tools: Read, Grep, WebSearch
---

[에이전트가 따를 지침]
```

**핵심:** description이 발동 조건. LLM이 읽고 스스로 판단.
500줄 이하로 유지. 참조 문서는 별도 파일로 분리.

---

### 패턴 3. 서브에이전트 프롬프트 설계 원칙

각 서브에이전트는 다음을 명시해야 한다:

```
당신은 [구체적 전문가 역할]입니다.

담당 범위: [이것만 한다]
제외 범위: [이건 하지 않는다]
사용 가능한 도구: [명시]
전제 조건: [부모 에이전트가 제공하는 것]

결과 형식:
- 핵심 발견사항 (불릿)
- 불확실한 부분 (명시)
- 다음 권장 액션
- 생성/수정한 파일 목록
```

**중요:** 서브에이전트는 부모의 컨텍스트를 상속받지 않는다.
부모가 필요한 모든 컨텍스트를 명시적으로 전달해야 한다.

---

## 조율 아키텍처 — 파일 기반 협업

Claude Code Agent Teams의 실제 구현:

```
~/.claude/
├── tasks/
│   ├── task-001.json   {"status": "in_progress", "owner": "agent-A", "deps": []}
│   ├── task-002.json   {"status": "pending", "deps": ["task-001"]}
│   └── task-003.json   {"status": "completed"}
└── inboxes/
    ├── agent-A/        ← A에게 온 메시지
    ├── agent-B/        ← B에게 온 메시지
    └── lead/           ← 리드에게 온 메시지
```

**핵심:** 파일시스템이 오케스트레이터. 별도 메시지 브로커 불필요.
에이전트가 자유롭게 태스크를 선택하고 완료 후 다음 태스크로 이동.

---

## 품질 게이트 설계

```
약한 스펙 → 에이전트 전체에 오류 전파
강한 스펙 → 에이전트가 올바른 방향으로 수렴
```

**Cowork 수준 품질 게이트:**

1. **실행 전 계획 승인** — 분해 결과를 사람이 먼저 검토
2. **태스크 완료 시 자동 검증** — 테스트·린트 자동 실행 훅
3. **불확실성 명시 의무** — 프롬프트에서 강제
4. **AGENTS.md 학습 축적** — 에이전트가 배운 것을 문서화

```
[시스템 프롬프트에 포함]
계획 작성 시 반드시 포함:
- 불확실한 부분 (명시적으로)
- 전제하는 조건 (명시적으로)
- 사람이 검토해야 할 부분
- 복잡도 예상 (simple / medium / complex)

실행 전 승인을 기다린다.
완료 후 검증을 실행한다.
```

---

## cowork-studio/OpenCowork — 가장 유사한 사례

13개 코어 도구 항상 탑재:

| # | 도구 | 역할 |
|---|------|------|
| 1 | 코드/텍스트 검색 | 시맨틱 + 정규식 |
| 2 | 파일 조작 | 읽기·편집·병합 |
| 3 | 터미널 실행 | 명령어 실행 |
| 4 | 웹 검색·이미지 | 외부 정보 수집 |
| 5 | 문서 변환 | 다양한 포맷 |
| 6 | 사용자 인터랙션 | 승인·입력 요청 |
| 7 | 비전 분석 | 이미지 이해 |
| 8 | 히스토리 압축 | 컨텍스트 관리 |
| 9 | 파일 퍼지 검색 | 유사 파일 탐색 |
| 10 | 메모리 관리 | 기억·요약 |
| 11 | 멀티에이전트 메시징 | 에이전트 간 통신 |
| 12 | 마우스/키보드 | 데스크톱 자동화 |
| 13 | 센서 데이터 | 환경 인식 |

지원 모델: Claude Sonnet 4.5, DeepSeek V3.2, GLM-4.7, Qwen3-30B (로컬)

---

## 사내 시스템 구축 시 참고할 핵심 교훈

1. **Deep Agents SDK = 40%**, 프롬프트 설계 = 60%
2. 시스템 프롬프트는 짧으면 안 된다 — few-shot 필수
3. 서브에이전트 역할 경계를 명확히 정의해야 자율성이 생긴다
4. 파일시스템이 가장 단순하고 강력한 조율 레이어
5. 품질 게이트 없는 멀티에이전트는 오류 증폭기가 된다
6. 토큰 비용: 에이전트 N명 = 기본 비용 × ~7배 예상
