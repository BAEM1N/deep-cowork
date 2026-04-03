/** SSE event types — matches agent/stream.py sse() output */

export type SSEEvent =
  | { type: "token"; content: string; source?: string }
  | { type: "tasks"; tasks: Array<{ id: string; label: string; status: string }> }
  | { type: "task_update"; id: string; status: string }
  | { type: "agents"; agents: Array<{ id: string; name: string; status: string; currentTask?: string }> }
  | { type: "tool_call"; name: string; args: string; source?: string; tool_call_id?: string }
  | { type: "tool_result"; content: string; tool_name?: string; source?: string }
  | { type: "files_changed"; thread_id: string }
  | { type: "workspace_path"; thread_id?: string; path: string }
  | { type: "title"; thread_id: string; title: string }
  | { type: "approval"; approval_id: string; tool_name: string; args: Record<string, unknown>; source?: string }
  | { type: "error"; message: string };

export function parseSSEEvent(raw: string): SSEEvent | null {
  try {
    const evt = JSON.parse(raw);
    if (!evt || typeof evt !== "object" || !evt.type) return null;
    return evt as SSEEvent;
  } catch {
    return null;
  }
}
