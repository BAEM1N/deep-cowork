import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { SaveIcon, RefreshCwIcon, CheckIcon, BookOpenIcon } from "lucide-react";
import { getMemory, updateMemory } from "../lib/api";
import { useStore } from "../store";

type MemoryKey = "soul" | "user" | "agents";

const LABELS: Record<MemoryKey, { title: string; desc: string; placeholder: string }> = {
  agents: { title: "AGENTS.md", desc: "에이전트 지침", placeholder: "에이전트의 작업 규칙, 워크플로, 도구 사용 가이드를 정의하세요." },
  soul: { title: "SOUL.md", desc: "에이전트 페르소나", placeholder: "에이전트의 성격, 전문성, 소통 스타일을 정의하세요." },
  user: { title: "USER.md", desc: "사용자 선호", placeholder: "사용자 선호, 기술 스택, 금지 사항을 기록하세요." },
};

export function MemoryPanel() {
  const { serverPort, locale } = useStore();
  const [values, setValues] = useState<Record<MemoryKey, string>>({ soul: "", user: "", agents: "" });
  const [saving, setSaving] = useState<MemoryKey | null>(null);
  const [saved, setSaved] = useState<MemoryKey | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function load() {
    setLoading(true); setLoadError(null);
    try {
      const d = await getMemory();
      setValues({ soul: d.soul || "", user: d.user || "", agents: d.agents || "" });
    } catch (e) { setLoadError(e instanceof Error ? e.message : "로드 실패"); }
    finally { setLoading(false); }
  }

  useEffect(() => { if (serverPort) load(); }, [serverPort]);

  async function handleSave(key: MemoryKey) {
    setSaving(key);
    try {
      await updateMemory(key, values[key]);
      setSaved(key);
      setTimeout(() => setSaved(null), 2000);
    } catch {}
    finally { setSaving(null); }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>
          {locale === "ko" ? "에이전트 시스템 프롬프트에 자동 주입됩니다" : "Auto-injected into agent system prompt"}
        </p>
        <button onClick={load} disabled={loading} className="p-1 rounded" style={{ color: "var(--muted-foreground)" }}>
          <RefreshCwIcon size={12} className={loading ? "animate-spin" : ""} />
        </button>
      </div>
      {loadError && <p className="text-[10px] px-1" style={{ color: "#ff4d4d" }}>{loadError}</p>}

      {(["agents", "soul", "user"] as MemoryKey[]).map((key) => {
        const meta = LABELS[key];
        const isSaved = saved === key;
        return (
          <motion.div key={key} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
            <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: "1px solid var(--border)" }}>
              <div className="flex items-center gap-1.5">
                {key === "agents" && <BookOpenIcon size={11} style={{ color: "#3884ff" }} />}
                <span className="text-[11px] font-mono font-semibold" style={{ color: "#3884ff" }}>{meta.title}</span>
                <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>{meta.desc}</span>
              </div>
              <button onClick={() => handleSave(key)} disabled={saving === key}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium"
                style={{ background: isSaved ? "rgba(52,199,89,0.12)" : "rgba(56,132,255,0.1)", color: isSaved ? "#34c759" : "#5a9eff" }}>
                {isSaved ? <><CheckIcon size={10} /> {locale === "ko" ? "저장됨" : "Saved"}</> : <><SaveIcon size={10} /> {locale === "ko" ? "저장" : "Save"}</>}
              </button>
            </div>
            <textarea
              value={values[key]}
              onChange={(e) => setValues((p) => ({ ...p, [key]: e.target.value }))}
              placeholder={meta.placeholder}
              rows={key === "agents" ? 8 : 4}
              className="w-full bg-transparent text-[11px] px-3 py-2.5 resize-y outline-none leading-relaxed font-mono placeholder:opacity-30"
              style={{ color: "var(--foreground)", maxHeight: 400 }}
            />
          </motion.div>
        );
      })}

      <div className="rounded-xl px-3 py-2" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
        <p className="text-[10px] font-mono" style={{ color: "var(--muted-foreground)" }}>MEMORY.md ({locale === "ko" ? "세션별 자동 기록" : "auto-recorded per session"})</p>
        <p className="text-[10px] mt-1" style={{ color: "var(--muted-foreground)", opacity: 0.6 }}>
          {locale === "ko" ? "에이전트가 memory_write 도구로 자동 저장 · 파일 탭에서 확인" : "Auto-saved by memory_write tool · view in Files tab"}
        </p>
      </div>
    </div>
  );
}
