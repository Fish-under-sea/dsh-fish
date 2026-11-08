/**
 * @fish-under-sea/dsh-fish —— 浏览器半边。
 *
 * 本包自身不渲染任何界面：各成员各自带自己的浏览器半区
 * （审批说明、任务看板、SSH 运维、用量统计、会话归档、技能中心与设置排序），
 * 由 loader 按各自的 `dsh.client` 声明分别注入。
 */
export function apply() {}