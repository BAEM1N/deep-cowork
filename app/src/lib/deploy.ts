/**
 * Deploy mode — controls which LLM providers are visible.
 *
 * Set via VITE_DEPLOY_MODE env var at build time:
 *   "local"  → Ollama only (no cloud API key UI)
 *   "cloud"  → Anthropic + OpenRouter only
 *   "all"    → everything (default)
 *
 * Build commands:
 *   npm run build                          → all
 *   VITE_DEPLOY_MODE=local npm run build   → local only
 *   VITE_DEPLOY_MODE=cloud npm run build   → cloud only
 */

export type DeployMode = "local" | "cloud" | "all";

export const DEPLOY_MODE: DeployMode = (() => {
  const mode = (import.meta.env.VITE_DEPLOY_MODE || "all") as string;
  if (mode === "local" || mode === "cloud") return mode;
  return "all";
})();

export const PROVIDERS = (() => {
  const all = [
    { value: "anthropic", label: "Anthropic", placeholder: "claude-sonnet-4-6", cloud: true, local: false },
    { value: "openrouter", label: "OpenRouter", placeholder: "anthropic/claude-sonnet-4-5", cloud: true, local: false },
    { value: "ollama", label: "Ollama", placeholder: "llama3.1", cloud: false, local: true, defaultUrl: "http://localhost:11434/v1" },
    { value: "lmstudio", label: "LM Studio", placeholder: "loaded-model", cloud: false, local: true, defaultUrl: "http://localhost:1234/v1" },
    { value: "vllm", label: "vLLM", placeholder: "meta-llama/Llama-3.1-8B", cloud: false, local: true, defaultUrl: "http://localhost:8000/v1" },
  ] as const;

  if (DEPLOY_MODE === "local") return all.filter((p) => p.local);
  if (DEPLOY_MODE === "cloud") return all.filter((p) => p.cloud);
  return all;
})();

/** Local providers that support model fetching from server */
export const LOCAL_PROVIDERS = new Set(["ollama", "lmstudio", "vllm"]);

/** Whether to show API key input (not needed for local-only) */
export const SHOW_API_KEY = DEPLOY_MODE !== "local";

/** Default provider based on deploy mode */
export const DEFAULT_PROVIDER = DEPLOY_MODE === "local" ? "ollama" : "anthropic";
