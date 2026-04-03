# UI 분석 — Claude Cowork + 레퍼런스 프로젝트
> 작성일: 2026-04-01

---

## 1. Claude Cowork 공식 UI 구조

### 레이아웃 (3패널)
```
┌──────────────┬────────────────────────┬──────────────┐
│ Left Sidebar │     Main Area          │ Right Panel  │
│              │                        │              │
│ • Projects   │ [Task Input]           │ • Progress   │
│ • Dispatch   │  "Work in a Folder" □  │ • Artifacts  │
│ • Scheduled  │                        │ • Files      │
│ • Ideas      │ [Streaming Response]   │              │
│   Create     │  └ tool indicators     │              │
│   Analyze    │                        │              │
│   Organize   │                        │              │
│   Communicate│                        │              │
└──────────────┴────────────────────────┴──────────────┘
```

### 핵심 UX 패턴
| 패턴 | 설명 |
|------|------|
| **Plan-then-Execute** | 실행 전 플랜 보여주고 승인 대기 |
| **Folder-Scoped** | "Work in a Folder" 체크박스로 접근 범위 제한 |
| **One-time / Always Allow** | 권한 토글로 마찰 최소화 |
| **Dispatch** | 다른 기기에서 태스크 할당, 데스크탑이 완료 후 알림 |
| **Ideas Tab** | Create / Analyze / Organize / Communicate 4분류 |

### 컬러 팔레트 (Anthropic)
```
배경:         #141413  (Dark, 따뜻한 검정)
Primary:      #C46849  (테라코타 오렌지)
Light BG:     #F4F3EE  (Pampas 크림)
텍스트:       Gray-050  (밝은 회색)
```
> 설계 철학: "저녁 대화" 느낌 — 차가운 터미널이 아닌 따뜻한 공간

---

## 2. OpenWork UI (LangChain 공식)

### 디자인 시스템 — Tactical / SCADA
```
테마:     다크 전용
폰트:     JetBrains Mono (모노스페이스)
보더:     radius 3px (날카로운 모서리)
컬러스페이스: HEX
```

### 컬러 팔레트
```css
--background:          #0D0D0F   /* 거의 검정 */
--background-elevated: #141418
--foreground:          #E8E8EC
--border:              #2A2A32
--status-critical:     #E53E3E   /* 빨강 */
--status-warning:      #F59E0B   /* 앰버 */
--status-nominal:      #22C55E   /* 초록 */
--status-info:         #3B82F6   /* 파랑 */
--accent:              #FB923C   /* 오렌지 */
```

### 레이아웃
```
Left (240px)   │   Center         │   Right (250–450px)
───────────────┼──────────────────┼──────────────────
Thread List    │  Chat / Kanban   │  Tabs:
 • 상태 아이콘  │  MessageBubble   │  • Todo
 • 상대시간    │  StreamingMD     │  • Subagents
 • 편집가능    │                  │  • Files
```

### Todo 카드 (실제 코드 기반)
```
┌─────────────────────────────────┐
│ 📋 Agent Tasks          3/5 ─── │
├─────────────────────────────────┤
│ ✓ 요구사항 분석         (초록)  │
│ ⟳ API 설계 중...        (파랑)  │
│ ○ 구현                  (회색)  │
│ ○ 테스트                (회색)  │
│ ○ 배포                  (회색)  │
└─────────────────────────────────┘
```

### Badge 시스템
```css
nominal:  border-#22C55E/30  bg-#22C55E/15  text-#22C55E
warning:  border-#F59E0B/30  bg-#F59E0B/15  text-#F59E0B
critical: border-#E53E3E/30  bg-#E53E3E/15  text-#E53E3E
info:     border-#3B82F6/30  bg-#3B82F6/15  text-#3B82F6
```

---

## 3. AIDotNet OpenCowork UI

### 디자인 시스템 — 모던 / 라이트+다크
```
테마:     라이트 / 다크 / 시스템
폰트:     Inter (sans-serif)
보더:     radius 0.625rem (둥근 모서리)
컬러스페이스: OKLCH (지각적 균일)
애니메이션: Framer Motion
```

### 컬러 팔레트 (다크 모드)
```css
--background: oklch(0.145 0 0)    /* 어두운 회색-검정 */
--foreground: oklch(0.985 0 0)    /* 밝은 흰색 */
--border:     oklch(1 0 0 / 10%)  /* 10% 알파 흰색 */
--input:      oklch(1 0 0 / 15%)
```

### 모드 스위처 (핵심 컴포넌트)
```
┌─────────────────────────────────────┐
│  🔍 Clarify  💻 Code  🤝 Cowork  🏗 ACP │
│        ↑ 선택 시 배경 하이라이트          │
│  clarify: amber/5  code: violet/5       │
│  cowork: emerald/5  acp: cyan/5         │
└─────────────────────────────────────┘
```
Framer Motion `layoutId` 로 스프링 애니메이션 전환.

### 레이아웃
```
TitleBar (모드 스위처 포함)
├── WorkspaceSidebar (Ctrl+B 토글)
├── MessageList (max-w-3xl 중앙 정렬)
│    └── AssistantMessage
│         ├── ToolCallCard
│         ├── SubAgentCard
│         ├── TaskCard
│         └── ThinkingBlock
└── InputArea (하단 고정)
```

---

## 4. 3개 UI 비교

| 항목 | Claude Cowork | OpenWork | AIDotNet |
|------|--------------|----------|----------|
| **테마** | 다크 (따뜻함) | 다크 (차가움) | 라이트+다크 |
| **폰트** | AnthropicSans | JetBrains Mono | Inter |
| **모서리** | 부드러움 | 3px (날카로움) | 0.625rem (둥근) |
| **레이아웃** | 3패널 | 3패널 | 사이드바+중앙 |
| **태스크** | 우측 패널 별도 | Todo 카드 (우측) | 메시지 인라인 |
| **서브에이전트** | 미흡 (알려진 이슈) | Kanban + 우측 패널 | SubAgentCard |
| **애니메이션** | 미니멀 | Loader 스피너 | Framer Motion |
| **모드 전환** | 탭 (Chat/Cowork/Code) | 없음 | 모드 스위처 ✨ |
| **권한 UI** | One-time/Always | approve/reject | PermissionDialog |

---

## 5. 사내 시스템 UI 설계 방향

### 레이아웃 권고
```
┌──────────────┬────────────────────────┬──────────────┐
│  Left (220)  │     Main (flex-1)      │  Right (280) │
│              │                        │              │
│ 대화 목록    │  모드 스위처            │  📋 Tasks    │
│  + 상태표시  │  ──────────────────    │  🤖 Agents   │
│              │  메시지 스트림          │  📁 Files    │
│ 프로젝트     │  (max-w-3xl 중앙)      │              │
│              │  ──────────────────    │  승인 게이트  │
│              │  입력창 (하단 고정)     │              │
└──────────────┴────────────────────────┴──────────────┘
```

### 컬러 권고 (Anthropic 팔레트 참조)
```css
/* Cowork 느낌의 따뜻한 다크 테마 */
--bg:       #141413    /* Anthropic 다크 */
--elevated: #1C1B19
--accent:   #C46849    /* 테라코타 */
--nominal:  #22C55E    /* 완료 */
--info:     #3B82F6    /* 진행 중 */
--warning:  #F59E0B    /* 승인 필요 */
```

### 필수 구현 컴포넌트 우선순위
```
1순위 (코어)
  ├── ChatInput     — 입력 + 폴더 선택
  ├── MessageStream — 토큰 스트리밍 + tool indicator
  └── TodoCard      — 태스크 상태 실시간 업데이트

2순위 (에이전트)
  ├── AgentPanel    — 서브에이전트 상태
  ├── ApprovalModal — approve / reject
  └── ModeSwitch    — clarify / code / cowork

3순위 (편의)
  ├── FilePanel     — 생성된 파일 목록
  ├── ThreadList    — 대화 이력
  └── KanbanView    — 전체 태스크 보드
```
