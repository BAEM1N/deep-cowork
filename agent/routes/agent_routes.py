"""
MX Cowork — Agent streaming, approval, abort, and thread management endpoints.
"""
from __future__ import annotations

import asyncio
import json
import os
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

import config
from hitl import (
    pending_approvals,
    approval_results,
    thread_approval_ids,
    thread_output_queues,
    abort_signals,
    thread_subagents,
)
from state import state
from stream import sse, run_agent_stream, run_mock_stream
from routes.settings import _active_key

router = APIRouter()


# ── Pydantic models ──────────────────────────────────────
class ChatRequest(BaseModel):
    message: str
    thread_id: str = "default"
    mode: str = "cowork"
    workspace_path: str | None = None

    def validated_mode(self) -> str:
        return self.mode if self.mode in config.VALID_MODES else "cowork"


class ApprovalRequest(BaseModel):
    approval_id: str
    approved: bool


# ── Endpoints ────────────────────────────────────────────
@router.post("/agent/stream")
async def stream_agent(req: ChatRequest):
    has_key = bool(_active_key())
    use_mock = not has_key or os.getenv("MOCK_MODE", "").lower() in ("1", "true")

    if use_mock:
        if req.thread_id not in state.threads_meta:
            state.threads_meta[req.thread_id] = {
                "title": "New conversation",
                "created_at": datetime.now().isoformat(),
                "mode": req.mode,
            }
        gen = run_mock_stream(req.message, req.thread_id, req.validated_mode(), req.workspace_path)
    else:
        mode = req.validated_mode()
        state.get_or_create(req.thread_id, mode, req.workspace_path)
        gen = run_agent_stream(req.message, req.thread_id, mode, req.workspace_path)

    return StreamingResponse(
        gen,
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )


@router.post("/agent/approve")
async def approve_action(req: ApprovalRequest):
    evt = pending_approvals.get(req.approval_id)
    if not evt:
        raise HTTPException(404, "승인 요청 없음")
    approval_results[req.approval_id] = req.approved
    evt.set()
    return {"ok": True, "approved": req.approved}


@router.post("/agent/abort/{thread_id}")
async def abort_thread(thread_id: str):
    """진행 중인 에이전트 실행 중단 (해당 스레드 소속 승인만 거부)"""
    abort_signals[thread_id] = True
    for approval_id in list(thread_approval_ids.pop(thread_id, set())):
        evt = pending_approvals.get(approval_id)
        if evt:
            approval_results[approval_id] = False
            evt.set()
    subagents = thread_subagents.pop(thread_id, {})
    if subagents and (out_queue := thread_output_queues.get(thread_id)):
        for sa in subagents.values():
            if sa["status"] == "running":
                sa["status"] = "cancelled"
        asyncio.create_task(out_queue.put(sse({"type": "agents", "agents": list(subagents.values())})))
    return {"ok": True, "thread_id": thread_id}


@router.get("/agent/threads")
async def list_threads():
    threads = [{"thread_id": tid, **meta} for tid, meta in state.threads_meta.items()]
    threads.sort(key=lambda t: t.get("created_at", ""), reverse=True)
    return {"threads": threads}


@router.delete("/agent/threads/{thread_id}")
async def reset_thread(thread_id: str):
    abort_signals[thread_id] = True
    out_queue = thread_output_queues.get(thread_id)
    if out_queue:
        await out_queue.put(None)
    await asyncio.sleep(0.05)

    state.remove(thread_id)
    if state.db_conn:
        for table in config.CHECKPOINT_TABLES:
            try:
                await state.db_conn.execute(
                    f"DELETE FROM {table} WHERE thread_id = ?", (thread_id,)  # noqa: S608
                )
            except Exception:
                pass
        try:
            await state.db_conn.commit()
        except Exception:
            config.logger.warning("스레드 DB 삭제 커밋 실패: %s", thread_id, exc_info=True)
    ws = config.WORKSPACE_ROOT / thread_id
    if ws.exists():
        import shutil
        try:
            shutil.rmtree(ws)
        except Exception:
            config.logger.warning("스레드 워크스페이스 삭제 실패: %s", ws, exc_info=True)
    return {"ok": True}


@router.get("/agent/threads/{thread_id}/messages")
async def get_thread_messages(thread_id: str):
    if not state.checkpointer:
        return {"messages": []}
    cfg = {"configurable": {"thread_id": thread_id}}
    try:
        ckpt_tuple = await state.checkpointer.aget_tuple(cfg)
    except Exception:
        return {"messages": []}
    if not ckpt_tuple:
        return {"messages": []}
    channel_values = ckpt_tuple.checkpoint.get("channel_values", {})
    raw_messages = channel_values.get("messages", [])
    out = []
    for msg in raw_messages:
        if hasattr(msg, "type"):
            role = "user" if msg.type in ("human",) else "assistant"
            content = msg.content if isinstance(msg.content, str) else json.dumps(msg.content, ensure_ascii=False)
            tool_calls = None
            if hasattr(msg, "tool_calls") and msg.tool_calls:
                tool_calls = [{"name": tc.get("name", ""), "id": tc.get("id", "")} for tc in msg.tool_calls]
            out.append({"role": role, "content": content, "tool_calls": tool_calls})
        elif isinstance(msg, dict):
            role = "user" if msg.get("type") == "human" else "assistant"
            content = msg.get("content", "")
            if isinstance(content, list):
                content = " ".join(c.get("text", "") for c in content if isinstance(c, dict))
            out.append({"role": role, "content": content})
    return {"messages": out}
