# dsh-git-sync

给 DeepSeek Harness Web GUI 的**一键 GitHub 同步**插件。把你的 DSH 环境——
**已安装的插件、每个插件是否启用、插件配置、本地设置、会话记录、附件**——
采集进你自己的**私有** git 仓库并推送，或在新机器上一键还原。

> **新机器请不必动api设置：DEEPSEEK_API_KEY、BAILIAN_API_KEY、BAILIAN_HE_API_KEY。**

---

## 它解决什么

DSH 把所有用户状态收敛在单个 home 目录（`$DSH_HOME`，默认 `~/.dsh`）。
手动同步要记住一串路径、还要小心别把密钥推上去。这个插件把这件事变成
「设置 → Git 同步」里的几个按钮。

## 安装

```powershell
# 方式一（推荐）：link 安装 —— 仓库源码就是安装源
dsh plugin --profile web add "link:<仓库路径>/plugin"

# 方式二：拷贝安装（file:）—— 改完源码必须重装才生效
dsh plugin --profile web add "file:<仓库路径>/plugin"

# 方式三：从打包好的 tarball 安装
dsh plugin --profile web add "file:<仓库路径>/dsh-git-sync-0.1.0.tgz"
```

**为什么推荐 `link:`**：`file:` 是 pnpm 的**目录拷贝** —— 装完之后，
你在仓库里改 `plugin/lib/*.js` **不会**反映到已安装的那份，
重启也没用，必须重新 `add` 一次。`link:` 建的是目录联接（Junction），
仓库源码即安装源，以后改完只要重启 DSH 即可。

装完**重启 DSH**（插件行与设置页都是下次启动生效）。

> **换机提醒**：安装会把**本机绝对路径**写进 `profiles/web/package.json`
> （`"dsh-git-sync": "link:D:/…/plugin"`）。这个文件会被同步到另一台机器，
> 而那边没有这个目录，`dsh plugin install` 会在这一项上失败。
> 要么两台机器 clone 到同一路径，要么在新机器上先
> `dsh plugin --profile web remove dsh-git-sync` 再按本机路径 `add` 回去。

## 使用

打开 **设置 → Git 同步**：

| 按钮 | 作用 |
| --- | --- |
| **一键同步** | 采集 → 提交 → 推送，日常用这一个就够 |
| **仅采集并提交** | `~/.dsh` 的白名单内容 → 仓库目录，然后 `git add/commit`（**不推送**） |
| **从仓库还原到本机** | 仓库目录 → `~/.dsh`，覆盖前备份到仓库的 `_backup/` |
| **密钥体检** | 扫描将上传的文本文件 + 用 `.credentials.yaml` 里的真实密钥值做精确匹配 |
| **刷新** | 重新读取仓库状态 |

> **「一键同步」会补推之前没推上去的提交。** 推送失败（TLS 拦截、断网、凭据过期）
> 后不用做别的，**再点一次「一键同步」即可** —— 它判断的是「本地是否领先远端」，
> 而不是「本次是否产生了新提交」。
>
> 曾经有个隐蔽的 bug：旧代码只在本次产生新提交时才推送，于是推送失败后再点一键同步
> 会因为「本机已无变更」而永不重试，还回报成功。已修，并加了回归测试。
>
> **「仅采集并提交」是「先看后推」的闸口。** 它只提交、不推送，方便你先看差异
> 再决定要不要送上 GitHub。（`pushgit` 动作仍在 API 上保留，作为应急通道。）

面板里的开关：

- **含会话记录** — `~/.dsh/sessions`（zstd 二进制，只增不减、无法 diff）
- **含附件** — `~/.dsh/attachments`

单个文件读不到（被锁定、权限不足、或被文件策略拒绝）**只会跳过并在日志里列出，
不会中断整次同步**。

### 状态卡怎么看

| 卡片 | 含义 |
| --- | --- |
| **待同步** | **本机 ↔ 仓库的内容差异**（新增 / 变更 / 仓库多出）。为 0 表示两边一致 |
| **仓库内文件** | 仓库里已同步的载荷规模（文件数 · 体积）。**这不是待办量** |
| **工作区** | 仓库的 git 工作区是否干净、是否领先远端 |
| **分支 / 远端** | 当前分支与 `origin` URL |
| **上次运行** | 上一次动作、时间与成败 |

> **「待同步」与「工作区」要一起看**：待同步 = 0 且工作区干净 ⇒ 本机配置已完整
> 提交并推送到远端，没有什么可同步的。
>
> 早先版本把「仓库内文件数」标成了「待同步文件」，会让人误以为有几十个文件排队
> 等着上传 —— 已改。

**仓库目录**在面板里直接改、点「保存设置」即可。它存在
`$DSH_HOME/dsh-git-sync/config.json`——**故意放在同步范围之外**，
所以每台机器可以指向自己的克隆路径，不会被互相覆盖。

## 同步范围（白名单）

| 路径 | 含义 |
| --- | --- |
| `profiles/web/package.json` | 装了什么插件 + bundle 层顺序 |
| `profiles/web/cordis.patch.yml` | **每个插件是否启用**（`disabled:` 行）+ 配置覆盖 |
| `profiles/web/pnpm-lock.yaml` / `pnpm-workspace.yaml` | 精确版本与 pnpm 配置 |
| `settings.yaml` | 全局设置（主题、模型、provider、皮肤、桌宠…） |
| **`skills/`** | **Skill 目录**（`~/.dsh/skills`） |
| `.agent-presets/` | agent 预设 |
| `storages/workspace.json` | 工作区 ↔ 会话映射 |
| `task-board/`、`dsh-session-archive/`、`dsh-usage/` | 看板账本、归档状态、用量账本 |
| `pet.json`、`skin-center-active.json` | 桌宠、皮肤 |
| `sessions/`、`attachments/` | 会话记录与附件（可选开关） |

> **Skill 位置很关键。** DSH 会从多个根目录读 Skill：`<项目根>/.dsh/skills`、
> `<项目根>/.agents/skills`、`<DSH_HOME>/skills`、`~/.agents/skills`。
> 本插件只覆盖 **`<DSH_HOME>/skills`**（即 `~/.dsh/skills`）——所以 Skill 必须放在
> 用户级目录才会被同步。放在项目级 `.dsh/skills` 的不在同步范围内。

## 永不搬运

`.credentials.yaml` · `.env` · `*.pem` · `*.key` · `node_modules/` · `.pnpm/` ·
`profiles/web/cordis.yml`（派生的空根）· `storages/session_projcache/` ·
`.anonymous-user-id` · `.dshw-size.json` · `.dshw-usage.json` ·
`workspace-local-paths.json` · 各类 `*.bak*` / `*.pre-sync-*`

## 安全设计（三道闸）

1. **文件级硬黑名单**：路径任一段命中即拒绝。这是唯一不依赖内容判断的闸，
   `.credentials.yaml` 因此在结构上就不可能被搬运。
2. **提交前复查暂存区**：`git add` 后检查 `git diff --cached --name-only`，
   一旦出现密钥类文件名 → `git reset` 并中止提交。
3. **密钥体检**：读 `.credentials.yaml` 提取真实密钥值做**精确匹配**，
   叠加通用正则（`sk-…`、GitHub token、AWS key、私钥块、Bearer、`api_key:` 赋值）。

其他约束：**不做 force push、不重写历史**；git 以非交互方式运行
（`GIT_TERMINAL_PROMPT=0`），不会弹凭据窗口卡住宿主；API 路由只允许同源请求
（拒绝 `sec-fetch-site: cross-site`）。

## 已知限制

- **`workspace.json` 里是绝对路径**（如 `D:\Fish-code\DSH`）。换机后必须手工改，
  否则工作区指向不存在的位置。
- **会话是 zstd 压缩二进制**，git 无法 diff / 行级合并。两台机器同时改同一会话
  会二进制冲突，本插件不做内容级合并（需要那个能力请用社区插件）。
- **仓库只增不减**：会话是追加型数据，删本地不会缩小仓库。
- **装完插件后需要重启 DSH** 才能在设置页看到它。
- 依赖 `git` 在 PATH 中。若你的机器用 HTTPS 拦截式加速器
  （如 Watt Toolkit / SteamTools），git 可能报 TLS 错误——解决办法见仓库的
  `AGENT-GUIDE.md` §9.1。
- 主机半边的 `ctx.webServer` 路由是 **loopback + 同源** 保护，没有额外的鉴权层。
- **只覆盖用户级 Skill**（`~/.dsh/skills`）。项目级 `.dsh/skills`、`.agents/skills`
  与 `~/.agents/skills` 不在同步范围内。
- 刻意不同步：`skin-center/`（只有可再生的壁纸令牌缓存）、`*.bak*`、`*.lock`。

## 两个已修的坑（值得知道）

### 1. Windows 只读目标会让覆盖失败

`copyFileSync` 会把源文件的**只读属性带到目标**，而 Windows 的 `CopyFileW`
在目标已存在且带 `ReadOnly` 时直接返回 `ERROR_ACCESS_DENIED`。两者叠加的结果是
**「第一次采集成功，之后每次都失败」**，而且是在第一个只读文件上就中断整次同步。

处理：拷前清掉目标只读位；仍失败则删掉目标重来；拷后保持可写。
（实测：修复前仓库里有 108 个只读文件，修复后为 0，采集 0 跳过。）

### 2. 单个文件失败不该炸掉整次同步

插件跑在 DSH 宿主进程内，而会话与附件**正在被该进程写入**，
出现 `EBUSY` / `EPERM` 是常态。现在每个文件独立 `try/catch`，
失败记入 `skipped` 并在面板日志里列出，其余文件照常同步。

## 实现说明

- **零 npm 依赖**：只用 `node:` 内置模块。宿主 loader 在插件未导出 `Config`
  schema 时会把 `config` 原样透传（`if (!runtime.Config) return config`），
  所以这里不引入 schemastery。
- Web 半边用 `react.createElement` 手写，只 `require('react')`，
  不依赖任何 `@deepseek-ai/*` 客户端包。
- 宿主导出：`name` / `inject = ['webServer']` / `apply(ctx, config)`。
- Web 半导出：`inject = ['slots']` / `apply(ctx)`，向 `settings.section` 注册一页。

## 许可

MIT。