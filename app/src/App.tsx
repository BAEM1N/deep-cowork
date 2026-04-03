import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircleIcon, LoaderIcon, KeyIcon } from "lucide-react";
import { listen } from "@tauri-apps/api/event";
import { useStore } from "./store";
import { t } from "./lib/i18n";
import { SHOW_API_KEY } from "./lib/deploy";
import { ThreadList } from "./components/ThreadList";
import { ChatArea } from "./components/ChatArea";
import { AgentPanel } from "./components/AgentPanel";
import { getHealth } from "./lib/api";
import { setPort } from "./lib/api";

function ServerBoot() {
  const { serverError } = useStore();
  return (
    <div
      className="flex flex-col items-center justify-center w-full h-full gap-4"
      style={{ background: "var(--background)" }}
    >
      {serverError ? (
        <>
          <AlertCircleIcon size={28} style={{ color: "#ff4d4d" }} />
          <div className="text-center">
            <p className="text-sm font-medium" style={{ color: "#b0b4bc" }}>
              서버 시작 실패
            </p>
            <p className="text-xs mt-1 font-mono max-w-xs" style={{ color: "#808590" }}>
              {serverError}
            </p>
            <p className="text-[10px] mt-2 font-mono" style={{ color: "#555" }}>
              앱을 재시작하거나 터미널에서 서버를 확인하세요.
            </p>
          </div>
        </>
      ) : (
        <>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
          >
            <LoaderIcon size={22} style={{ color: "#3884ff" }} />
          </motion.div>
          <p className="text-sm" style={{ color: "#808590" }}>
            에이전트 서버 시작 중…
          </p>
        </>
      )}
    </div>
  );
}

function ApiKeyBanner() {
  const locale = useStore((s) => s.locale);
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 px-5 py-3 shrink-0"
      style={{
        background: "rgba(56, 132, 255, 0.08)",
        borderBottom: "1px solid rgba(56, 132, 255, 0.2)",
      }}
    >
      <KeyIcon size={13} style={{ color: "#3884ff" }} />
      <p className="text-xs" style={{ color: "#b0b4bc" }}>
        <strong style={{ color: "#5a9eff" }}>{t("apiKeyMissing", locale)}</strong> — {t("apiKeyBannerMsg", locale)}
      </p>
    </motion.div>
  );
}

function AppShell() {
  const { apiKeyMissing, filesChanged } = useStore();
  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden" style={{ background: "var(--background)" }}>
      {/* Tauri titlebar drag region */}
      <div
        data-tauri-drag-region
        className="shrink-0 h-8 w-full select-none"
        style={{ background: "var(--background)" }}
      />
      {apiKeyMissing && SHOW_API_KEY && <ApiKeyBanner />}
      <div className="flex flex-1 min-h-0">
        <ThreadList />
        <div className="panel-divider" />
        <ChatArea />
        <div className="panel-divider" />
        <AgentPanel filesChanged={filesChanged} />
      </div>
    </div>
  );
}

export default function App() {
  const { setServerReady, setServerError, setApiKeyMissing, setOsPlatform } = useStore();

  async function initFromHealth() {
    try {
      const h = await getHealth();
      setApiKeyMissing(!h.api_key_set);
      if (h.os_platform) setOsPlatform(h.os_platform);
    } catch {
      setApiKeyMissing(true);
    }
  }

  // Apply saved theme on mount
  useEffect(() => {
    const saved = useStore.getState().theme;
    if (saved === "light") document.documentElement.classList.add("light");
  }, []);

  useEffect(() => {
    const unlisten1 = listen<number>("server_ready", async (e) => {
      const port = e.payload;
      setPort(port);
      setServerReady(port);
      await initFromHealth();
    });

    const unlisten2 = listen<string>("server_error", (e) => {
      setServerError(e.payload);
    });

    const unlisten3 = listen<string>("agent_crashed", (e) => {
      setServerError(`에이전트 크래시: ${e.payload}`);
    });

    if (!("__TAURI_INTERNALS__" in window)) {
      setTimeout(async () => {
        setPort(8008);
        setServerReady(8008);
        await initFromHealth();
      }, 400);
    }

    return () => {
      unlisten1.then((f) => f());
      unlisten2.then((f) => f());
      unlisten3.then((f) => f());
    };
  }, [setServerReady, setServerError, setApiKeyMissing, setOsPlatform]);

  const { serverReady } = useStore();

  return (
    <AnimatePresence mode="wait">
      {serverReady ? (
        <motion.div key="app" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="w-screen h-screen">
          <AppShell />
        </motion.div>
      ) : (
        <motion.div key="boot" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="w-screen h-screen">
          <ServerBoot />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
