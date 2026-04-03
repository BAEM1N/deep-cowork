import { useState, useMemo, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BotIcon, UserIcon, WrenchIcon, CheckIcon, LoaderIcon, XIcon, ChevronDownIcon } from "lucide-react";
import type { Message, ToolCall } from "../store";
import { MarkdownContent } from "./MarkdownContent";

function ToolCallRow({ tc }: { tc: ToolCall }) {
  const [expanded, setExpanded] = useState(false);

  const icon =
    tc.status === "running" ? (
      <LoaderIcon size={11} className="animate-spin" style={{ color: "#3884ff" }} />
    ) : tc.status === "done" ? (
      <CheckIcon size={11} style={{ color: "#34c759" }} />
    ) : (
      <XIcon size={11} style={{ color: "#ff4d4d" }} />
    );

  const hasLongInput = tc.input && tc.input.length > 60;

  return (
    <div
      className="rounded-xl text-xs font-mono overflow-hidden"
      style={{ background: "var(--surface-elevated)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <WrenchIcon size={11} style={{ color: "#3884ff" }} />
        <span style={{ color: "var(--secondary-foreground)" }} className="font-semibold shrink-0">{tc.name}</span>
        <span className="truncate flex-1 opacity-50" style={{ color: "var(--muted-foreground)" }}>{tc.input}</span>
        {hasLongInput && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="shrink-0 p-0.5 rounded transition-transform"
            style={{ color: "var(--muted-foreground)", transform: expanded ? "rotate(180deg)" : "none" }}
          >
            <ChevronDownIcon size={10} />
          </button>
        )}
        {icon}
      </div>
      {expanded && hasLongInput && (
        <div className="px-3 pb-2 pt-0" style={{ borderTop: "1px solid var(--border)" }}>
          <pre className="text-[10px] font-mono whitespace-pre-wrap break-all" style={{ color: "var(--muted-foreground)", maxHeight: 200, overflowY: "auto" }}>
            {tc.input}
          </pre>
        </div>
      )}
    </div>
  );
}

const UserBubble = memo(function UserBubble({ msg }: { msg: Message }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex justify-end">
      <div className="flex items-end gap-2 max-w-[75%]">
        <div
          className="px-4 py-2.5 rounded-2xl rounded-br-md text-sm leading-relaxed"
          style={{ background: "#3884ff", color: "#ffffff", fontWeight: 450 }}
        >
          {msg.content}
        </div>
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
          style={{ background: "rgba(56, 132, 255, 0.15)" }}
        >
          <UserIcon size={12} style={{ color: "#3884ff" }} />
        </div>
      </div>
    </motion.div>
  );
});

const AssistantBubble = memo(function AssistantBubble({ msg }: { msg: Message }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-3">
      <div
        className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-1"
        style={{ background: "var(--surface-elevated)", border: "1px solid var(--border)" }}
      >
        <BotIcon size={12} style={{ color: "#5a9eff" }} />
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        {msg.toolCalls && msg.toolCalls.length > 0 && (
          <div className="space-y-1.5">
            {msg.toolCalls.map((tc) => (<ToolCallRow key={tc.id} tc={tc} />))}
          </div>
        )}
        {msg.content && <MarkdownContent content={msg.content} streaming={msg.streaming} />}
      </div>
    </motion.div>
  );
});

const MAX_VISIBLE = 200;

export const MessageStream = memo(function MessageStream({ messages }: { messages: Message[] }) {
  const visible = useMemo(
    () => messages.length > MAX_VISIBLE ? messages.slice(messages.length - MAX_VISIBLE) : messages,
    [messages]
  );

  return (
    <div className="flex flex-col gap-5 py-6 px-1">
      {messages.length > MAX_VISIBLE && (
        <p className="text-center text-[10px] py-1" style={{ color: "var(--muted-foreground)" }}>
          ↑ 이전 {messages.length - MAX_VISIBLE}개 메시지 숨김
        </p>
      )}
      <AnimatePresence initial={false}>
        {visible.map((msg) =>
          msg.role === "user" ? <UserBubble key={msg.id} msg={msg} /> : <AssistantBubble key={msg.id} msg={msg} />
        )}
      </AnimatePresence>
    </div>
  );
});
