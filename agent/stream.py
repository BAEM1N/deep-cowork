"""
DeepCoWork — SSE streaming, agent event loop, and mock stream.

Deep Agents SDK interrupt_on 패턴:
- interrupt_on={"write_file": True, "edit_file": True, "execute": True}
- 에이전트가 해당 도구 호출 시 자동 중단
- graph_state.tasks[].interrupts에서 pending action_requests 확인
- Command(resume={"decisions": [...]})로 재개
"""
from __future__ import annotations

import asyncio
import json
import uuid
from pathlib import Path
from typing import Any

import config
from hitl import (
    pending_approvals,
    approval_results,
    thread_approval_ids,
    thread_output_queues,
    thread_subagents,
    abort_signals,
    cleanup_thread,
)


# ── SSE helpers ──────────────────────────────────────────
def sse(payload: dict) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


def sse_done() -> str:
    return "data: [DONE]\n\n"


def derive_title(message: str) -> str:
    text = message.strip()
    for sep in [".", "?", "!", "\n"]:
        if sep in text:
            text = text.split(sep)[0]
    return text[:48] + ("…" if len(text) > 48 else "")


def map_status(raw: str) -> str:
    mapping = {
        "in_progress": "in_progress", "running": "in_progress",
        "completed": "completed", "done": "completed", "skipped": "completed",
        "failed": "failed", "error": "failed", "cancelled": "failed",
    }
    return mapping.get(raw, "pending")


# ── Stream events from agent ─────────────────────────────
async def stream_events(agent: Any, agent_input: Any, cfg: dict, active_subagents: dict):
    from agent_core import stream_events as _core_stream
    async for chunk in _core_stream(agent, agent_input, cfg, active_subagents):
        yield chunk


# ── Agent pump ───────────────────────────────────────────
async def _pump_agent(
    message: str,
    thread_id: str,
    mode: str,
    workspace_path: str | None,
    out: asyncio.Queue,
) -> None:
    """Deep Agents interrupt_on HITL loop."""
    from state import state

    agent = state.get_or_create(thread_id, mode, workspace_path)
    cfg = {"configurable": {"thread_id": thread_id}}
    active_subagents: dict[str, dict] = {}

    meta = state.threads_meta.get(thread_id, {})
    resolved_ws = meta.get("workspace_path")
    if resolved_ws:
        await out.put(sse({"type": "workspace_path", "thread_id": thread_id, "path": resolved_ws}))

    if meta.get("title") in ("New conversation", f"Thread {thread_id[:8]}"):
        title = derive_title(message)
        state.update_title(thread_id, title)
        await out.put(sse({"type": "title", "thread_id": thread_id, "title": title}))

    try:
        agent_input: Any = {"messages": [{"role": "user", "content": message}]}

        for _iter in range(config.MAX_AGENT_ITERATIONS):
            if abort_signals.pop(thread_id, False):
                break

            async for chunk in stream_events(agent, agent_input, cfg, active_subagents):
                await out.put(chunk)
                if abort_signals.get(thread_id):
                    break

            if abort_signals.pop(thread_id, False):
                break

            # Check for Deep Agents interrupt_on
            from agent_core import get_agent_state
            graph_state = await get_agent_state(agent, cfg)
            pending: list = []
            for task in (graph_state.tasks or []):
                for interrupt in (getattr(task, "interrupts", None) or []):
                    pending.append(interrupt)

            if not pending:
                break

            # Process each interrupt
            decisions = []
            for interrupt in pending:
                value = getattr(interrupt, "value", interrupt) or {}
                action_requests = value.get("action_requests", []) if isinstance(value, dict) else []

                if not action_requests:
                    config.logger.debug("action_requests 없는 interrupt, 자동 거부")
                    decisions.append({"type": "reject", "message": "알 수 없는 interrupt"})
                    continue

                for action_req in action_requests:
                    tool_name = action_req.get("name", action_req.get("type", action_req.get("tool_name", "")))

                    if tool_name in config.READ_ONLY_TOOLS:
                        decisions.append({"type": "approve"})
                        continue

                    # HITL: request frontend approval
                    approved = await _request_approval(tool_name, action_req.get("args", {}), thread_id, out)
                    decisions.append({"type": "approve" if approved else "reject"})

            from agent_core import resume_agent_input
            agent_input = resume_agent_input(decisions)
            await out.put(sse({"type": "files_changed", "thread_id": thread_id}))
        else:
            await out.put(sse({"type": "error", "message": f"에이전트가 최대 반복 횟수({config.MAX_AGENT_ITERATIONS}회)를 초과했습니다."}))

    except Exception as exc:
        config.logger.exception("에이전트 스트리밍 오류")
        await out.put(sse({"type": "error", "message": str(exc)}))

    cleanup_thread(thread_id)
    await out.put(sse_done())
    await out.put(None)


async def _request_approval(
    tool_name: str,
    tool_args: dict,
    thread_id: str,
    out: asyncio.Queue,
) -> bool:
    """Send approval request to frontend and wait for response."""
    approval_id = str(uuid.uuid4())
    evt = asyncio.Event()
    pending_approvals[approval_id] = evt
    thread_approval_ids.setdefault(thread_id, set()).add(approval_id)

    await out.put(sse({
        "type": "approval",
        "approval_id": approval_id,
        "tool_name": tool_name,
        "args": tool_args,
        "source": "main",
    }))

    try:
        await asyncio.wait_for(evt.wait(), timeout=config.APPROVAL_TIMEOUT_SEC)
    except asyncio.TimeoutError:
        approval_results[approval_id] = False
    finally:
        pending_approvals.pop(approval_id, None)
        thread_approval_ids.get(thread_id, set()).discard(approval_id)

    return approval_results.pop(approval_id, False)


async def run_agent_stream(
    message: str,
    thread_id: str,
    mode: str,
    workspace_path: str | None = None,
):
    """Deep Agents SSE stream — asyncio.Queue based."""
    out: asyncio.Queue[str | None] = asyncio.Queue()
    thread_output_queues[thread_id] = out

    async def pump():
        try:
            await _pump_agent(message, thread_id, mode, workspace_path, out)
        except Exception as exc:
            config.logger.exception("pump error")
            await out.put(sse({"type": "error", "message": str(exc)}))
            await out.put(sse_done())
            await out.put(None)
        finally:
            thread_output_queues.pop(thread_id, None)

    asyncio.create_task(pump())

    while True:
        chunk = await out.get()
        if chunk is None:
            break
        yield chunk


# ── Mock stream ──────────────────────────────────────────
async def run_mock_stream(message: str, thread_id: str, mode: str, workspace_path: str | None = None):
    import random

    title = message[:40] + ("…" if len(message) > 40 else "")
    yield sse({"type": "title", "thread_id": thread_id, "title": title})
    await asyncio.sleep(0.1)

    response = f"""> **[MOCK 모드]** API 키가 설정되지 않아 실제 에이전트가 동작하지 않습니다.

# [{mode.upper()} 모드] 작업 분석

요청: **"{message[:60]}"**

> **MOCK 모드**: Settings에서 API 키를 설정하세요."""

    for char in response:
        yield sse({"type": "token", "content": char, "source": "main"})
        await asyncio.sleep(random.uniform(0.004, 0.012))

    ws = Path(workspace_path) if workspace_path else config.WORKSPACE_ROOT / thread_id
    ws.mkdir(parents=True, exist_ok=True)
    yield sse({"type": "files_changed", "thread_id": thread_id})
    yield sse_done()
