import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileIcon, FileCodeIcon, FileTextIcon, RefreshCwIcon, ChevronRightIcon, XIcon, SaveIcon, CheckIcon, PencilIcon, EyeIcon, AlertCircleIcon } from "lucide-react";
import { getFiles, readFile, writeFile, type AgentFile } from "../lib/api";
import { useStore } from "../store";

function fileIcon(path: string) {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const code = ["ts", "tsx", "js", "jsx", "py", "rs", "go", "java", "cpp", "c", "sh"];
  if (code.includes(ext)) return <FileCodeIcon size={12} style={{ color: "#3884ff" }} />;
  if (["md", "txt", "json", "yaml", "yml", "toml"].includes(ext)) return <FileTextIcon size={12} style={{ color: "#ffb340" }} />;
  return <FileIcon size={12} style={{ color: "#606068" }} />;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`;
  return `${(bytes / 1024 / 1024).toFixed(1)}M`;
}

function FileViewer({ threadId, file, onClose }: { threadId: string; file: AgentFile; onClose: () => void }) {
  const [content, setContent] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true); setLoadError(null); setEditing(false);
    readFile(threadId, file.path).then((c) => { setContent(c); setEditContent(c); }).catch((e) => setLoadError(e.message)).finally(() => setLoading(false));
  }, [threadId, file.path]);

  const isDirty = editing && editContent !== content;

  async function handleSave() {
    setSaving(true); setSaveError(null);
    try { await writeFile(threadId, file.path, editContent); setContent(editContent); setEditing(false); setSaved(true); setTimeout(() => setSaved(false), 2000); }
    catch (e) { setSaveError(e instanceof Error ? e.message : "저장 실패"); }
    finally { setSaving(false); }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
      className="absolute inset-0 flex flex-col rounded-xl overflow-hidden" style={{ background: "#151518", border: "1px solid #2a2a30", zIndex: 10 }}>
      <div className="flex items-center justify-between px-3 py-2 shrink-0 gap-2" style={{ borderBottom: "1px solid #222228" }}>
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {fileIcon(file.path)}
          <span className="text-xs font-mono truncate" style={{ color: "#b0b4bc" }}>{file.path}</span>
          {isDirty && <span className="text-[9px] px-1.5 rounded-md shrink-0" style={{ background: "rgba(56,132,255,0.15)", color: "#5a9eff" }}>수정됨</span>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!loading && !loadError && !editing && (
            <button onClick={() => { setEditContent(content ?? ""); setEditing(true); setSaveError(null); }} className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px]" style={{ color: "#808590", background: "#1e1e22" }}><PencilIcon size={9} /> 편집</button>
          )}
          {editing && (
            <>
              <button onClick={() => { if (isDirty && !confirm("저장하지 않은 변경 사항이 있습니다. 취소하시겠습니까?")) return; setEditing(false); setEditContent(content ?? ""); }} className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px]" style={{ color: "#606068", background: "#1e1e22" }}><EyeIcon size={9} /> 취소</button>
              <button onClick={handleSave} disabled={saving || !isDirty} className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium"
                style={{ background: saved ? "rgba(52,199,89,0.15)" : isDirty ? "rgba(56,132,255,0.15)" : "#1e1e22", color: saved ? "#34c759" : isDirty ? "#5a9eff" : "#505058" }}>
                {saved ? <CheckIcon size={9} /> : <SaveIcon size={9} />} {saving ? "저장 중…" : saved ? "저장됨" : "저장"}
              </button>
            </>
          )}
          <button onClick={() => { if (isDirty && !confirm("저장하지 않은 변경 사항이 있습니다. 닫으시겠습니까?")) return; onClose(); }} className="p-1 rounded" style={{ color: "#606068" }}><XIcon size={12} /></button>
        </div>
      </div>
      {saveError && <div className="flex items-center gap-2 px-3 py-1.5 text-[11px] shrink-0" style={{ background: "rgba(255,77,77,0.08)", borderBottom: "1px solid rgba(255,77,77,0.15)", color: "#ff6b6b" }}><AlertCircleIcon size={11} />{saveError}</div>}
      <div className="flex-1 overflow-auto p-3">
        {loading ? <div className="flex items-center gap-2" style={{ color: "#606068" }}><RefreshCwIcon size={12} className="animate-spin" /><span className="text-xs">불러오는 중…</span></div>
        : loadError ? <div className="flex items-center gap-2 text-xs" style={{ color: "#ff4d4d" }}><AlertCircleIcon size={12} />{loadError}</div>
        : editing ? <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} className="w-full h-full bg-transparent text-xs font-mono resize-none outline-none" style={{ color: "#b0b4bc", lineHeight: 1.6, minHeight: "100%", caretColor: "#3884ff" }} spellCheck={false} autoFocus />
        : <pre className="text-xs font-mono whitespace-pre-wrap" style={{ color: "#b0b4bc", lineHeight: 1.6 }}>{content}</pre>}
      </div>
    </motion.div>
  );
}

export function FilePanel({ threadId, filesChanged }: { threadId: string | null; filesChanged: number }) {
  const { serverReady } = useStore();
  const [files, setFiles] = useState<AgentFile[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [selectedFile, setSelectedFile] = useState<AgentFile | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!serverReady || !threadId) return;
    setLoading(true); setLoadError(null);
    try { const r = await getFiles(threadId); setFiles(r.files); setTruncated(r.truncated); }
    catch (e) { setLoadError(e instanceof Error ? e.message : "파일 목록 로드 실패"); }
    finally { setLoading(false); }
  }, [serverReady, threadId]);

  useEffect(() => { setSelectedFile(null); }, [threadId]);
  useEffect(() => { const t = setTimeout(() => refresh(), 300); return () => clearTimeout(t); }, [refresh, filesChanged]);

  if (!threadId) return <div className="flex items-center justify-center h-full" style={{ color: "#505058" }}><p className="text-xs">스레드를 선택하세요</p></div>;

  return (
    <div className="relative flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-1 pb-2 shrink-0">
        <p className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: "#505058" }}>Files</p>
        <button onClick={refresh} className="p-0.5 rounded" style={{ color: "#606068" }} title="Refresh"><RefreshCwIcon size={11} className={loading ? "animate-spin" : ""} /></button>
      </div>
      {loadError && <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-xl text-[11px] mb-2" style={{ background: "rgba(255,77,77,0.08)", border: "1px solid rgba(255,77,77,0.15)", color: "#ff6b6b" }}><AlertCircleIcon size={10} />{loadError}</div>}
      {truncated && <p className="text-[10px] px-1 pb-1.5" style={{ color: "#5a9eff" }}>파일이 너무 많아 처음 500개만 표시됩니다</p>}
      {!loadError && files.length === 0 ? (
        <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: loading ? "transparent" : "#151518", border: loading ? "none" : "1px dashed #2a2a30" }}>
          {loading ? <><RefreshCwIcon size={11} className="animate-spin" style={{ color: "#606068" }} /><span className="text-[11px]" style={{ color: "#606068" }}>불러오는 중…</span></>
          : <><FileIcon size={12} style={{ color: "#505058" }} /><span className="text-[11px]" style={{ color: "#606068" }}>생성된 파일 없음</span></>}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-0.5">
          {files.map((f) => (
            <motion.button key={f.path} initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={() => setSelectedFile(f)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-xl text-left transition-colors"
              style={{ background: selectedFile?.path === f.path ? "rgba(56,132,255,0.08)" : "transparent" }}
              onMouseEnter={(e) => { if (selectedFile?.path !== f.path) (e.currentTarget as HTMLElement).style.background = "#1a1a20"; }}
              onMouseLeave={(e) => { if (selectedFile?.path !== f.path) (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
              {fileIcon(f.path)}
              <span className="text-[11px] font-mono flex-1 truncate text-left" style={{ color: "#a0a4ac" }}>{f.path}</span>
              <span className="text-[9px] shrink-0 font-mono" style={{ color: "#505058" }}>{formatSize(f.size)}</span>
              <ChevronRightIcon size={10} style={{ color: "#505058" }} />
            </motion.button>
          ))}
        </div>
      )}
      <AnimatePresence>{selectedFile && <FileViewer threadId={threadId} file={selectedFile} onClose={() => setSelectedFile(null)} />}</AnimatePresence>
    </div>
  );
}
