import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { XIcon, KeyIcon, CheckIcon, LoaderIcon, CpuIcon, ServerIcon, RefreshCwIcon } from "lucide-react";
import { postApiKey, getSettings, postProviderSettings } from "../lib/api";
import { useStore } from "../store";
import { PROVIDERS, SHOW_API_KEY, DEFAULT_PROVIDER, LOCAL_PROVIDERS } from "../lib/deploy";

interface Props { open: boolean; onClose: () => void; }
type Tab = "apikey" | "model";

export function SettingsModal({ open, onClose }: Props) {
  const { setApiKeyMissing, locale } = useStore();
  const [tab, setTab] = useState<Tab>("apikey");
  const [key, setKey] = useState("");
  const [keyStatus, setKeyStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [provider, setProvider] = useState(DEFAULT_PROVIDER);
  const [model, setModel] = useState("");
  const [localUrl, setLocalUrl] = useState("http://localhost:11434/v1");
  const [modelStatus, setModelStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [loading, setLoading] = useState(false);

  // Ollama model list
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [ollamaLoading, setOllamaLoading] = useState(false);
  const [ollamaError, setOllamaError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setLoading(true);
      getSettings().then((s) => {
        setProvider(s.provider ?? DEFAULT_PROVIDER);
        setModel(s.model ?? "");
        if (s.ollama_base_url) setLocalUrl(s.ollama_base_url);
      }).catch(() => {}).finally(() => setLoading(false));
    }
  }, [open]);

  // Fetch Ollama models when provider is ollama
  useEffect(() => {
    if (open && LOCAL_PROVIDERS.has(provider)) {
      fetchOllamaModels();
    }
  }, [open, provider]);

  async function fetchOllamaModels() {
    setOllamaLoading(true);
    setOllamaError(null);
    try {
      let models: string[] = [];
      const baseUrl = localUrl.replace(/\/v1\/?$/, "");

      // Try OpenAI-compatible /v1/models first (works for LM Studio, vLLM, Ollama)
      try {
        const res = await fetch(`${baseUrl}/v1/models`, { signal: AbortSignal.timeout(5000) });
        if (res.ok) {
          const data = await res.json();
          models = (data.data || []).map((m: { id: string }) => m.id).sort();
        }
      } catch {}

      // Fallback: Ollama-specific /api/tags
      if (models.length === 0) {
        const res = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(5000) });
        if (res.ok) {
          const data = await res.json();
          models = (data.models || []).map((m: { name: string }) => m.name).sort();
        }
      }

      if (models.length === 0) throw new Error("no models");

      setOllamaModels(models);
      if (!model && models.length > 0) setModel(models[0]);
    } catch {
      setOllamaError(locale === "ko"
        ? `서버 연결 실패. 서버가 실행 중인지 확인하세요.`
        : `Failed to connect. Is the server running?`);
      setOllamaModels([]);
    } finally {
      setOllamaLoading(false);
    }
  }

  async function handleSaveKey() {
    const trimmed = key.trim();
    if (!trimmed) return;
    setKeyStatus("saving");
    try {
      const res = await postApiKey(trimmed);
      if (res.ok) { setKeyStatus("saved"); setApiKeyMissing(!res.api_key_set); setTimeout(() => { setKeyStatus("idle"); setKey(""); onClose(); }, 900); }
      else setKeyStatus("error");
    } catch { setKeyStatus("error"); }
  }

  async function handleSaveModel() {
    if (!model.trim()) return;
    setModelStatus("saving");
    try {
      const res = await postProviderSettings(provider, model.trim(), LOCAL_PROVIDERS.has(provider) ? localUrl : undefined);
      if (res.ok) { setModelStatus("saved"); setTimeout(() => { setModelStatus("idle"); onClose(); }, 900); }
      else setModelStatus("error");
    } catch { setModelStatus("error"); }
  }

  const currentProvider = PROVIDERS.find((p) => p.value === provider) ?? PROVIDERS[0];
  useEffect(() => { if (open && (LOCAL_PROVIDERS.has(provider) || !SHOW_API_KEY)) setTab("model"); }, [open, provider]);

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    ...(SHOW_API_KEY && provider !== "ollama" ? [{ id: "apikey" as Tab, label: "API Key", icon: <KeyIcon size={12} /> }] : []),
    { id: "model", label: locale === "ko" ? "모델" : "Model", icon: <CpuIcon size={12} /> },
  ];

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: -8 }}
            transition={{ duration: 0.18 }} role="dialog" aria-modal="true"
            className="fixed z-50 left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 w-[460px] rounded-2xl shadow-2xl"
            style={{ background: "#1a1a20", border: "1px solid #2a2a30" }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid #222228" }}>
              <span className="text-sm font-semibold" style={{ color: "#ecedf0" }}>
                {locale === "ko" ? "설정" : "Settings"}
              </span>
              <button onClick={onClose} className="p-1 rounded-lg" style={{ color: "#606068" }}><XIcon size={14} /></button>
            </div>
            <div className="flex items-center px-5 pt-3 pb-0 gap-0" style={{ borderBottom: "1px solid #222228" }}>
              {tabs.map((t) => (
                <button key={t.id} onClick={() => setTab(t.id)} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium" style={{ color: tab === t.id ? "#ecedf0" : "#606068", borderBottom: tab === t.id ? "2px solid #3884ff" : "2px solid transparent" }}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
            <div className="px-5 py-5 space-y-4">
              {tab === "apikey" && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium" style={{ color: "#808590" }}>{provider === "openrouter" ? "OpenRouter API Key" : "Anthropic API Key"}</label>
                    <input type="password" value={key} onChange={(e) => setKey(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleSaveKey(); if (e.key === "Escape") onClose(); }}
                      placeholder={provider === "openrouter" ? "sk-or-v1-..." : "sk-ant-api03-..."} autoFocus
                      className="w-full px-3 py-2.5 rounded-xl text-sm font-mono outline-none transition-all"
                      style={{ background: "#111114", border: `1px solid ${keyStatus === "error" ? "#ff4d4d" : "#2a2a30"}`, color: "#ecedf0" }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(56,132,255,0.5)")}
                      onBlur={(e) => (e.currentTarget.style.borderColor = keyStatus === "error" ? "#ff4d4d" : "#2a2a30")} />
                    {keyStatus === "error" && <p className="text-[11px]" style={{ color: "#ff4d4d" }}>
                      {locale === "ko" ? "키 저장에 실패했습니다." : "Failed to save API key."}
                    </p>}
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs" style={{ background: "#252530", color: "#808590" }}>
                      {locale === "ko" ? "취소" : "Cancel"}
                    </button>
                    <button onClick={handleSaveKey} disabled={!key.trim() || keyStatus === "saving" || keyStatus === "saved"}
                      className="px-4 py-2 rounded-xl text-xs font-medium flex items-center gap-1.5"
                      style={{ background: key.trim() ? "#3884ff" : "#252530", color: key.trim() ? "#fff" : "#505058" }}>
                      {keyStatus === "saving" ? <LoaderIcon size={11} className="animate-spin" /> : keyStatus === "saved" ? <CheckIcon size={11} /> : null}
                      {keyStatus === "saved" ? (locale === "ko" ? "저장됨" : "Saved") : (locale === "ko" ? "저장" : "Save")}
                    </button>
                  </div>
                </>
              )}
              {tab === "model" && (
                <>
                  {loading ? (
                    <div className="flex items-center justify-center py-6"><LoaderIcon size={16} className="animate-spin" style={{ color: "#808590" }} /></div>
                  ) : (
                    <>
                      {/* Provider selector */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium" style={{ color: "#808590" }}>
                          {locale === "ko" ? "프로바이더" : "Provider"}
                        </label>
                        <div className={`grid gap-1.5`} style={{ gridTemplateColumns: `repeat(${PROVIDERS.length}, 1fr)` }}>
                          {PROVIDERS.map((p) => (
                            <button key={p.value} onClick={() => {
                              setProvider(p.value);
                              setModel("");
                              setOllamaModels([]);
                              if ("defaultUrl" in p && p.defaultUrl) setLocalUrl(p.defaultUrl);
                            }}
                              className="px-3 py-2.5 rounded-xl text-xs font-medium transition-all"
                              style={{ background: provider === p.value ? "rgba(56,132,255,0.15)" : "#1e1e22", border: `1px solid ${provider === p.value ? "rgba(56,132,255,0.35)" : "#2a2a30"}`, color: provider === p.value ? "#5a9eff" : "#808590" }}>
                              {p.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Ollama: URL + model list from server */}
                      {LOCAL_PROVIDERS.has(provider) && (
                        <>
                          <div className="space-y-1.5">
                            <label className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "#808590" }}>
                              <ServerIcon size={11} />
                              {locale === "ko" ? "서버 주소" : "Server URL"}
                            </label>
                            <div className="flex gap-1.5">
                              <input type="text" value={localUrl} onChange={(e) => setLocalUrl(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") fetchOllamaModels(); }}
                                placeholder={currentProvider && "defaultUrl" in currentProvider ? (currentProvider as any).defaultUrl : "http://localhost:11434/v1"}
                                className="flex-1 px-3 py-2.5 rounded-xl text-sm font-mono outline-none"
                                style={{ background: "#111114", border: "1px solid #2a2a30", color: "#ecedf0" }} />
                              <button onClick={fetchOllamaModels} disabled={ollamaLoading}
                                className="px-3 py-2.5 rounded-xl text-xs font-medium flex items-center gap-1.5 shrink-0"
                                style={{ background: "rgba(56,132,255,0.15)", color: "#5a9eff", border: "1px solid rgba(56,132,255,0.3)" }}>
                                <RefreshCwIcon size={11} className={ollamaLoading ? "animate-spin" : ""} />
                                {locale === "ko" ? "조회" : "Fetch"}
                              </button>
                            </div>
                          </div>

                          {ollamaError && (
                            <p className="text-[11px] px-1" style={{ color: "#ff6b6b" }}>{ollamaError}</p>
                          )}

                          {/* Model selection from fetched list */}
                          <div className="space-y-1.5">
                            <label className="text-xs font-medium" style={{ color: "#808590" }}>
                              {locale === "ko" ? "모델 선택" : "Select Model"}
                              {ollamaModels.length > 0 && (
                                <span className="ml-1.5 text-[10px] font-normal" style={{ color: "#606068" }}>
                                  ({ollamaModels.length}{locale === "ko" ? "개 발견" : " found"})
                                </span>
                              )}
                            </label>
                            {ollamaModels.length > 0 ? (
                              <div className="grid grid-cols-2 gap-1.5 max-h-[200px] overflow-y-auto">
                                {ollamaModels.map((m) => (
                                  <button key={m} onClick={() => setModel(m)}
                                    className="px-3 py-2 rounded-xl text-[11px] font-mono text-left truncate transition-all"
                                    style={{
                                      background: model === m ? "rgba(56,132,255,0.15)" : "#151518",
                                      border: `1px solid ${model === m ? "rgba(56,132,255,0.35)" : "#2a2a30"}`,
                                      color: model === m ? "#5a9eff" : "#a0a4ac",
                                    }}
                                    title={m}>
                                    {m.replace(":latest", "")}
                                  </button>
                                ))}
                              </div>
                            ) : !ollamaLoading && !ollamaError ? (
                              <p className="text-[11px] py-3 text-center" style={{ color: "#606068" }}>
                                {locale === "ko" ? "서버 주소 입력 후 '조회' 버튼을 누르세요" : "Enter URL and click 'Fetch'"}
                              </p>
                            ) : null}
                          </div>
                        </>
                      )}

                      {/* Non-ollama: text input for model name */}
                      {provider !== "ollama" && (
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium" style={{ color: "#808590" }}>
                            {locale === "ko" ? "모델" : "Model"}
                          </label>
                          <input type="text" value={model} onChange={(e) => setModel(e.target.value)} placeholder={currentProvider.placeholder}
                            className="w-full px-3 py-2.5 rounded-xl text-sm font-mono outline-none transition-all"
                            style={{ background: "#111114", border: "1px solid #2a2a30", color: "#ecedf0" }}
                            onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(56,132,255,0.5)")}
                            onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a30")} />
                        </div>
                      )}

                      {modelStatus === "error" && <p className="text-[11px]" style={{ color: "#ff4d4d" }}>
                        {locale === "ko" ? "설정 저장에 실패했습니다." : "Failed to save settings."}
                      </p>}

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs" style={{ background: "#252530", color: "#808590" }}>
                          {locale === "ko" ? "취소" : "Cancel"}
                        </button>
                        <button onClick={handleSaveModel} disabled={!model.trim() || modelStatus === "saving" || modelStatus === "saved"}
                          className="px-4 py-2 rounded-xl text-xs font-medium flex items-center gap-1.5"
                          style={{ background: model.trim() ? "#3884ff" : "#252530", color: model.trim() ? "#fff" : "#505058" }}>
                          {modelStatus === "saving" ? <LoaderIcon size={11} className="animate-spin" /> : modelStatus === "saved" ? <CheckIcon size={11} /> : null}
                          {modelStatus === "saved" ? (locale === "ko" ? "저장됨" : "Saved") : (locale === "ko" ? "적용" : "Apply")}
                        </button>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
