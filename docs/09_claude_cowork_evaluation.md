# Claude Cowork 기준 평가 및 로드맵
> 작성일: 2026-04-02

---

## 요약

현재 저장소는 **Claude Cowork 같은 로컬 데스크톱 에이전트 앱**을 만들기 위한 기반으로는 충분히 좋다.  
평가를 한 줄로 요약하면 다음과 같다.

> **베이스는 합격. 이제 신뢰성·보안·워크스페이스 UX를 다듬어야 진짜 Claude Cowork급이 된다.**

### 총평
- **적합도: 8/10**
- **총점: 약 7.5/10**
- **판단**: 강한 프로토타입 단계이며, 제품화 직전 단계는 아님

---

## 왜 괜찮은가

현재 구조는 Claude Cowork류 앱의 핵심 패턴을 이미 상당 부분 갖추고 있다.

- **데스크톱 셸**: `app/src-tauri/src/lib.rs`
  - Tauri가 로컬 Python 에이전트 서버를 sidecar처럼 실행
- **대화형 UI**: `app/src/App.tsx`, `app/src/components/*`
  - 스레드 목록 / 채팅 / 우측 패널 구조
- **에이전트 백엔드**: `agent/main.py`
  - SSE 스트리밍
  - 스레드별 워크스페이스
  - 히스토리/체크포인트
  - 파일 목록/읽기
  - 승인(HITL) 흐름
- **레퍼런스 기반 구현 의식 존재**: `docs/references/open-claude-cowork`

즉, **로컬 데스크톱 앱 + 백엔드 에이전트 + 스트리밍 UI**라는 큰 뼈대는 이미 맞다.

---

## Claude Cowork와 비교했을 때 잘 맞는 점

### 1. 아키텍처 방향이 맞다

레퍼런스 `open-claude-cowork`는 다음 요소를 가진다.

- Electron
- Node/Express 백엔드
- SSE 스트리밍
- 세션 유지
- 툴 시각화

현재 프로젝트는 다음과 같다.

- **Tauri + React**
- **FastAPI + DeepAgents**
- **SSE**
- **SQLite 체크포인트**
- **툴콜/태스크/에이전트 패널**

기술 스택은 다르지만 제품 구조는 매우 유사하다.

### 2. Tauri 선택은 오히려 장점이 될 수 있다

Claude Cowork clone을 반드시 Electron으로 만들 필요는 없다.

현재 방향의 장점:

- 더 가벼운 데스크톱 런타임
- Python 에이전트 실험이 쉬움
- Tauri sidecar로 로컬 프로세스 관리가 비교적 명확함

### 3. “작업형 에이전트 앱”다운 UI가 이미 있다

확인된 기능:

- 모드 전환: `clarify / code / cowork / acp`
- Approval modal
- Task / Agent / File / Memory 패널
- Thread list
- Message streaming

즉, 단순한 채팅 앱이 아니라 **작업형 agent desktop**에 가깝다.

---

## 아직 부족한 점

### 1. 로컬 앱은 맞지만 완전 로컬 AI 앱은 아니다

현재는:

- 앱은 로컬에서 실행됨
- 에이전트 서버도 로컬에서 실행됨
- 그러나 모델은 기본적으로 **Anthropic/OpenRouter**에 의존

즉,

- **로컬 데스크톱 앱**: ✅
- **오프라인/온디바이스 AI 앱**: ❌

목표가 “Claude Cowork 같은 로컬 앱”이면 괜찮고,  
목표가 “완전 로컬 AI 앱”이라면 아직 아니다.

### 2. 툴 실행/승인 설계가 아직 거칠다

`agent/main.py`에서 문서와 프롬프트는 `execute` 도구를 전제로 하지만,  
실제 등록된 커스텀 도구 이름은 **`run_shell`** 중심이다.

현재 상태:

- 문서/프롬프트: `execute`
- 실제 코드: `run_shell`

또한 `interrupt_on`은 현재 `write_file`, `edit_file` 위주로 구성되어 있다.

따라서 문서상 의도와 실제 실행/승인 동작 사이에 정합성 리스크가 있다.

이는 Claude Cowork류 앱에서 큰 문제다.

- 사용자는 로컬 명령 실행에 민감함
- 실행 권한 UX가 제품 신뢰도의 핵심임

### 3. 폴더 스코프 UX가 아직 약하다

`app/src/components/ChatArea.tsx`에는 **Scope to folder** 버튼이 보이지만,  
실제 스코프 선택 기능은 아직 약한 편이다.

Claude Cowork 계열 앱에서는 다음이 중요하다.

- 어느 폴더를 작업 대상으로 삼는지
- 현재 스레드가 어떤 워크스페이스를 보는지
- 툴 실행 범위가 어디까지인지

현재는 thread별 워크스페이스는 있지만,  
**사용자 관점의 폴더 스코프 UX는 아직 부족하다.**

### 4. provider/tool ecosystem이 레퍼런스보다 약하다

레퍼런스 `open-claude-cowork`는:

- provider abstraction
- Composio/MCP 연동
- 다양한 외부 앱 연결

현재 프로젝트는:

- Anthropic / OpenRouter 정도
- custom tools 몇 개
- memory/files/task 중심

즉, 현재는 **로컬 코워킹 에이전트 앱**으로는 괜찮지만  
**업무 자동화 허브** 수준은 아직 아니다.

### 5. 제품화 마감 요소가 덜 됐다

현재도 작동은 가능해 보이지만, 제품화 기준으로는 다음이 더 필요하다.

- runtime provider/model 전환 UI
- abort/resume 정교화
- sidecar 패키징 완성
- install/setup 단순화
- 에러/로그 UX
- 보안 경계 명시
- workspace permission model

---

## 구조 평가

### 현재 구조는 적절하다

- `app/` → 데스크톱 클라이언트
- `agent/` → 로컬 에이전트 런타임
- `docs/` → 설계/레퍼런스
- `.omx/` → 작업 상태

이 구조 자체는 Claude Cowork류 앱을 만들기에 적합하다.

### 다만 정리는 필요하다

현재 루트는 다소 혼잡하다.

- `docs/references/*` 규모가 큼
- `app/.git`, `agent/.git` 중첩 저장소 존재
- 산출물/의존성 디렉터리 비중이 큼

개발 중에는 괜찮지만, 장기적으로는 다음이 필요하다.

- reference archive 분리
- nested git 정리
- product code path 명확화

---

## 현재 단계 판단

현재 프로젝트는 다음 상태로 보인다.

### 이미 된 것

- 데스크톱 앱 골격
- 로컬 에이전트 프로세스
- 스트리밍 채팅
- 스레드/히스토리
- 태스크/파일/메모리 패널
- 승인 UI

### 아직 애매한 것

- 실제 멀티에이전트 품질
- execute/HITL 일관성
- provider/tool 확장성
- 폴더 스코프 UX
- 제품 패키징

즉,

> **Claude Cowork 같은 앱을 만들 수 있는 토대는 충분하다.**
>
> 하지만 아직은 **작동하는 내부 프로토타입**이지,  
> **신뢰 가능한 로컬 업무 앱**이라고 부르기엔 조금 이르다.

---

## Claude Cowork 기준 점수표

| 항목 | 점수 | 평가 |
|---|---:|---|
| 데스크톱 앱 구조 | **9/10** | `app/src-tauri/src/lib.rs`에서 로컬 Python 서버를 띄우는 구조가 명확함 |
| 채팅 UX 기본기 | **8/10** | `ThreadList + ChatArea + AgentPanel` 3패널 구성이 좋음 |
| 스트리밍 응답 | **8.5/10** | SSE 처리와 토큰 스트리밍이 잘 갖춰짐 |
| 스레드/히스토리 | **8/10** | SQLite 체크포인트 + 히스토리 복원 있음 |
| 툴 가시성 | **7.5/10** | `tool_call`, `tool_result`, 파일 변경 표시 있음 |
| 승인(HITL) UX | **7/10** | 승인 모달은 있으나 execute/write 권한 모델 정합성은 더 다듬어야 함 |
| 워크스페이스 격리 | **8.5/10** | thread별 workspace 분리는 Claude Cowork류에 잘 맞음 |
| 멀티에이전트 느낌 | **6.5/10** | ACP 모드와 agent 패널은 있으나 orchestration 완성도는 더 필요 |
| 모델/provider 유연성 | **6.5/10** | Anthropic/OpenRouter는 있으나 UI 레벨 provider 선택은 약함 |
| 로컬 퍼스트성 | **7/10** | 앱/서버는 로컬이지만 모델은 원격 API 의존 |
| 확장성(skill/tool ecosystem) | **6/10** | 메모리/웹검색/쉘 정도는 있으나 레퍼런스만큼 확장되진 않음 |
| 제품화 준비도 | **6/10** | 프로토타입 강함, 패키징/권한/설치/복구 UX는 보강 필요 |

### 점수 해석

- **총점: 약 7.5/10**
- **아키텍처는 합격**
- **프로토타입 완성도는 높음**
- 하지만 **권한모델 / 스코프 / provider UX / 제품화**가 약점

---

## 우선순위 로드맵

아래 순서가 효율 대비 효과가 가장 크다.

### Phase 1 — 신뢰 가능한 로컬 앱 만들기

#### 1-1. execute / run_shell 정합성 맞추기

현재 문서/프롬프트와 실제 코드의 명칭이 어긋난다.

해야 할 일:

- 도구 이름을 하나로 통일
- 프롬프트/문서/이벤트/UI 텍스트 일치
- 실행 도구에 대한 승인 정책 명확화

목표:

- 사용자가 어떤 명령이 실행되는지 이해
- 언제 승인해야 하는지 이해
- 실행 범위가 어디인지 이해

#### 1-2. 권한 모델 정리

권장 정책:

- **자동 허용**: read / search / list / health
- **승인 필요**: write / edit / run_shell
- **고위험 승인**: network install, `rm`, `git reset`, side-effect shell

목표:

- Approval UX를 단순 팝업이 아니라 **보안 경계 UI**로 승격

#### 1-3. Abort / Resume 품질 보강

현재 abort는 프런트 fetch abort 중심 인상이 강하다.

해야 할 일:

- “중단됨” 상태를 명시
- 중단 후 재개 여부 선택 가능
- 중단 시 pending tool/agent/task 상태 정리

---

### Phase 2 — 진짜 cowork 앱 같은 UX 만들기

#### 2-1. 폴더 스코프 기능 완성

현재 Scope to folder 버튼은 있으나 실기능은 약하다.

해야 할 일:

- 현재 작업 대상 폴더 선택 UI
- thread별 target workspace 지정
- UI에 현재 스코프 배지 표시
- 백엔드에서 해당 스코프만 read/write/run 허용

목표:

- “이 스레드는 어느 프로젝트를 작업 중인가?”가 항상 명확해야 함

#### 2-2. Tool timeline 개선

권장 개선:

- 우측 패널에 **실행 로그 타임라인**
- tool별 상태: pending / running / approved / done / failed
- 클릭 시 args/result/raw output 확인

목표:

- Claude Cowork 같은 **작업이 보이는 앱** 느낌 강화

#### 2-3. Agent panel 고도화

권장 개선:

- parent agent / subagent 구분
- 어떤 task를 맡았는지 연결
- done/error 이유 표시
- ACP 모드에서 병렬 에이전트 흐름 강조

---

### Phase 3 — 실제로 쓰는 앱 만들기

#### 3-1. Provider / Model 설정 UI

필요 기능:

- provider 선택: Anthropic / OpenRouter / 이후 Ollama 가능
- model 선택
- API key 상태 표시
- 연결 테스트 버튼

목표:

- 코드 수정 없이 앱 안에서 모델을 교체 가능하게

#### 3-2. 로컬 모델 경로 추가

추천:

- Ollama provider 추가
- LM Studio/OpenAI-compatible local endpoint 지원
- 로컬 모델일 때 badge 표시: `Local Model`

목표:

- 원격 API뿐 아니라 **완전 로컬 실행 옵션** 제공

#### 3-3. 메모리 UX 정리

다듬을 점:

- 메모리 편집 이력
- thread memory와 global memory 구분 표시
- 저장 시점 표시

---

### Phase 4 — 제품화

#### 4-1. 설치/실행 단순화

목표:

- 앱 설치
- 키 입력
- 폴더 선택
- 바로 사용

#### 4-2. 패키징 완성

특히 Python runtime 배포가 핵심이다.

필요:

- sidecar packaging 전략 확정
- Python 없는 환경에서도 실행 가능하게
- dev/prod 경로 차이 정리

#### 4-3. 에러/로그/복구 UX

필요:

- server boot 실패 상세 안내
- 모델 연결 실패 안내
- workspace 접근 실패 안내
- 로그 보기 / 복사 / 리포트 버튼

---

## 추천 우선순위

가장 먼저 해야 할 Top 5:

1. **execute / run_shell 통일**
2. **권한/승인 모델 정리**
3. **폴더 스코프 기능 완성**
4. **tool timeline + agent panel 강화**
5. **provider/model 설정 UI**

이 다섯 가지만 정리해도 체감상  
**“프로토타입” → “진짜 Claude Cowork 느낌 앱”**으로 크게 올라간다.

---

## 빠른 액션 플랜

### 1주차
- execute / run_shell 통일
- approval policy 정리
- abort 상태 처리 개선

### 2주차
- 폴더 스코프 UI/백엔드 연결
- 현재 workspace 표시
- tool timeline 추가

### 3주차
- provider/model 설정 화면
- local provider(Ollama 등) 초석
- agent panel 개선

### 4주차
- 패키징/설치 정리
- 에러/로그/복구 UX
- E2E polishing

---

## 최종 판단

현재 프로젝트는 **Claude Cowork를 흉내 내는 수준은 이미 넘었고**,  
잘 다듬으면 **“MX 팀용 로컬 cowork app”**으로 충분히 발전 가능하다.

가장 중요한 포인트는 다음과 같다.

> **기능 추가보다 먼저, 실행 권한/워크스페이스/가시성을 정교하게 만드는 것**

