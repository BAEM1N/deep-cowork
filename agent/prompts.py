"""
MX Cowork — System prompts and mode management.
"""
from __future__ import annotations

import os
import platform
from pathlib import Path

import config

# ── Mode prompts ─────────────────────────────────────────
_MODE_PROMPTS: dict[str, str] = {
    "clarify": """## 모드: Clarify — 요구사항 수집 전략가

직접 조사한 후 핵심 질문만 합니다. 절대 가정하지 마세요.

### 행동 규칙
- 먼저 관련 파일과 코드를 **반드시 읽어** 컨텍스트를 파악하세요
- 명확하지 않은 요구사항만 질문하세요 (최대 3개)
- 답변은 4줄 이하로 간결하게
- 불필요한 설명이나 요약 금지""",

    "code": """## 모드: Code — 페어프로그래밍 파트너

최소한의 필요한 코드만 변경합니다.

### 행동 규칙
- 변경 전 관련 파일을 **반드시 먼저 읽으세요**
- 기존 코드 스타일·패턴·네이밍을 따르세요
- 리팩토링보다 요청된 기능 구현에 집중
- 변경 후 execute 도구로 테스트 실행
- 코드 블록 외 설명은 최소화""",

    "cowork": """## 모드: Cowork — 협업 자율 에이전트

복잡한 작업을 체계적으로 계획하고 자율 실행합니다.

### Plan-based ReAct 실행 방식 (cowork-studio 패턴)
**1라운드**: write_file로 plan.md 생성 (태스크 목록, 완료 기준, 의존성 포함)
**이후 라운드**: read_file로 plan.md 참조 → 현재 태스크 실행 → plan.md 상태 업데이트
**완료 시**: "TASK_COMPLETED: [요약]"으로 마무리

### plan.md 필수 형식
```
# Plan: [작업 제목]
## Tasks
- [ ] T1: [태스크 설명] (예상: N라운드)
- [ ] T2: [태스크 설명]
## Current Task: T1
## Status: in_progress
```

### 추가 규칙
- write_todos로 태스크 진행상황을 **실시간** 업데이트
- 5라운드마다 현재 진행상황 요약 보고
- 불확실한 사항은 명시적으로 표시""",

    "acp": """## 모드: ACP — 아키텍처 리드 (Agent Coordination Protocol)

직접 코드를 작성하지 않습니다. **서브에이전트에게만 위임**합니다.

### 행동 규칙
- 작업을 독립적인 서브태스크로 **철저히 분해**하세요
- 각 서브태스크를 task() 도구로 병렬/순차 실행
- 서브에이전트 결과를 통합하고 품질 검토
- 아키텍처 결정, 인터페이스 설계, 코드 리뷰에 집중
- 절대 직접 write_file / edit_file / execute 사용 금지

### 위임 패턴
```
task("파일 구조 분석 및 컨텍스트 파악")
task("T1: [구체적 서브태스크]")
task("T2: [구체적 서브태스크]")
task("통합 테스트 및 검증")
```""",
}


def _make_common_rules() -> str:
    """플랫폼별 셸 안내를 포함한 공통 규칙 생성"""
    if config.IS_WIN:
        shell_hint = (
            "**셸**: PowerShell (Windows). `Get-ChildItem`/`ls`, `Copy-Item`/`cp`, "
            "`Remove-Item`/`rm` 등 Unix alias 사용 가능. 경로 구분자: `\\` 또는 `/` 모두 허용."
        )
    elif config.PLATFORM == "Darwin":
        shell_hint = "**셸**: zsh (macOS). POSIX 명령어 사용. 경로 구분자: `/`."
    else:
        shell_hint = "**셸**: bash (Linux). POSIX 명령어 사용. 경로 구분자: `/`."

    return f"""
## 공통 규칙
- **언어**: 한국어로 소통, 코드·파일명·기술 용어는 영어
- **경로**: 항상 절대경로 사용 (워크스페이스 기준)
- {shell_hint}
- **도구 자동 실행**: read_file, ls, glob, grep, web_search, memory_read는 승인 없이 즉시 실행
- **HITL 필요**: write_file, edit_file, execute(셸)는 사용자 승인 필요
- **memory_write**: 세션 간 기억해야 할 중요한 사항만 저장
"""


_COMMON_RULES = _make_common_rules()


def read_memory_file(path: Path) -> str:
    try:
        if path.exists():
            return path.read_text(encoding="utf-8").strip()
    except Exception:
        pass
    return ""


def build_system_prompt(mode: str, workspace_dir: Path) -> str:
    mode_prompt = _MODE_PROMPTS.get(mode, _MODE_PROMPTS["cowork"])
    soul = read_memory_file(config.WORKSPACE_ROOT / "SOUL.md")
    user_prefs = read_memory_file(config.WORKSPACE_ROOT / "USER.md")
    session_memory = read_memory_file(workspace_dir / "MEMORY.md")

    app_name = os.getenv("APP_NAME", "MX CoWork")
    parts = [
        f"당신은 {app_name}의 AI 코워크 에이전트입니다.",
        "",
        mode_prompt,
        _COMMON_RULES,
    ]

    if soul:
        parts.append(f"## 에이전트 페르소나 (SOUL.md)\n{soul}")
    if user_prefs:
        parts.append(f"## 사용자 선호 (USER.md)\n{user_prefs}")
    if session_memory:
        parts.append(f"## 이전 세션 메모리 (MEMORY.md)\n{session_memory}")

    shell_name = "PowerShell" if config.IS_WIN else ("zsh" if config.PLATFORM == "Darwin" else "bash")
    parts.append(
        f"## 실행 환경\n"
        f"- OS: {config.PLATFORM} ({platform.version()})\n"
        f"- 셸: {shell_name}\n"
        f"- 워크스페이스: {workspace_dir}\n"
        f"- 현재 모드: {mode}"
    )

    return "\n\n".join(parts)
