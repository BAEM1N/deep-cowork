import { motion, AnimatePresence } from "framer-motion";
import { CheckIcon, CircleIcon, LoaderIcon, XCircleIcon, ListTodoIcon } from "lucide-react";
import type { Task, TaskStatus } from "../store";

function statusIcon(status: TaskStatus) {
  switch (status) {
    case "completed": return <CheckIcon size={12} style={{ color: "#34c759" }} />;
    case "in_progress": return <LoaderIcon size={12} className="animate-spin" style={{ color: "#3884ff" }} />;
    case "failed": return <XCircleIcon size={12} style={{ color: "#ff4d4d" }} />;
    default: return <CircleIcon size={12} style={{ color: "#505058" }} />;
  }
}

function statusColor(status: TaskStatus): string {
  switch (status) {
    case "completed": return "#34c759";
    case "in_progress": return "#3884ff";
    case "failed": return "#ff4d4d";
    default: return "#606068";
  }
}

export function TodoCard({ tasks }: { tasks: Task[] }) {
  if (tasks.length === 0) return null;
  const completed = tasks.filter((t) => t.status === "completed").length;
  const progress = tasks.length > 0 ? completed / tasks.length : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl overflow-hidden"
      style={{ background: "#151518", border: "1px solid #2a2a30" }}
    >
      <div className="flex items-center justify-between px-3.5 py-2.5" style={{ borderBottom: "1px solid #222228" }}>
        <div className="flex items-center gap-2">
          <ListTodoIcon size={13} style={{ color: "#3884ff" }} />
          <span className="text-xs font-semibold" style={{ color: "#b0b4bc" }}>Agent Tasks</span>
        </div>
        <span className="text-[10px] font-mono tabular-nums" style={{ color: "#808590" }}>{completed}/{tasks.length}</span>
      </div>
      <div className="h-0.5" style={{ background: "#222228" }}>
        <motion.div
          className="h-full"
          style={{ background: "#3884ff", originX: 0 }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: progress }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>
      <div className="px-3.5 py-2 space-y-1">
        <AnimatePresence initial={false}>
          {tasks.map((task) => (
            <motion.div key={task.id} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="flex items-center gap-2.5 py-1">
              <span className="shrink-0">{statusIcon(task.status)}</span>
              <span className="text-xs flex-1 truncate" style={{ color: statusColor(task.status), textDecoration: task.status === "completed" ? "line-through" : "none", opacity: task.status === "completed" ? 0.6 : 1 }}>
                {task.label}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
