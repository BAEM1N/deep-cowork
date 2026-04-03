"""
MX Cowork — File listing, reading, and writing endpoints.
"""
from __future__ import annotations

import os
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import config
from state import state
from tools import is_safe_path

router = APIRouter()

_MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


class WriteFileRequest(BaseModel):
    content: str


@router.get("/agent/threads/{thread_id}/files")
async def list_files(thread_id: str):
    meta = state.threads_meta.get(thread_id, {})
    ws_path = meta.get("workspace_path")
    ws = Path(ws_path) if ws_path else config.WORKSPACE_ROOT / thread_id
    if not ws.exists():
        return {"files": [], "truncated": False}
    # Path validation: ensure workspace is within safe bounds
    if not is_safe_path(Path.home(), ws):
        raise HTTPException(403, "접근 거부")
    files = []
    truncated = False
    try:
        for dirpath, dirnames, filenames in os.walk(ws, topdown=True):
            dp = Path(dirpath)
            depth = len(dp.relative_to(ws).parts)
            if depth >= config.FILE_LIST_MAX_DEPTH:
                dirnames.clear()
                continue
            dirnames[:] = [
                d for d in dirnames
                if not d.startswith(".") and d not in config.FILE_LIST_SKIP_DIRS
            ]
            for name in sorted(filenames):
                if name.startswith("."):
                    continue
                p = dp / name
                try:
                    st = p.stat()
                    rel = str(p.relative_to(ws))
                    files.append({
                        "path": rel,
                        "size": st.st_size,
                        "modified": datetime.fromtimestamp(st.st_mtime).isoformat(),
                    })
                except OSError:
                    continue
                if len(files) >= config.FILE_LIST_MAX:
                    truncated = True
                    break
            if truncated:
                break
    except (PermissionError, OSError):
        pass
    files.sort(key=lambda f: f["path"])
    return {"files": files, "truncated": truncated}


@router.get("/agent/threads/{thread_id}/files/{file_path:path}")
async def read_file(thread_id: str, file_path: str):
    meta = state.threads_meta.get(thread_id, {})
    ws_path = meta.get("workspace_path")
    ws = Path(ws_path) if ws_path else config.WORKSPACE_ROOT / thread_id
    target = (ws / file_path).resolve()
    if not is_safe_path(ws, target):
        raise HTTPException(403, "접근 거부")
    if not target.exists():
        raise HTTPException(404, "파일 없음")
    if target.stat().st_size > _MAX_FILE_SIZE:
        raise HTTPException(413, f"파일이 너무 큽니다 ({target.stat().st_size // (1024*1024)}MB > 10MB)")
    try:
        content = target.read_text(encoding="utf-8")
        return {"path": file_path, "content": content, "size": target.stat().st_size}
    except UnicodeDecodeError:
        raise HTTPException(415, "바이너리 파일은 텍스트로 읽을 수 없습니다")


@router.put("/agent/threads/{thread_id}/files/{file_path:path}")
async def write_file_api(thread_id: str, file_path: str, req: WriteFileRequest):
    """UI에서 파일 직접 저장 (에디터 저장 버튼용)"""
    meta = state.threads_meta.get(thread_id, {})
    ws_path = meta.get("workspace_path")
    ws = Path(ws_path) if ws_path else config.WORKSPACE_ROOT / thread_id
    target = (ws / file_path).resolve()
    if not is_safe_path(ws, target):
        raise HTTPException(403, "접근 거부")
    # File size limit check
    content_bytes = req.content.encode("utf-8", errors="replace")
    if len(content_bytes) > _MAX_FILE_SIZE:
        raise HTTPException(413, f"파일 크기는 10MB를 초과할 수 없습니다 (현재: {len(content_bytes) // (1024*1024)}MB)")
    try:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(req.content, encoding="utf-8")
        return {"ok": True, "path": file_path, "size": target.stat().st_size}
    except Exception as e:
        raise HTTPException(500, f"저장 실패: {e}")
