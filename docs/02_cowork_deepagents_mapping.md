# Cowork 핵심 특징 → Deep Agents SDK 매핑
> 작성일: 2026-04-01

---

## 매핑 전체 표

| Cowork 특징 | 역할 | Deep Agents SDK |
|-------------|------|-----------------|
| **계획·태스크 분해** | 목표를 서브태스크로 쪼개 추적 | `TodoListMiddleware` + `write_todos` |
| **공유 파일시스템** | 에이전트 간 정보 교환 레이어 | `FilesystemBackend` + `FilesystemMiddleware` |
| **전문화 서브에이전트** | 역할별 격리 실행 worker | `SubAgent` / `CompiledSubAgent` |
| **비동기 병렬 실행** | 에이전트 동시 실행·상태 추적 | `AsyncSubAgent` + `AsyncSubAgentMiddleware` |
| **에이전트 간 통신** | 오케스트레이터 없이 조율 | `AsyncSubAgentMiddleware` (REST 기반 태스크 조율) |
| **Human-in-the-loop** | 플랜 승인·품질 게이트 | `HumanInTheLoopMiddleware` + `InterruptOnConfig` |
| **컨텍스트 격리** | 에이전트별 독립 컨텍스트 | `SubAgentMiddleware` (서브에이전트마다 독립 실행) |
| **메모리** | 대화·세션 간 지식 유지 | `MemoryMiddleware` + `StoreBackend` |
| **스킬** | 재사용 가능한 능력 단위 | `SkillsMiddleware` + `SkillMetadata` |
| **컨텍스트 압축** | 토큰 한계 대응, 자동 요약 | `SummarizationMiddleware` + `SummarizationToolMiddleware` |
| **격리 실행 환경** | 보안·샌드박스 실행 | `LocalShellBackend` + `LangSmithSandbox` |
| **상태 지속성** | 세션 간 상태 보존 | `StoreBackend` + `checkpointer` (LangGraph) |
| **복합 백엔드** | 여러 백엔드 동시 라우팅 | `CompositeBackend` |
| **행동 지침** | 에이전트 성격·규칙 정의 | `system_prompt` (create_deep_agent 파라미터) |
| **에이전트 팩토리** | 전체 에이전트 조립·실행 진입점 | `create_deep_agent()` → `CompiledStateGraph` |

---

## 계층별 구조

```
┌─────────────────────────────────────────────┐
│              create_deep_agent()            │  ← 조립 진입점
├─────────────────────────────────────────────┤
│                 Middleware                  │
│  TodoList │ HumanInTheLoop │ Summarization  │  ← 행동 제어
│  Memory   │    Skills      │ Filesystem     │
│  SubAgent │ AsyncSubAgent  │ PromptCaching  │
├─────────────────────────────────────────────┤
│                  Backend                   │
│  FilesystemBackend │ StateBackend           │  ← 저장·실행 레이어
│  StoreBackend      │ LocalShellBackend      │
│  CompositeBackend  │ LangSmithSandbox       │
├─────────────────────────────────────────────┤
│              LangGraph Runtime              │  ← 하부 실행 엔진
│    checkpointer │ store │ CompiledStateGraph │
└─────────────────────────────────────────────┘
```

---

## 핵심 3가지 상세

### 1. 태스크 분해 — `TodoListMiddleware`

Cowork의 "목표 → 서브태스크 분해 → 추적" 기능의 직접 구현체.

```python
from deepagents import create_deep_agent
from deepagents.middleware import TodoListMiddleware

agent = create_deep_agent(
    middleware=[TodoListMiddleware()],
    ...
)
```

내부적으로 `write_todos` 도구를 에이전트에 노출 → 에이전트가 스스로 태스크 작성·업데이트.

---

### 2. 서브에이전트 — `SubAgent` vs `AsyncSubAgent`

| 타입 | 실행 방식 | 사용 시점 |
|------|-----------|-----------|
| `SubAgent` + `SubAgentMiddleware` | 동기 (결과 기다림) | 순차 의존 작업 |
| `AsyncSubAgent` + `AsyncSubAgentMiddleware` | 비동기 (백그라운드) | **병렬 독립 작업** ← Cowork 핵심 |
| `CompiledSubAgent` | 사전 컴파일된 그래프 | 재사용 잦은 에이전트 |

```python
from deepagents import SubAgent, AsyncSubAgent

# 전문화된 역할 정의
researcher = SubAgent(
    name="researcher",
    description="시장 조사 담당",
    system_prompt="...",
    tools=[search_tool, fetch_tool],
)

# 병렬 실행용
code_reviewer = AsyncSubAgent(
    name="code_reviewer",
    description="코드 리뷰 담당",
    graph_id="...",
    url="...",
)
```

---

### 3. 파일시스템 — `FilesystemBackend` + `FilesystemMiddleware`

Cowork의 Virtual Filesystem = 에이전트 간 공유 메모리.

```python
from deepagents.backends import FilesystemBackend
from deepagents.middleware import FilesystemMiddleware

backend = FilesystemBackend(base_path="/workspace")

# 에이전트가 사용 가능한 파일 도구들:
# ls(), read_file(), write_file(), edit_file(), glob(), grep()
```

`CompositeBackend`로 여러 백엔드를 묶으면 파일시스템 + 외부 스토어 동시 사용 가능.

---

## Cowork에 없고 Deep Agents에만 있는 것

| Deep Agents 기능 | 설명 |
|-----------------|------|
| `AnthropicPromptCachingMiddleware` | Anthropic 프롬프트 캐싱으로 토큰 비용 절감 |
| `SummarizationToolMiddleware` | 에이전트가 직접 요약 요청 가능 (온디맨드) |
| `PatchToolCallsMiddleware` | 불완전한 tool call 자동 복구 |
| `context_schema` | 외부 런타임 컨텍스트 타입 정의 |
| `LangSmithSandbox` | LangSmith 기반 추적·평가 통합 |
