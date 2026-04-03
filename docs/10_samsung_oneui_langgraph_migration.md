# Round 15: Modern Dark + DeepAgent 기반 CoWork 앱
> 작성일: 2026-04-03 | DeepCoWork CoWork 에이전트

---

## 1. 변경 요약

### Stage 1: Modern Dark 디자인

| 요소 | Before (Warm Obsidian) | After (Modern Dark) |
|------|----------------------|----------------------|
| 프라이머리 | oklch 앰버 | `#3884ff` 삼성 블루 |
| 배경 | oklch 따뜻한 블랙 | `#0a0a0c` 딥 차콜 |
| 컬러 방식 | oklch (차이 안 보임) | hex (명확한 차이) |
| 테마 | 다크 전용 | **다크/라이트 전환** |
| 국제화 | 한국어 전용 | **한/영 전환** |

### Stage 2: 에이전트 코어 — DeepAgents SDK

```python
create_deep_agent(
    model=llm,
    tools=[web_search, memory_read, memory_write, task],
    backend=LocalShellBackend(root_dir=workspace),
    interrupt_on={"write_file": True, "edit_file": True, "execute": True},
    checkpointer=AsyncSqliteSaver(...),
    system_prompt=...,
    skills=["skills/"],  # NEW: folder-based skill loading
)
```

### Stage 3: Skills 시스템

- `~/.cowork/workspace/skills/{skill-name}/SKILL.md` 구조
- YAML frontmatter: name, description, license, allowed-tools
- Progressive disclosure: 에이전트가 메타데이터 확인 후 필요 시 전체 내용 로드
- 앱 UI에서 스킬 탭으로 생성/편집/삭제 가능
- 기본 제공: `code-review`, `research`

### Stage 4: AGENTS.md / 메모리 에디터

- **메모리 탭**: AGENTS.md, SOUL.md, USER.md 인라인 편집
- **스킬 탭**: SKILL.md 생성/편집/삭제
- 모두 에이전트 시스템 프롬프트에 자동 주입

---

## 2. E2E 검증 결과

| 테스트 | 결과 |
|--------|------|
| LLM 스트리밍 (OpenRouter/Claude) | **통과** |
| HITL write_file 승인/거부 | **통과** |
| 워크스페이스 격리 | **통과** |
| Skills API (2개 로드) | **통과** |
| Memory API (SOUL/USER/AGENTS) | **통과** |
| 다크/라이트 테마 전환 | **통과** |
| 한/영 i18n 전환 | **통과** |
| 자동 스레드 생성 | **통과** |
| CORS (Vite dev) | **통과** |

---

## 3. 아키텍처

```
┌─────────────────────────────────────────┐
│              Tauri Desktop              │
│  ┌──────────┐  ┌──────────┐  ┌────────┐│
│  │ Thread   │  │  Chat    │  │ Right  ││
│  │ List     │  │  Area    │  │ Panel  ││
│  │          │  │          │  │────────││
│  │ 🌙/☀️   │  │ Mode     │  │Tasks   ││
│  │ EN/한    │  │ Switch   │  │Agents  ││
│  │ ⚙ 설정  │  │          │  │Log     ││
│  │          │  │ Messages │  │Files   ││
│  │          │  │          │  │Memory  ││
│  │          │  │ Input    │  │Skills  ││
│  └──────────┘  └──────────┘  └────────┘│
└───────────────────┬─────────────────────┘
                    │ SSE
┌───────────────────▼─────────────────────┐
│           FastAPI Backend               │
│  ┌──────────────────────────────────┐   │
│  │      agent_core.py               │   │
│  │  create_deep_agent()             │   │
│  │  ├── LocalShellBackend           │   │
│  │  ├── interrupt_on (HITL)         │   │
│  │  ├── skills=["skills/"]          │   │
│  │  └── tools (web, memory, task)   │   │
│  └──────────────────────────────────┘   │
│  routes/ │ stream.py │ state.py │ ...   │
└───────────────────┬─────────────────────┘
                    │
              LLM API (OpenRouter/Anthropic/Ollama)
```

---

## 4. 파일 변경 목록

### Frontend (app/)
| 파일 | 변경 내용 |
|------|-----------|
| `src/index.css` | Modern Dark 디자인 시스템 (hex, 다크/라이트) |
| `src/App.tsx` | 테마 초기화, CSS 변수 배경 |
| `src/store.ts` | locale, theme 상태 추가 |
| `src/lib/i18n.ts` | **신규** — 60+ 번역 키 (ko/en) |
| `src/lib/api.ts` | MemoryContent에 agents 필드 추가 |
| `src/components/ChatArea.tsx` | i18n, 자동 스레드 생성, Samsung 스타일 |
| `src/components/ModeSwitch.tsx` | i18n, pill 스타일 |
| `src/components/ThreadList.tsx` | i18n, 테마/언어 토글 버튼 |
| `src/components/AgentPanel.tsx` | i18n, Skills 탭 추가 |
| `src/components/MemoryPanel.tsx` | AGENTS.md 에디터 추가 |
| `src/components/SkillsPanel.tsx` | **신규** — 스킬 관리 UI |
| `src/components/MessageStream.tsx` | Samsung 블루 버블 |
| `src/components/MarkdownContent.tsx` | 코드 블록 오버플로 수정 |
| `src/components/*.tsx` | 전체 Samsung hex 컬러 적용 |

### Backend (agent/)
| 파일 | 변경 내용 |
|------|-----------|
| `agent_core.py` | DeepAgents SDK 유지, skills 파라미터 추가 |
| `stream.py` | DeepAgents interrupt_on HITL 패턴 |
| `main.py` | CORS localhost 패턴 추가 |
| `routes/settings.py` | Skills CRUD API, AGENTS.md 지원 |
| `pyproject.toml` | deepagents>=0.4.12 유지 |

### 기타
| 파일 | 변경 내용 |
|------|-----------|
| `CLAUDE.md` | **신규** — 실수 방지 가이드 (7가지) |
| `docs/10_*.md` | Round 15 개발 문서 |
