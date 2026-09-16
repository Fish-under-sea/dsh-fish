/**
 * dsh-fish —— 浏览器半边。
 *
 * 本包自身不渲染任何界面：三个子插件各自带自己的浏览器半区
 * （approval-guide 的审批中文说明、session-title-refresh 的设置页、
 * git-sync 的同步面板），由 loader 按各自的 `dsh.client` 声明分别注入。
 *
 * 这里保持一个空实现，只为满足 package.json 里 `dsh.client.platform: 'web'`
 * 的入口声明，避免 loader 解析 exports 时落空。
 */
export function apply() {}