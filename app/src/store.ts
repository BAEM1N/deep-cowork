import { create } from "zustand";
import type { Locale } from "./lib/i18n";

export type TaskStatus = "pending" | "in_progress" | "completed" | "failed";
export type Mode = "clarify" | "code" | "cowork" | "acp";
export type AgentStatus = "idle" | "running" | "done" | "error";

export interface ToolLogEntry {
  id: string;
  name: string;
  args: string;
  result?: string;
  status: "running" | "done" | "error";
  source: string;
  timestamp: Date;
}

export interface Task {
  id: string;
  label: string;
  status: TaskStatus;
}

export interface SubAgent {
  id: string;
  name: string;
  status: AgentStatus;
  currentTask?: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  name: string;
  input: string;
  status: "running" | "done" | "error";
}

export interface Thread {
  id: string;
  title: string;
  updatedAt: Date;
  mode: Mode;
}

interface AppState {
  serverReady: boolean;
  serverPort: number;
  serverError: string | null;
  apiKeyMissing: boolean;
  mode: Mode;
  activeThreadId: string | null;
  threads: Thread[];
  messages: Message[];
  tasks: Task[];
  agents: SubAgent[];
  toolLog: ToolLogEntry[];
  inputValue: string;
  isStreaming: boolean;
  filesChanged: number; // bump to trigger FilePanel refresh
  workspacePath: string | null; // derived from threadWorkspacePaths[activeThreadId]
  threadWorkspacePaths: Record<string, string>;
  osPlatform: string; // "Windows" | "Darwin" | "Linux" — from backend /settings
  locale: Locale;
  theme: "dark" | "light";

  setServerReady: (port: number) => void;
  setServerError: (error: string) => void;
  setApiKeyMissing: (v: boolean) => void;
  setMode: (mode: Mode) => void;
  setActiveThread: (id: string) => void;
  addThread: (thread: Thread) => void;
  updateThreadTitle: (id: string, title: string) => void;
  addMessage: (msg: Message) => void;
  appendToLastMessage: (chunk: string) => void;
  finalizeStream: () => void;
  setTasks: (tasks: Task[]) => void;
  updateTask: (id: string, status: TaskStatus) => void;
  setAgents: (agents: SubAgent[]) => void;
  updateAgent: (id: string, patch: Partial<SubAgent>) => void;
  setInputValue: (v: string) => void;
  bumpFiles: () => void;
  clearThread: () => void;
  setMessages: (messages: Message[]) => void;
  addToolCallToLastMessage: (tc: ToolCall) => void;
  markLastToolCallDone: (toolName?: string) => void;
  addToolLog: (entry: Omit<ToolLogEntry, "id" | "timestamp">) => void;
  updateLastToolLog: (result: string, status?: "done" | "error") => void;
  clearToolLog: () => void;
  setWorkspacePath: (path: string | null) => void; // sets for activeThreadId
  setOsPlatform: (platform: string) => void;
  setLocale: (locale: Locale) => void;
  setTheme: (theme: "dark" | "light") => void;
}

export const useStore = create<AppState>((set) => ({
  serverReady: false,
  serverPort: 8008,
  serverError: null,
  apiKeyMissing: false,
  mode: (() => {
    try {
      const stored = localStorage.getItem("cowork_mode");
      const valid: Mode[] = ["clarify", "code", "cowork", "acp"];
      return (stored && valid.includes(stored as Mode)) ? stored as Mode : "cowork";
    } catch { return "cowork" as Mode; }
  })(),
  activeThreadId: (() => {
    try { return localStorage.getItem("cowork_active_thread"); } catch { return null; }
  })(),
  threads: [],
  messages: [],
  tasks: [],
  agents: [],
  toolLog: [],
  inputValue: "",
  isStreaming: false,
  filesChanged: 0,
  workspacePath: null,
  threadWorkspacePaths: {},
  osPlatform: "Darwin",
  theme: (() => {
    try {
      const stored = localStorage.getItem("cowork_theme");
      return (stored === "light" ? "light" : "dark") as "dark" | "light";
    } catch { return "dark" as "dark" | "light"; }
  })(),
  locale: (() => {
    try {
      const stored = localStorage.getItem("cowork_locale");
      return (stored === "en" ? "en" : "ko") as Locale;
    } catch { return "ko" as Locale; }
  })(),

  setServerReady: (port) => set({ serverReady: true, serverPort: port, serverError: null }),
  setServerError: (error) => set({ serverError: error }),
  setApiKeyMissing: (v) => set({ apiKeyMissing: v }),
  setMode: (mode) => {
    try { localStorage.setItem("cowork_mode", mode); } catch { /* storage unavailable */ }
    set({ mode });
  },
  setActiveThread: (id) => {
    try { localStorage.setItem("cowork_active_thread", id); } catch { /* storage unavailable */ }
    return set((s) => ({
      activeThreadId: id,
      messages: [],
      tasks: [],
      agents: [],
      toolLog: [],
      filesChanged: 0, // 스레드 전환 시 파일 카운터 초기화 (이전 스레드 카운트 누수 방지)
      workspacePath: s.threadWorkspacePaths[id] ?? null,
    }));
  },
  addThread: (thread) =>
    set((s) => ({
      threads: s.threads.some((t) => t.id === thread.id)
        ? s.threads
        : [thread, ...s.threads],
    })),
  updateThreadTitle: (id, title) =>
    set((s) => ({
      threads: s.threads.map((t) => (t.id === id ? { ...t, title } : t)),
    })),
  addMessage: (msg) =>
    set((s) => ({
      messages: [...s.messages, msg],
      isStreaming: msg.streaming ?? false,
      // bump updatedAt so thread rises to top of list
      threads: s.threads.map((t) =>
        t.id === s.activeThreadId ? { ...t, updatedAt: new Date() } : t
      ),
    })),
  appendToLastMessage: (chunk) =>
    set((s) => {
      const msgs = [...s.messages];
      const last = msgs[msgs.length - 1];
      if (last && last.streaming) {
        msgs[msgs.length - 1] = { ...last, content: last.content + chunk };
      }
      return { messages: msgs };
    }),
  finalizeStream: () =>
    set((s) => {
      const msgs = [...s.messages];
      const last = msgs[msgs.length - 1];
      if (last) msgs[msgs.length - 1] = { ...last, streaming: false };
      return { messages: msgs, isStreaming: false };
    }),
  setTasks: (tasks) => set({ tasks }),
  updateTask: (id, status) =>
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, status } : t)),
    })),
  setAgents: (agents) => set({ agents }),
  updateAgent: (id, patch) =>
    set((s) => ({
      agents: s.agents.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    })),
  setInputValue: (inputValue) => set({ inputValue }),
  bumpFiles: () => set((s) => ({ filesChanged: s.filesChanged + 1 })),
  clearThread: () => set({ messages: [], tasks: [], agents: [], toolLog: [] }),
  addToolLog: (entry) =>
    set((s) => {
      const next = [...s.toolLog, { ...entry, id: crypto.randomUUID(), timestamp: new Date() }];
      return { toolLog: next.length > 200 ? next.slice(-200) : next };
    }),
  updateLastToolLog: (result, status = "done") =>
    set((s) => {
      const log = [...s.toolLog];
      for (let i = log.length - 1; i >= 0; i--) {
        if (log[i].status === "running") {
          log[i] = { ...log[i], result, status };
          break;
        }
      }
      return { toolLog: log };
    }),
  clearToolLog: () => set({ toolLog: [] }),
  setOsPlatform: (osPlatform) => set({ osPlatform }),
  setLocale: (locale) => {
    try { localStorage.setItem("cowork_locale", locale); } catch {}
    set({ locale });
  },
  setTheme: (theme) => {
    try { localStorage.setItem("cowork_theme", theme); } catch {}
    if (theme === "light") {
      document.documentElement.classList.add("light");
    } else {
      document.documentElement.classList.remove("light");
    }
    set({ theme });
  },
  setWorkspacePath: (path) =>
    set((s) => ({
      workspacePath: path,
      threadWorkspacePaths: s.activeThreadId
        ? path
          ? { ...s.threadWorkspacePaths, [s.activeThreadId]: path }
          : Object.fromEntries(Object.entries(s.threadWorkspacePaths).filter(([k]) => k !== s.activeThreadId))
        : s.threadWorkspacePaths,
    })),
  addToolCallToLastMessage: (tc) =>
    set((s) => {
      const msgs = [...s.messages];
      const last = msgs[msgs.length - 1];
      if (last && last.role === "assistant") {
        msgs[msgs.length - 1] = {
          ...last,
          toolCalls: [...(last.toolCalls ?? []), tc],
        };
      }
      return { messages: msgs };
    }),
  markLastToolCallDone: (toolName?: string) =>
    set((s) => {
      const msgs = [...s.messages];
      for (let i = msgs.length - 1; i >= 0; i--) {
        const msg = msgs[i];
        if (msg.role === "assistant" && msg.toolCalls) {
          const tcs = [...msg.toolCalls];
          // toolName 있으면 이름 매칭 우선, 없으면 마지막 running 찾기
          const idx = toolName
            ? [...tcs.keys()].reverse().find((j) => tcs[j].name === toolName && tcs[j].status === "running") ?? -1
            : tcs.map((_tc, j) => j).reverse().find((j) => tcs[j].status === "running") ?? -1;
          if (idx !== -1) {
            tcs[idx] = { ...tcs[idx], status: "done" };
            msgs[i] = { ...msgs[i], toolCalls: tcs };
            return { messages: msgs };
          }
        }
      }
      return {};
    }),
  setMessages: (messages) => set({ messages }),
}));
