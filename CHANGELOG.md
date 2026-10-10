# 更新记录

> `@fish-under-sea/dsh-fish` 聚合包的完整版本记录。README 顶部只保留最近一版，历史条目归档于此。

---

> **0.7.1（2026-10-10）**：**修掉「第八个成员装不上」** —— `dsh-our-free-model` 已发布到 npm **官方源**（`2.0.0`），本包对它的依赖由 `github:Fish-under-sea/Our-Free-Mode-fish` 改为 **`^2.0.0`**。根因：pnpm 11 **默认启用** `blockExoticSubdeps`，**禁止子依赖使用 git / file / link 协议**，于是 0.7.0 在任何默认配置的机器上都以 `ERR_PNPM_EXOTIC_SUBDEP` 失败 —— 只有让用户关掉 `blockExoticSubdeps` 才能装。改用 registry 版本后不再触发该保护，**不需要用户放宽任何安全设置**。功能零变化：0.7.0 相对 0.6.11 的唯一改动就是新增这个成员。
>
> 同步更新：`dsh-our-free-model` 的 `package.json` 移除 `private: true`（它只用于拦误发布，不影响清单内容）；本仓库 `package.json`（0.7.0 → **0.7.1**、依赖改 `^2.0.0`）；README 中英双语（安装说明、`[NOT_FOUND]` 镜像同步清单、版本号）。

---

> **0.7.0（2026-10-10）**：新增**第八个成员** —— `dsh-our-free-model`（上游 [Ebony-Vinyl/dsh-our-free-model](https://github.com/Ebony-Vinyl/dsh-our-free-model) 的 **Fork**，仓库 [Fish-under-sea/Our-Free-Mode-fish](https://github.com/Fish-under-sea/Our-Free-Mode-fish)，依赖 `github:Fish-under-sea/Our-Free-Mode-fish`）。本 Fork 新增「**隐藏渠道模型分组**」总开关：渠道包向模型选择器贡献 13 个 provider 分组（CodeArts / CodeBuddy / Loomy / Raccoon / MiniMax / Gemini 等），与用户自己在 profile 里配的 provider 混在一起把选择器撑长 —— 打开开关即一次收起 13 组。**只影响展示、不影响路由**：网关请求走 `resolveModelInfo()`，被隐藏的模型照常收发；渠道设置页的「显示列表」「关闭全部」读 `listAllModels()`，同样不受影响；默认**关闭**，升级不会静默改变用户看到的列表。开关位置：设置 → 免费模型 → 偏好（`our-free-model/settings.json` 的 `hideChannelModels`，该文件已在 `git-sync` 白名单里，跨机复原）。上游 contributor 模式 36/37 通过（`upgrade-ui` 在改动前即失败）。
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
