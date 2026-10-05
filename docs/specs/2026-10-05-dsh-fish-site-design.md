# dsh-fish 展示站 · 设计规格（v1）

> 状态：**待用户审查**。批准后只进入实现计划，不在本文档内写实现代码。
> 目标仓库：`Fish-under-sea/dsh-fish`；产出落在仓库新增目录 `site/`。
> 上游决策：视觉方向选 **A · 深海荧光**（用户在视觉伴侣页面上选定）。

---

## 1. 站点定位

给 `@fish-under-sea/dsh-fish` 插件聚合包做一套**对外产品展示站**：让第一次点进来的人 30 秒内明白「这是什么、装它有什么好处、怎么装」，并能在插件详情页查到每个成员的能力、配置与边界。

- **分类**：`brand` 路线（落地页 / 展示页，失败于被遗忘）→ 惊艳与记忆点优先于信息密度。
- **语言**：简体中文（与仓库 README 一致）。
- **受众**：已在使用 DSH（DeepSeek Harness）的人，以及从 GitHub / npm 点进来看的路人。
- **落点**：静态多页站，`site/` 目录，零构建、零外部依赖，本地 `file://` 双击可看，也可直接作为 GitHub Pages 的发布目录。

### 成功标准

1. 打开首页 5 秒内能说出「一个包装齐七个插件」这件事。
2. 任一插件页能在不跳 GitHub 的情况下回答：它解决什么问题、长什么样、怎么装、怎么配、有什么坑。
3. 断网、无 CDN、无字体下载时视觉不塌。

---

## 2. 信息架构

九页。首页负责「为什么」，插件页负责「是什么」，安装页负责「怎么装和踩坑怎么办」。

```text
site/
├── index.html                              首页
├── install.html                            安装与排错
├── plugins/
│   ├── approval-guide.html                 审批中文说明
│   ├── session-title-refresh.html          会话标题自动刷新
│   ├── git-sync.html                       一键 Git 同步
│   ├── settings-nav-order.html             设置导航重排
│   ├── visual-companion.html               视觉伴侣唤醒
│   ├── agent-teams.html                    多智能体团队协作（外部补充版）
│   └── better-reasoning-effort.html        思考强度与输入模态（外部 Fork）
├── assets/
│   ├── css/tokens.css                      设计令牌（唯一允许出现色值的地方）
│   ├── css/style.css                       全站样式
│   ├── js/main.js                          全站交互（原生 ES2020，零依赖）
│   └── img/favicon.svg                     站点图标（唯一的独立图形文件）
└── README.md                               站点说明（怎么本地看、怎么发布）
```

导航层级：`首页 › 插件（下拉七个）› 安装`。插件页之间用「上一个 / 下一个」成环，方便连续浏览。

---

## 3. 视觉系统 · 深海荧光

### 3.1 母题

包名 `fish-under-sea` 就是母题：**一片深海剖面**。

- 顶部光柱斜射入水，中部七条鱼（＝七个插件），底部是海底落款。
- 首页 Hero 全屏承载这个剖面；插件页把「那条鱼」放大成页面主图标。
- 深色是这套方向的**有意选择**，不提供浅色主题（见 §9 非目标）。

### 3.2 色彩令牌（`tokens.css`，深色单主题）

| 令牌 | 值 | 用途 |
|---|---|---|
| `--abyss-900` | `#04090F` | 页脚 / 最深背景 |
| `--abyss-800` | `#060D16` | 页面底色 |
| `--abyss-700` | `#0B1622` | 卡片底 |
| `--abyss-600` | `#11202E` | 抬高面（hover、代码块） |
| `--abyss-500` | `#1A2E3F` | 强分隔线 |
| `--cyan-300` | `#67E8F9` | 链接 hover、亮强调 |
| `--cyan-400` | `#22D3EE` | **主强调**（与仓库 README 徽标同色） |
| `--cyan-600` | `#0E7490` | 描边、深青装饰 |
| `--coral-400` | `#FF7A59` | 次强调：风险 / 注意类提示，全站总量克制 |
| `--kelp-400` | `#4ADE80` | 成功态：复制成功、安装通过 |
| `--text-100` | `#EAF6FA` | 主文字 |
| `--text-300` | `#A7BFCC` | 次文字 |
| `--text-500` | `#7A96A6` | 弱文字（meta、图注） |
| `--line` | `rgba(34,211,238,.14)` | 默认分隔线 |
| `--focus-ring` | `#67E8F9` | 焦点环 |

对比度自查（正文 ≥ 4.5:1）：`--text-100`、`--text-300`、`--cyan-400` 对 `--abyss-800` 均远超阈值；`--text-500` 对 `--abyss-800` 约 5:1，只用于 12–13px 的辅助文字且不得承载唯一信息。

### 3.3 字体与排版

字体栈一律用系统字体，不下载任何字体文件：

- 正文 / 标题：`-apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", "PingFang SC", sans-serif`
- 代码 / 命令 / 版本号：`ui-monospace, "Cascadia Mono", Consolas, "SFMono-Regular", monospace`

| 令牌 | 值 |
|---|---|
| `--fs-display` | `clamp(2rem, 5vw, 3.25rem)` |
| `--fs-h1` | `clamp(1.75rem, 3.6vw, 2.5rem)` |
| `--fs-h2` | `clamp(1.35rem, 2.6vw, 1.75rem)` |
| `--fs-h3` | `1.0625rem` |
| `--fs-body` | `1rem` |
| `--lh-tight` / `--lh-body` / `--lh-loose` | `1.25` / `1.75` / `2` |
| `--fs-sm` | `0.875rem` |
| `--fs-xs` | `0.78rem` |
| `--fs-code` | `0.875rem` |

正文行宽 65–75ch（`--container-narrow: 760px`）；全站容器 `--container: 1120px`。

### 3.4 空间、形状、层级

- 间距走 4px 网格：`--space-1…--space-12` = `4 8 12 16 20 24 32 40 48 64 80 96`。
- 圆角：`--radius-sm 6px` / `--radius-md 10px` / `--radius-lg 16px` / `--radius-pill 999px`。
- 深色下**不用传统灰阴影**，抬高靠「青边光晕 + 暗投影」：`--shadow-lift: 0 0 0 1px rgba(34,211,238,.18), 0 10px 30px rgba(0,0,0,.55)`。

### 3.5 动效

| 令牌 | 值 |
|---|---|
| `--dur-fast` | `140ms` |
| `--dur-base` | `240ms` |
| `--dur-slow` | `420ms` |
| `--ease-out` | `cubic-bezier(.22,.61,.36,1)` |

规则：

- 只动 `transform` 与 `opacity`；禁止 `transition: all`。
- 每屏最多 1–2 个关键元素在动。**鱼群整体视为一个动效单元**（七条鱼共用同一条动画与相位，只是位移量不同），因此 Hero 的动效单元是「鱼群」+「光柱」两个，不超限。
- 无限循环动画只允许用于 Hero 的鱼群漂浮与光柱缓摆：周期 ≥ 8s、幅度 ≤ 8px / ≤ 2deg，且必须能被 `prefers-reduced-motion` 关掉。
- 「水波扩散」：卡片 hover 时从中心扩散一圈极淡青环，用 `scale` + `opacity` 实现。
- `prefers-reduced-motion: reduce` 时：全部动画与过渡降为 **0 时长的一帧终态**——元素必须可见、位置必须是终态，禁止出现「因初始 `opacity:0` 而永久不可见」的元素。

### 3.6 七条鱼（插件图标）

七个插件各有一条形态不同的鱼，语义与插件对应，全部内联 SVG（`assets/img/`，无位图）：

| 插件 | 鱼形 | 语义 |
|---|---|---|
| approval-guide | 圆钝盾形鱼 | 守护、把风险讲清楚 |
| session-title-refresh | 长身条带鱼 | 标签与命名 |
| git-sync | 分叉尾鱼 | 分支与合并 |
| settings-nav-order | 长背鳍鱼 | 排序与队列 |
| visual-companion | 大眼鱼 | 观察与点选 |
| agent-teams | 三条小鱼成群的鱼 | 团队与分工 |
| better-reasoning-effort | 尖头快鱼 | 深度与速度 |

图形规则：

- **实现方式**：七条鱼与品牌标记**全部内联在各页 HTML 中**（`<svg>` 直接写在标签里），以便继承 `currentColor`、参与动效、且 `file://` 下零额外请求。`assets/img/` 下只有 `favicon.svg` 一个独立文件，用 `<link rel="icon" href="assets/img/favicon.svg">` 引用。
- **几何**：每个图标 `viewBox` 统一 `0 0 24 24`，`fill="currentColor"`，线宽与圆角风格保持一致。
- **配色**：默认继承父级 `currentColor`（落在青系上），允许 `better-reasoning-effort` 一条鱼在细节处使用 `--coral-400`，全站珊瑚橙总量克制。
- **可访问性**：图标 `aria-hidden="true"`，其旁必有文字名称；若某处图标单独承载语义（例如插件卡的唯一标识），改用 `<svg role="img"><title>插件名</title></svg>`。

---

## 4. 页面结构

### 4.1 全站骨架（每页复用）

```html
<a class="skip-link" href="#main">跳到主要内容</a>
<header class="site-header" data-header>
  品牌标记（小鱼 + dsh-fish 字标） · 主导航（首页 / 插件▾ / 安装 / GitHub）
  插件下拉：七个插件 · 移动端抽屉开关
</header>
<main id="main"> …页面内容… </main>
<footer class="site-footer"> 品牌 · 浏览 · 相关仓库 · 底部署名 </footer>
```

- 当前页导航项加 `aria-current="page"`。
- 每页有且仅有一个 `<main id="main">`。
- 区块统一 `<section class="section">` + 内部 `<div class="container">`。

**页面标题与描述**（每页独立，不可复制粘贴同一份）：

- `<title>` 格式：`<页面名> · dsh-fish`；首页直接写 `dsh-fish · Fish 自建 DSH 插件全家桶`。
- `<meta name="description">`：40–120 字中文，说清这页能回答什么。
- `<html lang="zh-CN">`、`<meta charset="utf-8">`、`<meta name="viewport" content="width=device-width, initial-scale=1">`（不加 `user-scalable=no`）。
- 引入顺序固定：`tokens.css` → `style.css` → `<script src="assets/js/main.js" defer>`。

### 4.2 首页 `index.html`

| 区块 | 内容 |
|---|---|
| Hero | 光柱 + 七条鱼群 + 大标题「一个包，装齐全部自建 DSH 插件」 + 副标题 + 安装命令（可复制） + 两个 CTA（看插件 / 安装指引） |
| 数据行 | `7 个插件` · `1 条命令` · `零运行时依赖` · `MIT`（「零运行时依赖」指五个自建子包的实现只用 `node:` 内置模块，不引 npm 包） |
| 鱼群总览 | 七张插件卡：图标 + 名称 + 版本 + 一句话定位 + 类型标签（client+host / host-only / client-only）；点进详情页 |
| 为什么用聚合包 | 对照表：分别装七个 vs 装一个；`cordis.patch.yml` 一次插七行的原理 |
| 装前必读 | 醒目提示：本包会停用内置会话标题提供方 `session-title-llm`，及其原因与行为差异 |
| 三条安装路径 | npm（推荐）/ GitHub / 本地 `link:` 开发，各一句取舍 + 指向安装页 |
| 尾部 CTA | 再给一次安装命令与仓库链接 |

### 4.3 插件详情页（七页统一模板）

| 区块 | 内容 |
|---|---|
| 标题区 | 面包屑 + 该插件的鱼形图标 + 全名（npm 包名）+ 版本徽标 + 一句话定位 + 安装命令（可复制） |
| 解决什么问题 | 2–4 段，讲清它替代了什么手工操作 |
| 效果（界面示意） | 一张 CSS 绘制的界面 mockup + 要点列表 |
| 使用 | 操作步骤或入口路径；配置项表格（键 / 默认值 / 说明） |
| 兼容与边界 | 已知限制、平台差异、需要重启之类的前提 |
| 相邻导航 | 上一个 / 下一个插件（成环） |

七个插件页的内容底料来自各自 README（`packages/*/README.md` 与两个外部仓库），事实性内容（版本号、命令、配置键、默认值）必须与 README 一致，不得臆造。

### 4.4 安装页 `install.html`

| 区块 | 内容 |
|---|---|
| 三条路径 | npm 安装（推荐）/ GitHub `#path:` 安装 / 本地 `link:` 开发安装，各带完整命令块 |
| 装完要做什么 | 重启 DSH、`--dump-config` 自检应恰好出现一行 |
| 镜像排错 | `[NOT_FOUND]` 的成因 + 七条 `syncs` 触发命令 + 复查命令 |
| 手工声明依赖的两条坑 | ① 子包必须能被 profile 顶层解析到 ② 子包要写在 `devDependencies`；说明重复挂载会让启动失败 |
| 卸载与回退 | remove 命令及行为回退说明 |

---

## 5. 组件清单

实现方只能使用下列类名，缺组件先反馈再补，不各自发明。

- **布局**：`.container` `.container--narrow` `.section` `.section--tight` `.grid` `.grid--2` `.grid--3` `.grid--4` `.stack` `.cluster`
- **头部**：`.site-header` `.site-header.is-scrolled` `.brand` `.brand__mark` `.brand__name` `.nav` `.nav__list` `.nav__link` `.nav__link.is-active` `.nav__toggle` `.dropdown` `.dropdown__menu` `.dropdown__item`
- **通用**：`.skip-link` `.visually-hidden` `.eyebrow` `.section__head` `.section__title` `.section__lead` `.lead` `.badge` `.tag` `.tag--cyan` `.tag--coral` `.btn` `.btn--primary` `.btn--ghost` `.link-arrow` `.divider`
- **首页**：`.hero` `.hero__glow` `.hero__title` `.hero__sub` `.hero__actions` `.fish-school` `.fish-school__item` `.stat-row` `.stat` `.stat__num` `.stat__label` `.compare-table` `.notice`
- **插件页**：`.plugin-hero` `.plugin-hero__icon` `.plugin-hero__name` `.plugin-hero__tagline` `.plugin-hero__install` `.mockup` `.mockup__bar` `.mockup__body` `.prose` `.spec-table` `.callout` `.callout--warn` `.callout--info` `.callout--danger` `.prev-next`
- **代码**：`.code-block` `.code-block__cmd` `.code-block__copy` `.code-block.is-copied`
- **页脚**：`.site-footer` `.site-footer__inner` `.footer__col` `.footer__title` `.footer__list` `.site-footer__bottom`
- **动效**：`.reveal` + `.is-visible`

### 界面示意（mockup）规范

- 每张 mockup 用 HTML + CSS 在页面内绘制（**不用截图、不用位图**），带窗口标题栏 `.mockup__bar`。
- 容器 `role="img"` + 一句 `aria-label`（说明这张示意在展示什么），内部结构 `aria-hidden="true"`。
- 七张示意分别对应：审批卡片（含高危分级）/ 标题设置页 / Git 同步面板与状态卡 / 设置导航重排列表 / 视觉伴侣点选页 / 团队面板与任务依赖 / 模型编辑卡的思考强度控件。

---

## 6. 交互契约（`assets/js/main.js`）

原生 ES2020，形态 `(function(){ 'use strict'; … })()`，暴露 `window.DshFishSite = { version: '1.0.0', init }`，`DOMContentLoaded` 自动 `init()`。**幂等**：重复 `init()` 不重复绑定。**容错**：任何选择器取不到就返回，绝不抛错（某页没有该组件也要能跑）。

| 钩子 | 行为 |
|---|---|
| `[data-header]` | 滚动超过 24px 加 `.is-scrolled` |
| `[data-nav-toggle]` + `[data-nav]` | 移动端抽屉：切换 `.nav.is-open` 与 `aria-expanded`，`Esc` 关闭，点链接或遮罩关闭，`resize` 到桌面宽度复位 |
| `[data-dropdown]` | 「插件」下拉：点击开合，`Esc` 关闭，点击外部关闭，`aria-expanded` 同步 |
| `[data-copy]` | 复制命令：`navigator.clipboard.writeText`，失败降级为 `select()` 选中文本；成功后按钮文案变「已复制」并在 1.6s 后复原 |
| `.reveal` | `IntersectionObserver` 加 `.is-visible`，只触发一次；`prefers-reduced-motion: reduce` 时立即全部可见 |
| `[data-year]` | 填入当前年份 |

禁止：`alert()`、`eval()`、`innerHTML` 注入用户输入、任何第三方库、任何网络请求。

平滑滚动用纯 CSS（`scroll-behavior: smooth` + `scroll-margin-top`）实现，不写 JS。

---

## 7. 可访问性与响应式底线

**a11y（可否决审美）**

- 正文对比度 ≥ 4.5:1；大字与图形 ≥ 3:1。
- `:focus-visible` 必须有可见焦点环（`--focus-ring`，2px + 2px 偏移），禁止无替代的 `outline: none`。
- 触控命中区 ≥ 44×44 CSS px（导航项、按钮、下拉项、复制按钮）。
- 装饰性 SVG / 图形 `aria-hidden="true"`；界面示意用 `role="img"` + `aria-label`。
- 不阻止粘贴、不禁用浏览器缩放（不写 `user-scalable=no`）。
- 键盘可走完全站：导航 → 下拉 → 正文链接 → 复制按钮 → 页脚。

**响应式**

- 断点 `640px` / `900px` / `1200px`，移动优先，至少 3 组 `@media`。
- 移动端：导航转抽屉、`--gutter` 缩小、多列网格转单列、表格转卡片式。
- Hero 鱼群在 `<640px` 下只保留前 4 条（CSS `.fish-school__fish:nth-child(n+5){ display:none }`）；HTML 中鱼群顺序与插件卡顺序一致，即保留 approval-guide / session-title-refresh / git-sync / settings-nav-order 四条。
- 全屏 Hero 用 `100dvh`；`overflow-x: clip`（不用 `hidden`，避免杀掉 sticky 后代）；安全区 `env()` 必须包在 `calc()` 里。
- 验收宽度：320 / 375 / 414 / 768 / 1200，320px 下不得出现横向滚动。

---

## 8. 验收标准

1. 九个 HTML 文件齐备，相对路径互链正确，双击 `index.html` 能在 `file://` 下完整浏览。
2. **零外部引用**：全站不存在指向站外的 `src` / `href`（`<link>`、`<script>`、`<img>`、`url()`）；指向 GitHub / npm 的普通 `<a>` 跳转链接是允许的。
3. 除 `tokens.css` 外，任何 CSS/HTML 里不出现硬编码色值（`#fff`、`rgb()` 等）。
4. 每个插件页的版本号、安装命令、配置键与对应 README 逐项一致。
5. 键盘可完整浏览，焦点环可见；320px 宽无横向滚动。
6. `prefers-reduced-motion: reduce` 下无永久不可见的元素。
7. `node --check site/assets/js/main.js` 通过。
8. 九个页面全部通过 `design-essence` 检测脚本，无 `blocker` / `high` 级问题：

   ```bash
   node "$DSH_HOME/skill-refs/design-essence/scripts/detect.mjs" site/
   ```

---

## 9. 非目标（YAGNI）

- 不做浅色 / 明暗主题切换（深色是方向 A 的构成要素）。
- 不做站内搜索、不做博客 / 更新日志页、不做英文版。
- 不做构建步骤：不引入 npm 依赖、不打包、不预处理器（CSS 直接写）。
- 不用任何真实截图或位图（仓库当前没有可用截图，全部改为 CSS 绘制的界面示意）。
- **不改动仓库任何现有文件**；本期只新增 `site/` 与本文档。
- 不自动配置 GitHub Pages：发布方式由用户决定（可从 `main` 分支的 `/site` 目录发布），本期不新增 workflow 文件。

---

## 10. 实现计划交接

批准后进入实现计划阶段，建议按文件所有权切分并行（样式与令牌必须先行冻结，页面写手才能并行）：

1. **样式基线**（`tokens.css` + `style.css` + `assets/img/*.svg`）：先落地，作为其余工作的依赖。
2. **页面写作**：首页 + 安装页一组；七个插件页按 README 内容分给 2–3 人。
3. **交互**（`main.js`）：可与页面写作并行，但要按 §6 契约实现。
4. **验证**：零外链扫描、硬编码色值扫描、对比度与 a11y 抽查、320px 横向滚动检查、`node --check`。

具体任务 DAG 与成员分工在实现计划中确定，本文档不预设。