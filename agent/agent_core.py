"""
MX Cowork — Agent Core (Deep Agents SDK)
==========================================

★ 이 파일이 유일한 에이전트 SDK 결합 지점입니다. ★

Deep Agents SDK (langchain-ai/deepagents) 기반:
- create_deep_agent: LangGraph ReAct + LocalShellBackend + TodoListMiddleware
- interrupt_on: 도구 이름별 HITL (write_file, edit_file, execute)
- LocalShellBackend: 파일/셸 도구 자동 제공

참고: https://github.com/BAEM1N/langchain-langgraph-deepagents-notebooks

Export 계약:
1. build_llm()          — LLM 인스턴스
2. build_agent()        — DeepAgent 인스턴스
3. stream_events()      — SSE 스트리밍
4. get_agent_state()    — 에이전트 상태 조회
5. resume_agent_input() — HITL 재개 입력
6. tool                 — 도구 데코레이터
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from deepagents import create_deep_agent
from deepagents.backends import LocalShellBackend
from langchain_anthropic import ChatAnthropic
from langchain_core.tools import tool as langchain_tool
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver
from langgraph.types import Command

import config
from prompts import build_system_prompt


# ── 0. LLM Builder ───────────────────────────────────────

def build_llm() -> Any:
    """현재 설정 기반 LLM 인스턴스 생성."""
    provider = config.LLM_PROVIDER or os.getenv("LLM_PROVIDER", "anthropic")
    _VALID_PROVIDERS = {"anthropic", "openrouter", "ollama", "lmstudio", "vllm"}
    if provider not in _VALID_PROVIDERS:
        config.logger.warning("알 수 없는 LLM_PROVIDER '%s', anthropic으로 기본값 사용", provider)
        provider = "anthropic"

    if provider == "openrouter":
        key = config.OPENROUTER_API_KEY or os.getenv("OPENROUTER_API_KEY") or ""
        model = config.MODEL_NAME or "anthropic/claude-sonnet-4-5"
        return ChatOpenAI(
            model=model,
            api_key=key or "none",
            base_url=config.OPENROUTER_BASE_URL,
            temperature=0.0,
            max_tokens=8192,
            default_headers={
                "HTTP-Referer": os.getenv("APP_URL", "https://cowork.local"),
                "X-Title": os.getenv("APP_NAME", "DeepCoWork"),
            },
        )
    elif provider in ("ollama", "lmstudio", "vllm"):
        model = config.MODEL_NAME or "llama3.1"
        _defaults = {
            "ollama": "http://localhost:11434/v1",
            "lmstudio": "http://localhost:1234/v1",
            "vllm": "http://localhost:8000/v1",
        }
        base_url = config.OLLAMA_BASE_URL or os.getenv("OLLAMA_BASE_URL", _defaults.get(provider, _defaults["ollama"]))
        return ChatOpenAI(
            model=model,
            api_key="local",
            base_url=base_url,
            temperature=0.0,
            max_tokens=8192,
        )
    else:
        key = config.ANTHROPIC_API_KEY or os.getenv("ANTHROPIC_API_KEY") or ""
        kwargs: dict = {
            "model": config.MODEL_NAME or "claude-sonnet-4-6",
            "temperature": 0.0,
            "max_tokens": 8192,
        }
        if key:
            kwargs["api_key"] = key
        return ChatAnthropic(**kwargs)


# ── 1. Agent Builder ──────────────────────────────────────

def build_agent(
    workspace_dir: Path,
    checkpointer: Any,
    mode: str = "cowork",
    thread_id: str | None = None,
    with_hitl: bool = True,
    tools: list | None = None,
    system_prompt: str | None = None,
) -> Any:
    """Deep Agents SDK로 에이전트를 생성합니다.

    LocalShellBackend이 다음 도구를 자동 제공:
    - read_file, write_file, edit_file, execute
    - ls, glob, grep
    - write_todos (TodoListMiddleware)

    Parameters
    ----------
    workspace_dir : 에이전트 작업 디렉토리
    checkpointer : AsyncSqliteSaver
    mode : "clarify" | "code" | "cowork" | "acp"
    with_hitl : True면 write/edit/execute 전 사용자 승인
    tools : 추가 LangChain tool 목록 (web_search, memory 등)
    system_prompt : 시스템 프롬프트 (None이면 mode 기반 자동 생성)
    """
    llm = build_llm()

    backend = LocalShellBackend(
        root_dir=str(workspace_dir),
        virtual_mode=False,
        timeout=60,
        max_output_bytes=50_000,
        inherit_env=True,
    )

    if system_prompt is None:
        system_prompt = build_system_prompt(mode, workspace_dir)

    interrupt_on: dict = (
        {"write_file": True, "edit_file": True, "execute": True}
        if with_hitl else {}
    )

    # Skills: folder-based SKILL.md loading (progressive disclosure)
    skills_sources = _resolve_skills(workspace_dir)

    return create_deep_agent(
        model=llm,
        tools=tools or [],
        backend=backend,
        interrupt_on=interrupt_on,
        checkpointer=checkpointer,
        system_prompt=system_prompt,
        skills=skills_sources if skills_sources else None,
    )


def _resolve_skills(workspace_dir: Path) -> list[str]:
    """Resolve skill sources from global + workspace-local skill dirs.

    Skill priority (later overrides earlier):
    1. Global skills: ~/.cowork/skills/
    2. Workspace skills: {workspace}/skills/
    """
    sources: list[str] = []
    global_skills = config.WORKSPACE_ROOT / "skills"
    if global_skills.is_dir():
        sources.append("skills/")
    ws_skills = workspace_dir / "skills"
    if ws_skills.is_dir():
        sources.append("skills/")
    return sources


# ── 2. Stream Events ─────────────────────────────────────

async def stream_events(
    agent: Any,
    agent_input: Any,
    cfg: dict,
    active_subagents: dict,
):
    """에이전트 실행을 스트리밍하고, SSE dict로 변환합니다.

    Yields: "data: {JSON}\\n\\n" 형식의 SSE 문자열
    """
    import json
    from stream import sse, map_status

    thread_id = cfg["configurable"]["thread_id"]

    async for event in agent.astream(
        agent_input,
        stream_mode=["updates", "messages"],
        subgraphs=True,
        config=cfg,
    ):
        if len(event) == 3:
            namespace, evmode, data = event
        else:
            namespace, evmode, data = (), event[0], event[1]

        source = "main" if not namespace else str(namespace[-1])

        if evmode == "messages":
            msg, meta_ev = data
            node = meta_ev.get("langgraph_node", "")
            if (
                hasattr(msg, "content")
                and msg.content
                and node in ("model", "agent", "call_model")
                and not getattr(msg, "tool_calls", None)
            ):
                yield sse({"type": "token", "content": msg.content, "source": source})

        elif evmode == "updates":
            if not data:
                continue
            for node_name, node_data in (data or {}).items():
                if not node_data or not isinstance(node_data, dict):
                    continue
                msgs = node_data.get("messages", [])
                if hasattr(msgs, "value"):
                    msgs = msgs.value

                for msg in (msgs if isinstance(msgs, list) else []):
                    if hasattr(msg, "tool_calls") and msg.tool_calls:
                        for tc in msg.tool_calls:
                            tname = tc.get("name", "")
                            targs = tc.get("args", {})
                            tc_id = tc.get("id", "")

                            if tname == "write_todos":
                                todos = targs.get("todos", [])
                                yield sse({"type": "tasks", "tasks": [
                                    {
                                        "id": t.get("id", str(i)),
                                        "label": t.get("content", t.get("todo", t.get("title", str(t)))),
                                        "status": map_status(t.get("status", "pending")),
                                    }
                                    for i, t in enumerate(todos)
                                ]})
                            else:
                                yield sse({
                                    "type": "tool_call",
                                    "name": tname,
                                    "args": str(targs)[:200],
                                    "source": source,
                                    "tool_call_id": tc_id,
                                })

                    elif hasattr(msg, "tool_call_id") and hasattr(msg, "content"):
                        content_str = (
                            msg.content if isinstance(msg.content, str)
                            else json.dumps(msg.content, ensure_ascii=False)
                        )
                        tname_result = getattr(msg, "name", "") or ""
                        _TRUNC = 2000
                        truncated_content = content_str[:_TRUNC]
                        if len(content_str) > _TRUNC:
                            truncated_content += f"\n…({len(content_str) - _TRUNC}자 생략)"
                        yield sse({
                            "type": "tool_result",
                            "content": truncated_content,
                            "tool_name": tname_result,
                            "source": source,
                        })
                        if tname_result in config.FILE_WRITE_TOOLS:
                            yield sse({"type": "files_changed", "thread_id": thread_id})

                if node_name.startswith("tools") and namespace:
                    for aid in list(active_subagents):
                        if active_subagents[aid]["status"] == "running":
                            active_subagents[aid]["status"] = "done"
                    yield sse({"type": "agents", "agents": list(active_subagents.values())})


# ── 3. Agent State ────────────────────────────────────────

async def get_agent_state(agent: Any, cfg: dict):
    """에이전트의 현재 상태를 조회합니다."""
    return await agent.aget_state(cfg)


# ── 4. Resume Input ───────────────────────────────────────

def resume_agent_input(decisions: list[dict]) -> Any:
    """HITL 승인 결과를 에이전트 재개 입력으로 변환합니다."""
    return Command(resume={"decisions": decisions})


# ── 5. Tool decorator (re-export) ─────────────────────────

tool = langchain_tool
