import { motion, AnimatePresence } from "framer-motion";
import { ShieldAlertIcon, CheckIcon, XIcon, FileEditIcon, TerminalIcon } from "lucide-react";

interface PendingApproval {
  approvalId: string;
  toolName: string;
  args: Record<string, unknown>;
  source: string;
}

interface Props {
  approval: PendingApproval | null;
  queueSize?: number;
  onApprove: (id: string, approved: boolean) => void;
}

function toolIcon(name: string) {
  if (name === "write_file" || name === "edit_file")
    return <FileEditIcon size={16} style={{ color: "#ffb340" }} />;
  return <TerminalIcon size={16} style={{ color: "#ff6b6b" }} />;
}

function formatArgs(toolName: string, args: Record<string, unknown>): string {
  if (toolName === "write_file") {
    const lines = [`📄 ${args.path}`, ""];
    if (args.content_preview) lines.push(String(args.content_preview));
    return lines.join("\n");
  }
  if (toolName === "edit_file") return [`📄 ${args.path}`, "", `— OLD: ${args.old_text}`, `+ NEW: ${args.new_text}`].join("\n");
  if (toolName === "execute") return `$ ${args.command ?? args.cmd ?? JSON.stringify(args)}`;
  const path = args.path || args.file_path || args.filename;
  if (path) return `${path}`;
  return JSON.stringify(args, null, 2).slice(0, 400);
}

export function ApprovalModal({ approval, queueSize = 0, onApprove }: Props) {
  if (!approval) return null;
  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-end justify-center pb-24"
        style={{ background: "rgba(0,0,0,0.6)" }}>
        <motion.div
          initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
          transition={{ type: "spring", stiffness: 340, damping: 28 }}
          className="w-full max-w-lg mx-6 rounded-2xl overflow-hidden"
          style={{ background: "#1e1e22", border: "1px solid #2a2a30", boxShadow: "0 8px 40px rgba(0,0,0,0.5)" }}>
          <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: "1px solid #2a2a30" }}>
            <ShieldAlertIcon size={18} style={{ color: "#ffb340" }} />
            <div className="flex-1">
              <p className="text-sm font-semibold" style={{ color: "#ecedf0" }}>승인 필요</p>
              <p className="text-xs mt-0.5" style={{ color: "#808590" }}>에이전트가 파일 시스템 작업을 요청합니다</p>
            </div>
            {queueSize > 1 && <span className="text-[11px] px-2 py-0.5 rounded-full font-mono shrink-0" style={{ background: "rgba(255,179,64,0.15)", color: "#ffb340" }}>{queueSize}개 대기 중</span>}
          </div>
          <div className="px-5 py-4 space-y-3">
            <div className="flex items-center gap-2">
              {toolIcon(approval.toolName)}
              <span className="text-xs font-mono font-semibold" style={{ color: "#ffb340" }}>{approval.toolName}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-md font-mono" style={{ background: "#252530", color: "#606068" }}>{approval.source}</span>
            </div>
            <div className="p-3 rounded-xl font-mono text-xs" style={{ background: "#151518", color: "#a0a4ac", border: "1px solid #2a2a30" }}>
              {formatArgs(approval.toolName, approval.args)}
            </div>
          </div>
          <div className="flex items-center gap-2 px-5 py-4" style={{ borderTop: "1px solid #2a2a30" }}>
            <button onClick={() => onApprove(approval.approvalId, true)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-colors"
              style={{ background: "rgba(52,199,89,0.15)", border: "1px solid rgba(52,199,89,0.35)", color: "#34c759" }}>
              <CheckIcon size={14} /> 승인
            </button>
            <button onClick={() => onApprove(approval.approvalId, false)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-colors"
              style={{ background: "rgba(255,77,77,0.15)", border: "1px solid rgba(255,77,77,0.35)", color: "#ff6b6b" }}>
              <XIcon size={14} /> 거부
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export type { PendingApproval };
