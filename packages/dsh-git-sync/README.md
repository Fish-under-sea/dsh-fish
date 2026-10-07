<div align="center">

# @fish-under-sea/dsh-git-sync

**一键把 DSH 配置面同步到私有 Git 仓库，换机还原**

[![npm](https://img.shields.io/npm/v/@fish-under-sea/dsh-git-sync?style=flat-square&label=npm&color=cb3837)](https://www.npmjs.com/package/@fish-under-sea/dsh-git-sync)
![license](https://img.shields.io/badge/license-MIT-green?style=flat-square)
![node](https://img.shields.io/badge/node-%3E%3D20-339933?style=flat-square)
![DSH](https://img.shields.io/badge/DSH-%3E%3D0.2.0--rc.2-4b6ef6?style=flat-square)
![plugin](https://img.shields.io/badge/plugin-client%20%2B%20host-6b7280?style=flat-square)

**简体中文** · [English](README.en.md)

</div>

---

## 解决什么问题

DSH 把所有用户状态收敛在单个 home 目录（`$DSH_HOME`，默认 `~/.dsh`）。手动同步要记住一串路径、还要小心别把密钥推上去。本插件把这件事变成「设置 → Git 同步」里的几个按钮——把你的 DSH 环境（已安装的插件、每个插件是否启用、插件配置、本地设置、Skill、看板账本、壁纸引擎设置）采集进你自己的**私有** Git 仓库并推送，或在新机器上一键还原。

## 效果

- **白名单采集**：只搬运配置面，密钥文件（`.credentials.yaml`）在硬黑名单里，永不搬运。
- **三道安全闸**：文件级硬黑名单 → 提交前复查暂存区 → 密钥体检（通用正则 + `.credentials.yaml` 精确匹配）。
- **远端合并**：采集 / 推送之前先 `git fetch`；远端领先且本机无提交时快进合并；两边都有提交时自动 `rebase`；冲突则回滚并如实报错，绝不留半合并状态。
- **补推语义**：推送与否按「本地是否领先远端」判断，而不是「本次是否产生了新提交」——推送失败后再点一次「一键同步」即可重试。
- **单文件容错**：单个文件读不到（被锁定、权限不足、或被文件策略拒绝）只会跳过并在日志里列出，不中断整次同步。
- **额外扫描根**（0.3.0）：白名单条目可以用「根前缀」指向 `$DSH_HOME` 之外的额外目录（当前用于壁纸引擎），仓库里落成同名子目录。
- **零 npm 依赖**：只用 `node:` 内置模块。

## 安装

```sh
# 方式一（推荐）：从 npm 安装
# --profile 后跟本机实际的 profile 名：桌面版是 desktop，Web 版是 web
dsh plugin --profile <profile> add @fish-under-sea/dsh-git-sync

# 方式二：link 安装（改源码开发时用）—— 仓库源码即安装源，改完重启 DSH 即生效
dsh plugin --profile <profile> add "link:<仓库路径>/packages/dsh-git-sync"

# 方式三：拷贝安装（file:）—— 改完源码必须重新 add 才生效
dsh plugin --profile <profile> add "file:<仓库路径>/packages/dsh-git-sync"
```

**怎么选**：日常使用走方式一（npm，版本可追溯、可 `update`）；要改源码时用方式二（`link:` 建的是目录联接，仓库源码即安装源，改完重启 DSH 即可）。`file:` 是 pnpm 的**目录拷贝**——装完之后改 `lib/*.js` **不会**反映到已安装的那份，重启也没用，必须重新 `add` 一次，只适合一次性试用。

装完**重启 DSH**（插件行与设置页都是下次启动生效）。

> **换机提醒**：安装会把**本机绝对路径**写进 `profiles/<profile>/package.json`（`"@fish-under-sea/dsh-git-sync": "link:D:/…/plugin"`）。这个文件会被同步到另一台机器，而那边没有这个目录，`dsh plugin install` 会在这一项上失败。要么两台机器 clone 到同一路径，要么在新机器上先 `dsh plugin --profile web remove @fish-under-sea/dsh-git-sync` 再按本机路径 `add` 回去。

## 使用

打开 **设置 → Git 同步**：

| 按钮 | 作用 |
| --- | --- |
| **一键同步** | 先 `git fetch` 远端并自动合并，再采集 → 提交 → 推送，日常用这一个就够 |
| **仅采集并提交** | `$DSH_HOME` 的白名单内容 → 仓库目录，然后 `git add` / `commit`（**不推送**） |
| **从仓库还原到本机** | 仓库目录 → `$DSH_HOME`，覆盖前备份到仓库的 `_backup/` |
| **密钥体检** | 扫描将上传的文本文件 + 用 `.credentials.yaml` 里的真实密钥值做精确匹配 |
| **刷新** | 重新读取仓库状态 |

### 状态卡怎么看

| 卡片 | 含义 |
| --- | --- |
| **待同步** | **本机 ↔ 仓库的内容差异**（新增 / 变更 / 仓库多出）。为 0 表示两边一致 |
| **仓库内文件** | 仓库里已同步的载荷规模（文件数 · 体积）。**这不是待办量** |
| **工作区** | 仓库的 git 工作区是否干净、是否领先远端 |
| **分支 / 远端** | 当前分支与 `origin` URL |
| **上次运行** | 上一次动作、时间与成败 |

> **「待同步」与「工作区」要一起看**：待同步 = 0 且工作区干净 ⇒ 本机配置已完整提交并推送到远端，没有什么可同步的。早先版本把「仓库内文件数」标成了「待同步文件」，会让人误以为有几十个文件排队等着上传——已改。

### 关键语义

- **「一键同步」会补推之前没推上去的提交。** 推送与否按「本地是否领先远端」判断，而不是「本次是否产生了新提交」。推送失败（TLS 拦截、断网、凭据过期）后不用做别的，**再点一次「一键同步」即可**——曾经有个隐蔽的 bug：旧代码只在本次产生新提交时才推送，于是推送失败后再点一键同步会因为「本机已无变更」而永不重试，还回报成功。已修，并加了回归测试。
- **「仅采集并提交」是「先看后推」的闸口。** 它只提交、不推送，方便你先看差异再决定要不要送上 GitHub。（`pushgit` 动作仍在 API 上保留，作为应急通道。）
- **跨机同步不再需要手工救火。** 采集与推送之前会先 `git fetch` 远端：远端领先且本机没有提交时快进合并；两边都有提交时自动 `rebase`（保持线性历史）；遇到冲突则回滚到操作前并如实报错，绝不留半合并状态。此前只会 push，后果是远端一有新提交就永远卡在 `! [rejected] main -> main (fetch first)`；更隐蔽的是本机没有提交时 `@{u}` 引用陈旧，会**谎报**「本地与远端完全一致」而什么都不做。

## 配置

**仓库目录**在面板里直接改、点「保存设置」即可。它存在 `$DSH_HOME/dsh-git-sync/config.json`——**故意放在同步范围之外**，所以每台机器可以指向自己的克隆路径，不会被互相覆盖。

### 同步范围（白名单）

白名单列出相对 `$DSH_HOME` 的路径。`<profile>` 按目录动态枚举。

| 路径 | 含义 |
| --- | --- |
| `settings.yaml` | 0.1.x 口径的全局设置；0.2.0 起 home 下的它已被 patch layer 改名 `settings.yaml.imported`，该条目只在从 0.1.x 老机器迁移时有用 |
| `skin-center-active.json` | 皮肤中心当前激活项 |
| `skills/` | **Skill 目录**（`$DSH_HOME/skills`） |
| `skill-refs/` | Skill 的 refs 判据、可运行脚本与测试样本（0.2.7 起纳入） |
| `AGENTS.md` | 用户级全局指令 |
| `task-board/ledger-v2.json` | 看板账本 |
| `task-board/scheduler-v2.json` | 看板调度器状态 |
| `dsh-usage/` | 用量账本 |
| `dsh-settings-nav-order/state.json` | 设置导航顺序偏好（详见下方专节） |
| `profiles/<profile>/package.json` | 装了什么插件 + bundle 层顺序 |
| `profiles/<profile>/cordis.patch.yml` | **每个插件是否启用**（`disabled:` 行）+ 配置覆盖 |
| `profiles/<profile>/cordis.patch.yml.bak-plugin-manager` | 插件管理器写的配置备份（精确整路径放行，其它 `*.bak*` 仍一律拒绝） |
| `profiles/<profile>/pnpm-lock.yaml` | 精确版本，保证可复现 |
| `profiles/<profile>/pnpm-workspace.yaml` | pnpm 配置 |
| `wallpaper-engine/config.json` | 壁纸引擎全部设置（额外扫描根，详见下方专节） |
| `wallpaper-engine/glass-presets/` | 用户保存的玻璃预设（目录级收录，按额外扫描根） |

> **`<profile>` 按目录动态枚举**：本机 `profiles/` 下每个 profile 目录都会被覆盖，桌面版是 `desktop`、Web 版是 `web`。写死 profile 名会漏掉「装了什么插件 / 每个插件是否启用 / 精确版本」这最要紧的三样——0.2.0 桌面版踩过这个坑：profile 改名后白名单一条都命中不了，仓库里只剩 0.1.x 的 `profiles/web` 快照。

### 设置导航顺序

设置菜单的顺序与隐藏项**真正生效的地方是浏览器 `localStorage`**（键 `dsh-settings-nav-order/v1`），本插件在宿主进程里够不着它。[`dsh-settings-nav-order`](https://github.com/Fish-under-sea/dsh-fish/tree/main/packages/dsh-settings-nav-order) 的宿主半区因此把它镜像成 `$DSH_HOME/dsh-settings-nav-order/state.json`——用户每次保存时用自己那条同源路由写入，本插件只负责按相对路径搬运。少了这一条，换机后设置菜单的顺序与隐藏项就复原不了（剩下的都能复原）。

### 额外扫描根（0.3.0 新增）

白名单的口径是「相对 `$DSH_HOME` 的路径」，但 `dsh-plugin-wallpaper-engine`（壁纸引擎）把全部设置与素材放在 `~/.dsh-wallpaper-engine`——那是 `$DSH_HOME` 的**同级**目录，普通白名单条目无论怎么写都够不到它。

0.3.0 引入**额外扫描根**：白名单条目可以用「根前缀」指向额外根，仓库里落成同名子目录。代码里是一张 `EXTRA_ROOTS` 表，当前只有 `wallpaper-engine` 一项，可被环境变量 `DSH_WE_DATA_DIR` 覆盖，未设时落到 `~/.dsh-wallpaper-engine`。

本版收录两条：

- `wallpaper-engine/config.json` —— 壁纸引擎全部设置（外观、扩展、播放、壁纸库的隐藏与轮播）；
- `wallpaper-engine/glass-presets/` —— 用户保存的玻璃预设，按**目录**收录，以后新存的自动跟着走。

之所以「加扫描根」而不是「把文件搬进 home」：壁纸引擎的默认数据目录是**跨插件读契约**（皮肤中心靠 `<该目录>/config.json` 的 `settings.id` 预判「壁纸在台」），搬走会让皮肤侧首帧先闪一下。加扫描根完全不动生产路径。

明确**不**收录：壁纸引擎的 `cache/`（约 2.8 GB 派生缓存）、`ffmpeg/` 二进制、`bin/`、`diag/`、`avatars/`。

> **实现要点**：0.3.0 同时把原来散在五处（采集 / 还原 / 差异比较 / 密钥体检 / 面板统计）的白名单循环收敛成**唯一入口** `entriesOf(base, side)` ——否则「新增一种扫描口径只在其中一两处生效」是必然结局；本项目已经因为「多层防御各自为政」踩过两次（见 `isBakAllowed` 与 `.gitignore` 的注释），所以额外扫描根这件事必须只有一个落点。

### Skill 位置

DSH 会从多个根目录读 Skill：`<项目根>/.dsh/skills`、`<项目根>/.agents/skills`、`<DSH_HOME>/skills`、`~/.agents/skills`。本插件只覆盖 **`<DSH_HOME>/skills`**（即 `~/.dsh/skills`）——所以 Skill 必须放在用户级目录才会被同步。放在项目级 `.dsh/skills` 的不在同步范围内。

### 永不搬运

路径的任一段命中即拒绝：

- **精确文件名**：`.credentials.yaml` / `credentials.yaml` / `credentials.json` / `.env` / `node_modules` / `.pnpm` / `.git` / `session_projcache` / `.anonymous-user-id` / `.dshw-size.json` / `.dshw-usage.json` / `cordis.yml` / `workspace-local-paths.json`
- **后缀规则**：`*.bak*` / `*.pem` / `*.key` / `.credentials*`
- **唯一例外**：`profiles/<profile>/cordis.patch.yml.bak-plugin-manager`（插件管理器写的配置备份，换机复原时有用）按精确整路径放行，其它 `*.bak*` 仍一律拒绝

**不在范围内**：`sessions/`、`attachments/`（0.2.0 起永久排除）、**`.agent-presets/`、`pet.json`、`storages/workspace.json`（0.2.5 起撤下）**、**`dsh-session-archive/`（0.2.6 起撤下）**、`node_modules`、密钥文件、派生物（`cordis.yml`、`storages/session_projcache`）、本机状态（`.anonymous-user-id` 等）。

**0.2.5 撤下三条，理由各自独立**：

- `.agent-presets/` —— 不用自定义 agent 预设；
- `pet.json` —— 桌宠插件没启用，纯死文件；
- `storages/workspace.json` —— 里面是**机器相关的绝对路径**，搬到另一台机器本来也要手工改（见下方「兼容与边界」），同步它只会带来「换机后工作区指向不存在的位置」的噪声。

**0.2.6 再撤一条**：

- `dsh-session-archive/` —— [`@linxin666/dsh-session-archive`](https://www.npmjs.com/package/@linxin666/dsh-session-archive) 的**归档台账与运行状态**（`archive-ledger.json` + `state.json`）。它是**纯本机状态**：记「哪些会话何时被归档」，而会话本身永久不跨机同步（`sessions/`、`attachments/` 已排除），台账换机后没有意义；自动归档的**策略**在 `profiles/<profile>/cordis.patch.yml` 里、那份是同步的，新机器会自己重新记账。此前它还制造了一个假象：配置仓的 `.gitignore` 恰好也排除了它，于是「复制进仓库却永远不提交」，而面板显示待同步 0。

撤下的内容**仍留在本仓历史里**（`git log -- <路径>` 可取回）；想恢复同步，把对应的行加回 `WHITE_LIST` 即可。

> 侧记（2026-10-06 实测的一次教训）：白名单里**任何**被配置仓 `.gitignore` 排除的条目，都会变成「本地复制、永不提交、面板却显示已同步」的假象。改动白名单时顺手核对一遍仓库的 `.gitignore` 是值得的。

**同步范围 0.2.0 起收缩为「配置面」**：会话记录与附件**不再上传**。`sessions/` 是 zstd 二进制，只增不减、git 无法 diff 也无法行级合并，两台机器同时改必然冲突；`attachments/` 同理且属本机隐私数据。配置面换机后靠这一份清单 + 各自的会话副本复原即可。**已提交到仓库的旧会话文件不会被删除**（只停新增），历史保留可查。

### 安全设计（三道闸）

> **新机器请不必动 API 设置**：`DEEPSEEK_API_KEY`、`BAILIAN_API_KEY`、`BAILIAN_HE_API_KEY` 等密钥不在同步范围内，新机器上直接配即可。

1. **文件级硬黑名单**：路径任一段命中即拒绝。这是唯一不依赖内容判断的闸，`.credentials.yaml` 因此在结构上就不可能被搬运。
2. **提交前复查暂存区**：`git add` 后检查 `git diff --cached --name-only`，一旦出现密钥类文件名 → `git reset` 并中止提交。
3. **密钥体检**：读 `.credentials.yaml` 提取真实密钥值做**精确匹配**，叠加通用正则（`sk-…`、GitHub token、AWS key、私钥块、Bearer、`api_key:` 赋值）。

三道闸里前两道硬拦、第三道只告警。正则无法穷尽密钥形态，体检是辅助手段而非主闸——主闸是第一道的文件级拒绝。

其他约束：**不做 force push、不重写历史**；git 以非交互方式运行（`GIT_TERMINAL_PROMPT=0`），不会弹凭据窗口卡住宿主；API 路由只允许同源请求（拒绝 `sec-fetch-site: cross-site`）。

## 兼容与边界

- **工作区映射不再同步**（0.2.5 起）：`storages/workspace.json` 里是绝对路径（如 `D:\Fish-code\DSH`），换机后本来就该由那台机器自己生成；本插件既不采集它、也不在还原时覆盖它。
- **会话是 zstd 压缩二进制**，git 无法 diff / 行级合并。两台机器同时改同一会话会二进制冲突，本插件不做内容级合并。
- **仓库只增不减**：会话是追加型数据，删本地不会缩小仓库。
- **装完插件后需要重启 DSH** 才能在设置页看到它。
- 依赖 `git` 在 PATH 中。若你的机器用 HTTPS 拦截式加速器（如 Watt Toolkit / SteamTools），git 可能报 TLS 错误——解决办法见仓库的 `AGENT-GUIDE.md` §9.1。
- **本机没有 git 身份也能同步**：提交前会探一次 `user.name` / `user.email`，没有就临时用 origin 的 GitHub 主人名提交（详见下方「三个已修的坑」）。想固定成你自己的身份，在仓库里执行 `git config user.name` / `user.email` 即可。
- 主机半边的 `ctx.webServer` 路由是 **loopback + 同源**保护，没有额外的鉴权层。
- **只覆盖用户级 Skill**（`$DSH_HOME/skills`）。项目级 `.dsh/skills`、`.agents/skills` 与 `~/.agents/skills` 不在同步范围内。
- 刻意不同步：`skin-center/`（导入到壁纸库的**壁纸工程**——体积上百 MB，且能从本机 Wallpaper Engine 重新导入；其 `.cache/we-tokens.json` 里全是本机 Steam 绝对路径）、`*.bak*`。至于 `task-board/ledger-v2.lock` 这类锁文件：它们只是**不在白名单里**，所以同样不会被搬运，并非另有一条「锁文件规则」。

### 三个已修的坑

**本机没有 git 身份会让整次同步失败。** 全新机器上 `user.name` / `user.email` 都没有时，`git commit` 直接拒绝（`Author identity unknown … unable to auto-detect email address`）—— 而全新机器恰恰是「换机复原」最需要同步成功的一刻。0.2.3 及以前把这句报错笼统报成「推送失败」，面板上只显示「推送不行」，完全看不出真正原因。现在：提交前先探一次身份（`git var GIT_AUTHOR_IDENT`，与 `git commit` 同一套解析），没有就按 **origin 的 GitHub 主人名**提交（配成 `<主人>@users.noreply.github.com`，与仓库既有提交一致），拿不到 origin 就退到「本机登录名 @ 主机名」，并在面板日志里写明用了谁、怎么固定下来。**配了身份的机器完全不受影响**（连 `-c` 都不注入，作者就是你配置里的那个）。

**Windows 只读目标会让覆盖失败。** `copyFileSync` 会把源文件的**只读属性带到目标**，而 Windows 的 `CopyFileW` 在目标已存在且带 `ReadOnly` 时直接返回 `ERROR_ACCESS_DENIED`。两者叠加的结果是「第一次采集成功，之后每次都失败」。处理：拷前清掉目标只读位；仍失败则删掉目标重来；拷后保持可写。（实测：修复前仓库里有 108 个只读文件，修复后为 0，采集 0 跳过。）

**单个文件失败的不该炸掉整次同步。** 插件跑在 DSH 宿主进程内，而会话与附件**正在被该进程写入**，出现 `EBUSY` / `EPERM` 是常态。现在每个文件独立 `try/catch`，失败记入 `skipped` 并在面板日志里列出，其余文件照常同步。

## 开发与测试

- **零 npm 依赖**：只用 `node:` 内置模块。宿主 loader 在插件未导出 `Config` schema 时会把 `config` 原样透传（`if (!runtime.Config) return config`），所以这里不引入 schemastery。
- Web 半边用 `react.createElement` 手写，只 `require('react')`，不依赖任何 `@deepseek-ai/*` 客户端包。
- 宿主导出：`name` / `inject = ['webServer']` / `apply(ctx, config)`。
- Web 半导出：`inject = ['slots']` / `apply(ctx)`，向 `settings.section` 注册一页。

**测试**：同步引擎 **120 个用例全部通过**（`node test/test-sync-engine.mjs`）；设置页客户端 **37 个用例全部通过**（`node test/test-client.mjs`）。

本包没有配置 `scripts.test`；测试入口为六个文件：

```sh
node test/test-sync-engine.mjs      # 同步引擎：白名单 / 采集 / 还原 / 差异 / 拒绝闸
node test/test-client.mjs           # Web 半边渲染与文案断言
node test/client.test.mjs           # Web 半边装载冒烟（node:test）
node test/commit-identity.test.mjs  # 没有 git 身份时的提交回退（真实临时仓库 + 真实提交）
node test/test-push-retry.mjs       # 补推语义（真实远端）
node test/test-remote-merge.mjs     # 远端分叉时的快进 / rebase（真实远端）
```

> 直接 `node <测试文件>` 即可，**不要**用 `node --test test/`：测试运行器会派生子进程并捕获管道输出，在受限沙箱里会以 `EPERM` 失败。
>
> 后三个用例（`commit-identity.test.mjs` / `test-push-retry.mjs` / `test-remote-merge.mjs`）会 spawn 子进程调 `git`，在受限沙箱里以 `spawn EPERM` 失败——这是**环境限制**，不是代码问题；请在正常终端里跑它们。

## 与聚合包的关系

> 本包是 [`@fish-under-sea/dsh-fish`](https://github.com/Fish-under-sea/dsh-fish) 聚合包的成员之一；单独安装只影响这一项。

## 许可

MIT © Fish-under-sea
