"""
MX Cowork — HITL (Human-in-the-Loop) approval global state.
"""
from __future__ import annotations

import asyncio
from typing import Any

# HITL approval storage
pending_approvals: dict[str, asyncio.Event] = {}
approval_results: dict[str, bool] = {}

# Per-thread approval ID tracking (for abort — reject only that thread's approvals)
thread_approval_ids: dict[str, set[str]] = {}

# Per-thread SSE output queue (interrupt_on approval response wait)
thread_output_queues: dict[str, asyncio.Queue] = {}

# Abort signals
abort_signals: dict[str, bool] = {}

# ACP: per-thread sub-agent state sharing (task() tool -> _stream_events)
thread_subagents: dict[str, dict[str, dict]] = {}


def cleanup_thread(thread_id: str) -> None:
    """Clean up all HITL state for a thread after stream ends."""
    thread_subagents.pop(thread_id, None)
    for aid in list(thread_approval_ids.pop(thread_id, set())):
        pending_approvals.pop(aid, None)
        approval_results.pop(aid, None)
