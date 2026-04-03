# DeepCoWork — AI Agent Desktop App

## 프로젝트 구조

```
├── app/          ← Tauri + React 프론트엔드 (git submodule)
├── agent/        ← Python FastAPI 백엔드 (git submodule)
└── docs/         ← 설계 문서, 구현 로그
```

**주의: `app/`과 `agent/`는 git submodule이다.** 커밋은 각 서브모듈 내부에서 먼저 한 뒤, 부모 레포에서 `git add app agent && git commit`으로 서브모듈 포인터를 업데이트해야 한다.

## 핵심 아키텍처

```
Tauri (Rust) → spawns Python sidecar → FastAPI (agent/) → DeepAgents SDK → LLM API
     ↕                                        ↕
React Frontend (app/src/)              SSE streaming
```

## 에이전트 코어 — DeepAgents SDK 사용 (필수)

**절대 `create_react_agent`로 대체하지 마라.** DeepAgents SDK (`create_deep_agent`)를 사용해야 한다.

```python
from deepagents import create_deep_agent
from deepagents.backends import LocalShellBackend

agent = create_deep_agent(
    model=llm,
    tools=tools,                    # web_search, memory_read/write, task
    backend=LocalShellBackend(...), # read_file, write_file, edit_file, execute, ls, glob, grep 자동 제공
    interrupt_on={"write_file": True, "edit_file": True, "execute": True},  # 도구 이름별 HITL
    checkpointer=AsyncSqliteSaver(...),
    system_prompt=system_prompt,
)
```

### 왜 create_react_agent가 안 되는가

- `create_react_agent`의 `interrupt_before`는 **노드 이름**만 받음 (`"tools"`, `"agent"`)
- 도구 이름(`"write_file"` 등)을 넣으면 `ValueError: Interrupt node not found` 발생
- `LocalShellBackend`이 제공하는 8개 파일/셸 도구를 직접 구현할 필요 없음
- DeepAgents의 `interrupt_on`은 **도구 이름별** HITL을 지원함

### agent_core.py — 6-함수 Export 계약

이 파일만 DeepAgents SDK에 의존한다. 나머지 모듈은 이 계약에만 의존:

1. `build_llm()` — LLM 인스턴스 (Anthropic/OpenRouter/Ollama)
2. `build_agent()` — DeepAgent 인스턴스
3. `stream_events()` — SSE async generator
4. `get_agent_state()` — interrupt 상태 조회
5. `resume_agent_input()` — HITL Command(resume=...) 변환
6. `tool` — LangChain @tool 데코레이터

## HITL (Human-in-the-Loop) 흐름

```
Agent calls write_file → DeepAgents interrupt_on 트리거
  → stream.py: graph_state.tasks[].interrupts에서 action_requests 추출
  → SSE "approval" 이벤트 → Frontend ApprovalModal
  → User approve/reject → POST /agent/approve
  → Command(resume={"decisions": [{"type": "approve"}]}) 로 재개
```

## 프론트엔드 핵심 사항

- **디자인**: Samsung One UI 다크 모드 (hex 컬러 사용, oklch 쓰지 마라 — 다크모드에서 안 보임)
  - Primary: `#3884ff` (삼성 블루)
  - Background: `#0a0a0c`, Surface: `#151518`, Elevated: `#1e1e22`
  - 성공: `#34c759`, 에러: `#ff4d4d`, 경고: `#ffb340`
- **i18n**: `src/lib/i18n.ts` — 한/영 전환 (store.locale)
- **자동 스레드 생성**: 스레드 미선택 시 전송하면 자동으로 새 스레드 생성 (ChatArea.onSend)

## CORS 주의

`agent/main.py`의 CORS 설정에 `localhost:\d+` 패턴이 포함되어야 함:
```python
allow_origin_regex=r"http://(127\.0\.0\.1|localhost):\d+",
```
없으면 Vite dev 서버(localhost:1420)에서 POST 요청 실패.

## 실행 방법

```bash
# Tauri 개발 모드 (프론트엔드 + 백엔드 동시 실행)
cd app && npm run tauri dev

# 백엔드만
cd agent && .venv/bin/python main.py

# 프론트엔드만 (브라우저 모드)
cd app && npm run dev   # http://localhost:1420
```

## 환경 설정

- Python venv: `agent/.venv/` (Python 3.11)
- API 키: `agent/.env` (LLM_PROVIDER, OPENROUTER_API_KEY, MODEL_NAME)
- 영속 설정: `~/.cowork/.cowork.env`
- 워크스페이스: `~/.cowork/workspace/`
- DB: `~/.cowork/workspace/cowork.db` (SQLite, LangGraph checkpointer)

## 자주 하는 실수 방지

1. **oklch 컬러 쓰지 마라** — 다크모드 저채도 뉴트럴은 휴를 바꿔도 차이 안 보임. hex 사용.
2. **create_react_agent 쓰지 마라** — DeepAgents SDK의 `create_deep_agent` 사용.
3. **서브모듈 커밋** — `app/`, `agent/` 내부에서 먼저 커밋 후 부모에서 서브모듈 포인터 업데이트.
4. **CORS** — localhost 패턴 빠지면 Settings 저장 등 POST 요청 전부 실패.
5. **Tauri exit code 1** — 앱 창 닫으면 정상적으로 1 반환됨. 에러 아님.
6. **파일시스템 도구 직접 구현하지 마라** — `LocalShellBackend`이 전부 제공.
7. **interrupt_before에 도구 이름 넣지 마라** — 노드 이름만 지원 (`"tools"`, `"agent"`).
