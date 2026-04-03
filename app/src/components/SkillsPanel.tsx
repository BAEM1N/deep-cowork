import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SaveIcon, CheckIcon, PlusIcon, Trash2Icon, ChevronRightIcon, XIcon, RefreshCwIcon } from "lucide-react";
import { useStore } from "../store";

interface SkillInfo {
  name: string;
  description: string;
  allowed_tools: string[];
  path: string;
  content: string;
}

export function SkillsPanel() {
  const { serverPort, locale } = useStore();
  const base = `http://127.0.0.1:${serverPort}`;

  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [skillContent, setSkillContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newSkillName, setNewSkillName] = useState("");
  const [showNewSkill, setShowNewSkill] = useState(false);
  const [loading, setLoading] = useState(false);

  async function loadSkills() {
    setLoading(true);
    try {
      const res = await fetch(`${base}/settings/skills`);
      if (res.ok) {
        const data = await res.json();
        setSkills(data.skills || []);
      }
    } catch {}
    finally { setLoading(false); }
  }

  useEffect(() => { if (serverPort) loadSkills(); }, [serverPort]);

  async function handleSave() {
    if (!selectedSkill) return;
    setSaving(true);
    try {
      await fetch(`${base}/settings/skills/${selectedSkill}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: selectedSkill, content: skillContent }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      loadSkills();
    } catch {}
    finally { setSaving(false); }
  }

  async function handleDelete(name: string) {
    const msg = locale === "ko" ? `"${name}" 스킬을 삭제하시겠습니까?` : `Delete skill "${name}"?`;
    if (!confirm(msg)) return;
    await fetch(`${base}/settings/skills/${name}`, { method: "DELETE" });
    if (selectedSkill === name) { setSelectedSkill(null); setSkillContent(""); }
    loadSkills();
  }

  async function handleCreate() {
    const name = newSkillName.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
    if (!name) return;
    const template = `---
name: ${name}
description: ${locale === "ko" ? "새 스킬 설명을 입력하세요" : "Describe what this skill does"}
license: MIT
metadata:
  category: custom
  version: "1.0"
allowed-tools: read_file write_file execute
---

# ${name}

## When to Use
- ...

## Instructions
...
`;
    await fetch(`${base}/settings/skills/${name}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target: name, content: template }),
    });
    setNewSkillName("");
    setShowNewSkill(false);
    await loadSkills();
    setSelectedSkill(name);
    setSkillContent(template);
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>
          {locale === "ko" ? "SKILL.md 기반 에이전트 능력 확장" : "Extend agent capabilities via SKILL.md"}
        </p>
        <div className="flex items-center gap-1">
          <button onClick={loadSkills} className="p-1 rounded" style={{ color: "var(--muted-foreground)" }}>
            <RefreshCwIcon size={11} className={loading ? "animate-spin" : ""} />
          </button>
          <button onClick={() => setShowNewSkill(true)} className="p-1 rounded-lg" style={{ color: "#3884ff" }} title="Add skill">
            <PlusIcon size={13} />
          </button>
        </div>
      </div>

      {/* New skill input */}
      <AnimatePresence>
        {showNewSkill && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="flex items-center gap-2 overflow-hidden">
            <input
              autoFocus value={newSkillName}
              onChange={(e) => setNewSkillName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setShowNewSkill(false); }}
              placeholder={locale === "ko" ? "스킬 이름 (영문 소문자)" : "Skill name (lowercase)"}
              className="flex-1 px-2.5 py-1.5 rounded-lg text-[11px] font-mono outline-none"
              style={{ background: "var(--input)", border: "1px solid var(--border)", color: "var(--foreground)" }}
            />
            <button onClick={handleCreate} className="px-2.5 py-1.5 rounded-lg text-[10px] font-medium" style={{ background: "#3884ff", color: "#fff" }}>
              {locale === "ko" ? "생성" : "Create"}
            </button>
            <button onClick={() => setShowNewSkill(false)} className="p-1" style={{ color: "var(--muted-foreground)" }}>
              <XIcon size={12} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Skill list */}
      {skills.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-2xl opacity-30 mb-2">🧩</p>
          <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
            {locale === "ko" ? "등록된 스킬이 없습니다" : "No skills registered"}
          </p>
          <p className="text-[10px] mt-1" style={{ color: "var(--muted-foreground)", opacity: 0.6 }}>
            {locale === "ko" ? "위 + 버튼으로 스킬을 추가하세요" : "Click + above to add a skill"}
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {skills.map((skill) => (
            <div
              key={skill.name}
              className="group flex items-start gap-2 px-2.5 py-2 rounded-xl cursor-pointer transition-colors"
              style={{
                background: selectedSkill === skill.name ? "rgba(56,132,255,0.08)" : "transparent",
                border: selectedSkill === skill.name ? "1px solid rgba(56,132,255,0.15)" : "1px solid transparent",
              }}
              onClick={() => { setSelectedSkill(skill.name); setSkillContent(skill.content); }}
            >
              <ChevronRightIcon size={11} className="mt-0.5 shrink-0"
                style={{ color: selectedSkill === skill.name ? "#3884ff" : "var(--muted-foreground)", transform: selectedSkill === skill.name ? "rotate(90deg)" : "none", transition: "transform 0.15s" }} />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-mono font-medium" style={{ color: selectedSkill === skill.name ? "#5a9eff" : "var(--foreground)" }}>{skill.name}</p>
                <p className="text-[10px] truncate" style={{ color: "var(--muted-foreground)" }}>{skill.description}</p>
                {skill.allowed_tools.length > 0 && (
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {skill.allowed_tools.slice(0, 4).map((tool) => (
                      <span key={tool} className="text-[8px] px-1.5 py-0.5 rounded-md" style={{ background: "var(--secondary)", color: "var(--muted-foreground)" }}>{tool}</span>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(skill.name); }}
                className="p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                style={{ color: "var(--muted-foreground)" }}
              >
                <Trash2Icon size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Skill editor */}
      <AnimatePresence>
        {selectedSkill && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
            className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
            <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: "1px solid var(--border)" }}>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-mono font-semibold" style={{ color: "#3884ff" }}>{selectedSkill}</span>
                <span className="text-[9px]" style={{ color: "var(--muted-foreground)" }}>SKILL.md</span>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={handleSave} disabled={saving}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium"
                  style={{ background: saved ? "rgba(52,199,89,0.12)" : "rgba(56,132,255,0.1)", color: saved ? "#34c759" : "#5a9eff" }}>
                  {saved ? <><CheckIcon size={10} /> {locale === "ko" ? "저장됨" : "Saved"}</> : <><SaveIcon size={10} /> {locale === "ko" ? "저장" : "Save"}</>}
                </button>
                <button onClick={() => setSelectedSkill(null)} className="p-0.5 rounded" style={{ color: "var(--muted-foreground)" }}>
                  <XIcon size={11} />
                </button>
              </div>
            </div>
            <textarea
              value={skillContent}
              onChange={(e) => setSkillContent(e.target.value)}
              rows={14}
              className="w-full bg-transparent text-[11px] px-3 py-2.5 resize-y outline-none leading-relaxed font-mono"
              style={{ color: "var(--foreground)", maxHeight: 500 }}
              spellCheck={false}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
