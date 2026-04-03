import { useEffect, useState } from "react";
import { PlusIcon, MessageSquareIcon, Trash2Icon, Settings2Icon, SearchIcon, SunIcon, MoonIcon } from "lucide-react";
import { useStore, type Thread, type Message, type ToolCall } from "../store";
import { t, tf } from "../lib/i18n";
import { APP_NAME } from "../lib/branding";
import { formatDistanceToNow } from "../lib/time";
import { getThreads, deleteThread, getThreadMessages } from "../lib/api";
import { SettingsModal } from "./SettingsModal";

function ThreadItem({ thread, active }: { thread: Thread; active: boolean }) {
  const { setMessages } = useStore();
  const setActive = useStore((s) => s.setActiveThread);

  async function handleSelect() {
    setActive(thread.id);
    try {
      const history = await getThreadMessages(thread.id);
      if (history.length === 0) return;
      const msgs: Message[] = history.map((h) => ({
        id: crypto.randomUUID(),
        role: h.role,
        content: h.content,
        streaming: false,
        toolCalls: h.tool_calls?.map((tc): ToolCall => ({
          id: crypto.randomUUID(),
          name: tc.name,
          input: "",
          status: "done",
        })) ?? undefined,
      }));
      setMessages(msgs);
    } catch {}
  }

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    const locale = useStore.getState().locale;
    if (!confirm(tf("deleteConfirm", locale)(thread.title))) return;
    await deleteThread(thread.id);
    const store = useStore.getState();
    const next = store.threads.filter((t) => t.id !== thread.id);
    useStore.setState({ threads: next });
    if (store.activeThreadId === thread.id) {
      const nextId = next[0]?.id ?? null;
      try {
        if (nextId) localStorage.setItem("cowork_active_thread", nextId);
        else localStorage.removeItem("cowork_active_thread");
      } catch {}
      useStore.setState({ activeThreadId: nextId, messages: [], tasks: [], agents: [] });
    }
  }

  return (
    <div
      className="group relative flex items-start gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-150"
      style={{
        background: active ? "rgba(56, 132, 255, 0.1)" : "transparent",
        border: active ? "1px solid rgba(56, 132, 255, 0.15)" : "1px solid transparent",
      }}
      onClick={handleSelect}
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as HTMLElement).style.background = "var(--accent)";
      }}
      onMouseLeave={(e) => {
        if (!active) (e.currentTarget as HTMLElement).style.background = "transparent";
      }}
    >
      <MessageSquareIcon
        size={13}
        className="mt-0.5 shrink-0"
        style={{ color: active ? "#3884ff" : "#505058" }}
      />
      <div className="min-w-0 flex-1">
        <p
          className="text-xs font-medium truncate leading-snug"
          style={{ color: active ? "#ecedf0" : "#808590" }}
        >
          {thread.title}
        </p>
        <p className="text-[10px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>
          {formatDistanceToNow(thread.updatedAt)}
        </p>
      </div>
      <span
        className="text-[9px] px-1.5 py-0.5 rounded-md font-mono shrink-0 mt-0.5"
        style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}
      >
        {thread.mode}
      </span>

      <button
        onClick={handleDelete}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ color: "#606068" }}
        title="Delete thread"
      >
        <Trash2Icon size={11} />
      </button>
    </div>
  );
}

export function ThreadList() {
  const { threads, activeThreadId, addThread, setActiveThread, serverReady, locale, setLocale, theme, setTheme } = useStore();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!serverReady) return;
    getThreads().then((remotes) => {
      const store = useStore.getState();
      const existingIds = new Set(store.threads.map((t) => t.id));
      const toAdd: Thread[] = remotes
        .filter((r) => !existingIds.has(r.thread_id))
        .map((r) => ({
          id: r.thread_id,
          title: r.title,
          updatedAt: new Date(r.created_at),
          mode: (r.mode as Thread["mode"]) ?? "cowork",
        }));
      if (toAdd.length > 0) {
        useStore.setState((s) => ({ threads: [...toAdd, ...s.threads] }));
      }
      const allIds = new Set([...existingIds, ...remotes.map((r) => r.thread_id)]);
      const saved = useStore.getState().activeThreadId;
      if (saved && !allIds.has(saved)) {
        useStore.setState({ activeThreadId: null });
        try { localStorage.removeItem("cowork_active_thread"); } catch {}
      }
    }).catch(() => {});
  }, [serverReady]);

  function handleNew() {
    const id = crypto.randomUUID();
    const thread: Thread = {
      id,
      title: "New conversation",
      updatedAt: new Date(),
      mode: useStore.getState().mode,
    };
    addThread(thread);
    setActiveThread(id);
  }

  return (
    <aside
      className="flex flex-col h-full"
      style={{
        width: 220,
        background: "var(--sidebar)",
        borderRight: "1px solid var(--sidebar-border)",
      }}
    >
      {/* Header */}
      <div className="px-4 pt-5 pb-3 flex items-center justify-between shrink-0">
        <span
          className="text-[11px] font-semibold tracking-widest uppercase"
          style={{ color: "var(--muted-foreground)" }}
        >
          {t("threads", locale)}
        </span>
        <button
          onClick={handleNew}
          className="p-1.5 rounded-lg transition-all"
          style={{ color: "#808590", background: "transparent" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--accent)"; (e.currentTarget as HTMLElement).style.color = "#3884ff"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "#808590"; }}
          title="New thread"
        >
          <PlusIcon size={15} />
        </button>
      </div>

      {/* Search */}
      {threads.length > 0 && (
        <div className="px-3 pb-2 shrink-0">
          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <SearchIcon size={11} style={{ color: "#505058", flexShrink: 0 }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("search", locale)}
              className="flex-1 bg-transparent text-[11px] outline-none placeholder:text-[#505058]"
              style={{ color: "#b0b4bc" }}
            />
          </div>
        </div>
      )}

      {/* Thread list */}
      <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5">
        {threads.length === 0 ? (
          <p className="text-[11px] px-3 py-8 text-center whitespace-pre-line" style={{ color: "var(--muted-foreground)" }}>
            {t("noThreads", locale)}
          </p>
        ) : (() => {
          const filtered = [...threads]
            .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
            .filter((t) => !searchQuery || t.title.toLowerCase().includes(searchQuery.toLowerCase()));
          return filtered.length === 0 ? (
            <p className="text-[11px] px-3 py-4 text-center" style={{ color: "var(--muted-foreground)" }}>
              {t("noResults", locale)}
            </p>
          ) : (
            filtered.map((t) => (
              <ThreadItem key={t.id} thread={t} active={t.id === activeThreadId} />
            ))
          );
        })()}
      </div>

      {/* Footer with footer */}
      <div
        className="px-4 py-3 border-t shrink-0 flex items-center justify-between"
        style={{ borderColor: "var(--sidebar-border)" }}
      >
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#3884ff" }} />
          <p className="text-[10px] font-medium tracking-wide" style={{ color: "var(--muted-foreground)" }}>
            {APP_NAME}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-1 rounded-lg transition-colors"
            style={{ color: "var(--muted-foreground)" }}
            title={theme === "dark" ? "Light mode" : "Dark mode"}
          >
            {theme === "dark" ? <SunIcon size={12} /> : <MoonIcon size={12} />}
          </button>
          <button
            onClick={() => setLocale(locale === "ko" ? "en" : "ko")}
            className="px-1.5 py-0.5 rounded-md text-[9px] font-semibold transition-colors"
            style={{ color: "var(--muted-foreground)", background: "var(--secondary)" }}
            title={locale === "ko" ? "Switch to English" : "한국어로 전환"}
          >
            {t("langToggle", locale)}
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            className="p-1 rounded-lg transition-colors"
            style={{ color: "var(--muted-foreground)" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#3884ff")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "#505058")}
            title={t("settings", locale)}
          >
            <Settings2Icon size={13} />
          </button>
        </div>
      </div>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </aside>
  );
}
