# DeepCoWork

AI 에이전트 데스크톱 앱 — [Deep Agents SDK](https://github.com/langchain-ai/deepagents) 기반 멀티에이전트 협업 도구

## Features

- **DeepAgents SDK** — `create_deep_agent` + `LocalShellBackend` + `interrupt_on` HITL
- **4 Modes** — Clarify, Code, Cowork, ACP (Multi-Agent)
- **Skills** — 폴더 기반 SKILL.md 에이전트 능력 확장
- **HITL** — write_file, edit_file, execute 승인/거부
- **Multi-Provider** — Anthropic, OpenRouter, Ollama, LM Studio, vLLM
- **Dark/Light Theme** — 다크/라이트 테마 전환
- **i18n** — 한국어/English
- **Cross-Platform** — macOS, Windows, Linux (Tauri)

## Quick Start

```bash
# 1. Install dependencies
cd app && npm install
cd ../agent && python -m venv .venv && source .venv/bin/activate && pip install -e .

# 2. Set API key
echo "OPENROUTER_API_KEY=sk-or-..." > agent/.env
echo "LLM_PROVIDER=openrouter" >> agent/.env
echo "MODEL_NAME=anthropic/claude-sonnet-4-5" >> agent/.env

# 3. Run
cd app && npm run tauri dev
```

## Build

```bash
npm run build              # Default (all providers)
npm run build:local        # Ollama/LM Studio/vLLM only
npm run build:cloud        # Anthropic/OpenRouter only
npm run tauri build        # Desktop package (.dmg/.msi/.deb)
```

## Architecture

```
app/          — Tauri + React frontend
agent/        — FastAPI + DeepAgents backend
docs/         — Design docs & implementation log
```

## License

MIT
