"""
MX Cowork — AppState class, agent builder, and rebuild logic.
"""
from __future__ import annotations

import asyncio
from datetime import datetime
from pathlib import Path
from typing import Any

import aiosqlite

import config
from tools import make_tools
from hitl import abort_signals
from agent_core import build_agent, AsyncSqliteSaver


class AppState:
    db_conn: aiosqlite.Connection | None = None
    checkpointer: AsyncSqliteSaver | None = None
    _agents: dict[str, Any] = {}
    threads_meta: dict[str, dict] = {}

    async def setup(self) -> None:
        config.WORKSPACE_ROOT.mkdir(parents=True, exist_ok=True)
        self.db_conn = await aiosqlite.connect(str(config.DB_PATH))
        # Enable WAL mode for better concurrent read/write performance
        await self.db_conn.execute("PRAGMA journal_mode=WAL")
        await self.db_conn.execute("PRAGMA synchronous=NORMAL")
        self.checkpointer = AsyncSqliteSaver(self.db_conn)
        await self.checkpointer.setup()
        await self.db_conn.execute("""
            CREATE TABLE IF NOT EXISTS thread_meta (
                thread_id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                mode TEXT NOT NULL DEFAULT 'cowork',
                workspace_path TEXT,
                created_at TEXT NOT NULL
            )
        """)
        await self.db_conn.commit()
        await self._load_thread_meta()
        config.logger.info(f"DB: {config.DB_PATH}")

    async def teardown(self) -> None:
        if self.db_conn:
            await self.db_conn.close()

    async def _load_thread_meta(self) -> None:
        try:
            async with self.db_conn.execute(
                "SELECT thread_id, title, mode, workspace_path, created_at FROM thread_meta"
            ) as cur:
                rows = await cur.fetchall()
                for (tid, title, mode, ws_path, created_at) in rows:
                    self.threads_meta[tid] = {
                        "title": title,
                        "mode": mode,
                        "workspace_path": ws_path,
                        "created_at": created_at,
                    }
            async with self.db_conn.execute(
                "SELECT DISTINCT thread_id FROM checkpoints"
            ) as cur:
                rows = await cur.fetchall()
                for (tid,) in rows:
                    if tid not in self.threads_meta:
                        self.threads_meta[tid] = {
                            "title": f"Thread {tid[:8]}",
                            "created_at": datetime.now().isoformat(),
                            "mode": "cowork",
                            "workspace_path": None,
                        }
        except Exception:
            config.logger.warning("스레드 메타 로드 실패", exc_info=True)

    async def _persist_thread_meta(self, thread_id: str) -> None:
        meta = self.threads_meta.get(thread_id)
        if not meta or not self.db_conn:
            return
        try:
            await self.db_conn.execute(
                """INSERT INTO thread_meta (thread_id, title, mode, workspace_path, created_at)
                   VALUES (?, ?, ?, ?, ?)
                   ON CONFLICT(thread_id) DO UPDATE SET
                       title = excluded.title,
                       mode = excluded.mode,
                       workspace_path = excluded.workspace_path""",
                (
                    thread_id,
                    meta.get("title", "New conversation"),
                    meta.get("mode", "cowork"),
                    meta.get("workspace_path"),
                    meta.get("created_at", datetime.now().isoformat()),
                ),
            )
            await self.db_conn.commit()
        except Exception:
            config.logger.warning("thread_meta 저장 실패 (thread_id=%s)", thread_id, exc_info=True)

    async def _delete_thread_meta(self, thread_id: str) -> None:
        if not self.db_conn:
            return
        try:
            await self.db_conn.execute("DELETE FROM thread_meta WHERE thread_id = ?", (thread_id,))
            await self.db_conn.commit()
        except Exception:
            config.logger.warning("thread_meta 삭제 실패 (thread_id=%s)", thread_id, exc_info=True)

    def get_or_create(
        self,
        thread_id: str,
        mode: str = "cowork",
        workspace_path: str | None = None,
    ) -> Any:
        cached = self._agents.get(thread_id)
        meta = self.threads_meta.get(thread_id, {})
        cached_mode = meta.get("mode")
        cached_ws = meta.get("workspace_path")

        if cached is None or cached_mode != mode or cached_ws != workspace_path:
            if workspace_path:
                ws = Path(workspace_path).resolve()
                home = Path.home()
                try:
                    ws.relative_to(home)
                except ValueError:
                    config.logger.warning("workspace_path가 홈 디렉토리 밖: %s — 기본 경로 사용", workspace_path)
                    ws = config.WORKSPACE_ROOT / thread_id
                ws.mkdir(parents=True, exist_ok=True)
            else:
                ws = config.WORKSPACE_ROOT / thread_id
                ws.mkdir(parents=True, exist_ok=True)

            self._agents[thread_id] = create_agent(ws, self.checkpointer, mode, thread_id)
            resolved_ws_str = str(ws)
            is_new = thread_id not in self.threads_meta
            if is_new:
                self.threads_meta[thread_id] = {
                    "title": "New conversation",
                    "created_at": datetime.now().isoformat(),
                    "mode": mode,
                    "workspace_path": resolved_ws_str,
                }
            else:
                self.threads_meta[thread_id]["mode"] = mode
                self.threads_meta[thread_id]["workspace_path"] = resolved_ws_str
            asyncio.create_task(self._persist_thread_meta(thread_id))

        return self._agents[thread_id]

    def update_title(self, thread_id: str, title: str) -> None:
        if thread_id in self.threads_meta:
            self.threads_meta[thread_id]["title"] = title
            asyncio.create_task(self._persist_thread_meta(thread_id))

    def remove(self, thread_id: str) -> None:
        self._agents.pop(thread_id, None)
        self.threads_meta.pop(thread_id, None)
        asyncio.create_task(self._delete_thread_meta(thread_id))


state = AppState()


def create_agent(
    workspace_dir: Path,
    checkpointer: Any,
    mode: str = "cowork",
    thread_id: str | None = None,
    with_hitl: bool = True,
) -> Any:
    """Thin wrapper — delegates to agent_core.build_agent with tools."""
    tools = make_tools(workspace_dir, thread_id)
    return build_agent(
        workspace_dir=workspace_dir,
        checkpointer=checkpointer,
        mode=mode,
        thread_id=thread_id,
        with_hitl=with_hitl,
        tools=tools,
    )


# ── Agent rebuild lock (serializes concurrent rebuilds on settings change) ──
_agent_rebuild_lock = asyncio.Lock()


async def rebuild_all_agents_safe():
    """Rebuild all agents after settings change — serializes concurrent calls."""
    async with _agent_rebuild_lock:
        for tid in list(state._agents.keys()):
            meta = state.threads_meta.get(tid, {})
            ws_path = meta.get("workspace_path")
            mode = meta.get("mode", "cowork")
            ws = Path(ws_path) if ws_path else config.WORKSPACE_ROOT / tid
            try:
                state._agents[tid] = create_agent(ws, state.checkpointer, mode, tid)
                abort_signals.pop(tid, None)
            except Exception:
                config.logger.warning("에이전트 재빌드 실패: %s", tid, exc_info=True)
                state._agents.pop(tid, None)
