<div align="center">

# @fish-under-sea/dsh-settings-nav-order

**把 DSH 设置面板左侧菜单排成你要的顺序，并把不用的项收起来。**

[![npm](https://img.shields.io/npm/v/@fish-under-sea/dsh-settings-nav-order?style=flat-square&label=npm&color=cb3837)](https://www.npmjs.com/package/@fish-under-sea/dsh-settings-nav-order)
![license](https://img.shields.io/badge/license-MIT-green?style=flat-square)
![node](https://img.shields.io/badge/node-%3E%3D20-339933?style=flat-square)
![DSH](https://img.shields.io/badge/DSH-%3E%3D0.2.0--rc.2-4b6ef6?style=flat-square)
![client-only](https://img.shields.io/badge/plugin-client--only-6b7280?style=flat-square)

</div>

## 解决什么问题

DSH 设置面板左侧那列菜单（通用设置 / 模型 / 内置插件 / Agent 预设 / 已归档会话 / Git 同步 / …）的顺序写死在每个插件自己的 `settings.section` 注册里（一个 `order` 数字），GUI 既没有重排入口，也没有把不用的项收起来的办法。想把自己常用的项挪到上面、或把一年也用不到一次的项藏掉，只能去改别人的插件包——而应用内包在 asar 里（升级即丢），profile 下的包也会被插件更新覆盖。

本插件不碰任何第三方代码：排序靠给导航按钮打 CSS `order`，隐藏靠打 `display:none`。DOM 顺序、各插件的代码、React 的 key 全都不用动。

## 效果

- 按住 `⋮⋮` 把手拖动即可排序，也可点 `↑` / `↓` 精细调整。
- 点「隐藏」把不用的项从左栏收起——插件本身照常工作。
- 保存后立即生效；已隐藏的项在面板里显示成灰色删除线，点「显示」找回。
- 关掉「启用手动排序与隐藏」或点「恢复默认」，立刻回到各插件自己的样子。

## 安装

```sh
# 推荐：随聚合包一起装（见仓库根 README）
dsh plugin --profile <profile> add @fish-under-sea/dsh-settings-nav-order
```

`<profile>` 填 DSH 的 profile 名：桌面端 `desktop`，Web 端 `web`。

要改源码时才用 `link:<本目录的绝对路径>`。

装完必须**重启 DSH**：`cordis.patch.yml` 的插件行只在启动时展开，刷新页面不够。

## 使用

1. 打开「设置」，在左侧菜单里点最下面的「设置导航顺序」。
2. **排序**：按住每行左边的 `⋮⋮` 把手拖动；想精细调整也可以点 `↑` / `↓`。
3. **隐藏**：在不想看到的项上点「隐藏」——它就从左侧菜单里消失了，插件本身照常工作。
4. 点「保存」。左侧菜单立刻变样。

补充：

- 已经隐藏的行在面板里显示成灰色带删除线，点「显示」即可找回。
- 关掉「启用手动排序与隐藏」并保存 = 完全用各插件自己的样子。
- 点「恢复默认」= 清掉保存的顺序与隐藏，同样回到原样。
- 「设置导航顺序」这一页**不能隐藏自己**：它是唯一能取消隐藏的入口，藏了就再也进不来了。

## 配置

本插件**没有配置文件**。偏好存在浏览器 `localStorage`：

| 项 | 值 |
| --- | --- |
| 键 | `dsh-settings-nav-order/v1` |
| 内容 | `{"enabled":true,"order":[{"name":"模型","index":0}, …],"hidden":[{"name":"Web 插件","index":0}, …]}` |

为什么不用配置文件：这是「这台机器上这个浏览器」的显示偏好，跨设备同步没有意义；也因此宿主半边是空实现，不需要 API、不需要读盘。

## 兼容与边界

- **不改 DOM 顺序、不动第三方插件代码**：容器是 flex column，给子元素打 `style.order` 只改视觉顺序；隐藏只是 `display:none`，节点不删，取消隐藏立刻回来。
- **拖拽自己实现**：Pointer Events + `setPointerCapture` + 各行中线算落点（`dropIndex` + `adjustDrop`），不引第三方库，触摸屏同样能拖。箭头与拖拽最终都走同一个 `moveTo`，两种操作的结果必然一致。
- **按 `[class*="navList"]` 子串匹配**：真实 DOM 里的类名是 CSS Modules 的哈希名（`ZiQlkq_navList` / `ZiQlkq_navLabel`），精确的 `.navList` 选择器匹配不到；按「类名里含原名」匹配，DSH 换哈希前缀也不受影响。
- **同名项用「同名第几个」区分**：菜单项没有 id 也没有 data 属性，只能靠标签文本识别；配置里存 `{ name, index }` 而不是裸名字，菜单增删之后旧配置不会把别的项挤错位。
- **MutationObserver 观察 `document.body` 子树**：设置面板由 portal 挂在 `document.body` 上，面板一出现就重排；回调按帧合并（`requestAnimationFrame`），聊天区流式输出不会把它变成性能负担。
- **防自锁**：「设置导航顺序」自身永远不许被隐藏——它是唯一能取消隐藏的入口。
- **失败退回原样**：面板读不到、样式打不上、配置坏掉（坏 JSON、字段类型不对、隐私模式下 `localStorage` 抛异常），结果都只是顺序 / 隐藏没生效——不会白屏，也不会少项。
- **隐藏只收入口、不卸载插件**：被隐藏的插件功能照常工作；要彻底停用它请去插件管理页。
- **界面语言会影响识别**：菜单项靠显示出来的文字认，切到英文界面后，配置里记的中文名暂时不匹配，其余项不受影响；切回中文即恢复。
- **跟着浏览器 profile 走**：换浏览器、换机器、清站点数据都会回到默认样子。
- **新装 / 卸载插件**：配置里已经不存在的菜单项当成陈旧项忽略；新装插件新增的菜单项排在已保存顺序的后面，默认也不会被隐藏。

## 开发与测试

```sh
node test/client.test.mjs
```

零依赖：用手写的假 DOM + 假 React 跑完整条链路（装载 → 计算顺序 → 落到元素上 → 设置页渲染与交互），共 36 个用例。

拖拽的指针跟手效果假 DOM 测不了（假元素没有布局），测试覆盖的是它依赖的纯函数（`moveTo` / `dropIndex` / `adjustDrop`）以及与箭头的结果一致性；手感请以实机为准。

> 不要用 `node --test test/`：测试运行器会派生子进程并捕获管道输出，在受限沙箱里会以 `EPERM` 失败。直接运行测试文件即可。

## 与聚合包的关系

> 本包是 [`@fish-under-sea/dsh-fish`](https://github.com/Fish-under-sea/dsh-fish) 聚合包的成员之一；单独安装只影响这一项。

## 许可

MIT © Fish-under-sea
