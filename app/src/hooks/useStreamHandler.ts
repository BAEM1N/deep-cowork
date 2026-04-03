import { useRef, useState, useCallback, useEffect } from "react";
import { useStore, type Task, type SubAgent, type TaskStatus } from "../store";
import { postApproval, abortThread } from "../lib/api";
import { parseSSEEvent } from "../lib/sse-types";
import type { PendingApproval } from "../components/ApprovalModal";

const STALL_MS = 45_000;

export function useStreamHandler() {
  const serverPort = useStore((s) => s.serverPort);
  const activeThreadId = useStore((s) => s.activeThreadId);
  const mode = useStore((s) => s.mode);
  const workspacePath = useStore((s) => s.workspacePath);
  const addMessage = useStore((s) => s.addMessage);
  const appendToLastMessage = useStore((s) => s.appendToLastMessage);
  const finalizeStream = useStore((s) => s.finalizeStream);
  const setTasks = useStore((s) => s.setTasks);
  const updateTask = useStore((s) => s.updateTask);
  const setAgents = useStore((s) => s.setAgents);
  const updateThreadTitle = useStore((s) => s.updateThreadTitle);
  const bumpFiles = useStore((s) => s.bumpFiles);
  const addToolCallToLastMessage = useStore((s) => s.addToolCallToLastMessage);
  const markLastToolCallDone = useStore((s) => s.markLastToolCallDone);
  const addToolLog = useStore((s) => s.addToolLog);
  const updateLastToolLog = useStore((s) => s.updateLastToolLog);
  const setWorkspacePath = useStore((s) => s.setWorkspacePath);

  const abortRef = useRef<AbortController | null>(null);
  const threadAbortMap = useRef<Map<string, AbortController>>(new Map());
  const stallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
      abortRef.current?.abort();
    };
  }, []);

  // Abort previous thread stream on switch
  useEffect(() => {
    for (const [tid, ctrl] of threadAbortMap.current) {
      if (tid !== activeThreadId) {
        ctrl.abort();
        threadAbortMap.current.delete(tid);
      }
    }
  }, [activeThreadId]);

  const handleApproval = useCallback(async (id: string, approved: boolean) => {
    setApprovals((q) => q.filter((a) => a.approvalId !== id));
    try {
      await postApproval(id, approved);
    } catch {
      appendToLastMessage("\n\n⚠️ 승인 전송 실패: 네트워크 오류. 에이전트가 타임아웃 후 거부로 처리합니다.");
    }
  }, [appendToLastMessage]);

  const handleAbort = useCallback(async () => {
    if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
    const threadId = activeThreadId ?? "default";
    abortRef.current?.abort();
    try {
      await abortThread(threadId);
    } catch {
      // ignore
    }
    finalizeStream();
  }, [activeThreadId, finalizeStream]);

  const handleSend = useCallback(async (text: string) => {
    if (!text || !activeThreadId) return;
    const threadId = activeThreadId;

    addMessage({ id: crypto.randomUUID(), role: "user", content: text });
    addMessage({ id: crypto.randomUUID(), role: "assistant", content: "", streaming: true });

    abortRef.current = new AbortController();
    threadAbortMap.current.set(threadId, abortRef.current);

    function resetStall() {
      if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
      stallTimerRef.current = setTimeout(() => {
        abortRef.current?.abort();
        appendToLastMessage("\n\n⚠️ 응답 대기 시간 초과 (45초). 네트워크 또는 서버 상태를 확인하세요.");
        finalizeStream();
      }, STALL_MS);
    }

    try {
      const body: Record<string, unknown> = { message: text, thread_id: threadId, mode };
      if (workspacePath) body.workspace_path = workspacePath;

      const res = await fetch(`http://127.0.0.1:${serverPort}/agent/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: abortRef.current.signal,
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) return;
      resetStall();

      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        resetStall();
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (raw === "[DONE]") { finalizeStream(); break; }

          const evt = parseSSEEvent(raw);
          if (!evt) continue;

          switch (evt.type) {
            case "token":
              appendToLastMessage(evt.content ?? "");
              break;
            case "tasks":
              setTasks((evt.tasks ?? []) as Task[]);
              break;
            case "task_update":
              updateTask(evt.id, evt.status as TaskStatus);
              break;
            case "agents":
              setAgents((evt.agents ?? []) as SubAgent[]);
              break;
            case "tool_call": {
              const toolName = typeof evt.name === "string" ? evt.name : String(evt.name ?? "");
              const toolArgs = typeof evt.args === "string" ? evt.args : JSON.stringify(evt.args ?? "");
              addToolCallToLastMessage({
                id: crypto.randomUUID(),
                name: toolName,
                input: toolArgs,
                status: "running",
              });
              addToolLog({
                name: toolName,
                args: toolArgs,
                status: "running",
                source: typeof evt.source === "string" ? evt.source : "main",
              });
              break;
            }
            case "tool_result": {
              const resultToolName = typeof evt.tool_name === "string" ? evt.tool_name : undefined;
              markLastToolCallDone(resultToolName);
              updateLastToolLog(evt.content ?? "", "done");
              break;
            }
            case "files_changed":
              bumpFiles();
              break;
            case "workspace_path":
              if (evt.path) setWorkspacePath(evt.path);
              break;
            case "title":
              if (evt.thread_id && evt.title) {
                updateThreadTitle(evt.thread_id, evt.title);
              }
              break;
            case "approval":
              setApprovals((q) => [
                ...q,
                {
                  approvalId: evt.approval_id,
                  toolName: evt.tool_name,
                  args: evt.args ?? {},
                  source: evt.source ?? "agent",
                },
              ]);
              break;
            case "error":
              appendToLastMessage(`\n\n⚠️ 오류: ${evt.message}`);
              break;
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        appendToLastMessage("\n\n⚠️ 네트워크 오류: 연결이 끊어졌습니다.");
      }
    } finally {
      if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
      threadAbortMap.current.delete(threadId);
      finalizeStream();
    }
  }, [activeThreadId, mode, workspacePath, serverPort, addMessage, appendToLastMessage, finalizeStream, setTasks, updateTask, setAgents, updateThreadTitle, bumpFiles, addToolCallToLastMessage, markLastToolCallDone, addToolLog, updateLastToolLog, setWorkspacePath]);

  return { approvals, handleApproval, handleAbort, handleSend };
}
