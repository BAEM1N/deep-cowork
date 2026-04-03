/**
 * API client — talks to the Python agent backend
 */

let _port = 8008;

export function setPort(port: number) {
  _port = port;
}

function base() {
  return `http://127.0.0.1:${_port}`;
}

export interface AgentFile {
  path: string;
  size: number;
  modified: string;
}

export interface ThreadInfo {
  thread_id: string;
  title: string;
  created_at: string;
  mode: string;
}

export interface HealthInfo {
  status: string;
  model: string;
  api_key_set: boolean;
  db: string;
  os_platform?: string;
  workspace_root?: string;
}

export interface SettingsInfo {
  provider: string;
  model: string;
  api_key_set: boolean;
  ollama_base_url?: string;
  os_platform?: string;       // "Windows" | "Darwin" | "Linux"
  workspace_root?: string;    // 서버 기본 워크스페이스 경로
}

export async function getHealth(): Promise<HealthInfo> {
  const res = await fetch(`${base()}/health`);
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  return res.json();
}

export async function getSettings(): Promise<SettingsInfo> {
  const res = await fetch(`${base()}/settings`);
  if (!res.ok) throw new Error(`Failed to load settings: ${res.status}`);
  return res.json();
}

export async function postProviderSettings(
  provider: string,
  model: string,
  ollamaBaseUrl?: string,
): Promise<{ ok: boolean }> {
  const res = await fetch(`${base()}/settings/provider`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider, model, ollama_base_url: ollamaBaseUrl }),
  });
  if (!res.ok) throw new Error(`Failed to update provider settings: ${res.status}`);
  return res.json();
}

export async function getThreads(): Promise<ThreadInfo[]> {
  const res = await fetch(`${base()}/agent/threads`);
  if (!res.ok) throw new Error(`Failed to load threads: ${res.status}`);
  const data = await res.json();
  return data.threads ?? [];
}

export async function deleteThread(threadId: string): Promise<void> {
  await fetch(`${base()}/agent/threads/${threadId}`, { method: "DELETE" });
}

export interface FilesResult {
  files: AgentFile[];
  truncated: boolean;
}

export async function getFiles(threadId: string): Promise<FilesResult> {
  const res = await fetch(`${base()}/agent/threads/${encodeURIComponent(threadId)}/files`);
  if (!res.ok) throw new Error(`Failed to load files: ${res.status}`);
  const data = await res.json();
  return { files: data.files ?? [], truncated: data.truncated ?? false };
}

export async function readFile(threadId: string, filePath: string): Promise<string> {
  const res = await fetch(
    `${base()}/agent/threads/${encodeURIComponent(threadId)}/files/${filePath}`
  );
  if (!res.ok) throw new Error(`Failed to read file: ${res.status}`);
  const data = await res.json();
  return data.content as string;
}

export async function writeFile(threadId: string, filePath: string, content: string): Promise<void> {
  const res = await fetch(
    `${base()}/agent/threads/${encodeURIComponent(threadId)}/files/${filePath}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    }
  );
  if (!res.ok) throw new Error(`Failed to write file: ${res.status}`);
}

export interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
  tool_calls?: Array<{ name: string; id: string }> | null;
}

export async function getThreadMessages(threadId: string): Promise<HistoryMessage[]> {
  const res = await fetch(
    `${base()}/agent/threads/${encodeURIComponent(threadId)}/messages`
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.messages ?? [];
}

export async function postApiKey(apiKey: string): Promise<{ ok: boolean; api_key_set: boolean }> {
  const res = await fetch(`${base()}/settings/api-key`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: apiKey }),
  });
  if (!res.ok) throw new Error(`Failed to save API key: ${res.status}`);
  return res.json();
}

export async function postApproval(approvalId: string, approved: boolean): Promise<void> {
  await fetch(`${base()}/agent/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ approval_id: approvalId, approved }),
  });
}

export async function abortThread(threadId: string): Promise<void> {
  await fetch(`${base()}/agent/abort/${encodeURIComponent(threadId)}`, {
    method: "POST",
  });
}

export interface MemoryContent {
  soul: string;
  user: string;
  agents: string;
}

export async function getMemory(): Promise<MemoryContent> {
  const res = await fetch(`${base()}/settings/memory`);
  if (!res.ok) throw new Error(`Failed to load memory: ${res.status}`);
  return res.json();
}

export async function updateMemory(target: "soul" | "user" | "agents", content: string): Promise<{ ok: boolean }> {
  const res = await fetch(`${base()}/settings/memory`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target, content }),
  });
  if (!res.ok) throw new Error(`Failed to update memory: ${res.status}`);
  return res.json();
}
