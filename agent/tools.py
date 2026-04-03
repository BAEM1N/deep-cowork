"""
MX Cowork — LangChain tool definitions.
"""
from __future__ import annotations

import json
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path

from agent_core import tool

import config
from prompts import read_memory_file


def is_safe_path(base: Path, target: Path) -> bool:
    """Path escape prevention. Based on Path.relative_to — safe for Windows case-insensitive FS."""
    try:
        target.resolve().relative_to(base.resolve())
        return True
    except ValueError:
        return False


def make_tools(workspace_dir: Path, thread_id: str | None = None) -> list:
    """Create per-workspace LangChain tools.

    The ``task`` tool requires runtime dependencies (SSE helpers, output queues,
    sub-agent state, stream_events, build_agent) which are imported lazily to
    break the circular import chain tools -> stream -> state -> tools.
    """

    @tool
    def web_search(query: str) -> str:
        """웹에서 정보를 검색합니다. 최신 정보, API 문서, 에러 해결법 등을 찾을 때 사용하세요."""
        import time as _time
        last_exc: Exception | None = None
        encoded = urllib.parse.quote_plus(query)
        url = f"https://api.duckduckgo.com/?q={encoded}&format=json&no_html=1&skip_disambig=1"
        req = urllib.request.Request(url, headers={"User-Agent": "MXCowork/1.0"})
        for attempt in range(2):
            try:
                with urllib.request.urlopen(req, timeout=10) as resp:
                    data = json.loads(resp.read().decode())
                break
            except Exception as exc:
                last_exc = exc
                if attempt == 0:
                    _time.sleep(1)
                    continue
                return f"[검색 오류]: {exc}"
        else:
            return f"[검색 오류]: {last_exc}"
        try:
            results = []
            abstract = (data.get("AbstractText") or "").strip()
            if abstract:
                results.append(f"**요약**: {abstract}")
                abstract_url = (data.get("AbstractURL") or "").strip()
                if abstract_url:
                    results.append(f"출처: {abstract_url}")
            topics = data.get("RelatedTopics", [])
            for topic in topics[:5]:
                if isinstance(topic, dict):
                    text = (topic.get("Text") or "").strip()
                    if text:
                        results.append(f"- {text}")
            total = len([t for t in topics if isinstance(t, dict)])
            if total > 5:
                results.append(f"  ... 외 {total - 5}개 관련 항목")
            return "\n".join(results) if results else f"'{query}'에 대한 즉각적인 결과가 없습니다. 더 구체적인 쿼리를 시도하세요."
        except Exception as e:
            return f"[검색 오류]: {e}"

    @tool
    def memory_write(content: str) -> str:
        """중요한 정보를 MEMORY.md에 기록합니다.
        세션 간 기억해야 할 사항: 사용자 결정사항, 프로젝트 컨텍스트, 주요 발견사항."""
        mem_file = workspace_dir / "MEMORY.md"
        try:
            existing = mem_file.read_text(encoding="utf-8") if mem_file.exists() else "# Session Memory\n"
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")
            new_entry = f"\n## [{timestamp}]\n{content.strip()}\n"
            mem_file.write_text(existing + new_entry, encoding="utf-8")
            return "MEMORY.md에 저장 완료."
        except Exception as e:
            return f"[오류]: {e}"

    @tool
    def memory_read(target: str = "all") -> str:
        """저장된 메모리를 읽습니다.
        target: 'soul' (에이전트 페르소나) | 'user' (사용자 선호) | 'memory' (세션 기억) | 'all' (전체)"""
        files = {
            "soul": config.WORKSPACE_ROOT / "SOUL.md",
            "user": config.WORKSPACE_ROOT / "USER.md",
            "memory": workspace_dir / "MEMORY.md",
        }
        results = []
        for key, path in files.items():
            if target not in ("all", key):
                continue
            content = read_memory_file(path)
            if content:
                results.append(f"### {key.upper()}.md\n{content}")
        return "\n\n".join(results) if results else "저장된 메모리가 없습니다."

    @tool
    async def task(description: str, instructions: str = "") -> str:
        """서브에이전트를 생성해 독립적인 서브태스크를 실행합니다.
        description: 작업 설명 (에이전트 이름으로 표시)
        instructions: 서브에이전트에게 줄 상세 지시사항 (생략 시 description 사용)
        여러 task()를 순차 또는 병렬로 호출해 작업을 위임하세요."""
        import uuid
        # Late imports to break circular dependency
        from stream import sse, stream_events
        from agent_core import build_agent
        from state import state as app_state
        from hitl import thread_output_queues, thread_subagents

        out_queue = thread_output_queues.get(thread_id) if thread_id else None
        prompt = instructions.strip() or description

        # Initialize global sub-agent state map
        if thread_id:
            if thread_id not in thread_subagents:
                thread_subagents[thread_id] = {}
            subagents = thread_subagents[thread_id]
        else:
            subagents = {}

        aid = uuid.uuid4().hex[:8]
        sub_thread_id = f"{thread_id or 'acp'}-sub-{aid}"

        subagents[aid] = {"id": aid, "name": description, "status": "running", "currentTask": prompt[:80]}
        if out_queue:
            await out_queue.put(sse({"type": "agents", "agents": list(subagents.values())}))

        try:
            # Sub-agents run without HITL (main agent already has approval)
            sub_agent = build_agent(workspace_dir, app_state.checkpointer, "code", sub_thread_id, with_hitl=False)
            sub_config = {"configurable": {"thread_id": sub_thread_id}}
            sub_active: dict[str, dict] = {}
            result_tokens: list[str] = []

            async for chunk in stream_events(
                sub_agent,
                {"messages": [{"role": "user", "content": prompt}]},
                sub_config,
                sub_active,
            ):
                if out_queue:
                    try:
                        data = json.loads(chunk.removeprefix("data: ").strip())
                        if data.get("type") == "token":
                            result_tokens.append(data.get("content", ""))
                        data["source"] = f"sub:{description[:24]}"
                        await out_queue.put(sse(data))
                    except Exception:
                        pass

            subagents[aid]["status"] = "done"
            if out_queue:
                await out_queue.put(sse({"type": "agents", "agents": list(subagents.values())}))

            return "".join(result_tokens).strip() or f"[{description} 완료]"

        except Exception as exc:
            subagents[aid]["status"] = "error"
            if out_queue:
                await out_queue.put(sse({"type": "agents", "agents": list(subagents.values())}))
            return f"[{description} 오류]: {exc}"

    return [web_search, memory_write, memory_read, task]
