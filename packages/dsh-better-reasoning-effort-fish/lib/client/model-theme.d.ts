/** 模型优先的主题识别，移植自 HanaAyane/dsh-reasoning-effort PR 9（MIT）。 */
export type ModelThemeKind = 'deepseek' | 'openai' | 'claude' | 'gemini' | 'kimi' | 'glm' | 'qwen' | 'minimax';
/** Detect model theme: 'claude' for Claude/Anthropic, 'openai' for OpenAI/GPT/Codex, 'gemini' for Google/Gemini, 'kimi' for Moonshot/Kimi, 'glm' for Zhipu GLM/ZCode, 'qwen' for Alibaba Qwen/Tongyi, 'minimax' for MiniMax/Hailuo, 'deepseek' for others. */
export declare function detectModelTheme(provider?: string | null, modelId?: string | null, modelName?: string | null): ModelThemeKind;
