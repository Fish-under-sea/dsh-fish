/**
 * @fish-under-sea/dsh-fish —— Fish 自建插件聚合包的宿主半边。
 *
 * 本包**不实现任何功能**，它是一个「bundle 层载体」：真正干活的是包根
 * 的 cordis.patch.yml，它在 profile 组合阶段把四个自建插件与一个外部补充版
 * （dsh-agent-teams-fish）的插件行一次性插入 roster。那份 patch 才是本包的全部价值。
 *
 * 因此这里保持空实现：本包没有自己的插件行（patch 里不为本包插入行），
 * load 到它时什么都不该发生。
 *
 * 为什么不像 @linxin666/dsh-web-all 那样做一个「故障隔离外壳」：
 * 外壳要求行名写成聚合包的子路径（@fish-under-sea/dsh-fish/<插件>），
 * 而 DSH 的 client-modules 扫描器用 exactPackageSpecifier() 过滤 entries
 * —— scoped 名必须正好是 `@scope/name` 两段，多一段子路径即判为「不是包」
 * 并跳过，于是浏览器半区不会注册。子路径换来的隔离能力，代价是三个插件的
 * 设置页与界面全部消失，不划算。三个子插件本身足够简单，任一插件启动失败
 * 只影响它自己。
 *
 * @module @fish-under-sea/dsh-fish
 */

/** 空实现：本包不注册任何东西，功能全部来自 cordis.patch.yml。 */
export function apply() {}

/** 无需任何服务。 */
export const inject = [];