"""
MX Cowork — Configuration, constants, and global environment settings.
"""
from __future__ import annotations

import logging
import os
import platform
from pathlib import Path

from dotenv import load_dotenv

# ── Platform detection ────────────────────────────────────
PLATFORM = platform.system()   # "Windows" | "Linux" | "Darwin"
IS_WIN = PLATFORM == "Windows"

# ── Environment loading ───────────────────────────────────
load_dotenv()
_cowork_env = Path.home() / ".cowork" / ".cowork.env"
if _cowork_env.exists():
    load_dotenv(_cowork_env, override=True)

# ── Logging ───────────────────────────────────────────────
LOG_LEVEL = os.getenv("LOG_LEVEL", "WARNING").upper()
logging.basicConfig(level=getattr(logging, LOG_LEVEL, logging.WARNING))
logger = logging.getLogger("cowork")

# ── LLM provider settings (mutable — changed by settings API) ──
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "anthropic")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1")
MODEL_NAME = os.getenv("MODEL_NAME", "claude-sonnet-4-6")
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

# ── Workspace paths ──────────────────────────────────────
_DEFAULT_WORKSPACE = str(Path.home() / ".cowork" / "workspace")
WORKSPACE_ROOT = Path(os.getenv("WORKSPACE_ROOT", _DEFAULT_WORKSPACE))
DB_PATH = WORKSPACE_ROOT / "cowork.db"
COWORK_ENV_FILE = WORKSPACE_ROOT.parent / ".cowork.env"

# ── Numeric constants ────────────────────────────────────
MAX_AGENT_ITERATIONS = 50
APPROVAL_TIMEOUT_SEC = 30
MAX_MEMORY_BYTES = 50 * 1024   # 50 KB
FILE_LIST_MAX = 500
FILE_LIST_MAX_DEPTH = 5

# ── Frozen sets ──────────────────────────────────────────
FILE_LIST_SKIP_DIRS: frozenset[str] = frozenset({
    ".git", "node_modules", "__pycache__", ".venv", "venv",
    ".mypy_cache", "dist", "build", ".next", ".nuxt", "target",
})

VALID_MODES: frozenset[str] = frozenset({"clarify", "code", "cowork", "acp"})

READ_ONLY_TOOLS: frozenset[str] = frozenset({
    "read_file", "ls", "glob", "grep", "web_search", "memory_read",
})

FILE_WRITE_TOOLS: frozenset[str] = frozenset({
    "write", "create_file", "append_file", "write_file", "edit_file", "execute",
})

CHECKPOINT_TABLES: frozenset[str] = frozenset({
    "checkpoints", "checkpoint_blobs", "checkpoint_migrations", "checkpoint_writes",
})
