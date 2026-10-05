/**
 * 视觉伴侣的语料渲染（纯函数，零依赖）。
 *
 * 单独成模块的原因：宿主插件要让测试与调用方都能在**没有 `@deepseek-ai/*` 依赖**
 * 的环境里验证文案，所以把这段从 `lib/index.js` 里拆出来。
 *
 * @module @fish-under-sea/dsh-visual-companion/message
 */

const clean = (v) => String(v ?? '').replace(/\s+/g, ' ').trim()

/**
 * 把一次「提交」渲染成注入语料。语气平实、不啰嗦，别像系统告警。
 *
 * - 单选：`用户在页面上选好了 A（单栏布局）。`
 * - 多选：`用户在页面上选好了 2 项：A（单栏布局）、C（混合方案），备注：间距再大一点。`
 * - 只有备注：`用户在页面上留了句话：整体再紧凑些。`
 *
 * @param pending - `pending.json` 的解析结果（`selections` / `choice` / `text` / `note`）。
 * @returns 供 `agent.followup` 投递的一行用户消息。
 */
export function companionMessage(pending) {
  const selections = Array.isArray(pending?.selections) ? pending.selections : []
  const note = clean(pending?.note)
  const describe = (s) => {
    const choice = clean(s?.choice)
    const text = clean(s?.text)
    if (choice === '') return text
    return `${choice.toUpperCase()}${text === '' ? '' : `（${text}）`}`
  }
  const noteOnly = selections.length === 0 && pending?.choice === undefined && pending?.text === undefined
  let body
  let tail = ''
  if (selections.length === 1) body = `用户在页面上选好了 ${describe(selections[0])}`
  else if (selections.length > 1) body = `用户在页面上选好了 ${selections.length} 项：${selections.map(describe).join('、')}`
  else if (!noteOnly) {
    const choice = clean(pending.choice)
    const text = clean(pending.text)
    body = `用户在页面上选好了 ${choice === '' ? text : `${choice.toUpperCase()}${text === '' ? '' : `（${text}）`}`}`
  } else body = `用户在页面上留了句话：${note === '' ? '（无内容）' : note}`
  if (note !== '' && !noteOnly) tail = `，备注：${note}`
  return `【视觉伴侣】${body}${tail}。已同步给你，直接往下走就行（不必再问他）。`
}