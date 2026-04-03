import { motion } from "framer-motion";
import { SearchIcon, CodeIcon, UsersIcon, NetworkIcon } from "lucide-react";
import { useStore, type Mode } from "../store";
import { t } from "../lib/i18n";

const MODE_KEYS = {
  clarify: { label: "modeClarify", desc: "modeClarifyDesc", icon: <SearchIcon size={13} />, activeColor: "#ffb340" },
  code: { label: "modeCode", desc: "modeCodeDesc", icon: <CodeIcon size={13} />, activeColor: "#a78bfa" },
  cowork: { label: "modeCowork", desc: "modeCoworkDesc", icon: <UsersIcon size={13} />, activeColor: "#3884ff" },
  acp: { label: "modeAcp", desc: "modeAcpDesc", icon: <NetworkIcon size={13} />, activeColor: "#f472b6" },
} as const;

const MODE_IDS: Mode[] = ["clarify", "code", "cowork", "acp"];

export function ModeSwitch() {
  const { mode, setMode, locale } = useStore();

  return (
    <div
      className="flex items-center gap-0.5 rounded-full p-1"
      style={{ background: "var(--muted)" }}
    >
      {MODE_IDS.map((id) => {
        const m = MODE_KEYS[id];
        const active = mode === id;
        return (
          <button
            key={id}
            onClick={() => setMode(id)}
            title={t(m.desc as any, locale)}
            className="relative flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors z-10"
            style={{ color: active ? m.activeColor : "var(--muted-foreground)" }}
          >
            {active && (
              <motion.div
                layoutId="mode-bg"
                className="absolute inset-0 rounded-full"
                style={{ background: "var(--surface-elevated)", boxShadow: `0 0 12px ${m.activeColor}15` }}
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              {m.icon}
              {t(m.label as any, locale)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
