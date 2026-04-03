# Rust + Tauri + DeepAgents 연동 가능성 분석
> 작성일: 2026-04-01

---

## 결론 먼저

> **연동 가능하다. 단, 사이드카 패턴을 반드시 사용해야 한다.**
> DeepAgents는 Tauri Core(Rust) 안에서 직접 실행되지 않는다.
> Node.js 또는 Python 바이너리를 사이드카로 실행하고 IPC로 통신한다.

---

## Tauri vs Electron — 성능 비교

| 지표 | Tauri v2 | Electron | 차이 |
|------|---------|----------|------|
| **메모리** | ~83 MB | ~400 MB | **80% 절감** |
| **시작 시간** | < 500 ms | 1–2 초 | **40% 빠름** |
| **번들 크기** | 2.5–3 MB | 150 MB | **50배 작음** |
| **CPU 유휴** | 무시할 수준 | 높음 | — |

**왜 가벼운가:** Tauri는 Chromium을 번들링하지 않는다.
OS 네이티브 WebView 사용 (macOS → WebKit, Windows → WebView2, Linux → WebKitGTK).

---

## Tauri 아키텍처

```
┌──────────────────────────────────────┐
│  WebView (React / Vue / Svelte)      │  ← 프론트엔드 (HTML/CSS/JS)
│  - UI 렌더링, 사용자 입력            │
│  - Tauri API 호출 (invoke/listen)    │
└──────────────────┬───────────────────┘
                   │ IPC (JSON-RPC)
┌──────────────────▼───────────────────┐
│  Tauri Core (Rust)                   │  ← 메인 프로세스
│  - OS 접근, 파일시스템, 프로세스 관리 │
│  - 사이드카 수명주기 관리             │
│  - IPC 라우팅 및 보안 검증           │
└──────────────────┬───────────────────┘
                   │ spawn
┌──────────────────▼───────────────────┐
│  Sidecar (DeepAgents)                │  ← 외부 바이너리
│  Node.js (deepagentsjs) 또는         │
│  Python (deepagents + FastAPI)       │
└──────────────────────────────────────┘
```

---

## IPC 3가지 메커니즘

| 방식 | 패턴 | 적합한 용도 |
|------|------|------------|
| **Commands** (`invoke`) | 요청→응답 | 단일 쿼리, 설정 조회 |
| **Events** (`emit/listen`) | 단방향 발행 | 상태 업데이트, 라이프사이클 |
| **Channels** | 고처리량 스트리밍 | **LLM 토큰 스트리밍** ← 핵심 |

```typescript
// 프론트엔드: 토큰 스트림 구독
const unlisten = await listen('token_stream', (event) => {
  responseDiv.textContent += event.payload.token
})

// Rust Core: 사이드카 stdout → 프론트엔드로 emit
app_handle.emit("token_stream", json!({ "token": token, "done": false }))
```

---

## DeepAgents 연동 방법 2가지

### Option A: deepagentsjs → Node.js 사이드카

```
deepagentsjs (TypeScript)
    ↓ pkg로 컴파일
Node.js 바이너리 (플랫폼별)
    ↓ Tauri sidecar로 실행
stdin/stdout JSON 통신
    ↓
Tauri Core → Events → 프론트엔드
```

**빌드 과정:**
```bash
# 1. deepagentsjs 앱을 바이너리로 컴파일
pkg agent-server.js -t node18-macos-arm64,node18-linux-x64,node18-win-x64

# 2. tauri.conf.json에 등록
{
  "bundle": {
    "externalBin": ["binaries/agent-server"]
  }
}

# 3. 파일명 규칙 (타겟 트리플 접미사 필수)
# agent-server-aarch64-apple-darwin
# agent-server-x86_64-unknown-linux-gnu
# agent-server-x86_64-pc-windows-msvc
```

**장점:** JS 네이티브, deepagentsjs 직접 실행
**단점:** pkg 컴파일 복잡, 플랫폼별 크기 증가

---

### Option B: deepagents (Python) → FastAPI 사이드카 ← **권장**

```
deepagents (Python SDK)
    + FastAPI 서버
    ↓ PyInstaller로 번들
Python 바이너리 (플랫폼별)
    ↓ Tauri가 localhost:8008로 실행
SSE 스트리밍
    ↓
Tauri Core (HTTP 클라이언트) → Events → 프론트엔드
```

**FastAPI 스트리밍 패턴:**
```python
from fastapi.responses import StreamingResponse
from deepagents import create_deep_agent

agent = create_deep_agent(model=..., tools=[...], middleware=[...])

@app.post("/agent/stream")
async def stream_response(req: ChatRequest):
    async def generate():
        async for chunk in agent.astream({"messages": [req.message]}):
            yield f"data: {json.dumps({'token': chunk})}\n\n"
    return StreamingResponse(generate(), media_type="text/event-stream")
```

**Tauri Core에서 사이드카 실행:**
```rust
#[tauri::command]
async fn start_agent_server(app_handle: AppHandle) -> Result<(), String> {
    app_handle
        .shell()
        .sidecar("agent-server")
        .args(["--port", "8008"])
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}
```

**장점:** 성숙한 Python SDK, FastAPI SSE 기본 지원, curl로 로컬 테스트 가능
**단점:** PyInstaller 빌드 복잡, 바이너리 크기 80–150MB

---

## 관련 Tauri 플러그인

| 플러그인 | 역할 | DeepAgents 연관성 |
|---------|------|-----------------|
| `tauri-plugin-shell` | 사이드카 실행·관리 | **필수** |
| `tauri-plugin-fs` | 파일시스템 접근 | FilesystemBackend 연동 |
| `tauri-plugin-websocket` | 양방향 스트리밍 | 에이전트 간 통신 |
| `tauri-plugin-sql` | SQLite | 체크포인터·대화 저장 |
| `tauri-plugin-velesdb` | 벡터 DB (70µs 검색) | RAG, 메모리 검색 |
| `tauri-plugin-mcp` | MCP 프로토콜 | DeepAgents MCP 연동 |

---

## 전체 연동 아키텍처

```
┌─────────────────────────────────────────────────────┐
│ React Frontend (Tauri WebView)                      │
│  ChatUI / TodoPanel / SubagentView / ApprovalModal  │
│  listen('token_stream') / listen('agent_event')     │
└────────────────────┬────────────────────────────────┘
                     │ invoke / listen
┌────────────────────▼────────────────────────────────┐
│ Tauri Core (Rust)                                   │
│  - SQLite: 대화·태스크·상태 저장                     │
│  - 사이드카 PID 관리 (시작·종료·재시작)              │
│  - HTTP 클라이언트 (localhost:8008 → SSE 수신)       │
│  - emit('token_stream') → 프론트엔드                │
└────────────────────┬────────────────────────────────┘
                     │ localhost:8008
┌────────────────────▼────────────────────────────────┐
│ DeepAgents Sidecar (Python + FastAPI)               │
│  create_deep_agent(                                 │
│    middleware=[                                     │
│      TodoListMiddleware(),                          │
│      FilesystemMiddleware(),                        │
│      AsyncSubAgentMiddleware(),                     │
│      HumanInTheLoopMiddleware(),                    │
│      MemoryMiddleware(),                            │
│      SkillsMiddleware(),                            │
│    ],                                               │
│    backend=FilesystemBackend(base_path=workspace),  │
│    subagents=[researcher, reviewer, executor],      │
│  )                                                  │
└─────────────────────────────────────────────────────┘
```

---

## 핵심 제약사항

| 제약 | 내용 | 해결책 |
|------|------|--------|
| **사이드카 자기 완결성** | 외부 의존성 없는 단일 바이너리 필수 | PyInstaller `--onefile` |
| **플랫폼별 빌드** | macOS / Windows / Linux 각각 컴파일 | GitHub Actions CI/CD |
| **IPC JSON 직렬화** | 바이너리 데이터 불가 (Base64 필요) | 임베딩 등은 별도 처리 |
| **WebView 차이** | OS별 JS 엔진 다름 | 크로스플랫폼 테스트 필수 |
| **Web Worker 제한** | Worker에서 Tauri API 호출 불가 | Rust Core 경유 |

---

## 개발 난이도 평가

| 영역 | 난이도 | 비고 |
|------|--------|------|
| Tauri 기본 설정 | ★★☆☆☆ | 문서 잘 되어있음 |
| React + Tauri IPC | ★★☆☆☆ | invoke/listen 패턴 단순 |
| **사이드카 빌드** | ★★★★☆ | 플랫폼별 컴파일이 제일 까다로움 |
| FastAPI SSE 스트리밍 | ★★☆☆☆ | DeepAgents astream() 그대로 사용 |
| Rust Core 로직 | ★★★☆☆ | 복잡한 로직 없으면 보일러플레이트 수준 |
| **전체** | ★★★☆☆ | Electron 대비 20–30% 추가 초기 설정 |

---

## 최종 권고

**Rust + Tauri + Python DeepAgents FastAPI 사이드카** 조합이 최적.

- 속도·메모리: Tauri가 Electron 대비 압도적 우위
- DeepAgents 연동: FastAPI 사이드카로 완전 호환
- 스트리밍: SSE → Tauri Events → 프론트엔드 경로 검증됨
- 유일한 허들: 플랫폼별 PyInstaller 빌드 파이프라인 구성

> **Electron으로 먼저 프로토타입, 안정화 후 Tauri 마이그레이션**도 현실적 선택지.
> openwork 코드베이스(Electron)가 좋은 시작점이 될 수 있음.
