"""
DeepCoWork — Agent Server  v5
FastAPI + DeepAgents + Dynamic Mode Prompts + Extended Tools + Memory Layer
+ native HITL via interrupt_on (write_file, edit_file, execute)
+ Provider/Model settings
+ Workspace scope per-thread
+ Abort support
+ Cross-platform: Windows PowerShell / Linux bash / macOS zsh
"""
from __future__ import annotations

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import config
from state import state
from hitl import thread_output_queues
from routes.settings import router as settings_router
from routes.agent_routes import router as agent_router
from routes.files import router as files_router


# ── Lifespan ─────────────────────────────────────────────
@asynccontextmanager
async def lifespan(_: FastAPI):
    await state.setup()
    _init_default_soul()
    port = int(os.getenv("PORT", 8008))
    print(f"SERVER_READY:{port}", flush=True)
    yield
    for out_queue in list(thread_output_queues.values()):
        try:
            await out_queue.put(None)
        except Exception:
            pass
    await state.teardown()


def _init_default_soul():
    soul_path = config.WORKSPACE_ROOT / "SOUL.md"
    if not soul_path.exists():
        soul_path.write_text(
            "# Agent Persona\n\n"
            "열정적이고 체계적인 시니어 엔지니어처럼 행동합니다.\n"
            "복잡한 문제를 명확하게 분해하고, 코드 품질을 중시하며,\n"
            "팀워크와 지식 공유를 가치 있게 생각합니다.\n"
            "간결하고 직접적으로 소통합니다.",
            encoding="utf-8",
        )


# ── FastAPI app ──────────────────────────────────────────
app = FastAPI(title="DeepCoWork Agent Server", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1",
        "http://localhost",
        "tauri://localhost",
        "https://tauri.localhost",
    ],
    allow_origin_regex=r"http://(127\.0\.0\.1|localhost):\d+",
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type", "Accept"],
)

app.include_router(settings_router)
app.include_router(agent_router)
app.include_router(files_router)


if __name__ == "__main__":
    import argparse
    import uvicorn

    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=int(os.getenv("PORT", 8008)))
    args = parser.parse_args()

    os.environ["PORT"] = str(args.port)
    uvicorn.run(app, host="127.0.0.1", port=args.port)
