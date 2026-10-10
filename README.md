<div align="center">

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

> **🆕 0.7.3（2026-10-10）**：`dsh-agent-teams-fish` **0.4.2 → 0.4.3**（依赖范围 `^0.4.2` → **`^0.4.3`**）—— **纯文档修正，二进制与 0.4.2 等价**。0.4.2 修了「队长头像跟随路由」，但 README 的「已知限制」表里漏改了「队长不跟随模型路由」那一行，同一份文档里新旧说法并存。代码没问题，**npm 包内 README 在 publish 那一刻就冻结、事后无法修改**，所以只能补发一版把正确文案带上 npm。本版 `lib/` 运行时代码与 0.4.2 逐字节相同，升上来只是为了让 npm 页面上的文档不再自相矛盾。详见 [dsh-agent-teams-fish v0.4.3](https://github.com/Fish-under-sea/dsh-agent-teams-fish/blob/main/release-notes/v0.4.3.md)。

---

> **0.7.2（2026-10-10）**：两个成员同时升级 —— `@fish-under-sea/dsh-session-title-refresh` **0.3.2** 与 `dsh-agent-teams-fish` **0.4.2**。
>
> **① 标题刷新（0.3.2）**：**修掉「标题模型不支持 off 档时，每一次自动命名都报 `UNSUPPORTED_REASONING_EFFORT`」**。0.3.1 为了修「思考吃光输出预算」而**无条件**传 `reasoningEffort: 'off'`，但 **DSH 核心对显式档位是硬校验、不做任何降级**（模型没声明该档位就直接抛，连 reasoning 元数据都没有时传任何档位同样抛），`dsh-llm-pi-ai` 又会把未声明的档位一律钉成不支持 —— 于是**所有没声明 `off` 的模型**（真实配置 58 个里占 **33 个**）自动命名全部失效。0.3.2 改为**先探测再表态**：读该模型真实档位，能关思考就传 `off`、关不掉退到它支持的最低档、实在没有才完全不传该字段。core 25 + host 25 + client 13 = **63** 用例全通过。
>
> **② AgentTeams（0.4.2）**：**修掉「队长头像永远是 DeepSeek 那张」**。队长换成 qwen / claude / glm 后头像不变 —— 不是缺素材（10 个厂商的队长图早在包里），而是客户端把队长图**写死成常量** `team-lead-deepseek-v2.png`，另外 9 张永远不可达；宿主端 `team.json` 也只记 `captainSessionId`、没有队长的模型路由。0.4.2 建队时写入 `captainProvider` / `captainModel`，快照暴露（实时值优先），客户端走与成员同一套厂商识别。artwork-role-match 30 → **34** 用例 + 2 条新门禁。
>
> ⚠️ **第八个成员的安装约定**：本包插入 `id: our-free-model` 行，而 `dsh-our-free-model` 自己的 bundle 层也插入同一个 id —— 聚合 patch **不去重**，两边都生效就是**重复挂载、启动失败**。所以请把它写在 profile 的 `devDependencies`（装得到，且不会被对账提升为 bundle 层），**不要**再列进 `dsh.profile.bundles`（见 [安装](#安装) 与「[为什么子包要写在 devDependencies](#方式二从-git-仓库安装跨机可复现)」）。
>
> 更早的版本记录见 [CHANGELOG.md](CHANGELOG.md)。

---

## 这是什么

Fish 自建 [DSH](https://github.com/Fish-under-sea/DSH)（DeepSeek Harness）插件聚合包。根目录是**聚合包**，子插件源码在 `packages/` 下。聚合包靠自己的 bundle 层（`cordis.patch.yml`）把八个插件的插件行**一次性插入** profile 的 roster —— 其中五个是本仓库 `packages/` 下的自建插件，另外三个是**外部补充版**：`dsh-agent-teams-fish`、`dsh-better-reasoning-effort-fish` 与 `dsh-our-free-model`（各自独立仓库，非本仓库子包）。

> **装一次 `@fish-under-sea/dsh-fish` ＝ 装齐八个插件。**

**命名差异（容易踩）**：npm 包名 `@fish-under-sea/*` 带 scope，但仓库目录名（`dsh-fish/`）与 GitHub 仓库名（`Fish-under-sea/dsh-fish`）**不带**。

## 包含的插件

| 子包 | 版本 | 说明 |
|------|:----:|------|
| [`dsh-approval-guide`](packages/dsh-approval-guide) | 0.2.2 | 在审批弹窗里追加**中文说明**：这次审批会做什么、有什么风险、依据是什么 |
| [`dsh-session-title-refresh`](packages/dsh-session-title-refresh) | 0.3.2 | **会话标题自动刷新**：第 N 轮起总结命名，此后每 M 轮刷新一次；设置页「标题模型（可选）」下拉与官方「模型」页同源；标题调用的**思考档位按模型真实能力挑**（能关就关、关不掉退最低档、无元数据不传），默认输出预算 256、`max-tokens` 有正文即接受截断结果 |
| [`dsh-git-sync`](packages/dsh-git-sync) | 0.3.2 | **一键 Git 同步**：把插件清单、启用状态、本地设置、Skills、看板/用量账本、设置导航顺序偏好、**标题自动刷新设置**与**免费模型插件配置及用量账本**同步到自己的私有仓库；支持**额外扫描根**，白名单条目可用根前缀指向 `$DSH_HOME` 之外的目录（壁纸引擎的设置、玻璃预设、字体集与吉祥物素材都走这条路） |
| [`dsh-settings-nav-order`](packages/dsh-settings-nav-order) | 0.1.5 | **设置导航重排**：把设置面板左侧菜单排成自己要的顺序、把不想看的项收起来；偏好随 Git 同步插件**跨机复原** |
| [`dsh-visual-companion`](packages/dsh-visual-companion) | 0.1.7 | **视觉伴侣唤醒**：网页上看原型 / 比布局，点选 + 备注后按「提交给助手」，会话自动收到一条用户消息并起一轮 —— 不必回终端复述；**点选过程静默，只有提交才唤醒一次**（0.1.7 起加载日志的版本号从 `package.json` 现读，不再写死） |
| [`dsh-agent-teams-fish`](https://github.com/Fish-under-sea/dsh-agent-teams-fish) | 0.4.3 | **AgentTeams 多智能体团队协作**（上游 [NanmiCoder/dsh-agent-teams](https://github.com/NanmiCoder/dsh-agent-teams) 的**补充版**）：自然语言组队、成员/任务依赖 DAG、信箱通信、右侧栏树状监测；**厂商头像素材随包分发**（15 厂商 × 10 岗位 + 厂商通用图 + 立绘 + 队长 + 商标 SVG，280 个文件 / 约 28.6 MB，含 1024×1024 高清 WebP 族），装完即有，跨机不再依赖 `artworkDir`；自定义目录仍可整套覆盖；商标 SVG 按扩展名送达；**队长头像跟随队长自己的模型路由**（0.4.2 修，此前写死成 DeepSeek 那张，其余 9 张永远不可达） |
| [`dsh-better-reasoning-effort-fish`](https://github.com/Fish-under-sea/dsh-better-reasoning-effort-fish) | 0.5.7 | **思考强度与输入模态**（上游 [HaoyueQin/dsh-better-reasoning-effort](https://github.com/HaoyueQin/dsh-better-reasoning-effort) 的**Fork**）：在官方「模型」页编辑卡里直接编辑每模型的 `reasoningEfforts` 与 `input` 声明，并支持一键自动适配；本 Fork 把 `settings.models.provider-card` 席位完整让给模型能力面板 |
| [`dsh-our-free-model`](https://github.com/Fish-under-sea/Our-Free-Mode-fish) | 2.0.0 | **免费模型与渠道聚合**（上游 [Ebony-Vinyl/dsh-our-free-model](https://github.com/Ebony-Vinyl/dsh-our-free-model) 的**Fork**）：把 13 个免费渠道（CodeArts / CodeBuddy / Loomy / Raccoon / MiniMax / Gemini 等）与免费模型并入官方模型选择器，并自带渠道网关供其它本地 harness 反代。本 Fork 新增「**隐藏渠道模型分组**」总开关 —— 渠道分组会与你自己配的 provider 混在一起把选择器撑长，打开即一次收起 13 组；**只影响展示不影响路由**（网关请求走 `resolveModelInfo()`，被隐藏的模型照常收发），渠道设置页的「显示列表 / 关闭全部」读 `listAllModels()` 也不受影响；默认关闭，升级不会静默改变你看到的列表 |

## 本包会停用一个 DSH 内置插件

**这是使用前必须知道的行为** —— `cordis.patch.yml` 会显式停用 DSH 内置的会话标题提供方：

```yaml
- id: session-title-llm
  name: '@deepseek-ai/dsh-session-title-first-prompt-llm'
  disabled: true
```

**原因**：会话标题服务每个进程**只接受一个提供方**，第二次注册会直接抛错。所以必须先让位给 `dsh-session-title-refresh`。

**行为差异**：本插件同样以 `first-prompt` 节奏注册，**第 1 轮照样会生成标题** —— 日常使用无感知，但你需要知道这个内置插件是被本包关掉的。

## 安装

### 方式一：从 npm 安装（推荐，装一个包就够）

```powershell
dsh plugin --profile <profile> add @fish-under-sea/dsh-fish
```

聚合包已声明八个插件依赖，它们作为传递依赖被 pnpm 装到 profile 顶层（本 profile 用 `nodeLinker: hoisted`），插件行按包名解析即可得到。

**为什么不会插出重复行**：对账逻辑（`dsh-plugin-manager` 的 `reconcile`）只遍历 **profile 自己的 `dependencies`**，不递归看传递依赖，所以子包不会被提升为 bundle 层，插行不会叠加。

> ⚠️ **如果安装报 `[NOT_FOUND]`**：本包与**八个**成员包都已发布到 npm **官方源**。若你的机器把 registry 指向国内镜像（例如 `registry.npmmirror.com`），镜像**懒同步**可能还没收录其中某个子包，于是 `dsh plugin add` 会以
> `404 Not Found … {"error":"[NOT_FOUND] @fish-under-sea/<子包> not found"}` 失败。
> **这不是包不存在** —— 任选下面一条即可：
>
> - **触发镜像同步**（公开端点、幂等、无需登录，等十几秒即可装）：
>   ```sh
>   curl.exe -X PUT https://registry.npmmirror.com/-/package/@fish-under-sea/dsh-approval-guide/syncs
>   curl.exe -X PUT https://registry.npmmirror.com/-/package/@fish-under-sea/dsh-git-sync/syncs
>   curl.exe -X PUT https://registry.npmmirror.com/-/package/@fish-under-sea/dsh-session-title-refresh/syncs
>   curl.exe -X PUT https://registry.npmmirror.com/-/package/@fish-under-sea/dsh-settings-nav-order/syncs
>   curl.exe -X PUT https://registry.npmmirror.com/-/package/@fish-under-sea/dsh-visual-companion/syncs
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
  "@fish-under-sea/dsh-session-title-refresh": "github:Fish-under-sea/dsh-fish#path:packages/dsh-session-title-refresh",
  "@fish-under-sea/dsh-settings-nav-order": "github:Fish-under-sea/dsh-fish#path:packages/dsh-settings-nav-order",
  "@fish-under-sea/dsh-visual-companion": "github:Fish-under-sea/dsh-fish#path:packages/dsh-visual-companion",
  "dsh-agent-teams-fish": "github:Fish-under-sea/dsh-agent-teams-fish",
  "dsh-better-reasoning-effort-fish": "github:Fish-under-sea/dsh-better-reasoning-effort-fish",
  "dsh-our-free-model": "github:Fish-under-sea/Our-Free-Mode-fish"
}
```

`#path:` 是 pnpm 的子目录语法，让一个仓库同时提供多个包 —— 五个子包指向本仓库；三个外部补充版指向各自仓库：[`dsh-agent-teams-fish`](https://github.com/Fish-under-sea/dsh-agent-teams-fish)、[`dsh-better-reasoning-effort-fish`](https://github.com/Fish-under-sea/dsh-better-reasoning-effort-fish) 与 [`dsh-our-free-model`](https://github.com/Fish-under-sea/Our-Free-Mode-fish)（三者包都在各自仓库根目录，无需 `#path:`）；换机 `pnpm install` 后直接从仓库下载，**不依赖任何本机绝对路径**。`bundles` 里只需列 `"@fish-under-sea/dsh-fish"`（它的 patch 负责插入八行）。

### 方式三：本地开发安装（改源码即时生效）

```jsonc
// profiles/<profile>/package.json
"dependencies": {
  "@fish-under-sea/dsh-fish": "link:<本仓库路径>"
},
"devDependencies": {
  "@fish-under-sea/dsh-approval-guide": "link:<本仓库路径>/packages/dsh-approval-guide",
  "@fish-under-sea/dsh-git-sync": "link:<本仓库路径>/packages/dsh-git-sync",
  "@fish-under-sea/dsh-session-title-refresh": "link:<本仓库路径>/packages/dsh-session-title-refresh",
  "@fish-under-sea/dsh-settings-nav-order": "link:<本仓库路径>/packages/dsh-settings-nav-order",
  "@fish-under-sea/dsh-visual-companion": "link:<本仓库路径>/packages/dsh-visual-companion",
  "dsh-agent-teams-fish": "link:<dsh-agent-teams-fish 仓库路径>",
  "dsh-better-reasoning-effort-fish": "link:<dsh-better-reasoning-effort-fish 仓库路径>",
  "dsh-our-free-model": "link:<Our-Free-Mode-fish 仓库路径>"
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

`dsh plugin` 每次执行都会对账，把 profile 的 `dependencies` 里任何声明了 `dsh.bundle` 的包**自动追加进 `dsh.profile.bundles`**。八个包各自都声明了 `dsh.bundle`，而聚合包的 patch 已经把八行插行复述了一遍 ——

> 子包一旦被提升为 bundle 层，插行就会**叠加成重复行**，而**重复挂载会让应用启动失败**。

**这一条对第八个成员 `dsh-our-free-model` 尤其要紧**：它自己的 `cordis.patch.yml` 插入的 id 就是 `our-free-model`，与本包插的是**同一个 id**（`composeEntries` 只做 `push`、不去重）。所以任何时候都**必须**把它从 `dsh.profile.bundles` 里移走（或直接从 profile 的 `dependencies` 挪到 `devDependencies`）。

写在 `devDependencies` 同样会被装到 profile 顶层（行名照常解析得到），但不会被对账逻辑提升为 bundle 层。

## 子插件的运行期配置

本仓库五个子插件的参数**都不写在 `cordis.patch.yml` 里**，而是存在各自 `$DSH_HOME` 下的 `config.json` 中，在 **GUI 设置页**里修改（外部补充版与 `dsh-visual-companion` 相反：它们的配置写在插件行的 `config` 里）：

| 插件 | 设置入口 | 配置文件 |
|------|---------|---------|
| `approval-guide` | 无配置项 | — |
| `session-title-refresh` | 设置 → 会话标题自动刷新 | `$DSH_HOME/dsh-session-title-refresh/config.json` |
| `git-sync` | 设置 → Git 同步 | `$DSH_HOME/dsh-git-sync/config.json` |
| `settings-nav-order` | 设置 → 设置导航顺序 | 无配置项；偏好存在浏览器 `localStorage`（键 `dsh-settings-nav-order/v1`）并镜像到 `$DSH_HOME/dsh-settings-nav-order/state.json`（供 `git-sync` 采集） |
| `dsh-visual-companion` | 无设置页（配置写在自己 profile patch 的插件行里） | 同上（`watchDir`：视觉伴侣根目录，用于「加载即自动绑定」） |
| `dsh-agent-teams-fish` | 无设置页（配置写在聚合包 `cordis.patch.yml` 的插件行里） | 同上（`stateDir` / `memberProvider` / `artworkDir`） |
| `dsh-better-reasoning-effort-fish` | 无设置页（能力直接嵌进官方「模型」页编辑卡） | 同上（`autofill` / `modalityAutofill` / `probeTimeoutMs` / `bootRetryDelaysMs` / `defaultGuard`，写在插件行的 `config` 或 `settings.yaml` 的插件 `config` 块） |
| `dsh-our-free-model` | 设置 → 免费模型（含「偏好」区的**隐藏渠道模型分组**开关） | `$DSH_HOME/our-free-model/settings.json`（该文件在 `git-sync` 白名单里，跨机复原） |

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
├── package.json          # 聚合包清单（version 0.7.3，dsh.bundle.patch 指向 cordis.patch.yml）
├── cordis.patch.yml      # bundle 层：停用内置标题插件 + 插入八个插件的插件行
├── CHANGELOG.md          # 完整版本记录（README 顶部只留最近一版）
├── pnpm-workspace.yaml   # workspace 声明（仅本地开发用）
├── lib/                  # 聚合包自身的空实现（本包不注册任何东西）
│   ├── index.js
│   └── client.js
└── packages/
    ├── dsh-approval-guide/
    ├── dsh-session-title-refresh/
    ├── dsh-git-sync/
    ├── dsh-settings-nav-order/
    └── dsh-visual-companion/
```

> 三个外部补充版 **不在** `packages/` 下 —— `dsh-agent-teams-fish` 的源码在[它自己的仓库](https://github.com/Fish-under-sea/dsh-agent-teams-fish)，`dsh-better-reasoning-effort-fish` 在[另一个仓库](https://github.com/Fish-under-sea/dsh-better-reasoning-effort-fish)，`dsh-our-free-model` 在[第三个仓库](https://github.com/Fish-under-sea/Our-Free-Mode-fish)；三者都以 **npm 依赖**的形式随聚合包装到 profile 顶层。

> **子包为什么不在聚合包的 `files` 里被打包进来**：聚合包只携带 `lib/`、`cordis.patch.yml` 与 `README*.md`，五个子包与三个外部补充版都以 **npm 依赖**的形式被装到 profile 顶层（见方式一）。只有在「一个仓库同时提供多个包、从 GitHub 安装」时才需要在安装方 profile 里用 `#path:` 显式声明（见方式二）。

## 开发

```bash
pnpm install                                                          # 装 workspace 依赖

node packages/dsh-approval-guide/test/guide.test.mjs                  # 跑测试
node packages/dsh-session-title-refresh/test/run-all.mjs
node packages/dsh-git-sync/test/client.test.mjs
node packages/dsh-git-sync/test/test-sync-engine.mjs
node packages/dsh-git-sync/test/commit-identity.test.mjs
node packages/dsh-settings-nav-order/test/client.test.mjs
node packages/dsh-settings-nav-order/test/host.test.mjs
node packages/dsh-visual-companion/test/visual-companion.test.mjs
```

> 聚合包本身不实现功能，也**不注册任何东西** —— 它的唯一职责是携带 `cordis.patch.yml`。

## 改包名时要同步的五处

包名不只是 `package.json` 里的一行字符串，**五处必须一起改**，漏一处就在运行期炸：

| # | 位置 | 漏改的后果 |
|:-:|------|-----------|
| 1 | 六个 `package.json` 的 `name` | 安装方的依赖键对不上 |
| 2 | 聚合包与五个子包 `cordis.patch.yml` 里的行 `name` | 行解析不到包，插件整条不加载 |
| 3 | ⚠️ **带浏览器半区的包（本仓库四个子包 + 两个外部补充版）`lib/client.js` 里 `__ModuleLoader__.load({ id })` 的 `id`** | **浏览器侧报 `loaded without registering "<包名>"`，插件加载失败** |
| 4 | 安装方 profile 的依赖键与 `bundles` | 依赖装不上、bundle 层不展开 |
| 5 | 子包在 profile 里的归属 | 必须放 `devDependencies`（见「两条坑」第 ② 条） |

**第 3 条最隐蔽**：loader 是拿**行里解析出的包名**去 `factories` 里认领 factory 的（`@deepseek-ai/dsh-client-modules/lib/client.js` 的 `if (!this.factories.has(id)) throw ... loaded without registering`），所以**注册名必须严格等于包名** —— 包名带 scope，注册名也必须带。

好消息：四个带浏览器半区的子包的客户端测试都断言了这一点，而且断言**读的是 `package.json` 的 `name`** 而不是硬编码字符串 —— 以后再改名漏改，**会被测试直接抓住**。

**外部补充版同理**：`dsh-agent-teams-fish`（[仓库](https://github.com/Fish-under-sea/dsh-agent-teams-fish)）、`dsh-better-reasoning-effort-fish`（[仓库](https://github.com/Fish-under-sea/dsh-better-reasoning-effort-fish)）与 `dsh-our-free-model`（[仓库](https://github.com/Fish-under-sea/Our-Free-Mode-fish)）都来自独立仓库，改包名时同样要同步 `package.json` 的 `name` / `cordis.patch.yml` 的行 `name` / `lib/client.js` 的注册 `id` 三处 —— 前者的美术路由链测试断言「注册名 = `package.json` 的 `name`」，后者的常量 `PLUGIN_ID` 也等于包名（`src/constants.ts`），改名漏改同样会被抓住。

## 许可

**MIT**（聚合包与五个子包一致）。

三个外部补充版同样以 **MIT** 分发，**著作权各归其上游原作者**：

- `dsh-agent-teams-fish` → [NanmiCoder/dsh-agent-teams](https://github.com/NanmiCoder/dsh-agent-teams)（程序员阿江 / Relakkes）
- `dsh-better-reasoning-effort-fish` → [HaoyueQin/dsh-better-reasoning-effort](https://github.com/HaoyueQin/dsh-better-reasoning-effort)（**HaoyueQin**）
- `dsh-our-free-model` → [Ebony-Vinyl/dsh-our-free-model](https://github.com/Ebony-Vinyl/dsh-our-free-model)（**Ebony-Vinyl**）

补充版的来源、署名与改动范围见各自仓库里的 `NOTICE.md`。

> 仓库根目录已放置 `LICENSE` 文件，与 `package.json` 中的 `license` 字段（MIT）及五个子包保持一致。

---

<sub>聚合包 <code>@fish-under-sea/dsh-fish</code> v0.7.3 · DSH ≥ 0.2.0-rc.2 · Node ≥ 20</sub>
