# 更新记录

> `@fish-under-sea/dsh-fish` 聚合包的完整版本记录。README 顶部只保留最近一版，历史条目归档于此。

---

> **0.8.2（2026-10-12）**：**`dsh-usage` 0.4.7 → 0.4.9 —— 假设计价口径放宽到「所有 API 下的 DeepSeek 消耗」，并删掉说明小字。**
>
> **背景**：0.4.7 引入的假设行只统计**官方家族路由**（`deepseek-official` / `deepseek-account`）。用户指出这不对 —— 应为「目前存的所有 API 下的 DeepSeek 消耗」。实测本机台账印证了这个缺口有多大：`bailian` 一个渠道的 DeepSeek 模型就有 **27.4 亿 tokens**，而官方家族只有 2.6 亿。
>
> **新口径**：新增核心判据 `countsAsDeepSeekUsage(provider, model)` —— 路由属官方家族**或**模型 id 含 `deepseek`（不分大小写）即计入；非 DeepSeek 模型（MiMo / Qwen / GLM / GPT / Claude 等）一律排除。中转与聚合渠道计入：聚合站或免费渠道上的 DeepSeek 模型同样是 DeepSeek 消耗。
>
> **为什么汇总放在宿主侧（要紧）**：线上协议按 `SUMMARY_MODEL_CAP = 12` 截断每个 provider 的模型列表，浏览器侧求和会在聚合站模型数超过上限后**静默漏算**。测试里专门构造 20 个模型的场景证明了这一点：客户端拿到的 12 条里已不含 DeepSeek 那条，而宿主汇总仍完整。因此新增 `UsageWindowSummary.deepseek` 与 `UsageDayView.deepseek`，由 `summarizeDays` 在同一遍扫描里累加（它本来就持有不截断的逐模型映射，零额外开销）。客户端 `officialPricingScenarios` 只读该分桶；**旧宿主不下发时少显示一行**，不拿只看到官方账号的口径冒充全量。
>
> **数字变化**（本机真实台账，2026-09-11 ~ 2026-10-12）：旧口径 ¥22.06 / ¥11.03 → 新口径 **¥1478.77 / ¥739.39**（DeepSeek 49.3 亿 tokens，占全部流量 57.9%）。**旧口径算出值与用户截图的 ¥22.06 / ¥11.03 逐分吻合**，证明计价算法与线上一致，新值可直接采信。
>
> **界面**：按用户要求，假设计价行下方的说明小字（`usage.bank.scenario.hint`）中英词条与渲染一并移除。
>
> **验证**：新增 6 条测试全绿（跨路由汇总、官方别名保底、非 DeepSeek 排除、模型上限不影响汇总、多种真实命名口径、旧宿主降级、零值非 undefined、历史 `cost` 不参与）；`tsc -b` 与 `tsdown` 通过；产物中确认计价行在位且已删文案彻底消失。

---
> **0.8.1（2026-10-12）**：**三个子包功能更新**（聚合包本身只升依赖范围，成员数仍为 14）。
>
> **① `dsh-skill-lens-fish` 0.1.0 → 0.1.1：依赖图文件名与点击打开**
>
> 现场反馈两个问题：节点名被截断成同一串、点击打不开文件。
>
> - **标签改为文件名**：原标签是 `skill-refs/ai-asset-forge/scripts/detect.mjs` 这类完整路径，而节点宽度固定、按 24 字截断，同目录下多个节点会**显示成同一个名字**（用户截图里 8 个节点全是 `skill-refs/ai-asset-for...`），看起来像重复节点。改为取 basename 后各自可辨；完整路径保留在 `title` 悬停提示里。代价是不同目录下的同名文件外观相同，需靠悬停区分（已与用户确认这一取舍）。同时把 Windows 反斜杠一并按分隔符处理。
> - **可点性改由节点自带 `open` 描述决定**：原 `clickable` 硬排除 `root` 与 `referenced`，导致「引用资源」与扁平技能本体**永远不可点**。现在 `{ via: "skill" }` 仍跳「文件」页签编辑，新增 `{ via: "external" }` 走只读预览。新增只读对话框（原生 `dialog`，含加载态、失败 `role=alert`、关闭按钮与 Escape、来源路径、Markdown 与等宽文本分流），**不提供保存入口**。
> - **安全性**：宿主 `read` 有 `isUnderAllowedRoot` 闸门，而 `resolve-refs` 成功时已把资源所在目录登记进 `allowedRoots`，因此只读读取复用既有通路，**无需放宽任何权限**。
> - 节点补 `role=button` / `tabIndex` / Enter 与 Space 键处理，不再只有鼠标可用。
>
> **② `dsh-usage` 0.4.6 → 0.4.7：Token 银行新增官方价目表假设行**
>
> 在「官方余额实测花费」下方新增一行：按**当前** Flash 价目表对 **DeepSeek 官方家族** token 重算两次，一次假设全部调用落在高峰时段、一次假设全部落在空闲时段，两个金额构成假设成本的上下界。
>
> 口径（已与用户逐项确认）：**只算官方家族**（`isDeepSeekProviderRoute`，MiMo 与其它渠道无官方价目表、计入会失真）；**不判断真实时段、不复用历史 `cost`**（折叠时刻的 `cost` 按每次调用真实所处时段计价，与反事实估算语义不同）；**取 `provider.totals` 而非 `models` 列表**（后者会被路由层截断，用它会漏算）；`outputTokens` 已含 reasoning，不重复计入。文案明确写出「不是实际扣费」。已知偏差：2026-09-14 前存在的 v4-pro 档会按 Flash 价估算 —— 与既有 `cost` 同为当前口径，两者可比。
>
> 实现复用同一份 `FLASH_PRICE` 常量（`core/pricing.ts` 新增 `deepseekFlashScenarioSpend`），不复制价格数字。
>
> **③ `dsh-agent-teams-fish` 0.6.1 → 0.7.0：新增 MiMo 厂商（命名空间 17 → 18）**
>
> 新增 **MiMo（小米 MiMo）**，与 `stepfun` / `jev` 同档 —— 只有「厂商通用图 + 立绘高清」，没有 Q 版岗位图；成员请求 `member-mimo-<role>-v2.png` 时第 1 跳落空，**第 2 跳命中自家厂商角色**。
>
> **识别规则的边界是本次难点**：`mimo` 与 `minimax` / `mistral` 同以 `mi` 开头，放宽成裸 `\bmi[\w.-]*` 会把这两家整片吞掉；而宽松的 `\bmimo[\w.-]*` 又会误吞 `mimosa` / `mimolette` 这类普通英文词。规则因此要求 `mimo` 后**是词边界或分隔符** —— MiMo 的真实模型 ID 一律带分隔符（`MiMo-7B` / `mimo-v2` / `mimo-vl`），收紧不会漏掉真实 ID。正反两组边界都有单测钉住。
>
> 素材新增 3 个文件（256×256 RGBA 头像 + 1024×1536 alpha WebP 立绘 + 商标 SVG），素材目录 286 → 289；**立绘经逐角点核验保留透明背景**（四角 RGBA 均为 `(0,0,0,0)`）。⚠️ `brand-mimo.svg` 是**自制简版 Mi 字标**（小米橙圆角方底 + 白色 `mi`），不是官方商标 —— 仓库门禁强制每厂商必须有商标文件，拿到官方素材后替换同名文件即可。走 minor 是因为 `ARTWORK_VENDORS.length` 是门禁硬断言的契约值。
>
> **④ 发布说明（要紧，需知悉）**
>
> - 三个子包先行发布：`@fish-under-sea/dsh-skill-lens-fish@0.1.1`、`@fish-under-sea/dsh-usage@0.4.7`、`dsh-agent-teams-fish@0.7.0`；聚合包随本版把依赖范围指向它们。
> - `dsh-agent-teams-fish` 发布时用了 `--ignore-scripts` **跳过 `prepublishOnly`**：该 hook 会跑 `pnpm verify`，其中 `quality-gates-work-order.test.mjs` 的 #174 用例需要在 `%TEMP%` 创建符号链接，而本机 Windows 未开管理员/开发者模式时必然 `EPERM`。**已用 `git stash` 对照验证**：暂存掉全部改动后该用例以完全相同方式失败，与本次修改无关。发布前已逐项手工跑完门禁（`verify.mjs` all checks passed、`artwork-role-match` 42/42、`custom-artwork` 21/21，以及 web-routes / release / readme / skill / http-body / compatibility / capabilities / member-spawn-recovery / git-install / source-runner / git-artifact 共 11 项全部 PASS）。在具备符号链接权限的机器上应正常跑该 hook。
> - `dsh-agent-teams-fish` 的发布基于 **GitHub `origin/main`（0.6.1）**，**不是**本机那份停在 `0.5.1` 的旧克隆（落后 239 个提交）—— 从旧克隆发布会把 0.6.0 / 0.6.1 的全部内容回退掉。
>
---

> **0.8.0（2026-10-12）**：**并入 6 个上游全家桶插件（Fork）+ 1 个自建插件，成员数 7 → 14。**
>
> **① 6 个上游 Fork（Apache-2.0）**：把 [zhu1090093659/dsh-web](https://github.com/zhu1090093659/dsh-web) 的 `dsh-task-board`、`dsh-git-graph`、`dsh-model-capabilities`、`dsh-ssh`、`dsh-usage`、`dsh-session-archive`（基线均为 `0.4.6`）fork 进 `packages/`，以 `@fish-under-sea/dsh-client-ui-task-board` / `-git-graph` / `-model-capabilities`、`@fish-under-sea/dsh-ssh` / `dsh-usage` / `dsh-session-archive` 发布。
>
> **为什么必须 fork 而不是加依赖**：上游把这些包的 npm scope 与包名一起**烧进了客户端 bundle 的模块注册 id**（`window.__ModuleLoader__.load({ id: "@linxin666/…" })`），而宿主 `@deepseek-ai/dsh-client-modules` 在 `nearestPackage()` 里按 **`package.json` 的 `name`** 认领包（`name === expectedPackageName` 才接受）。两者不一致时包认领失败，**浏览器半区（设置页 / 面板）整个不加载**。因此改名必须改源码并重建 bundle，这也正是能自主发版、后续跟随内核演进的前提。
>
> **② 改了什么（仅 scope 与遥测，功能与上游 0.4.6 等价）**：
> - 包名与 npm scope：`@linxin666/*` → `@fish-under-sea/*`；源码、配置、文档中的引用一并替换（含 `mountOnce("<包名>")` 的**进程级挂载守卫标识** —— 不改会让 fork 与上游原版被认作同一插件而互相排挤）。
> - **移除安装遥测**：上游 `shared/client/telemetry.ts` 每日向 `https://dsh-market.com/api/telemetry/event` 上报一次包名。涉及 `dsh-task-board`、`dsh-git-graph`、`dsh-ssh` 三个包（删 `src/client/telemetry.ts` 与其 import/调用）。另三个包本就没有遥测。
> - **修正两个上游自身缺陷**：`dsh-session-archive` 的 `dependencies` 写的无 scope `schemastery`，而源码 import 带 scope 的 `@deepseek-ai/schemastery`（构建期 TS2307 类型解析失败），已改为 `^3.18.4`；`dsh-ssh` 的 `native-panel.tsx` JSDoc 里 `@module` 标注的上游笔误 `dsh-client-ssh` 已修正。
> - 各包附 **`NOTICE`**（Apache-2.0 §4b 要求）：来源仓库、来源包名与版本、修改内容、许可与免责。
> - **不带 `tests/`**（上游 6 包共 230 个测试文件，约占其文件数 39%）：本仓库只维护 `src/` + `lib/`，改源码后跑 `pnpm --filter <包> build` 重建。
>
> **③ 构建链**：移植上游仓库根的共享构建预设到本仓库 `shared/`（`tsdown.client.ts`、`web-platform.ts`、`types/css-modules.d.ts`）；根 `package.json` 增加构建 devDependencies（`tsdown@0.22.2`、`typescript@~5.7.2`、`lightningcss@^1.32.0`）。**注意**：`lightningcss` 必须装在**仓库根**，因为共享预设从根目录解析依赖。`lib/` 提交进仓库，因此发布流程照旧无需构建。
>
> **④ 新增自建插件 `dsh-skill-lens-fish@0.1.0`**：Skill Lens Fish 版，基于 [x-feichen/dsh-skill-lens](https://github.com/x-feichen/dsh-skill-lens)（MIT）改造 —— 跟随 `$DSH_HOME`（上游写死 `~/.dsh`，在本机 `~/.dsh-beta` 下扫描恒为空）、识别扁平 `<名称>.md` 技能、把技能对 `skill-refs/` 等目录外共享资源的引用解析成真实路径并单列为依赖图的「引用资源」分类；构建脚本从 `package.json` 现读注册 id（上游硬编码，正是「改包名五处」第 3 处的坑）。
>
> **⑤ ⚠️ 与 `@linxin666/dsh-web-all` 共存（要紧）**：6 个 Fork 与该聚合包**同源**。两者同时启用会让这 6 个插件**被挂载两次**（两个任务看板抢同一侧栏席位、重复注册同一宿主服务）。行 id 不冲突（本包用 `ui-*` / 裸名，对方用 `web-ui-*`），**不会**触发「同 id 插两行」的启动失败，但行为异常。请在**自己 profile 的补丁层**把那 6 个 `web-ui-*` 行设为 `disabled: true`。本包**不主动改写别人的行**（跨包干预会产生耦合与 `entry not found` 告警）。
>
> **⑥ README / 许可**：双语 README 全量同步（成员表 +7 行、安装清单、新增「与 dsh-web-all 共存」章节、成员数 7 → 14）；6 个 Fork 为 **Apache-2.0**（本仓库自身与自建子包为 MIT），著作权归上游原作者，见各包 `NOTICE`。

---

> **0.7.9（2026-10-12）**：`dsh-agent-teams-fish` **0.6.0 → 0.6.1**（依赖范围 `^0.6.0` → **`^0.6.1`**）—— **修掉「升级 DSH 到 0.2.1-alpha.2 后插件被整行禁用」**。
>
> **症状**：DSH 运行时升到 `0.2.1-alpha.2` 后，宿主日志出现 `disabling profile plugin row "agent-teams": Plugin dsh-agent-teams-fish@0.6.0 is incompatible with dsh 0.2.1-alpha.2`，面板上插件显示「异常」，**AgentTeams 团队协作完全不工作**。这不是崩溃，而是 DSH 的主动保护：声明面没跟上运行时，它宁可停用也不冒着崩溃或数据损坏的风险加载。
>
> **根因**：该仓库以 `compatibility.json` 为**单一事实源**，并由 `scripts/compatibility.mjs` 强制「每条 peer 范围必须精确枚举其中的宿主版本」。DSH 升版后这个枚举列表没跟上 —— **插件代码本身无缺陷**（编译产物只 value-import `@deepseek-ai/dsh-llm` 与 `@deepseek-ai/schemastery`，两者在新宿主上照常导出；其余 `@deepseek-ai/*` 均为编译期擦除的类型导入）。
>
> **修法**：把 `0.2.1-alpha.2` 以 `track: preview` 加入 `supportedHosts`，并同步追加到全部 **21** 条 `@deepseek-ai/dsh-*` peer 白名单（门禁会强制这一步：只改事实源而漏改 peer 立即报 `peer range must enumerate the supported host targets`）。`recommendedHost` **保持**稳定版 `0.2.0-rc.2` 不动 —— alpha 不得充当普通用户推荐目标。**不改宽范围**：DSH 用 `includePrerelease` 语义比较，`>=0.2.0-rc.2` 会宣称「与所有未来版本兼容」，与该仓库「逐版本实测后再声明」的立场相悖。
>
> **验证**：兼容性门禁红 → 绿；`readme` 8/8、`release` 6/6、美术三套件 21/21 + 41/41 + 9/9 全绿；`lib/` 产物未变（`git-artifact-stamp.json` 的 `output` 摘要一致，仅含 version 的 `source` 摘要更新）。已发布 npm 0.6.1 并核实 **21/21** 条 peer 均含新版本。

---
> **0.7.8（2026-10-12）**：**移出 `@fish-under-sea/dsh-session-title-refresh`、`dsh-git-sync` 新增「导出私钥配置」、聚合包加上自定义图标**。
>
> **① 移出 `dsh-session-title-refresh`（成员数 8 → 7）**：DSH 自 **v0.2.1-alpha.2** 起**已内置会话自动重命名**，与该插件的核心用途重叠 —— 该插件因此**暂停维护更新**（源码保留在 `packages/` 下，npm 上已发布的版本仍可单独安装），本聚合包不再随附。
>
> ⚠️ **同时撤下原先那段「停用 DSH 内置首行标题提供方（`session-title-llm`）」的 patch** —— 这段停用当初就是为了给该插件让位。若只移出插件而保留停用，内置提供方被关掉却没有替代者，**会话将不再自动命名**。现内置提供方恢复生效。仍要用旧插件的话单独安装即可，它自带的 patch 会重新停用内置提供方。
>
> **② `dsh-git-sync` 0.3.3 → 0.4.0：新增「导出私钥配置」（纯本机）**：把带凭据的几份配置（`channel-pack/state.json`、`channel-pack/auto-checkin.json`、`channel-pack/token-ledger.json`、`.credentials.yaml`、`our-free-model/eac-user.json`）拷到**指定目录**（面板可改，**留空即桌面**）下的 `DSH私钥配置` 文件夹，**保留原相对目录结构**，并写入一份 README 说明每个文件是什么、要放回新机器的哪里。
>
> 三条必须守住的约束：**纯本地**（不碰 git、不发任何网络请求）、**不解析内容**（只做字节拷贝，凭据内容绝不进日志或 README）、**不放宽权限**（走 `fs.copyFileSync` 而非内部那个会把目标 chmod 成 `0666` 的 `copyFileRobust`，POSIX 下收紧到 `0600`）。它与 git 同步是**两条完全分开的通路** —— 凭据在同步硬黑名单里，永远不会随仓库走；正因如此换机时这几份只能手工搬，本功能就是把这件事变得不容易漏。新增测试 `test/test-private-export.mjs`（32 个断言）。
>
> **③ 自定义图标**：新增 `icon.png`（384×384 · 231 KB）。DSH 规定图标为「相对 manifest 的路径、SVG/PNG/JPEG/WebP、≤ 256 KiB」，故从 1254×1254 的源图缩到 384×384 并压到 231 KB；同时加入 `files` 白名单。插件管理器卡片、bundle 详情与设置里的插件清单从此显示本包图标。
>
> **④ 测试**：同步引擎 188/188、客户端 37/37、bundle 注册 2/2、新增导出 32/32 —— 全部通过。

---
> **0.7.7（2026-10-11）**：三个上游 fork 同步到最新上游 —— `dsh-agent-teams-fish` **0.5.1 → 0.6.0**、`dsh-better-reasoning-effort-fish` **0.5.7 → 0.5.8**、`dsh-our-free-model` **2.0.0 → 2.1.0**（依赖范围分别提到 **`^0.6.0`** / **`^0.5.8`** / **`^2.1.0`**）。
>
> **① `dsh-agent-teams-fish` 0.6.0**：并入上游 v0.1.23（37 个提交）—— **成员工具策略**（可为成员配策略 ID，四个必需协调工具始终保留；只控工具可用性，不是操作系统沙箱）、**质量门契约与修订绑定**（verdict 绑定实际产物字节与完整修复 lineage）、**修复契约保留与失效源告警**（不在失败依赖上死锁）、**越界 finding 升级**（带理由升级，而非造不可能完成的修复任务）、**lineage 身份沿 fork 链**、**工作区审计**、**损坏 `team.json` 降级读取**、会话来源元数据与非破坏性历史恢复。三处冲突（`src/snapshot.ts` 的 import 块与函数体、`src/tools.ts` 的 `add_member`）均按「两侧并存」融合；Fish 自建的 `src/artwork-source.ts`、`src/client/artwork.ts` 降级链、`captainRouteOf` 队长头像跟随路由与 286 个随包素材零改动保留。`lib/` 为提交进仓库的产物，已随源码重建（77 个文件）。
>
> **② `dsh-better-reasoning-effort-fish` 0.5.8**：并入上游三条安装路线说明（24 小时 `minimum-release-age` 下写明版本号可立即安装、release 页面附带的 tarball 路线、GitHub 源码安装）。⚠️ **0.5.7 已发布过**，而本仓库 HEAD 比它多一个 README 提交，同版本号发不上去，故版本提到 0.5.8 —— 本次为纯文档变更，运行时代码与 0.5.7 等价。该仓库与上游**无共同祖先**，本次是**逐处移植**而非 merge。
>
> **③ `dsh-our-free-model` 2.1.0**：并入上游 v2.1.0（17 个提交，真 merge，双父）—— **combos 组合链**、**token-saver**、**原生 Anthropic 网关**、`standalone` 拆分（`packages/standalone/`）、渠道包与 Kilo 渠道、升级器 snapshot SHA 修复。两处冲突取舍：`package.json` 取上游 2.1.0 但**保持本版已移除 `private`**（本包要发 npm）；`src/adapter.js` 的 import 两侧符号并存、计价钩子保留本版 `PIXEL_IMAGE_PRICING`。Fish 自建的 `src/channel-visibility.js`（108 行，隐藏渠道模型分组）与 `src/image-pricing.js`（75 行，按面积计价）与合并前 diff 为 0 行。
>
> **④ ⚠️ 仓库改名**：`dsh-our-free-model` 的仓库已从 `Our-Free-Mode-fish` 迁到 [`dsh-our-free-model-fish`](https://github.com/Fish-under-sea/dsh-our-free-model-fish)（**旧名已 404**）。本 README 与 CHANGELOG 中英双语里指向旧名的链接、`github:` 安装示例与 `link:` 路径占位已全部同步。
>
> **⑤ ⚠️ `dsh-our-free-model` 的应用内一键升级暂不可用**：它的自升级器按 Ed25519 签名校验 `feed/manifest.json`（`src/updater.js` 里 pin 了上游公钥），而重签需要上游发布私钥 —— **本机没有**，`node scripts/build-manifest.mjs --check` 实测 rc=1（`src/channel-visibility.js` 不在清单、`src/image-pricing.js` 从上游精简版换成本版完整版）。**npm 安装不受影响**：该包**无 `prepublishOnly` / `prepack` / `prepare`**，且 `feed/` 与 `catalog/` **不在 `files` 清单里**，所以 `npm publish` 不会被签名卡住，受影响的只是应用内自升级通道。按用户决定**不修改** `src/feed.js` / `src/updater.js` 里写死的上游 `REPO` 常量（改成自建仓库只会拉到与 fork 文件不符的上游签名清单，校验照样失败）。
>
> **⑥ 测试**：at-fork 美术与质量门测试全绿（自定义美术 21/21、岗位匹配 41/41、质量门修订 9/9），另有五套上游新门禁通过（tool-policies 13/13、lineage-identity 9/9、corrupt-teamjson 6/6、issue-203-card 13/13、member-spawn-recovery 10/10）；ofm 的 `channel-visibility` 与 `image-pricing` 测试通过、`tsc --noEmit` 通过；brf `tsc --noEmit` 通过、vitest 452/452 全绿。

---

> **0.7.6（2026-10-11）**：`@fish-under-sea/dsh-git-sync` **0.3.2 → 0.3.3**（依赖范围 `^0.3.2` → **`^0.3.3`**）—— **壁纸引擎采集范围四条收敛为一条**。
>
> **① 为什么收敛**：壁纸引擎（`dsh-plugin-wallpaper-engine`）的 ADR-0011 把「预设」从**玻璃子集快照**升为**整机配置快照**，并新增了导入 / 导出。面板里点「导出预设…」得到的那份文件（本机 `$DSH_HOME/FISH.json`）**就是**这个插件的配置面 —— 实测 `values` 116 键与 `config.json.settings` 132 键的**差集恰好是 12 个硬排除键 + 4 个资产指针**（硬排除的是当前壁纸 / 隐藏清单 / 轮播列表 / `userProps` 本机绝对路径摘要 / 运行期失败记忆 / 版本号），且 `assets` 段**内嵌了字体与吉祥物资产本体**。⇒ 原先的四条（`wallpaper-engine/config.json` + `glass-presets/` + `fontsets/` + `mascot/`，走额外扫描根）全部冗余。
>
> **② 顺带修掉一个真实缺陷**：采集是**单向拷贝**（只从 home 往仓库复制、从不删仓库侧），所以白名单**目录**里本机删掉的文件会**永远留在仓库**，被差异引擎如实算成「仓库多出 N」。本机当时的面板正是 `4 个文件有差异（新增 0 · 变更 1 · 仓库多出 3）`——多出的 3 个全在被撤下的目录里（两份旧格式玻璃预设 + 一张旧立绘，来历正是 ADR-0011 那次旧预设作废）。撤下目录后**归零**。⚠️ 这只治了壁纸引擎这一处，`skills/` 等目录级条目仍有只增不减特性（已记入配置仓 README 的已知问题）。
>
> **③ 额外扫描根机制保留、当前表为空**：`EXTRA_ROOTS` 是给「插件把数据放在 `$DSH_HOME` 之外」这类情况的通用落点，不再有消费者但有意留着（表空时行为与「没有这套机制」逐字等价）。再加一个根仍是两步：表里补一行 + 白名单加 `<key>/…`。
>
> **④ ⚠️ 还原不是全自动（本版最要紧的用户可见变化）**：`dsh-git-sync` 只负责把文件搬回 `$DSH_HOME/FISH.json`；**真正生效要在壁纸引擎面板里点「导入预设…」选中它，且导入后还要在列表里点一下那份预设**（导入 ≠ 应用）。不做这两步，新机器上壁纸引擎就是出厂状态，而面板「待同步」却显示 0 —— 属**静默失败**。配置仓的 README 与 AGENT-GUIDE.md 都补了专节讲这件事（含四步流程与"资产段缺席 = 保持现值不动"等语义）。
>
> **⑤ 测试**：同步引擎 178 → **188** 用例全通过（第 12 段重写为「只收 FISH.json」并加了「本机删掉快照后仓库那份如实算成 removed」的回归；第 14b 段从「字体集 / 吉祥物随配置走」改为「资产已内嵌、素材目录不再采集」）。其余 5 个测试文件同样全绿（其中 3 个需在非沙箱环境跑，沙箱下 `spawn git` 必然 EPERM）。
>
> 同时把配置仓 `dsh-sync.ps1` 的白名单对齐到 0.3.3 —— 顺带补上了此前落后的 0.2.7～0.3.2 条目（`skill-refs`、`dsh-session-title-refresh/config.json`、`our-free-model` 四份），并把密钥体检的目标路径从写死的 `profiles\web` 改为按 profile 目录动态枚举（写死 web 在桌面版下等于「压根没扫」，比不扫更危险）。

---

> **0.7.5（2026-10-11）**：`dsh-agent-teams-fish` **0.5.0 → 0.5.1**（依赖范围 `^0.5.0` → **`^0.5.1`**）—— **降级链修正 + 厂商识别细化**。
>
> **① 降级链缺陷（本版重点）**：原链是 `vendor+role → role → vendor`，而岗位通用图（随包 8 张鲸鱼）对**每一个**岗位都存在，所以「岗位」那一跳**永远**抢先命中，「厂商」那一跳是死代码。现场症状正是「**头像右下角徽标已是 StepFun 商标，头像本体却是通用岗位鲸鱼**」—— 厂商识别本身没错，坏的是链序。后果两条：只有厂商通用图的 **7 家**（`meta` / `mistral` / `rwkv` / `seed` / `ernie` / `stepfun` / `jev`）厂商角色**永久不可达**；`member-<vendor>-full-v2.webp`（**17 张**厂商立绘）永远轮不到，点击放大只拿到 256 岗位头像。0.5.1 改为 **`vendor+role → vendor → role`**：厂商身份是这套头像的主诉求，厂商优先，岗位图仍留链尾兜底。
>
> **② 门禁为何没抓到**：当时只钉了**第 1 跳**（`vendor+role` 必须命中自己那张），而事故发生在第 2 跳。0.5.1 补 3 条断言：第 2 跳必须落自家 `member-<vendor>-v2.png`、**厂商跳下标必须小于岗位跳**（覆盖全部 17 厂商 × 10 岗位）、`-full` 链必须优先厂商立绘。
>
> **③ 识别细化（按各厂商官方文档补漏命中）**：`stepfun` 补**字母家族**（`step-asr` / `step-tts-mini` / `step-r1-v-mini` / `step-video-t2v`）与 `stepaudio-*` —— 旧规则 `step[-_.]?\d` 要求 step 后跟**数字**，这些官方 ID 整片漏；`glm` 补 `charglm` / `codegeex` / `cogview` / `cogvideo` 与平台名 `bigmodel`；`qwen` 补 `dashscope` / `aliyun`；`gemini` 补 `palm-<数字>` / `bison` / `gecko` / `vertex`；`seed` 补 `byteplus` / `skylark`；`minimax` 补 `speech-<数字>`；并把 `\bern` **收紧**为 `\bernie`，避免把 `ernest` / `ernestine` 判成文心一言。刻意不吞 `stepper` / `steps` / `stepstone` / `palmyra-x5` / `metaphor-3` / `jevons` 等，均有单测钉住。
>
> 详见 [dsh-agent-teams-fish v0.5.1](https://github.com/Fish-under-sea/dsh-agent-teams-fish/blob/main/release-notes/v0.5.1.md)。

---

> **0.7.4（2026-10-11）**：`dsh-agent-teams-fish` **0.4.3 → 0.5.0**（依赖范围 `^0.4.3` → **`^0.5.0`**）—— **第三轮厂商素材**。厂商命名空间 **15 → 17**，新增 **StepFun（阶跃星辰）** 与 **Jev（TypeSafe System One）**，随包素材 **280 → 286 个文件 / 约 29.3 MB**。
>
> **① 档位**：两家都只有「厂商通用图 + 立绘高清」，与既有 `meta` / `mistral` / `rwkv` / `seed` / `ernie` 同档。成员请求 `member-<vendor>-<role>-v2.png` 时第 1 跳落空，随后由 [0.5.1](https://github.com/Fish-under-sea/dsh-agent-teams-fish/blob/main/release-notes/v0.5.1.md) 修正为**第 2 跳命中自家厂商角色**（0.5.0 当时误落岗位通用图 —— 那正是 0.5.1 修掉的链序缺陷）。本机暂无这两家的 Q 版岗位图，属预期兜底，不是缺素材事故。
>
> **② 识别规则**：`stepfun` 同时认 provider 名、`step-<数字>` 模型族与中文「阶跃」。**模型族那一条是必需的**：本机三条 Step 路由（[模型配置清单](模型配置清单.md) 的 S1 / S2 / S3）的 provider 段是 `cn-f/cline/cline-free` 这类，**没有一个字母是 stepfun**，而 model 是 `step-5-preview`，只认 provider 名会让整队掉兜底头像 —— 与 [0.4.1](https://github.com/Fish-under-sea/dsh-agent-teams-fish/blob/main/release-notes/v0.4.1.md) 修掉的 `hunyuan3` / `rwkv7` / `seed1.6` 是**同一类病根**。`jev` 认 `jev` / `typesafe` / `type-safe`，两者都保留词边界，`stepper` / `steps` / `stepstone` / `jevons` 一类普通词不会被误吞（单测钉住）。
>
> **③ ⚠️ `brand-jev.svg` 是占位字标，不是官方商标**：TypeSafe / Jev 无公开商标（simple-icons 与 LobeHub icons 均 404），而插件门禁 `every vendor ships its own artwork tier` **强制每个厂商必须有 `brand-<vendor>.svg`**。故按既有归一化口径（墨迹框最大边缩到 0.84×24、居中）自制「J」字标并注入品牌色；拿到官方素材后直接替换同名文件即可。`brand-stepfun.svg` 取自 LobeHub icons 官方单色 path，无此问题。
>
> 详见 [dsh-agent-teams-fish v0.5.0](https://github.com/Fish-under-sea/dsh-agent-teams-fish/blob/main/release-notes/v0.5.0.md)。

---

> **0.7.3（2026-10-10）**：`dsh-agent-teams-fish` **0.4.2 → 0.4.3**（依赖范围 `^0.4.2` → **`^0.4.3`**）—— **纯文档修正，二进制与 0.4.2 等价**。[0.4.2](https://github.com/Fish-under-sea/dsh-agent-teams-fish/blob/main/release-notes/v0.4.2.md) 修了「队长头像跟随路由」，但 README 的「已知限制」表里漏改了「队长不跟随模型路由」那一行，同一份文档里新旧说法并存，而那句「想自动跟随需给快照加字段」描述的正是 0.4.2 已做完的事。代码没有问题，问题在于 **npm 包内 README 在 `npm publish` 那一刻就冻结、事后无法修改** —— 所以只能补发一版把正确文案带上 npm。本版 `lib/` 运行时代码与 0.4.2 逐字节相同，升上来只是为了让 npm 页面上的文档不再自相矛盾。详见 [v0.4.3](https://github.com/Fish-under-sea/dsh-agent-teams-fish/blob/main/release-notes/v0.4.3.md)。

---

> **0.7.2（2026-10-10）**：两个成员同时升级 —— `@fish-under-sea/dsh-session-title-refresh` **0.3.2**（依赖范围 `^0.3.1` → **`^0.3.2`**）与 `dsh-agent-teams-fish` **0.4.2**（依赖范围 `^0.4.0` → **`^0.4.2`**）。
>
> **① `session-title-refresh` 0.3.2 —— 修掉「标题模型不支持 off 档时，每一次自动命名都报 UNSUPPORTED_REASONING_EFFORT」**。症状：`provider "hy-f" model "buddy/hy3" does not support reasoning effort "off"`，标题功能整个失效。根因是 0.3.1 的修复引入了新缺陷：为了修「思考吃光输出预算」而**无条件**传 `reasoningEffort: 'off'`，但 **DSH 核心对显式档位是硬校验、不做任何降级**（`dsh-llm` 的 `resolveCallWithInfo`：模型没声明该档位就直接抛；模型连 reasoning 元数据都没有时传任何档位同样抛），而 `dsh-llm-pi-ai` 会把**未声明的档位一律钉成不支持**。0.3.1 那行代码的注释写着「不支持该档位的通道会退化成自己的默认档，不会报错」——**这句是错的**。用真实配置复现：58 个模型里 **33 个**（gpt / claude / kimi / glm / hy3 / minimax / mimo 等）在 0.3.1 下每一次命名都必然失败。0.3.2 改为**先探测再表态**：调 `ctx.llm.resolveModelInfo()`（与派发校验同源）读该模型真实档位，能关思考就传 `off`、关不掉退到它支持的**最低**档、连元数据都没有才完全不传该字段；探测结果按 provider/model 缓存，探测失败也只退回不传档位。同时纠正一处事实：`purpose: 'session-title'` **只有**官方 `dsh-llm-deepseek` 消费，`dsh-llm-pi-ai` 完全不看它——所以在 pi-ai 通道上不传档位等于放任思考吃掉预算，这正是必须显式表态的原因。core 25 + host 25 + client 13 = **63** 用例全通过（新增 core 6 条 + host 5 条回归）。
>
> **② `dsh-agent-teams-fish` 0.4.2 —— 修掉「队长头像永远是 DeepSeek 那张」**。队长换成 qwen / claude / glm 后，面板里的队长头像始终不变。根因不是缺素材（10 个厂商的队长图早在包里），而是**客户端把队长图写死成常量** `team-lead-deepseek-v2.png`，三处渲染点直接引用，从不看队长实际跑在哪个模型上——于是 `team-lead-qwen-v2.png` 等另外 9 张**永远不可达**。更深一层，宿主端 `team.json` 只记 `captainSessionId`（队长是拥有团队的会话本身，不是成员），**根本没有队长的模型路由**，客户端想算也无从算起。0.4.2 建队时写入 `captainProvider` / `captainModel`，快照暴露（实时值优先，换模型即时跟随），客户端走与成员同一套厂商识别；未知厂商回落随包队长图。老团队记录（无该字段）读取照旧，素材与降级链零改动。artwork-role-match 30 → **34** 用例，`verify.mjs` 新增 2 条门禁并已注入缺陷验证有效性。

---

> **0.7.1（2026-10-10）**：**修掉「第八个成员装不上」** —— `dsh-our-free-model` 已发布到 npm **官方源**（`2.0.0`），本包对它的依赖由 `github:Fish-under-sea/dsh-our-free-model-fish` 改为 **`^2.0.0`**。根因：pnpm 11 **默认启用** `blockExoticSubdeps`，**禁止子依赖使用 git / file / link 协议**，于是 0.7.0 在任何默认配置的机器上都以 `ERR_PNPM_EXOTIC_SUBDEP` 失败 —— 只有让用户关掉 `blockExoticSubdeps` 才能装。改用 registry 版本后不再触发该保护，**不需要用户放宽任何安全设置**。功能零变化：0.7.0 相对 0.6.11 的唯一改动就是新增这个成员。
>
> 同步更新：`dsh-our-free-model` 的 `package.json` 移除 `private: true`（它只用于拦误发布，不影响清单内容）；本仓库 `package.json`（0.7.0 → **0.7.1**、依赖改 `^2.0.0`）；README 中英双语（安装说明、`[NOT_FOUND]` 镜像同步清单、版本号）。

---

> **0.7.0（2026-10-10）**：新增**第八个成员** —— `dsh-our-free-model`（上游 [Ebony-Vinyl/dsh-our-free-model](https://github.com/Ebony-Vinyl/dsh-our-free-model) 的 **Fork**，仓库 [Fish-under-sea/dsh-our-free-model-fish](https://github.com/Fish-under-sea/dsh-our-free-model-fish)，依赖 `github:Fish-under-sea/dsh-our-free-model-fish`）。本 Fork 新增「**隐藏渠道模型分组**」总开关：渠道包向模型选择器贡献 13 个 provider 分组（CodeArts / CodeBuddy / Loomy / Raccoon / MiniMax / Gemini 等），与用户自己在 profile 里配的 provider 混在一起把选择器撑长 —— 打开开关即一次收起 13 组。**只影响展示、不影响路由**：网关请求走 `resolveModelInfo()`，被隐藏的模型照常收发；渠道设置页的「显示列表」「关闭全部」读 `listAllModels()`，同样不受影响；默认**关闭**，升级不会静默改变用户看到的列表。开关位置：设置 → 免费模型 → 偏好（`our-free-model/settings.json` 的 `hideChannelModels`，该文件已在 `git-sync` 白名单里，跨机复原）。上游 contributor 模式 36/37 通过（`upgrade-ui` 在改动前即失败）。
>
> ⚠️ **升级注意（必须改一处 profile）**：本包现在插入 `id: our-free-model` 行，而 `dsh-our-free-model` 自己的 bundle 层插入的是**同一个 id** —— `composeEntries` 只做 `push`、**不去重**，两边都生效即**重复挂载、启动失败**。所以升级到 0.7.0 时必须把该包从 profile 的 `dsh.profile.bundles` 移走（或从 `dependencies` 挪到 `devDependencies`）。本仓库既有约定本就要求子包写在 `devDependencies`，这一条对第八个成员尤其要紧。
>
> 同步更新：`package.json`（0.6.11 → **0.7.0**，新增 `dsh-our-free-model` 依赖）、`cordis.patch.yml`（插入第八行）、README 中英双语（成员表、安装示例、配置表、仓库结构、许可与出处、成员数量 七 → 八）。

---

> **0.6.10（2026-10-10）**：`@fish-under-sea/dsh-git-sync` **0.3.1**（依赖范围 `^0.3.0` → **`^0.3.1`**）—— 同步范围纳入**免费模型插件（`our-free-model`）的配置面**三份文件：`settings.json`（开关 / 探测间隔 / 转发 / 出口 / 渠道网关 / 默认 maxTokens）、`catalog.json`（模型目录快照）、`availability.json`（可用性快照）。**刻意排除两份**：`stats.json` 是本机累计用量账本，跨机互相覆盖会让两边统计双双失真且换机无复原价值；`eac-user.json` 含**真实登录 token 与 GitHub 登录名**，属凭据——与 `.credentials.yaml` 同理由 **U 盘手工拷贝**，并同时进 `NEVER_COPY` 作纵深防御（白名单哪天被改成整目录也拦得住）。同步引擎用例 120 → **152** 全通过（新增 32 条覆盖「只搬配置、不搬账本与凭据」）。同时：README 顶部只保留**最新一版**，历史条目归档到 [CHANGELOG.md](CHANGELOG.md)。
>
> **0.6.9（2026-10-10）**：`@fish-under-sea/dsh-session-title-refresh` **0.3.1**（依赖范围 `^0.3.0` → **`^0.3.1`**）—— **修掉「每一次自动命名都报 max-tokens」**。症状：所有会话的自动命名与手动刷新全部失败，记录里清一色 `标题模型结束原因异常（max-tokens）`。根因是三层叠加：① 标题调用**没有显式关思考**（官方 provider 在 `purpose === 'session-title'` 时会强制 `effort='off'`，本插件自己发起的辅助调用漏了这一层）；② 输出预算默认只有 **64** token，思考型标题模型的 reasoning 直接把它吃光；③ 装配层对结束原因**一刀切**——`finish !== 'stop'` 就抛错保留旧标题，于是「预算撞顶」被当成「模型异常」。0.3.1 三处一起修：标题调用显式传 `reasoningEffort: 'off'`；默认输出预算 64 → **256**；`max-tokens` 收尾时**有正文就接受截断结果**（标题短，截断通常只影响尾部标点 / 空白），只有正文为空才判失败。core 19 + host 20 + client 13 = 52 用例全通过（新增 3 条回归：必须传 `reasoningEffort`、有正文的 `max-tokens` 要接受、默认预算 ≥ 256）。
>
> **0.6.8（2026-10-08）**：七份 README 全部**中英双语化 + 统一美化**（居中标徽章块、固定章节顺序、去 emoji 章节前缀、语言切换行）；各子包 `files` 均纳入 `README.en.md`。
>
> `@fish-under-sea/dsh-git-sync` **0.3.0**：新增**额外扫描根**——白名单条目可用根前缀指向 `$DSH_HOME` 之外的目录，本版收录壁纸引擎的 `config.json` 与玻璃预设（取自 `~/.dsh-wallpaper-engine`，与 DSH home **同级**）；同时把原来散在五处（采集 / 还原 / 差异比较 / 密钥体检 / 面板统计）的白名单循环收敛为唯一入口 `entriesOf()`。同步引擎 120 用例、设置页客户端 37 用例全通过。
>
> `@fish-under-sea/dsh-session-title-refresh` **0.3.0**：设置页新增「**标题模型（可选）**」下拉（与官方「模型」页同源，`ctx.llm.listProviders()` + `listModels()`，经只读同源路由 `GET …/api/models` 下发）；目录只作建议不作约束，目录外组合走「自定义…」手填；单 provider 读失败只记 `skipped`、整个 llm 不可用回 `ok:false`，两条降级都退回手填、**绝不把设置页打挂**。core 18 + host 20 + client 13 = 51 用例全通过。
>
> `@fish-under-sea/dsh-visual-companion` **0.1.7**：加载日志里的版本号改为**从 `package.json` 现读**（原写死 `v0.1.2`，会随版本漂移）；`bin/` 头部注释的 Node 要求改为与 `engines` 一致。
>
> `@fish-under-sea/dsh-approval-guide` **0.2.2** / `@fish-under-sea/dsh-settings-nav-order` **0.1.5**：文档版（双语 README）。
>
> `dsh-agent-teams-fish` **0.4.0**：第二轮美术素材——厂商命名空间 9 → **15**、岗位桶 8 → **10**，随包素材 123 → **280 个文件 / 约 28.6 MB**；新增 1024×1024 高清族（WebP）。
>
> `dsh-better-reasoning-effort-fish` **0.5.7**：修正 `FORK.md` / `NOTICE.md` 与 `package.json` 里多了一个连字符的仓库名（`-dsh-better-reasoning-effort-fish` → `dsh-better-reasoning-effort-fish`，原链接 404）；补上 `dsh.engines.dsh` 声明。
>
> **0.6.7（2026-10-07）**：`dsh-agent-teams-fish` **0.3.2**（依赖范围 `^0.3.1` → **`^0.3.2`**）—— **修掉厂商徽标静默消失**。0.3.1 把厂商素材放进包内（其中 9 个是 `brand-<vendor>.svg`），但宿主端对**包内**素材写死了 `content-type: image/png` → 浏览器解码 SVG 失败 → 徽标 `onError` 回落活动状态图，看起来就像「SVG 根本没进包」；只有「没有 `artworkDir`、纯吃包内素材」的机器看得见（配了自定义目录的走扩展名表，一直是对的）。0.3.2 改为**按扩展名推断媒体类型**，并新增两条门禁断言：包内素材的媒体类型必须与扩展名一致、每个厂商商标必须以 svg document 送达（做过变异验证：把 MIME 改回 `image/png` 立即失败并点名 9 个 `brand-*.svg`）。**范围说明**：`^0.3.1` 本就涵盖 0.3.2，显式提到 `^0.3.2` 是为了让新 lock 与上表都落到这一版。
>
> **0.6.6（2026-10-07）**：`dsh-agent-teams-fish` **0.3.1**（依赖范围 `^0.3.0` → **`^0.3.1`**）—— **厂商头像素材改为随包分发**。此前 108 张厂商素材（9 厂商 × 8 岗位 + 厂商通用图 + 512 立绘 + 队长立绘 + 商标 SVG）只存在于当初那台机器的 `artworkDir` **绝对路径**下：npm 包只带 15 张内置鲸鱼图，仓库里也没有它们，于是**换一台机器后候选链全部落空、整队回落成内置鲸鱼头像**。0.3.1 把它们连同导入脚本与打包门禁一起进包（15 张内置基线不变，包体积约 +8 MB），装完即有厂商头像，跨机不再需要配 `artworkDir`；门禁也从「目录恰好 15 个名字」改为「必须含 15 张基线 + 只接纳已知美术族」，并新增**厂商整套在位 / 首选候选可达 / 尺寸格式 / 商标离线自洽**四组断言。**范围说明**：`^0.3.0` 本就涵盖 0.3.1（`>=0.3.0 <0.4.0`），本次显式提到 `^0.3.1` 是为了让新 lock 与上表都明确落到这一版。
>
> **0.6.5（2026-10-07）**：`@fish-under-sea/dsh-visual-companion` **0.1.5**（依赖范围 `^0.1.4` → **`^0.1.5`**）—— **修掉「加载即自动绑定」把整条插件打成「异常」的崩溃**。症状：插件面板里这一条显示红点「异常」，而 `visual_companion` 工具与 `/companion` 命令一起消失。原因：`watchDir` 指向的 `<watchDir>/state` 还不存在时（全新工作区、这个目录还没被伴侣服务创建过），`arm()` 直接 `fs.watch` 该路径**同步抛 ENOENT** —— Windows 实测 `fs.watch` 对不存在的路径是**抛错**而不是发 `error` 事件，所以原先紧跟其后的 `.on('error')` 兜不住，异常一路冒到 cordis 的 `apply()`，条目被判「未激活」。现在绑定前先 `mkdir` 递归自建目录，并把观察失败降级为一条告警、状态如实留成「未绑定」——**插件照常加载**，工具与命令都在；`visual_companion({action:"arm"})` 也改为绑不上就如实回 `arm 失败`（此前无论成败都回「已绑定」）。用例 8 → 10（新增两条：目录不存在要自建并绑定、路径不是目录要降级告警且不掉线）。
>
> **0.6.4（2026-10-07，补记）**：`@fish-under-sea/dsh-git-sync` **0.2.7**（依赖范围 `^0.2.6` → **`^0.2.7`**）—— 同步白名单纳入 **`skill-refs/`**（Skill 的参考研究文件随配置仓跨机复原；此前的白名单只收 `skills/` 本体）。**本条是补记**：该版当天已先发到 npm，但没在主分支留下条目与 tag（tag 只到 `v0.6.3-dsh0.2.0rc2`），所以版本号在这里补上说明。
>
> **0.6.3（2026-10-06）**：`@fish-under-sea/dsh-git-sync` **0.2.6**（依赖范围提到 `^0.2.6`）—— **同步范围再撤一条** `dsh-session-archive/`（`@linxin666/dsh-session-archive` 的归档台账与运行状态）。它是**纯本机状态**：记「哪些会话何时被归档」，而会话本身永久不跨机同步，台账换机后没有意义；自动归档的**策略**在 `profiles/<profile>/cordis.patch.yml` 里、那份是同步的，新机器会自己重新记账。它此前还制造了一个假象：配置仓的 `.gitignore` 恰好也排除它，于是「复制进仓库却永远不提交」，面板却显示待同步 0。同步引擎用例 83 → 86。
>
> **0.6.2（2026-10-06）**：**文档修正版**（无代码改动）—— `@fish-under-sea/dsh-settings-nav-order` **0.1.4** 把 README 顶部的半边徽章从 `client-only` 改成 **`client + host`**（它从 0.1.2 起就有宿主半区：云同步桥就是宿主写的）；本 README 修掉一处**重复的 0.5.6 条目**与一处**混入正文的 0x07 控制字符**（早期脚本里 `\a` 转义被当字面量写进文件，导致那行显示成「gent-teams」）。npm 的 README 是发布时冻结的，所以这类修正必须发版才能在包页面上生效。
>
> **0.6.1（2026-10-06）**：`dsh-agent-teams-fish` **0.3.0**（依赖范围 `^0.1.29` → **`^0.3.0`**）—— 该包版本号从 `0.1.x` 收束到 `0.3.0`，把 `0.1.25`–`0.1.29` 的迭代（角色词表规范化与整队掉兜底头像修复、回滚客户端面板字典修桌面端 renderer 启动失败、斜杠命令说明统一为`中文标签 · 说明`、README 重排）与配套发布说明、GitHub tag 一并补齐。**本包唯一的改动就是依赖范围**：`^0.1.29` 属 `0.1.x` 区间，**解析不到 0.3.0**，因此必须发新版才能让聚合包带出 0.3.0。
>
> **0.6.0（2026-10-06）**：`@fish-under-sea/dsh-git-sync` **0.2.5**（依赖范围提到 `^0.2.5`）—— **同步范围撤下三条**：`agent 预设（.agent-presets/）`、`桌宠存档（pet.json）`、`工作区映射（storages/workspace.json）`。前两者本机不用（桌宠插件未启用），后者含**机器相关绝对路径**、换机后本就该由那台机器自己生成——同步它只会制造「换机后工作区指向不存在的位置」的噪声。采集与还原双向都不再碰这三条（**已提交的旧文件仍留在仓库历史里**，想恢复同步把 `WHITE_LIST` 对应行加回即可）。同步引擎用例 69→83。**本版按 minor 号发布**：0.5.12 与它是同一批改动，为清晰起见合成 0.6.0。
>
> **0.5.11（2026-10-06）**：`@fish-under-sea/dsh-visual-companion` **0.1.4**（依赖范围提到 `^0.1.4`）—— **仅开发依赖**：把该包测试真正需要的 3 个 DSH 包（`@deepseek-ai/dsh-llm` / `dsh-tools` / `schemastery`）另以 `devDependencies` 声明。它们此前只是**可选 peer**（运行时由 DSH 提供），测试却依赖手工塞进 `node_modules` 的那一份，全新 clone 直接 `pnpm install` 跑测试会 `ERR_MODULE_NOT_FOUND`；现在可复现。**运行时零变化**（`lib/` 与 `cordis.patch.yml` 未动），也顺手把该包 README 的用例数从 7 修正为 8。
>
> **0.5.10（2026-10-06）**：`@fish-under-sea/dsh-git-sync` **0.2.4**（依赖范围提到 `^0.2.4`）—— 修掉实机撞到的「换机后第一次同步必失败」：全新机器没有 `user.name` / `user.email` 时 `git commit` 被 git 直接拒绝（`Author identity unknown`），旧版却把它笼统报成「推送失败」；现在提交前探一次身份，缺失就按 **origin 的 GitHub 主人名**提交（`<主人>@users.noreply.github.com`，与仓库既有提交一致），拿不到 origin 就用「登录名 @ 主机名」，并在面板日志里写明用了谁；**配了身份的机器完全不受影响**。提交链路每一步失败都改回单行可读日志（不再把整段 git stderr 塞进 500 的 error 字段）。新增 7 个真实仓库用例（`test/commit-identity.test.mjs`）。
>
> **0.5.9（2026-10-06）**：`@fish-under-sea/dsh-settings-nav-order` **0.1.3**（依赖范围提到 `^0.1.3`）—— 审查后收尾：宿主写盘/读盘的失败与意外错误一律在日志里留痕（宿主侧 `ctx.logger.warn`、浏览器侧只在「响应拿到之后才抛」时记，宿主不可达这类预期失败不刷屏）；只读目标的原子写回退改为「先清只读位再改名」，**不再先删原文件**（消除理论上的丢失窗口）；`readBody` 补上中断（关标签页/断线）结算，避免 handler 悬挂。用例 47 个（客户端 53、宿主 17、git-sync 引擎 69）。
>
> **0.5.8（2026-10-06）**：给「设置导航顺序」补上**云同步桥** —— 偏好除浏览器 `localStorage` 外，另由 `@fish-under-sea/dsh-settings-nav-order` **0.1.2** 的宿主半区落成 `$DSH_HOME/dsh-settings-nav-order/state.json`（保存时写入、启动时回填；四情形对账规则，绝不静默丢弃本地未推送的改动；保存后如实回报宿主文件是否同步、写失败在宿主日志留痕），`@fish-under-sea/dsh-git-sync` **0.2.3** 的白名单收录该文件：**换机后设置菜单的顺序与隐藏项能随配置仓复原**。两个子包新增 46 个用例（settings-nav-order 客户端 36→52、宿主 17；git-sync 引擎 56→69）。
>
> **0.5.7（2026-10-05）**：两个斜杠命令的说明改为 `中文标签 · 说明` 格式（`/agent-teams` → 「智能体团队 · …」、`/companion` → 「视觉伴侣 · …」）。面板的**图标**与**中文标签前缀**由核心包 dsh-client-ui-commands 的写死表（HOST_FACES）提供，插件命令当前无扩展点，故用描述符文案逼近。
>
> **0.5.6（2026-10-05）**：`dsh-agent-teams-fish` **0.1.28** —— 回滚客户端面板字典（它导致桌面端 renderer 启动失败），指令中文化改由 Host 侧描述符承担（面板以内置兜底显示中文）；角色词表规范化仍保留在 0.1.27+。
>
> **0.5.5（2026-10-05）**：`dsh-agent-teams-fish` **0.1.27** —— 角色词表规范化（新增 `audio` / `video` 岗位桶，补 `author` / `写手` / `作者` 等漏词，并在工具描述里公布可选用词表，避免自造角色掉厂商兜底头像）；`@fish-under-sea/dsh-visual-companion` **0.1.2** —— 新增斜杠命令 **`/companion`**。
>
> **0.5.4（2026-10-05）**：纳入第七个成员 [`dsh-better-reasoning-effort-fish`](https://github.com/Fish-under-sea/dsh-better-reasoning-effort-fish) —— 「模型」页编辑卡里直接编辑每模型的思考强度与输入模态声明 + 一键自动适配（上游 `dsh-better-reasoning-effort` 的 Fork）；依赖范围 `^0.5.5`。
>
> **0.5.3（2026-10-05）**：跟随 `dsh-agent-teams-fish` **0.1.25**（README 统一美化与更新），依赖范围提到 `^0.1.25`。
>
> **0.5.2（2026-10-05）**：新增第六个成员 [`dsh-visual-companion`](packages/dsh-visual-companion) —— 在网页上看原型 / 比布局，点选 + 备注后按「提交给助手」，会话自动收到一条用户消息并起一轮，点选过程静默；六个 README 统一美化；五个子包升补丁版。
