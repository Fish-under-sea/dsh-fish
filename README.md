<div align="center">

<img src="icon.png" alt="@fish-under-sea/dsh-fish" width="120">

# @fish-under-sea/dsh-fish

**一个包，装齐全部自建 DSH 插件**

[![npm](https://img.shields.io/npm/v/@fish-under-sea/dsh-fish?style=flat-square&label=npm&color=cb3837)](https://www.npmjs.com/package/@fish-under-sea/dsh-fish)
![license](https://img.shields.io/badge/license-MIT-green?style=flat-square)
![node](https://img.shields.io/badge/node-%3E%3D20-339933?style=flat-square)
![DSH](https://img.shields.io/badge/DSH-%3E%3D0.2.0--rc.2-4b6ef6?style=flat-square)
![bundle](https://img.shields.io/badge/kind-bundle-6b7280?style=flat-square)

**简体中文** · [English](README.en.md)

</div>

---

> **🆕 0.8.1（2026-10-12）**：**三个子包功能更新**（聚合包本身只升依赖范围）。
>
> - **`dsh-skill-lens-fish` 0.1.0 → 0.1.1**：修掉依赖图「文件名显示与点击打开」两个现场问题。① 节点名从完整路径改为**文件名** —— 原先按 24 字截断，`skill-refs/ai-asset-forge/...` 一类路径会被截成同一串，同目录多个节点看起来像重复；完整路径仍在悬停提示里。② **引用资源与扁平技能本体现在可以点开**：新增只读预览对话框（支持关闭、Escape、读取失败提示），原先 `clickable` 硬排除这两类节点，点了没反应。技能目录内的文件仍跳「文件」页签编辑。
> - **`dsh-usage` 0.4.6 → 0.4.7**：Token 银行新增**官方价目表假设行** —— 按当前 Flash 价目表对 **DeepSeek 官方家族** token 重算两次，分别假设全部调用落在高峰 / 空闲时段，给出两个金额作为假设成本上下界。明确标注**不是实际扣费**，只计官方家族（MiMo 与其它渠道无官方价目表、不计入），也不复用折叠时刻的 `cost`。
> - **`dsh-agent-teams-fish` 0.6.1 → 0.7.0**：厂商命名空间 **17 → 18**，新增 **MiMo（小米 MiMo）**，与 `stepfun` / `jev` 同档（只有厂商通用图 + 立绘高清）。识别规则 `mimo` / `mimo-*` / `xiaomi` / 小米，**边界**要求 `mimo` 后是词边界或分隔符 —— 既避免吞掉 `minimax` / `mistral`，也避免误吞 `mimosa` 这类普通英文词。
>> **🆕 0.8.0（2026-10-12）**：**并入 6 个上游全家桶插件（Fork）+ 1 个自建插件，成员数 7 → 14**。
>
> - **新增 6 个上游 Fork**：把 [zhu1090093659/dsh-web](https://github.com/zhu1090093659/dsh-web)（Apache-2.0）的**任务看板、Git 图谱、模型能力、SSH、用量统计、会话归档**六个插件 fork 进本仓库 `packages/`，以 `@fish-under-sea/*` 自主发布。
>   - **为什么 fork 而不只是引用**：上游这些包把 npm scope 与包名一起烧进了客户端 bundle 的模块注册 id，内核按 `package.json` 的 `name` 认领包 —— 两者不一致时浏览器半区（设置页 / 面板）整个不加载。所以必须改源码、重建 bundle，才能自主发版与后续跟随内核演进。
>   - **改了什么**：只改 scope 与遥测，功能与上游 `0.4.6` 等价。**已移除安装遥测**（上游会每日向 `dsh-market.com` 上报一次包名）；各包 `NOTICE` 记录了修改内容与来源。
>   - **⚠️ 与 `@linxin666/dsh-web-all` 共存**：见下文[「与 dsh-web-all 共存」](#与-dsh-web-all-共存要紧)。
> - **新增 1 个自建插件**：`@fish-under-sea/dsh-skill-lens-fish`（Skill Lens Fish 版，基于 x-feichen/dsh-skill-lens 改造：跟随 `$DSH_HOME`、识别扁平技能、解析 `skill-refs/` 引用并画进依赖图）。
> - **成员数 7 → 14**（5 个本仓库自建 + 6 个上游 Fork + 3 个外部补充版）；聚合包 patch 插入 **14 行**。
> >
> 更早的版本记录见 [CHANGELOG.md](CHANGELOG.md)。

---

## 这是什么

Fish 自建 [DSH](https://github.com/Fish-under-sea/DSH)（DeepSeek Harness）插件聚合包。根目录是**聚合包**，子插件源码在 `packages/` 下。聚合包靠自己的 bundle 层（`cordis.patch.yml`）把十四个插件的插件行**一次性插入** profile 的 roster —— 其中十一个是本仓库 `packages/` 下的自建插件与上游 Fork，另外三个是**外部补充版**：`dsh-agent-teams-fish`、`dsh-better-reasoning-effort-fish` 与 `dsh-our-free-model`（各自独立仓库，非本仓库子包）。

> **装一次 `@fish-under-sea/dsh-fish` ＝ 装齐十四个插件。**

**命名差异（容易踩）**：npm 包名 `@fish-under-sea/*` 带 scope，但仓库目录名（`dsh-fish/`）与 GitHub 仓库名（`Fish-under-sea/dsh-fish`）**不带**。

## 包含的插件

| 子包 | 版本 | 说明 |
|------|:----:|------|
| [`dsh-approval-guide`](packages/dsh-approval-guide) | 0.2.2 | 在审批弹窗里追加**中文说明**：这次审批会做什么、有什么风险、依据是什么 |
| [`dsh-git-sync`](packages/dsh-git-sync) | 0.4.0 | **一键 Git 同步**：把插件清单、启用状态、本地设置、Skills、看板/用量账本、设置导航顺序偏好、**免费模型插件配置及用量账本**与**壁纸引擎整机配置快照**（`$DSH_HOME/FISH.json`，资产本体已内嵌）同步到自己的私有仓库。**0.4.0 新增「导出私钥配置」**：把带凭据的几份配置（`channel-pack/` 的花名册 / 签到 / 账本、`.credentials.yaml`、`our-free-model/eac-user.json`）**纯本机**拷到指定目录（默认桌面）下的 `DSH私钥配置` 文件夹，并附一份说明 README —— 不碰 git、不发任何网络请求，凭据内容也不进日志；**这条通路与 git 同步完全分开**，因为凭据在同步硬黑名单里、永远不会随仓库走 |
| [`dsh-settings-nav-order`](packages/dsh-settings-nav-order) | 0.1.5 | **设置导航重排**：把设置面板左侧菜单排成自己要的顺序、把不想看的项收起来；偏好随 Git 同步插件**跨机复原** |
| [`dsh-visual-companion`](packages/dsh-visual-companion) | 0.1.7 | **视觉伴侣唤醒**：网页上看原型 / 比布局，点选 + 备注后按「提交给助手」，会话自动收到一条用户消息并起一轮 —— 不必回终端复述；**点选过程静默，只有提交才唤醒一次**（0.1.7 起加载日志的版本号从 `package.json` 现读，不再写死） |
| [`dsh-skill-lens-fish`](packages/dsh-skill-lens-fish) | 0.1.1 | **技能中枢 Skill Lens（Fish 版）**：在会话页签里浏览本机全部 Agent Skill。基于 [x-feichen/dsh-skill-lens](https://github.com/x-feichen/dsh-skill-lens)（MIT）改造：上游只认 `<名称>/SKILL.md` 且把全局根写死 `~/.dsh`（本机 DSH_HOME 是 `~/.dsh-beta`，扫描恒为空）；本版跟随 `$DSH_HOME`、识别扁平 `<名称>.md`，并把技能对 `skill-refs/` 等目录外共享资源的引用解析成真实路径、单列为依赖图的「引用资源」分类 |
| [`dsh-client-ui-task-board`](packages/dsh-client-ui-task-board) | 0.4.6 | **任务看板**（上游 `@linxin666/dsh-client-ui-task-board@0.4.6` 的 **Fork**，Apache-2.0）：Host 权威账本、五列看板（可拖拽/按状态切换）、子任务树级联执行、Host cron 定时、**执行前的验收门**（goal 形态，A/B 双轮判分）、Agent Team 团队执行、标签与「续接卡片」冻结快照、执行权限确认门。**已移除安装遥测** |
| [`dsh-client-ui-git-graph`](packages/dsh-client-ui-git-graph) | 0.4.6 | **Git 图谱与分支切换**（上游 `@linxin666/dsh-client-ui-git-graph@0.4.6` 的 **Fork**，Apache-2.0）：交互式提交图谱 + 空白会话里的分支选择胶囊（宿主侧真跑 `git switch`），带 Worktree 冲突守卫与可读报错；opt-in 的 `git_worktree` 模型工具作用于 `$DSH_HOME/worktrees/` 托管目录。**已移除安装遥测** |
| [`dsh-client-ui-model-capabilities`](packages/dsh-client-ui-model-capabilities) | 0.4.6 | **模型能力声明**（上游 `@linxin666/dsh-client-ui-model-capabilities@0.4.6` 的 **Fork**，Apache-2.0）：在官方「模型」页的提供方卡片里直接编辑**逐模型推理档位**（off→max 与发送值）与**图像输入声明**，写官方 `llm-pi-ai` 设置命名空间；提供方一键禁用/启用（存档后下线路由，密钥不受影响） |
| [`dsh-ssh`](packages/dsh-ssh) | 0.4.6 | **SSH 运维**（上游 `@linxin666/dsh-ssh@0.4.6` 的 **Fork**，Apache-2.0）：主机库（可一键导入 `~/.ssh/config`）、持久连接池与多级跳板机、exec 执行、xterm Web 终端、SFTP 上传下载、本地端口转发、集群执行；另带 `ssh_list` / `ssh_exec` / `ssh_upload` / `ssh_download` / `ssh_tunnel` / `ssh_cluster` 六个模型工具。主机配置存 `$DSH_HOME/dsh-ssh.json`。**已移除安装遥测** |
| [`dsh-usage`](packages/dsh-usage) | 0.4.7 | **用量统计**（上游 `@linxin666/dsh-usage@0.4.6` 的 **Fork**，Apache-2.0）：分 provider / 模型的 token 台账（输入/输出/缓存读/缓存写分桶）、余额与**编程套餐配额**（Kimi / GLM / OpenCode Go / MiniMax / Codex）、DeepSeek 峰谷计价估算、「Token 银行」鲸元券，以及侧栏底部的紧凑速览卡。台账存 `$DSH_HOME/dsh-usage/` |
| [`dsh-session-archive`](packages/dsh-session-archive) | 0.4.6 | **会话归档管理**（上游 `@linxin666/dsh-session-archive@0.4.6` 的 **Fork**，Apache-2.0）：全量清单（含子代理会话与无工作区会话）、筛选搜索排序、跨结果集多选、批量归档/取消归档、**物理删除（含级联与保护规则）**，以及可选的自动归档与自动清理策略。**修正了上游的依赖声明错误**（源码 import 带 scope 的 `@deepseek-ai/schemastery`，上游 dependencies 却写无 scope 的 `schemastery`，导致构建期类型解析失败） |
| [`dsh-agent-teams-fish`](https://github.com/Fish-under-sea/dsh-agent-teams-fish) | 0.7.0 | **AgentTeams 多智能体团队协作**（上游 [NanmiCoder/dsh-agent-teams](https://github.com/NanmiCoder/dsh-agent-teams) 的**补充版**）：自然语言组队、成员/任务依赖 DAG、信箱通信、右侧栏树状监测；**厂商头像素材随包分发**（**17 厂商** × 10 岗位 + 厂商通用图 + 立绘 + 队长 + 商标 SVG，**286 个文件 / 约 29.3 MB**，含 1024×1024 高清 WebP 族），装完即有，跨机不再依赖 `artworkDir`；自定义目录仍可整套覆盖；商标 SVG 按扩展名送达；**队长头像跟随队长自己的模型路由**；`0.5.1` 修掉降级链序（`厂商+岗位 → 厂商 → 岗位`）；`0.6.0` 并入上游 v0.1.23（成员工具策略、质量门契约与修订绑定、lineage 身份沿 fork 链、工作区审计、损坏 `team.json` 降级）；**⚠️ `0.6.1` 修掉「升级 DSH 到 0.2.1-alpha.2 后插件被整行禁用」** —— 该版本的宿主白名单此前未收录新运行时，DSH 判定不兼容并自动停用插件行（症状：显示「异常」、团队协作毫无反应） |
| [`dsh-better-reasoning-effort-fish`](https://github.com/Fish-under-sea/dsh-better-reasoning-effort-fish) | 0.5.8 | **思考强度与输入模态**（上游 [HaoyueQin/dsh-better-reasoning-effort](https://github.com/HaoyueQin/dsh-better-reasoning-effort) 的**Fork**）：在官方「模型」页编辑卡里直接编辑每模型的 `reasoningEfforts` 与 `input` 声明，并支持一键自动适配；本 Fork 把 `settings.models.provider-card` 席位完整让给模型能力面板；0.5.8 并入上游三条安装路线说明（冷静期下写明版本号、release tarball 路线、GitHub 源码安装） |
| [`dsh-our-free-model`](https://github.com/Fish-under-sea/dsh-our-free-model-fish) | 2.1.0 | **免费模型与渠道聚合**（上游 [Ebony-Vinyl/dsh-our-free-model](https://github.com/Ebony-Vinyl/dsh-our-free-model) 的**Fork**）：把 13 个免费渠道（CodeArts / CodeBuddy / Loomy / Raccoon / MiniMax / Gemini 等）与免费模型并入官方模型选择器，并自带渠道网关供其它本地 harness 反代。本 Fork 新增「**隐藏渠道模型分组**」总开关 —— 渠道分组会与你自己配的 provider 混在一起把选择器撑长，打开即一次收起 13 组；**只影响展示不影响路由**（网关请求走 `resolveModelInfo()`，被隐藏的模型照常收发），渠道设置页的「显示列表 / 关闭全部」读 `listAllModels()` 也不受影响；默认关闭，升级不会静默改变你看到的列表。**2.1.0 并入上游 v2.1.0** —— combos 组合链、token-saver 省 token、原生 Anthropic 网关、`standalone` 拆分、渠道包与 Kilo 渠道、升级器 snapshot SHA 修复；Fish 自建的隐藏渠道分组与按面积计价完整保留 |

## 与 `dsh-web-all` 共存（要紧）

本包新增的 6 个 Fork **与上游聚合包 `@linxin666/dsh-web-all` 是同源插件**。两者同时启用会让这 6 个插件**被挂载两次**（两个任务看板抢同一个侧栏席位、重复注册同一个宿主服务），行为异常。

**行 id 不冲突**，所以**不会**触发「同一 id 插两行」的启动失败：

| 插件 | 本包行 id | `dsh-web-all` 行 id |
|---|---|---|
| 任务看板 | `ui-task-board` | `web-ui-task-board` |
| Git 图谱 | `ui-git-graph` | `web-ui-git-graph` |
| 模型能力 | `ui-model-capabilities` | `web-ui-model-capabilities` |
| SSH | `ssh` | `web-ui-ssh` |
| 用量统计 | `usage` | `web-ui-usage` |
| 会话归档 | `session-archive` | `web-ui-session-archive` |

**处理办法**：装了本包又装有 `dsh-web-all` 时，在**自己 profile 的补丁层**把上表右列那 6 个 `web-ui-*` 行设为 `disabled: true`，只保留本包这 6 行：

```yaml
# profiles/<profile>/cordis.patch.yml
- { id: web-ui-task-board,         disabled: true }
- { id: web-ui-git-graph,          disabled: true }
- { id: web-ui-model-capabilities, disabled: true }
- { id: web-ui-ssh,                disabled: true }
- { id: web-ui-usage,              disabled: true }
- { id: web-ui-session-archive,    disabled: true }
```

> 本包**不主动改写别人的行** —— 跨包干预会带来耦合，也会在对方未安装时产生 `entry not found` 告警（本机实测过这类噪音）。所以这里只做说明，由使用方决定。

## 本包不再停用任何内置插件

**0.7.8 起的行为变化** —— 原先本包会显式停用 DSH 内置的会话标题提供方（`session-title-llm`），为 `dsh-session-title-refresh` 让位（会话标题服务每个进程**只接受一个提供方**，第二次注册直接抛错）。

该插件移出后，这段停用**已一并撤除**，内置提供方恢复生效。**这一点很要紧**：若只移出插件而保留停用，内置提供方被关掉却没有替代者，**会话将不再自动命名**。

仍要旧插件的用户单独安装即可，它自带的 patch 会重新停用内置提供方：

```powershell
dsh plugin --profile <profile> add @fish-under-sea/dsh-session-title-refresh
```

## 安装

### 方式一：从 npm 安装（推荐，装一个包就够）

```powershell
dsh plugin --profile <profile> add @fish-under-sea/dsh-fish
```

聚合包已声明十四个插件依赖，它们作为传递依赖被 pnpm 装到 profile 顶层（本 profile 用 `nodeLinker: hoisted`），插件行按包名解析即可得到。

**为什么不会插出重复行**：对账逻辑（`dsh-plugin-manager` 的 `reconcile`）只遍历 **profile 自己的 `dependencies`**，不递归看传递依赖，所以子包不会被提升为 bundle 层，插行不会叠加。

> ⚠️ **如果安装报 `[NOT_FOUND]`**：本包与**十四个**成员包都已发布到 npm **官方源**。若你的机器把 registry 指向国内镜像（例如 `registry.npmmirror.com`），镜像**懒同步**可能还没收录其中某个子包，于是 `dsh plugin add` 会以
> `404 Not Found … {"error":"[NOT_FOUND] @fish-under-sea/<子包> not found"}` 失败。
> **这不是包不存在** —— 任选下面一条即可：
>
> - **触发镜像同步**（公开端点、幂等、无需登录，等十几秒即可装）：
>   ```sh
>   curl.exe -X PUT https://registry.npmmirror.com/-/package/@fish-under-sea/dsh-approval-guide/syncs
>   curl.exe -X PUT https://registry.npmmirror.com/-/package/@fish-under-sea/dsh-git-sync/syncs
>   curl.exe -X PUT https://registry.npmmirror.com/-/package/@fish-under-sea/dsh-settings-nav-order/syncs
>   curl.exe -X PUT https://registry.npmmirror.com/-/package/@fish-under-sea/dsh-skill-lens-fish/syncs
>   curl.exe -X PUT https://registry.npmmirror.com/-/package/@fish-under-sea/dsh-visual-companion/syncs
>   curl.exe -X PUT https://registry.npmmirror.com/-/package/@fish-under-sea/dsh-client-ui-task-board/syncs
>   curl.exe -X PUT https://registry.npmmirror.com/-/package/@fish-under-sea/dsh-client-ui-git-graph/syncs
>   curl.exe -X PUT https://registry.npmmirror.com/-/package/@fish-under-sea/dsh-client-ui-model-capabilities/syncs
>   curl.exe -X PUT https://registry.npmmirror.com/-/package/@fish-under-sea/dsh-ssh/syncs
>   curl.exe -X PUT https://registry.npmmirror.com/-/package/@fish-under-sea/dsh-usage/syncs
>   curl.exe -X PUT https://registry.npmmirror.com/-/package/@fish-under-sea/dsh-session-archive/syncs
>   curl.exe -X PUT https://registry.npmmirror.com/-/package/dsh-agent-teams-fish/syncs
>   curl.exe -X PUT https://registry.npmmirror.com/-/package/dsh-better-reasoning-effort-fish/syncs
>   curl.exe -X PUT https://registry.npmmirror.com/-/package/dsh-our-free-model/syncs
>   ```
>   返回 `{"ok":true,"state":"waiting"}` 即已受理；用
>   `curl.exe https://registry.npmmirror.com/@fish-under-sea%2Fdsh-approval-guide` 复查，出现 `"latest"` 就同步好了。
> - 或把该机器的 registry 换成官方源 `https://registry.npmjs.org/`。
> - 或用[方式三](#方式三本地开发安装改源码即时生效)的 `link:` 本地路径安装。

### 方式二：从 GitHub 安装（不想用 npm registry 时）

```jsonc
// profiles/<profile>/package.json
"dependencies": {
  "@fish-under-sea/dsh-fish": "github:Fish-under-sea/dsh-fish"
},
"devDependencies": {
  "@fish-under-sea/dsh-approval-guide": "github:Fish-under-sea/dsh-fish#path:packages/dsh-approval-guide",
  "@fish-under-sea/dsh-git-sync": "github:Fish-under-sea/dsh-fish#path:packages/dsh-git-sync",

  "@fish-under-sea/dsh-settings-nav-order": "github:Fish-under-sea/dsh-fish#path:packages/dsh-settings-nav-order",
  "@fish-under-sea/dsh-visual-companion": "github:Fish-under-sea/dsh-fish#path:packages/dsh-visual-companion",
  "@fish-under-sea/dsh-skill-lens-fish": "github:Fish-under-sea/dsh-fish#path:packages/dsh-skill-lens-fish",

  "@fish-under-sea/dsh-client-ui-task-board": "github:Fish-under-sea/dsh-fish#path:packages/dsh-client-ui-task-board",
  "@fish-under-sea/dsh-client-ui-git-graph": "github:Fish-under-sea/dsh-fish#path:packages/dsh-client-ui-git-graph",
  "@fish-under-sea/dsh-client-ui-model-capabilities": "github:Fish-under-sea/dsh-fish#path:packages/dsh-client-ui-model-capabilities",
  "@fish-under-sea/dsh-ssh": "github:Fish-under-sea/dsh-fish#path:packages/dsh-ssh",
  "@fish-under-sea/dsh-usage": "github:Fish-under-sea/dsh-fish#path:packages/dsh-usage",
  "@fish-under-sea/dsh-session-archive": "github:Fish-under-sea/dsh-fish#path:packages/dsh-session-archive",

  "dsh-agent-teams-fish": "github:Fish-under-sea/dsh-agent-teams-fish",
  "dsh-better-reasoning-effort-fish": "github:Fish-under-sea/dsh-better-reasoning-effort-fish",
  "dsh-our-free-model": "github:Fish-under-sea/dsh-our-free-model-fish"
}
```

`#path:` 是 pnpm 的子目录语法，让一个仓库同时提供多个包 —— 十一个子包指向本仓库；三个外部补充版指向各自仓库：[`dsh-agent-teams-fish`](https://github.com/Fish-under-sea/dsh-agent-teams-fish)、[`dsh-better-reasoning-effort-fish`](https://github.com/Fish-under-sea/dsh-better-reasoning-effort-fish) 与 [`dsh-our-free-model`](https://github.com/Fish-under-sea/dsh-our-free-model-fish)（三者包都在各自仓库根目录，无需 `#path:`）；换机 `pnpm install` 后直接从仓库下载，**不依赖任何本机绝对路径**。`bundles` 里只需列 `"@fish-under-sea/dsh-fish"`（它的 patch 负责插入十四行）。

> ⚠️ **6 个 Fork 需要先构建**：从 GitHub 源码安装时，`lib/` 虽已提交进仓库，但如果你改过 `src/`，要在该包目录下跑 `pnpm build`（`tsc -b` + `tsdown`）重新生成 `lib/index.js` 与 `lib/client.js` 后再重启 DSH。

### 方式三：本地开发安装（改源码即时生效）

```jsonc
// profiles/<profile>/package.json
"dependencies": {
  "@fish-under-sea/dsh-fish": "link:<本仓库路径>"
},
"devDependencies": {
  "@fish-under-sea/dsh-approval-guide": "link:<本仓库路径>/packages/dsh-approval-guide",
  "@fish-under-sea/dsh-git-sync": "link:<本仓库路径>/packages/dsh-git-sync",

  "@fish-under-sea/dsh-settings-nav-order": "link:<本仓库路径>/packages/dsh-settings-nav-order",
  "@fish-under-sea/dsh-visual-companion": "link:<本仓库路径>/packages/dsh-visual-companion",
  "@fish-under-sea/dsh-skill-lens-fish": "link:<本仓库路径>/packages/dsh-skill-lens-fish",

  "@fish-under-sea/dsh-client-ui-task-board": "link:<本仓库路径>/packages/dsh-client-ui-task-board",
  "@fish-under-sea/dsh-client-ui-git-graph": "link:<本仓库路径>/packages/dsh-client-ui-git-graph",
  "@fish-under-sea/dsh-client-ui-model-capabilities": "link:<本仓库路径>/packages/dsh-client-ui-model-capabilities",
  "@fish-under-sea/dsh-ssh": "link:<本仓库路径>/packages/dsh-ssh",
  "@fish-under-sea/dsh-usage": "link:<本仓库路径>/packages/dsh-usage",
  "@fish-under-sea/dsh-session-archive": "link:<本仓库路径>/packages/dsh-session-archive",

  "dsh-agent-teams-fish": "link:<dsh-agent-teams-fish 仓库路径>",
  "dsh-better-reasoning-effort-fish": "link:<dsh-better-reasoning-effort-fish 仓库路径>",
  "dsh-our-free-model": "link:<dsh-our-free-model-fish 仓库路径>"
}
```

**不要用 `file:` 指向本仓库** —— pnpm 会把 `file:` 目录依赖当「无哈希的目录依赖」缓存，改了源码后 `pnpm install`（连 `--force` 也一样）**不会重新复制**，必须手动删掉 `node_modules/dsh-*` 再装。`link:` 没有这个问题。

> 装完**重启 DSH** 生效。

## 手工声明依赖时的两条坑

> 用方式一（npm）可跳过本节 —— 聚合包已替你处理好。

**① 子包必须能被 profile 顶层解析到**

DSH 的浏览器半区扫描器（`@deepseek-ai/dsh-client-modules` 的 `locatePkgJson`）按插件行里的**包名**去 profile 顶层解析包目录。行名必须是完整的包名：

- ✅ 正确：`@fish-under-sea/dsh-approval-guide`（`@scope/name` 两段式 scoped 名）
- ❌ 错误：多带一段子路径会被 `exactPackageSpecifier()` 判为「不是包」**直接跳过**

子包不在 profile 顶层时，行解析不到 `package.json`，**插件的设置页与界面不会加载**。

**② 手工声明时子包要写在 `devDependencies`**

`dsh plugin` 每次执行都会对账，把 profile 的 `dependencies` 里任何声明了 `dsh.bundle` 的包**自动追加进 `dsh.profile.bundles`**。十四个包各自都声明了 `dsh.bundle`，而聚合包的 patch 已经把十四行插行复述了一遍 ——

> 子包一旦被提升为 bundle 层，插行就会**叠加成重复行**，而**重复挂载会让应用启动失败**。

**这一条对 `dsh-our-free-model` 尤其要紧**：它自己的 `cordis.patch.yml` 插入的 id 就是 `our-free-model`，与本包插的是**同一个 id**（`composeEntries` 只做 `push`、不去重）。所以任何时候都**必须**把它从 `dsh.profile.bundles` 里移走（或直接从 profile 的 `dependencies` 挪到 `devDependencies`）。

同理，`dsh-skill-lens-fish` 沿用了上游的 id `skill-lens`：**这台机器若曾单独装过上游的 `dsh-skill-lens`**（npm 包，插的是同一个 id），必须先把它从 profile 里移除，否则两行同 id 重复挂载，应用启动即失败。

写在 `devDependencies` 同样会被装到 profile 顶层（行名照常解析得到），但不会被对账逻辑提升为 bundle 层。

## 子插件的运行期配置

本仓库子插件的参数**都不写在 `cordis.patch.yml` 里**，而是存在各自 `$DSH_HOME` 下的 `config.json` 中，在 **GUI 设置页**里修改（外部补充版与 `dsh-visual-companion` 相反：它们的配置写在插件行的 `config` 里）：

| 插件 | 设置入口 | 配置文件 |
|------|---------|---------|
| `approval-guide` | 无配置项 | — |

| `git-sync` | 设置 → Git 同步 | `$DSH_HOME/dsh-git-sync/config.json` |
| `settings-nav-order` | 设置 → 设置导航顺序 | 无配置项；偏好存在浏览器 `localStorage`（键 `dsh-settings-nav-order/v1`）并镜像到 `$DSH_HOME/dsh-settings-nav-order/state.json`（供 `git-sync` 采集） |
| `dsh-visual-companion` | 无设置页（配置写在自己 profile patch 的插件行里） | 同上（`watchDir`：视觉伴侣根目录，用于「加载即自动绑定」） |
| `dsh-agent-teams-fish` | 无设置页（配置写在聚合包 `cordis.patch.yml` 的插件行里） | 同上（`stateDir` / `memberProvider` / `artworkDir`） |
| `dsh-better-reasoning-effort-fish` | 无设置页（能力直接嵌进官方「模型」页编辑卡） | 同上（`autofill` / `modalityAutofill` / `probeTimeoutMs` / `bootRetryDelaysMs` / `defaultGuard`，写在插件行的 `config` 或 `settings.yaml` 的插件 `config` 块） |
| `dsh-our-free-model` | 设置 → 免费模型（含「偏好」区的**隐藏渠道模型分组**开关） | `$DSH_HOME/our-free-model/settings.json`（该文件在 `git-sync` 白名单里，跨机复原） |
| `dsh-skill-lens-fish` | 无配置项（扫描根由宿主环境决定：`<会话工作区>/.dsh/skills` 与 `$DSH_HOME/skills`） | — |

**配置目录名是不带 scope 的短名**（`$DSH_HOME/dsh-git-sync/` 等），与 npm 包名解耦 —— 所以**改包名不会动到已有配置**。

外部补充版 `dsh-agent-teams-fish` 是**例外**：它的参数写在聚合包 `cordis.patch.yml` 的插件行 `config` 里（`stateDir` / `memberProvider`），另有 `artworkDir` 用于指向**自定义美术目录**：

```yaml
- id: agent-teams
  name: 'dsh-agent-teams-fish'
  config:
    stateDir: .agent-teams        # 团队状态目录（相对会话工作区）
    memberProvider: spawn         # 成员派生方式：spawn 或 fork
    # artworkDir: <绝对路径>      # 可选：自定义头像/商标目录（机器相关，默认用包内美术）
```

> `artworkDir` 是**机器相关**的绝对路径，所以没有写进聚合包（换机器不会指到别人的目录）；需要自定义美术时，在**自己 profile 的 patch 层**覆盖同一个 `id: agent-teams` 行即可。

### 关于 `settings-nav-order`

设置面板左侧那列菜单（通用设置 / 模型 / 内置插件 / Agent 预设 / …）的顺序，本来**写死在每个插件自己的 `settings.section` 注册里**（一个 `order` 数字），GUI 里既没有重排入口，也没有收起不用的办法。本插件加一页「设置导航顺序」解决：

- **排序**：拖动 `⋮⋮` 把手，或点 `↑`/`↓`
- **隐藏**：点「隐藏」收起不想看的项
- **做法**：给导航按钮打 CSS `order`（容器是 flex column）、隐藏打 `display:none`（**节点不删，随时可逆**）—— 两者都不动 DOM 顺序、不改任何第三方插件代码，所以**插件升级不会冲掉这些偏好**
- **数据**：主副本在浏览器 `localStorage`（键 `dsh-settings-nav-order/v1`），另由宿主半区镜像到 `$DSH_HOME/dsh-settings-nav-order/state.json` —— **该文件在 `git-sync` 的白名单里**，所以顺序与隐藏项会跟着配置仓跨机复原（换机打开设置页即自动回填）。0.1.2 起如此；此前这些偏好只在浏览器里，不跟仓库走
- **保存后如实回报**：面板会写明宿主文件是否已同步（写不进去就说「未同步、下次自动重推」，不假装成功）；有未保存的排序时点「启用」开关，也仍然显示「未保存」，不会谎报「已保存」
- **退回原样**：关掉「启用手动排序与隐藏」，或点「恢复默认」
- **防自锁**：「设置导航顺序」这一页**不能隐藏自己** —— 它是唯一能取消隐藏的入口
- **识别方式**：真实类名是 CSS Modules 哈希名（`ZiQlkq_navList`），所以按 `[class*="navList"]` 子串匹配，**DSH 换哈希前缀也不受影响**

## 仓库结构

```text
dsh-fish/                 # 仓库目录名（npm 包名是 @fish-under-sea/dsh-fish）
├── package.json          # 聚合包清单（version 0.8.1，dsh.bundle.patch 指向 cordis.patch.yml）
├── cordis.patch.yml      # bundle 层：插入十四个插件的插件行
├── CHANGELOG.md          # 完整版本记录（README 顶部只留最近一版）
├── pnpm-workspace.yaml   # workspace 声明（仅本地开发用；并放行 esbuild 安装脚本）
├── lib/                  # 聚合包自身的空实现（本包不注册任何东西）
│   ├── index.js
│   └── client.js
└── packages/
    ├── dsh-approval-guide/

    ├── dsh-git-sync/
    ├── dsh-settings-nav-order/
    ├── dsh-skill-lens-fish/   # 唯一带构建步骤的子包：src/ 经 esbuild 产出 lib/
    └── dsh-visual-companion/
```

> 三个外部补充版 **不在** `packages/` 下 —— `dsh-agent-teams-fish` 的源码在[它自己的仓库](https://github.com/Fish-under-sea/dsh-agent-teams-fish)，`dsh-better-reasoning-effort-fish` 在[另一个仓库](https://github.com/Fish-under-sea/dsh-better-reasoning-effort-fish)，`dsh-our-free-model` 在[第三个仓库](https://github.com/Fish-under-sea/dsh-our-free-model-fish)；三者都以 **npm 依赖**的形式随聚合包装到 profile 顶层。

> **子包为什么不在聚合包的 `files` 里被打包进来**：聚合包只携带 `lib/`、`cordis.patch.yml` 与 `README*.md`，十一个子包与三个外部补充版都以 **npm 依赖**的形式被装到 profile 顶层（见方式一）。只有在「一个仓库同时提供多个包、从 GitHub 安装」时才需要在安装方 profile 里用 `#path:` 显式声明（见方式二）。

## 开发

```bash
pnpm install                                                          # 装 workspace 依赖

node packages/dsh-approval-guide/test/guide.test.mjs                  # 跑测试

node packages/dsh-git-sync/test/client.test.mjs
node packages/dsh-git-sync/test/test-sync-engine.mjs
node packages/dsh-git-sync/test/commit-identity.test.mjs
node packages/dsh-settings-nav-order/test/client.test.mjs
node packages/dsh-settings-nav-order/test/host.test.mjs
node packages/dsh-visual-companion/test/visual-companion.test.mjs

# 6 个上游 Fork 的构建与检查（改 src 后必须重建 lib）
pnpm --filter @fish-under-sea/dsh-ssh build
pnpm --filter @fish-under-sea/dsh-usage build
pnpm --filter @fish-under-sea/dsh-session-archive build
pnpm --filter @fish-under-sea/dsh-client-ui-task-board build
pnpm --filter @fish-under-sea/dsh-client-ui-git-graph build
pnpm --filter @fish-under-sea/dsh-client-ui-model-capabilities build
```

> 聚合包本身不实现功能，也**不注册任何东西** —— 它的唯一职责是携带 `cordis.patch.yml`。

## 改包名时要同步的五处

包名不只是 `package.json` 里的一行字符串，**五处必须一起改**，漏一处就在运行期炸：

| # | 位置 | 漏改的后果 |
|:-:|------|-----------|
| 1 | 十四个 `package.json` 的 `name` | 安装方的依赖键对不上 |
| 2 | 聚合包与十一个子包 `cordis.patch.yml` 里的行 `name` | 行解析不到包，插件整条不加载 |
| 3 | ⚠️ **带浏览器半区的包（本仓库十一个子包 + 三个外部补充版）`lib/client.js` 里 `__ModuleLoader__.load({ id })` 的 `id`** | **浏览器侧报 `loaded without registering "<包名>"`，插件加载失败** |
| 4 | 安装方 profile 的依赖键与 `bundles` | 依赖装不上、bundle 层不展开 |
| 5 | 子包在 profile 里的归属 | 必须放 `devDependencies`（见「两条坑」第 ② 条） |

**第 3 条最隐蔽**：loader 是拿**行里解析出的包名**去 `factories` 里认领 factory 的（`@deepseek-ai/dsh-client-modules/lib/client.js` 的 `if (!this.factories.has(id)) throw ... loaded without registering`），所以**注册名必须严格等于包名** —— 包名带 scope，注册名也必须带。

好消息：四个带浏览器半区的子包的客户端测试都断言了这一点，而且断言**读的是 `package.json` 的 `name`** 而不是硬编码字符串 —— 以后再改名漏改，**会被测试直接抓住**。

**外部补充版同理**：`dsh-agent-teams-fish`（[仓库](https://github.com/Fish-under-sea/dsh-agent-teams-fish)）、`dsh-better-reasoning-effort-fish`（[仓库](https://github.com/Fish-under-sea/dsh-better-reasoning-effort-fish)）与 `dsh-our-free-model`（[仓库](https://github.com/Fish-under-sea/dsh-our-free-model-fish)）都来自独立仓库，改包名时同样要同步 `package.json` 的 `name` / `cordis.patch.yml` 的行 `name` / `lib/client.js` 的注册 `id` 三处 —— 前者的美术路由链测试断言「注册名 = `package.json` 的 `name`」，后者的常量 `PLUGIN_ID` 也等于包名（`src/constants.ts`），改名漏改同样会被抓住。

## 许可

**MIT**（聚合包与十一个自建子包一致）。

三个外部补充版同样以 **MIT** 分发，**著作权各归其上游原作者**：

- `dsh-agent-teams-fish` → [NanmiCoder/dsh-agent-teams](https://github.com/NanmiCoder/dsh-agent-teams)（程序员阿江 / Relakkes）
- `dsh-better-reasoning-effort-fish` → [HaoyueQin/dsh-better-reasoning-effort](https://github.com/HaoyueQin/dsh-better-reasoning-effort)（**HaoyueQin**）
- `dsh-our-free-model` → [Ebony-Vinyl/dsh-our-free-model](https://github.com/Ebony-Vinyl/dsh-our-free-model)（**Ebony-Vinyl**）

补充版的来源、署名与改动范围见各自仓库里的 `NOTICE.md`。

> 仓库根目录已放置 `LICENSE` 文件，与 `package.json` 中的 `license` 字段（MIT）及自建子包保持一致。

---

<sub>聚合包 <code>@fish-under-sea/dsh-fish</code> v0.8.1 · DSH ≥ 0.2.0-rc.2 · Node ≥ 20</sub>
