/**
 * DeepCoWork — Internationalization (한국어 / English)
 */

export type Locale = "ko" | "en";

const translations = {
  // ── Sidebar ──
  threads: { ko: "대화 목록", en: "THREADS" },
  newThread: { ko: "새 대화", en: "New thread" },
  search: { ko: "검색...", en: "Search..." },
  noThreads: { ko: "대화가 없습니다.\n새 대화를 시작하세요.", en: "No threads yet.\nStart a conversation." },
  noResults: { ko: "결과 없음", en: "No results." },
  deleteConfirm: { ko: (title: string) => `"${title}" 대화를 삭제하시겠습니까?`, en: (title: string) => `Delete "${title}"?` },
  settings: { ko: "설정", en: "Settings" },

  // ── Mode Switch ──
  modeClarify: { ko: "분석", en: "Clarify" },
  modeCode: { ko: "코드", en: "Code" },
  modeCowork: { ko: "협업", en: "Cowork" },
  modeAcp: { ko: "멀티", en: "ACP" },
  modeClarifyDesc: { ko: "요구사항 수집", en: "Requirement gathering" },
  modeCodeDesc: { ko: "페어 프로그래밍", en: "Pair programming" },
  modeCoworkDesc: { ko: "자율 실행", en: "Autonomous execution" },
  modeAcpDesc: { ko: "멀티에이전트", en: "Multi-agent" },

  // ── Chat Area ──
  readyTitle: { ko: "작업 준비 완료", en: "Ready to work" },
  readySub: { ko: "작업을 설명하면 에이전트가 협업합니다.", en: "Describe a task and the agents will coordinate." },
  inputPlaceholder: { ko: "작업을 설명하세요...", en: "Describe a task..." },
  stop: { ko: "중지", en: "Stop" },
  streaming: { ko: "에이전트가 응답 중입니다", en: "Agent is responding" },
  set: { ko: "적용", en: "Set" },

  // ── Right Panel Tabs ──
  tabTasks: { ko: "태스크", en: "Tasks" },
  tabAgents: { ko: "에이전트", en: "Agents" },
  tabTimeline: { ko: "기록", en: "Log" },
  tabFiles: { ko: "파일", en: "Files" },
  tabMemory: { ko: "메모리", en: "Memory" },
  tabSkills: { ko: "스킬", en: "Skills" },

  // ── Tasks ──
  noTasks: { ko: "태스크가 없습니다", en: "No tasks" },
  noTasksSub: { ko: "에이전트가 시작하면 태스크가 여기 표시됩니다", en: "Tasks will appear here once the agent starts" },
  agentTasks: { ko: "에이전트 태스크", en: "Agent Tasks" },

  // ── Agents ──
  noAgents: { ko: "서브에이전트 없음", en: "No sub-agents" },
  noAgentsSub: { ko: "ACP 모드에서 병렬 서브에이전트가 표시됩니다", en: "Sub-agents will appear in ACP mode" },

  // ── Timeline ──
  noTimeline: { ko: "실행 기록 없음", en: "No activity" },
  noTimelineSub: { ko: "도구 호출이 여기 실시간으로 표시됩니다", en: "Tool calls will appear here in real time" },

  // ── Files ──
  files: { ko: "파일", en: "Files" },
  selectThread: { ko: "스레드를 선택하세요", en: "Select a thread" },
  noFiles: { ko: "생성된 파일 없음", en: "No files yet" },
  loading: { ko: "불러오는 중…", en: "Loading…" },
  edit: { ko: "편집", en: "Edit" },
  cancel: { ko: "취소", en: "Cancel" },
  save: { ko: "저장", en: "Save" },
  saved: { ko: "저장됨", en: "Saved" },
  saving: { ko: "저장 중…", en: "Saving…" },
  modified: { ko: "수정됨", en: "Modified" },
  unsavedConfirm: { ko: "저장하지 않은 변경 사항이 있습니다. 취소하시겠습니까?", en: "You have unsaved changes. Discard?" },
  unsavedCloseConfirm: { ko: "저장하지 않은 변경 사항이 있습니다. 닫으시겠습니까?", en: "You have unsaved changes. Close?" },
  truncatedFiles: { ko: "파일이 너무 많아 처음 500개만 표시됩니다", en: "Too many files — showing first 500" },

  // ── Memory ──
  memoryInject: { ko: "에이전트 시스템 프롬프트에 자동 주입됩니다", en: "Automatically injected into agent system prompt" },
  soulTitle: { ko: "SOUL.md", en: "SOUL.md" },
  soulDesc: { ko: "에이전트 페르소나 · 행동 원칙", en: "Agent persona · behavior principles" },
  soulPlaceholder: { ko: "에이전트의 성격, 전문성, 소통 스타일을 정의하세요.", en: "Define the agent's personality, expertise, and communication style." },
  userTitle: { ko: "USER.md", en: "USER.md" },
  userDesc: { ko: "사용자 선호 · 프로젝트 컨텍스트", en: "User preferences · project context" },
  userPlaceholder: { ko: "사용자 선호, 기술 스택, 금지 사항을 기록하세요.", en: "Record user preferences, tech stack, and constraints." },
  memoryAuto: { ko: "MEMORY.md (세션별 자동 기록)", en: "MEMORY.md (auto-recorded per session)" },
  memoryAutoSub: { ko: "에이전트가 memory_write 도구로 자동 저장 · Files 탭에서 확인", en: "Auto-saved by memory_write tool · view in Files tab" },

  // ── Approval ──
  approvalNeeded: { ko: "승인 필요", en: "Approval Required" },
  approvalDesc: { ko: "에이전트가 파일 시스템 작업을 요청합니다", en: "Agent requests a file system operation" },
  approve: { ko: "승인", en: "Approve" },
  reject: { ko: "거부", en: "Reject" },
  queuePending: { ko: (n: number) => `${n}개 대기 중`, en: (n: number) => `${n} pending` },
  writeWarning: { ko: "파일 시스템에 영구적으로 쓰기 작업을 수행합니다", en: "This will permanently write to the file system" },
  execWarning: { ko: "셸 명령을 실행합니다 — 시스템에 영구적인 영향을 줄 수 있습니다", en: "This will execute a shell command — may permanently affect the system" },

  // ── Settings ──
  settingsTitle: { ko: "설정", en: "Settings" },
  apiKeyTab: { ko: "API 키", en: "API Key" },
  modelTab: { ko: "모델", en: "Model" },
  provider: { ko: "프로바이더", en: "Provider" },
  model: { ko: "모델", en: "Model" },
  apiKeyFail: { ko: "키 저장에 실패했습니다.", en: "Failed to save API key." },
  settingsFail: { ko: "설정 저장에 실패했습니다.", en: "Failed to save settings." },
  apply: { ko: "적용", en: "Apply" },

  // ── API Key Banner ──
  apiKeyMissing: { ko: "API 키 미설정", en: "API key not set" },
  apiKeyBannerMsg: { ko: "사이드바 하단 ⚙ Settings에서 키를 입력하세요.", en: "Enter your key in ⚙ Settings at the bottom of the sidebar." },

  // ── Server ──
  serverFail: { ko: "서버 시작 실패", en: "Server failed to start" },
  serverRestart: { ko: "앱을 재시작하거나 터미널에서 서버를 확인하세요.", en: "Restart the app or check the server in terminal." },
  serverStarting: { ko: "에이전트 서버 시작 중…", en: "Starting agent server…" },

  // ── Language ──
  language: { ko: "한국어", en: "English" },
  langToggle: { ko: "EN", en: "한" },

  // ── Misc ──
  hiddenMessages: { ko: (n: number) => `↑ 이전 ${n}개 메시지 숨김`, en: (n: number) => `↑ ${n} earlier messages hidden` },
  refresh: { ko: "새로고침", en: "Refresh" },
  newConversation: { ko: "새 대화", en: "New conversation" },
} as const;

type TranslationKey = keyof typeof translations;

export function t(key: TranslationKey, locale: Locale): string {
  const entry = translations[key];
  if (!entry) return key;
  const val = entry[locale];
  if (typeof val === "function") return val as unknown as string;
  return val as string;
}

// For dynamic translations (functions)
export function tf(key: TranslationKey, locale: Locale): (...args: any[]) => string {
  const entry = translations[key];
  if (!entry) return () => key;
  const val = entry[locale];
  if (typeof val === "function") return val as (...args: any[]) => string;
  return () => val as string;
}

export { translations };
