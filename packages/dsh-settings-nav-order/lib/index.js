/**
 * @fish-under-sea/dsh-settings-nav-order —— 宿主半边（空实现）。
 *
 * 本插件全部功能都在浏览器半区：它只做一件事——按用户保存的顺序给「设置」
 * 面板左侧那列导航按钮打 CSS `order`，从而在不改任何第三方插件代码的前提下
 * 改变菜单显示顺序。宿主侧不需要路由、不需要读文件，于是保持空实现。
 *
 * 之所以仍然要有一个宿主行（cordis.patch.yml 里的 insert），是因为
 * @deepseek-ai/dsh-client-modules 的扫描器只从 loader entries 里找声明了
 * `dsh.client` 的包；没有宿主行，浏览器半区不会被装载。
 *
 * @module @fish-under-sea/dsh-settings-nav-order
 */

/** 空实现：本包不注册任何宿主能力。 */
export function apply() {}

/** 无需任何服务。 */
export const inject = [];
