"""
MX Cowork — Settings and health endpoints.
"""
from __future__ import annotations

import os

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import config
from prompts import read_memory_file, _MODE_PROMPTS
from state import rebuild_all_agents_safe
from tools import is_safe_path

router = APIRouter()


# ── Pydantic models ──────────────────────────────────────
class ApiKeyRequest(BaseModel):
    api_key: str


class ProviderRequest(BaseModel):
    provider: str  # "anthropic" | "openrouter" | "ollama"
    model: str
    ollama_base_url: str | None = None


class MemoryUpdateRequest(BaseModel):
    target: str  # "soul" | "user"
    content: str


# ── Helpers ──────────────────────────────────────────────
def _active_key() -> str:
    provider = config.LLM_PROVIDER or os.getenv("LLM_PROVIDER", "anthropic")
    if provider == "openrouter":
        return config.OPENROUTER_API_KEY or os.getenv("OPENROUTER_API_KEY", "")
    return config.ANTHROPIC_API_KEY or os.getenv("ANTHROPIC_API_KEY", "")


def _persist_env(key: str, value: str) -> None:
    """Save env var to ~/.cowork.env for persistence across restarts."""
    try:
        config.COWORK_ENV_FILE.parent.mkdir(parents=True, exist_ok=True)
        lines: list[str] = []
        if config.COWORK_ENV_FILE.exists():
            for line in config.COWORK_ENV_FILE.read_text(encoding="utf-8").splitlines():
                if not line.startswith(f"{key}="):
                    lines.append(line)
        lines.append(f"{key}={value}")
        config.COWORK_ENV_FILE.write_text("\n".join(lines) + "\n", encoding="utf-8")
    except Exception:
        pass


# ── Endpoints ────────────────────────────────────────────
@router.get("/settings")
async def get_settings():
    provider = config.LLM_PROVIDER or os.getenv("LLM_PROVIDER", "anthropic")
    return {
        "provider": provider,
        "model": config.MODEL_NAME,
        "api_key_set": bool(_active_key()),
        "ollama_base_url": config.OLLAMA_BASE_URL,
        "os_platform": config.PLATFORM,
        "workspace_root": str(config.WORKSPACE_ROOT),
    }


@router.post("/settings/api-key")
async def set_api_key(req: ApiKeyRequest):
    key = req.api_key.strip()
    provider = config.LLM_PROVIDER or os.getenv("LLM_PROVIDER", "anthropic")
    if provider == "openrouter":
        config.OPENROUTER_API_KEY = key
        os.environ["OPENROUTER_API_KEY"] = key
        _persist_env("OPENROUTER_API_KEY", key)
    else:
        config.ANTHROPIC_API_KEY = key
        os.environ["ANTHROPIC_API_KEY"] = key
        _persist_env("ANTHROPIC_API_KEY", key)
    await rebuild_all_agents_safe()
    return {"ok": True, "api_key_set": bool(key), "provider": provider}


@router.post("/settings/provider")
async def set_provider(req: ProviderRequest):
    config.LLM_PROVIDER = req.provider
    config.MODEL_NAME = req.model
    os.environ["LLM_PROVIDER"] = req.provider
    os.environ["MODEL_NAME"] = req.model
    _persist_env("LLM_PROVIDER", req.provider)
    _persist_env("MODEL_NAME", req.model)
    if req.ollama_base_url:
        config.OLLAMA_BASE_URL = req.ollama_base_url
        os.environ["OLLAMA_BASE_URL"] = req.ollama_base_url
        _persist_env("OLLAMA_BASE_URL", req.ollama_base_url)
    await rebuild_all_agents_safe()
    return {"ok": True, "provider": config.LLM_PROVIDER, "model": config.MODEL_NAME}


@router.post("/settings/memory")
async def update_memory(req: MemoryUpdateRequest):
    target_map = {
        "soul": config.WORKSPACE_ROOT / "SOUL.md",
        "user": config.WORKSPACE_ROOT / "USER.md",
        "agents": config.WORKSPACE_ROOT / "AGENTS.md",
    }
    path = target_map.get(req.target)
    if not path:
        raise HTTPException(400, "target은 'soul', 'user', 'agents' 중 하나여야 합니다")
    encoded = req.content.encode("utf-8", errors="replace")
    if len(encoded) > config.MAX_MEMORY_BYTES:
        raise HTTPException(413, f"메모리 파일 크기는 50KB를 초과할 수 없습니다 (현재: {len(encoded)//1024}KB)")
    path.write_text(req.content, encoding="utf-8")
    await rebuild_all_agents_safe()
    return {"ok": True, "target": req.target}


@router.get("/settings/memory")
async def get_memory():
    return {
        "soul": read_memory_file(config.WORKSPACE_ROOT / "SOUL.md"),
        "user": read_memory_file(config.WORKSPACE_ROOT / "USER.md"),
        "agents": read_memory_file(config.WORKSPACE_ROOT / "AGENTS.md"),
    }


# ── Skills endpoints ────────────────────────────────────
@router.get("/settings/skills")
async def list_skills():
    """List all available skills from ~/.cowork/skills/"""
    skills_dir = config.WORKSPACE_ROOT / "skills"
    if not skills_dir.is_dir():
        return {"skills": []}
    skills = []
    for d in sorted(skills_dir.iterdir()):
        if not d.is_dir():
            continue
        skill_file = d / "SKILL.md"
        if not skill_file.exists():
            continue
        content = read_memory_file(skill_file)
        # Parse YAML frontmatter
        meta = _parse_skill_frontmatter(content)
        meta["path"] = str(d.relative_to(config.WORKSPACE_ROOT))
        meta["content"] = content
        skills.append(meta)
    return {"skills": skills}


@router.get("/settings/skills/{skill_name}")
async def get_skill(skill_name: str):
    skill_file = config.WORKSPACE_ROOT / "skills" / skill_name / "SKILL.md"
    if not skill_file.exists():
        raise HTTPException(404, f"Skill '{skill_name}' not found")
    return {"name": skill_name, "content": read_memory_file(skill_file)}


def _validate_skill_name(name: str) -> str:
    """Validate skill name to prevent path traversal."""
    import re
    clean = name.strip()
    if not clean or not re.match(r'^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]?$', clean):
        raise HTTPException(400, "스킬 이름은 영문 소문자, 숫자, 하이픈만 허용 (1-64자)")
    if ".." in clean or "/" in clean or "\\" in clean:
        raise HTTPException(400, "잘못된 스킬 이름")
    return clean


@router.put("/settings/skills/{skill_name}")
async def update_skill(skill_name: str, req: MemoryUpdateRequest):
    safe_name = _validate_skill_name(skill_name)
    skill_dir = config.WORKSPACE_ROOT / "skills" / safe_name
    # Double-check resolved path is within skills dir
    if not is_safe_path(config.WORKSPACE_ROOT / "skills", skill_dir.resolve()):
        raise HTTPException(403, "접근 거부")
    skill_dir.mkdir(parents=True, exist_ok=True)
    skill_file = skill_dir / "SKILL.md"
    skill_file.write_text(req.content, encoding="utf-8")
    await rebuild_all_agents_safe()
    return {"ok": True, "name": safe_name}


@router.delete("/settings/skills/{skill_name}")
async def delete_skill(skill_name: str):
    import shutil
    safe_name = _validate_skill_name(skill_name)
    skill_dir = config.WORKSPACE_ROOT / "skills" / safe_name
    if not is_safe_path(config.WORKSPACE_ROOT / "skills", skill_dir.resolve()):
        raise HTTPException(403, "접근 거부")
    if skill_dir.is_dir():
        shutil.rmtree(skill_dir)
    await rebuild_all_agents_safe()
    return {"ok": True}


def _parse_skill_frontmatter(content: str) -> dict:
    """Extract YAML frontmatter from SKILL.md"""
    result = {"name": "", "description": "", "allowed_tools": []}
    if not content.startswith("---"):
        return result
    parts = content.split("---", 2)
    if len(parts) < 3:
        return result
    for line in parts[1].strip().splitlines():
        if ":" not in line:
            continue
        key, _, val = line.partition(":")
        key = key.strip()
        val = val.strip()
        if key == "name":
            result["name"] = val
        elif key == "description":
            result["description"] = val
        elif key == "allowed-tools":
            result["allowed_tools"] = val.split()
    return result


@router.get("/health")
async def health():
    provider = config.LLM_PROVIDER or os.getenv("LLM_PROVIDER", "anthropic")
    return {
        "status": "ok",
        "provider": provider,
        "model": config.MODEL_NAME,
        "api_key_set": bool(_active_key()),
        "db": str(config.DB_PATH),
        "modes": list(_MODE_PROMPTS.keys()),
        "os_platform": config.PLATFORM,
        "workspace_root": str(config.WORKSPACE_ROOT),
    }
