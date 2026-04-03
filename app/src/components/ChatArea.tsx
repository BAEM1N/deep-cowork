import { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SendIcon, FolderIcon, StopCircleIcon, XIcon } from "lucide-react";
import { useStore } from "../store";
import { t } from "../lib/i18n";
import { useStreamHandler } from "../hooks/useStreamHandler";
import { MessageStream } from "./MessageStream";
import { ModeSwitch } from "./ModeSwitch";
import { ApprovalModal } from "./ApprovalModal";

function wsPlaceholder(osPlatform: string): string {
  if (osPlatform === "Windows") return "C:\\Users\\username\\project";
  if (osPlatform === "Darwin") return "/Users/username/project";
  return "/home/username/project";
}

export function ChatArea() {
  const messages = useStore((s) => s.messages);
  const inputValue = useStore((s) => s.inputValue);
  const isStreaming = useStore((s) => s.isStreaming);
  const activeThreadId = useStore((s) => s.activeThreadId);
  const workspacePath = useStore((s) => s.workspacePath);
  const osPlatform = useStore((s) => s.osPlatform);
  const setInputValue = useStore((s) => s.setInputValue);
  const locale = useStore((s) => s.locale);

  const { approvals, handleApproval, handleAbort, handleSend } = useStreamHandler();

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showWorkspaceInput, setShowWorkspaceInput] = useState(false);
  const [workspaceInput, setWorkspaceInput] = useState(workspacePath ?? "");
  const setWorkspacePath = useStore((s) => s.setWorkspacePath);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  function autoResize() {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 180)}px`;
  }

  function onSend() {
    const text = inputValue.trim();
    if (!text || isStreaming) return;

    // Auto-create thread if none selected
    let threadId = activeThreadId;
    if (!threadId) {
      threadId = crypto.randomUUID();
      const store = useStore.getState();
      store.addThread({
        id: threadId,
        title: "New conversation",
        updatedAt: new Date(),
        mode: store.mode,
      });
      store.setActiveThread(threadId);
    }

    setInputValue("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    // Small delay to ensure activeThreadId is set in store before handleSend reads it
    setTimeout(() => handleSend(text), 0);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  }

  function applyWorkspace() {
    const trimmed = workspaceInput.trim();
    setWorkspacePath(trimmed || null);
    setShowWorkspaceInput(false);
  }

  return (
    <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
      <ApprovalModal approval={approvals[0] ?? null} queueSize={approvals.length} onApprove={handleApproval} />

      {/* Topbar with accent bar */}
      <div
        className="shrink-0"
        style={{ background: "var(--sidebar)" }}
      >
        <div className="accent-bar" />
        <div className="flex items-center justify-between px-6 py-3">
          <ModeSwitch />
          <div className="flex items-center gap-2">
            {workspacePath && !showWorkspaceInput && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono cursor-pointer"
                style={{
                  background: "rgba(56, 132, 255, 0.12)",
                  border: "1px solid rgba(56, 132, 255, 0.3)",
                  color: "#5a9eff",
                  maxWidth: 160,
                }}
                onClick={() => { setWorkspaceInput(workspacePath); setShowWorkspaceInput(true); }}
                title={workspacePath}
              >
                <FolderIcon size={10} />
                <span className="truncate">{workspacePath.split("/").pop() || workspacePath}</span>
              </motion.div>
            )}

            {isStreaming && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-1.5">
                <button
                  onClick={handleAbort}
                  aria-label="에이전트 중지"
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] transition-colors"
                  style={{
                    color: "#ff6b6b",
                    background: "rgba(255, 77, 77, 0.1)",
                    border: "1px solid rgba(255, 77, 77, 0.3)",
                  }}
                >
                  <StopCircleIcon size={11} />
                  {t("stop", locale)}
                </button>
                <span
                  className="w-1.5 h-1.5 rounded-full animate-pulse"
                  style={{ background: "#3884ff" }}
                />
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* Workspace input bar */}
      <AnimatePresence>
        {showWorkspaceInput && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="shrink-0 overflow-hidden"
            style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}
          >
            <div className="flex items-center gap-2 px-6 py-2">
              <FolderIcon size={13} style={{ color: "#3884ff", flexShrink: 0 }} />
              <input
                autoFocus
                type="text"
                value={workspaceInput}
                onChange={(e) => setWorkspaceInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applyWorkspace();
                  if (e.key === "Escape") setShowWorkspaceInput(false);
                }}
                placeholder={wsPlaceholder(osPlatform)}
                className="flex-1 bg-transparent text-xs font-mono outline-none"
                style={{ color: "var(--secondary-foreground)" }}
              />
              {workspaceInput && (
                <button onClick={() => setWorkspaceInput("")} className="p-0.5" style={{ color: "var(--muted-foreground)" }}>
                  <XIcon size={12} />
                </button>
              )}
              <button
                onClick={applyWorkspace}
                className="px-3 py-1 rounded-full text-[10px] font-medium"
                style={{ background: "#3884ff", color: "#fff" }}
              >
                Set
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto" style={{ background: "var(--background)" }}>
        <div className="max-w-3xl mx-auto px-6">
          <AnimatePresence>
            {messages.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-5"
              >
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{
                    background: "linear-gradient(135deg, rgba(56,132,255,0.15), rgba(56,132,255,0.05))",
                    border: "1px solid rgba(56,132,255,0.2)",
                  }}
                >
                  <span className="text-2xl" style={{ color: "#3884ff" }}>⬡</span>
                </div>
                <div>
                  <p className="text-base font-semibold" style={{ color: "var(--foreground)" }}>
                    {t("readyTitle", locale)}
                  </p>
                  <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
                    {t("readySub", locale)}
                  </p>
                </div>
              </motion.div>
            ) : (
              <MessageStream key="msgs" messages={messages} />
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Input area — DeepCoWork style */}
      <div
        className="shrink-0 px-6 py-4"
        style={{ background: "var(--sidebar)", borderTop: "1px solid var(--sidebar-border)" }}
      >
        <div className="max-w-3xl mx-auto">
          <div
            className="flex items-end gap-3 rounded-2xl px-4 py-3 input-focus transition-all"
            style={{
              background: "var(--input)",
              border: "1px solid var(--border)",
            }}
          >
            <button
              className="p-1 rounded-lg shrink-0 mb-0.5 transition-colors"
              style={{ color: workspacePath ? "#3884ff" : "var(--muted-foreground)" }}
              title={workspacePath ? `Workspace: ${workspacePath}` : "Scope to folder"}
              onClick={() => { setWorkspaceInput(workspacePath ?? ""); setShowWorkspaceInput((v) => !v); }}
            >
              <FolderIcon size={16} />
            </button>

            <textarea
              ref={textareaRef}
              rows={1}
              value={inputValue}
              onChange={(e) => { setInputValue(e.target.value); autoResize(); }}
              onKeyDown={handleKeyDown}
              placeholder={t("inputPlaceholder", locale)}
              disabled={isStreaming}
              className="flex-1 bg-transparent text-sm resize-none outline-none leading-relaxed placeholder:text-[var(--muted-foreground)]"
              style={{ color: "var(--foreground)", maxHeight: 180 }}
            />

            <button
              onClick={onSend}
              disabled={!inputValue.trim() || isStreaming}
              aria-label="메시지 전송"
              className="p-2 rounded-xl shrink-0 mb-0.5 transition-all"
              style={{
                background: inputValue.trim() && !isStreaming ? "#3884ff" : "var(--accent)",
                color: inputValue.trim() && !isStreaming ? "#ffffff" : "var(--muted-foreground)",
              }}
            >
              <SendIcon size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
