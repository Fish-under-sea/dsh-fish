import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { detectModelTheme } from '../src/client/model-theme.js'

describe('模型品牌主题', () => {
  it.each([
    ['deepseek-v3', 'deepseek'], ['deepseek-r1', 'deepseek'],
    ['gpt-5', 'openai'], ['o3', 'openai'], ['openai/o4-mini', 'openai'], ['codex-mini', 'openai'],
    ['claude-sonnet-4', 'claude'], ['anthropic/claude-opus-4', 'claude'],
    ['gemini-2.5-pro', 'gemini'], ['gemma-3', 'gemini'],
    ['kimi-k2', 'kimi'], ['moonshot-v1', 'kimi'],
    ['glm-5', 'glm'], ['zcode', 'glm'], ['chatglm', 'glm'],
    ['qwen3-max', 'qwen'], ['qwq-32b', 'qwen'],
    ['MiniMax-M2', 'minimax'], ['hailuo', 'minimax'],
  ])('识别 %s 为 %s', (model, expected) => {
    expect(detectModelTheme('openrouter', model)).toBe(expected)
  })

  it.each([
    ['google', 'claude-sonnet-4', 'claude'],
    ['anthropic', 'gemini-2.5-pro', 'gemini'],
    ['openai-compatible', 'deepseek-r1', 'deepseek'],
    ['openai', 'qwen3', 'qwen'],
    ['deepseek', 'kimi-k2', 'kimi'],
  ])('聚合供应商 %s 不覆盖模型 %s 的主题', (provider, model, expected) => {
    expect(detectModelTheme(provider, model)).toBe(expected)
  })

  it('使用模型显示名识别，未知模型才回退到供应商', () => {
    expect(detectModelTheme('openai', 'deployment-1', 'Claude Sonnet')).toBe('claude')
    expect(detectModelTheme('dashscope', 'deployment-1')).toBe('qwen')
    expect(detectModelTheme('bigmodel', 'deployment-1')).toBe('glm')
    expect(detectModelTheme()).toBe('deepseek')
    expect(detectModelTheme(null, null, null)).toBe('deepseek')
    expect(detectModelTheme('gateway', 'unknown')).toBe('deepseek')
  })
})

describe('主题素材与构建契约', () => {
  const sprites = ['chibi', 'gpt', 'claude', 'gemini', 'kimi', 'glm', 'qwen', 'minimax']
  it.each(sprites)('%s 素材保留来源 PNG 的尺寸与透明通道', name => {
    const png = readFileSync(new URL(`../assets/${name}-runner-strip.png`, import.meta.url))
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
    // GPT 原始素材为 2172 × 390，其余七张为 2304 × 395；不重采样原图。
    expect(png.readUInt32BE(16)).toBe(name === 'gpt' ? 2172 : 2304)
    expect(png.readUInt32BE(20)).toBe(name === 'gpt' ? 390 : 395)
    expect(png[25]).toBe(6)
  })

  it('八款素材均被样式引用，并对减少动画偏好静态降级', () => {
    const styles = readFileSync(new URL('../src/client/runner-styles.ts', import.meta.url), 'utf8')
    for (const name of sprites) expect(styles).toContain(`../../assets/${name}-runner-strip.png`)
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)')
    expect(styles).toContain('animation: none')
    expect(styles).toContain('0% { background-position: 0% 0; }')
    expect(styles).not.toContain('.re-effort')
    expect(styles).not.toContain('.bre-model-root')
  })
})
