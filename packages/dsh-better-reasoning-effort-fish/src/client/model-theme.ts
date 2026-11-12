/** 模型优先的主题识别，移植自 HanaAyane/dsh-reasoning-effort PR 9（MIT）。 */
export type ModelThemeKind = 'deepseek' | 'openai' | 'claude' | 'gemini' | 'kimi' | 'glm' | 'qwen' | 'minimax'

/** Detect model theme: 'claude' for Claude/Anthropic, 'openai' for OpenAI/GPT/Codex, 'gemini' for Google/Gemini, 'kimi' for Moonshot/Kimi, 'glm' for Zhipu GLM/ZCode, 'qwen' for Alibaba Qwen/Tongyi, 'minimax' for MiniMax/Hailuo, 'deepseek' for others. */
export function detectModelTheme(
  provider?: string | null,
  modelId?: string | null,
  modelName?: string | null,
): ModelThemeKind {
  const p = (provider ?? '').toLowerCase()
  const m = `${modelId ?? ''} ${modelName ?? ''}`.toLowerCase()

  // 1. Check Model ID & Model Name first (aggregators / multi-model providers like Vertex/Bedrock/Antigravity/OpenRouter host models from various brands)
  if (
    m.includes('claude') ||
    m.includes('anthropic') ||
    m.includes('opus') ||
    m.includes('sonnet') ||
    m.includes('haiku')
  ) {
    return 'claude'
  }

  if (
    m.includes('gemini') ||
    m.includes('gemma') ||
    m.includes('google')
  ) {
    return 'gemini'
  }

  if (
    m.includes('kimi') ||
    m.includes('moonshot') ||
    m.includes('kimi-k1') ||
    m.includes('kimi-chat')
  ) {
    return 'kimi'
  }

  if (
    m.includes('glm') ||
    m.includes('zcode') ||
    m.includes('zhipu') ||
    m.includes('chatglm') ||
    m.includes('codegeex') ||
    m.includes('cogview')
  ) {
    return 'glm'
  }

  if (
    m.includes('qwen') ||
    m.includes('qwq') ||
    m.includes('tongyi') ||
    m.includes('aliyun') ||
    m.includes('alibaba')
  ) {
    return 'qwen'
  }

  if (
    m.includes('minimax') ||
    m.includes('abab') ||
    m.includes('hailuo') ||
    m.includes('mini-max')
  ) {
    return 'minimax'
  }

  if (
    m.includes('gpt') ||
    m.includes('chatgpt') ||
    m.includes('openai') ||
    m.includes('codex') ||
    m.includes('davinci') ||
    /(?:^|[\b\s/_.-])o[1-9](?:[\b\s/_.-]|$)/.test(m)
  ) {
    return 'openai'
  }

  if (
    m.includes('deepseek') ||
    m.includes('deep-seek') ||
    /(?:^|[\b\s/_.-])r1(?:[\b\s/_.-]|$)/.test(m) ||
    /(?:^|[\b\s/_.-])v3(?:[\b\s/_.-]|$)/.test(m)
  ) {
    return 'deepseek'
  }

  // 2. Fall back to Provider if model identifier is generic / ambiguous
  if (p.includes('claude') || p.includes('anthropic')) {
    return 'claude'
  }

  if (p.includes('gemini') || p.includes('google')) {
    return 'gemini'
  }

  if (p.includes('kimi') || p.includes('moonshot')) {
    return 'kimi'
  }

  if (p.includes('zhipu') || p.includes('bigmodel') || p.includes('zcode') || p.includes('glm')) {
    return 'glm'
  }

  if (p.includes('qwen') || p.includes('aliyun') || p.includes('alibaba') || p.includes('tongyi') || p.includes('dashscope') || p.includes('bailian')) {
    return 'qwen'
  }

  if (p.includes('minimax') || p.includes('hailuo')) {
    return 'minimax'
  }

  if (p.includes('openai') || p.includes('chatgpt') || p.includes('codex')) {
    return 'openai'
  }

  if (p.includes('deepseek') || p.includes('deep-seek')) {
    return 'deepseek'
  }

  return 'deepseek'
}

