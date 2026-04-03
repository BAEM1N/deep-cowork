# DeepCoWork

AI 에이전트 데스크톱 앱 — [Deep Agents SDK](https://github.com/langchain-ai/deepagents) 기반 멀티에이전트 협업 도구

## Download

[Releases](https://github.com/BAEM1N/deep-cowork/releases)에서 OS별 설치 파일 다운로드:

| OS | 파일 |
|----|------|
| macOS (Apple Silicon) | `DeepCoWork_x.x.x_aarch64.dmg` |
| macOS (Intel) | `DeepCoWork_x.x.x_x64.dmg` |
| Windows | `DeepCoWork_x.x.x_x64-setup.exe` |
| Linux | `DeepCoWork_x.x.x_amd64.AppImage` |

> Python 설치 불필요 — 에이전트 서버가 앱에 포함되어 있습니다.

## Features

- **DeepAgents SDK** — `create_deep_agent` + `LocalShellBackend` + HITL
- **4 Modes** — Clarify, Code, Cowork, ACP (Multi-Agent)
- **Skills** — 폴더 기반 SKILL.md 에이전트 능력 확장
- **HITL** — write_file, edit_file, execute 승인/거부
- **Multi-Provider** — Anthropic, OpenRouter, Ollama, LM Studio, vLLM
- **Dark/Light Theme**
- **i18n** — 한국어/English
- **Cross-Platform** — macOS, Windows, Linux

## Development

```bash
# 1. Clone
git clone https://github.com/BAEM1N/deep-cowork.git
cd deep-cowork

# 2. Install
cd app && npm install
cd ../agent && python -m venv .venv && source .venv/bin/activate && pip install -e .

# 3. Set API key
cp .env.example .env
# Edit .env with your API key

# 4. Run (dev mode)
cd ../app && npm run tauri dev
```

## Build

```bash
# Desktop package (current OS)
cd app && npm run tauri build

# Build variants
npm run build:local   # Ollama/LM Studio/vLLM only
npm run build:cloud   # Anthropic/OpenRouter only
```

## Architecture

```
app/          — Tauri 2 + React frontend
agent/        — FastAPI + DeepAgents SDK backend
  bundle.py   — PyInstaller sidecar builder
docs/         — Design docs
```

## License

MIT
