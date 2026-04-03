import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { BotIcon, CheckIcon, LoaderIcon, XCircleIcon, CircleIcon, TerminalIcon, GlobeIcon, FileIcon, DatabaseIcon, PlayIcon, ChevronDownIcon } from "lucide-react";
import { useStore, type AgentStatus, type ToolLogEntry } from "../store";
import { t } from "../lib/i18n";
import { TodoCard } from "./TodoCard";
import { FilePanel } from "./FilePanel";
import { MemoryPanel } from "./MemoryPanel";
import { SkillsPanel } from "./SkillsPanel";

type Tab = "tasks" | "agents" | "timeline" | "files" | "memory" | "skills";

function agentStatusIcon(status: AgentStatus) {
  switch (status) {
    case "running": return <LoaderIcon size={10} className="animate-spin" style={{ color: "#3884ff" }} />;
    case "done":    return <CheckIcon size={10} style={{ color: "#34c759" }} />;
    case "error":   return <XCircleIcon size={10} style={{ color: "#ff4d4d" }} />;
    default:        return <CircleIcon size={10} style={{ color: "var(--muted-foreground)" }} />;
  }
}

function toolIcon(name: string) {
  if (name.includes("shell") || name.includes("execute")) return <TerminalIcon size={10} />;
  if (name.includes("web") || name.includes("search")) return <GlobeIcon size={10} />;
  if (name.includes("file") || name.includes("write") || name.includes("read")) return <FileIcon size={10} />;
  if (name.includes("memory")) return <DatabaseIcon size={10} />;
  return <PlayIcon size={10} />;
}

function toolColor(name: string, status: ToolLogEntry["status"]) {
  if (status === "error") return "#ff4d4d";
  if (name.includes("shell") || name.includes("execute")) return "#a78bfa";
  if (name.includes("web") || name.includes("search")) return "#3884ff";
  if (name.includes("write") || name.includes("edit")) return "#5a9eff";
  if (name.includes("memory")) return "#f472b6";
  return "var(--muted-foreground)";
}

function TimelineEntry({ entry }: { entry: ToolLogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const color = toolColor(entry.name, entry.status);
  const hasLongResult = entry.result && entry.result.length > 120;

  return (
    <motion.div
      initial={{ opacity: 0, x: 4 }}
      animate={{ opacity: 1, x: 0 }}
      className="rounded-xl overflow-hidden"
      style={{ border: "1px solid var(--border)", background: "var(--surface)" }}
    >
      <div className="flex items-center gap-2 px-2.5 py-1.5">
        <span style={{ color }}>{toolIcon(entry.name)}</span>
        <span className="text-[11px] font-mono font-medium flex-1 truncate" style={{ color }}>{entry.name}</span>
        <span className="text-[9px] font-mono" style={{ color: "var(--muted-foreground)" }}>
          {entry.timestamp.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </span>
        {entry.status === "running" ? (
          <LoaderIcon size={9} className="animate-spin shrink-0" style={{ color: "#3884ff" }} />
        ) : entry.status === "error" ? (
          <XCircleIcon size={9} className="shrink-0" style={{ color: "#ff4d4d" }} />
        ) : (
          <CheckIcon size={9} className="shrink-0" style={{ color: "#34c759" }} />
        )}
      </div>
      {entry.args && (
        <div className="px-2.5 pb-1.5">
          <p className="text-[10px] font-mono truncate" style={{ color: "var(--muted-foreground)" }} title={entry.args}>{entry.args}</p>
        </div>
      )}
      {entry.result && (
        <div className="px-2.5 pb-1.5" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="flex items-start justify-between gap-1 mt-1">
            <p className={`text-[10px] font-mono flex-1 ${!expanded ? "line-clamp-2" : ""}`} style={{ color: "var(--muted-foreground)" }}>{entry.result}</p>
            {hasLongResult && (
              <button onClick={() => setExpanded((v) => !v)} className="shrink-0 p-0.5 rounded mt-0.5" style={{ color: "var(--muted-foreground)", transform: expanded ? "rotate(180deg)" : "none" }}>
                <ChevronDownIcon size={10} />
              </button>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}

function TimelinePanel() {
  const { toolLog } = useStore();
  const entries = useMemo(() => [...toolLog].reverse(), [toolLog]);
  if (entries.length === 0) return <EmptyState icon="⏱" label={useStore.getState().locale === "ko" ? "실행 기록 없음" : "No activity"} sub={useStore.getState().locale === "ko" ? "도구 호출이 여기 실시간으로 표시됩니다" : "Tool calls will appear here in real time"} />;
  return <div className="space-y-1.5">{entries.map((e) => <TimelineEntry key={e.id} entry={e} />)}</div>;
}

export function AgentPanel({ filesChanged }: { filesChanged: number }) {
  const { tasks, agents, activeThreadId, toolLog, locale } = useStore();
  const [tab, setTab] = useState<Tab>("tasks");

  const tabs: { id: Tab; labelKey: string; badge?: number }[] = [
    { id: "tasks",    labelKey: "tabTasks",    badge: tasks.length  || undefined },
    { id: "agents",   labelKey: "tabAgents",   badge: agents.length || undefined },
    { id: "timeline", labelKey: "tabTimeline", badge: toolLog.length || undefined },
    { id: "files",    labelKey: "tabFiles" },
    { id: "memory",   labelKey: "tabMemory" },
    { id: "skills",   labelKey: "tabSkills" },
  ];

  return (
    <aside className="flex flex-col h-full" style={{ width: 280, background: "var(--sidebar)", borderLeft: "1px solid var(--sidebar-border)" }}>
      {/* Tab bar */}
      <div className="flex items-center px-2 pt-4 pb-0 gap-0 shrink-0 overflow-x-auto" style={{ borderBottom: "1px solid var(--border)" }}>
        {tabs.map((tb) => (
          <button
            key={tb.id}
            onClick={() => setTab(tb.id)}
            className="relative flex items-center gap-1 px-2 py-2 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0"
            style={{
              color: tab === tb.id ? "var(--foreground)" : "var(--muted-foreground)",
              borderBottom: tab === tb.id ? "2px solid #3884ff" : "2px solid transparent",
            }}
          >
            {t(tb.labelKey as any, locale)}
            {tb.badge !== undefined && (
              <span className="text-[9px] px-1.5 rounded-full font-mono" style={{ background: tab === tb.id ? "rgba(56,132,255,0.15)" : "var(--surface-elevated)", color: tab === tb.id ? "#5a9eff" : "var(--muted-foreground)" }}>
                {tb.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {tab === "tasks" && (tasks.length > 0 ? <TodoCard tasks={tasks} /> : <EmptyState icon="📋" label={t("noTasks", locale)} sub={t("noTasksSub", locale)} />)}
        {tab === "agents" && (agents.length > 0 ? (
          <div className="space-y-2">
            {agents.map((agent) => (
              <motion.div key={agent.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-start gap-2.5 p-3 rounded-xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: "var(--surface-elevated)" }}>
                  <BotIcon size={11} style={{ color: "#3884ff" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium truncate" style={{ color: "var(--secondary-foreground)" }}>{agent.name}</span>
                    {agentStatusIcon(agent.status)}
                  </div>
                  {agent.currentTask && <p className="text-[10px] mt-0.5 truncate" style={{ color: "var(--muted-foreground)" }}>{agent.currentTask}</p>}
                </div>
              </motion.div>
            ))}
          </div>
        ) : <EmptyState icon="🤖" label={t("noAgents", locale)} sub={t("noAgentsSub", locale)} />)}
        {tab === "timeline" && <TimelinePanel />}
        {tab === "files" && <FilePanel threadId={activeThreadId} filesChanged={filesChanged} />}
        {tab === "memory" && <MemoryPanel />}
        {tab === "skills" && <SkillsPanel />}
      </div>
    </aside>
  );
}

function EmptyState({ icon, label, sub }: { icon: string; label: string; sub: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
      <span className="text-2xl opacity-40">{icon}</span>
      <p className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>{label}</p>
      <p className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>{sub}</p>
    </div>
  );
}
