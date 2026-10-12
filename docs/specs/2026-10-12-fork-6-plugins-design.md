# 6 个上游插件并入 dsh-fish · 设计规格（v1）

> 状态：**待用户审查**。批准后只进入实现计划，不在本文档内写实现代码。
> 目标仓库：`Fish-under-sea/dsh-fish`（本地 `D:\Fish-code\DSH\技能编排\dsh-fish`）。
> 上游：`github.com/zhu1090093659/dsh-web`（Apache-2.0，默认分支 `dev`，版本 `0.4.6`）。
> 决策记录：并入方式取 **B（fork 源码）**；**不带测试**；**只换 scope + 版本沿用 0.4.6**。

---

## 1. 目标与成功标准

把上游 6 个插件 fork 进本仓库 `packages/`，以 `@fish-under-sea/*` 名义自主发布，并完成 README 更新、GitHub 推送与 npm 发布。

### 成功标准

1. `pnpm -r build` 在仓库内**一次跑通**，6 个包的 `lib/client.js` 里模块注册 id 与各自 `package.json` 的 `name` **一致**。
2. `dsh plugin add @fish-under-sea/dsh-fish` 后，6 个插件在 GUI 里**功能与 fork 前一致**（看板、Git 图谱、模型能力、SSH、用量、会话归档各就位）。
3. fork 的 6 个包与 `dsh-web-all` **不重复挂载**，DSH 正常启动。
4. README（中/英）如实反映成员数、新包名、安装与排错。
5. GitHub `main` 有新提交、npm 上 6 个子包 + 根包新版可装。

### 非目标（YAGNI）

- 不改上游功能逻辑、不做本地魔改（首版保持与 0.4.6 行为等价）。
- 不做 6 个包的独立仓库拆分（都在本 monorepo 内）。
- 不为 fork 包单独建展示站页面（沿用聚合包站点，后续再说）。
- 不引入上游 monorepo 的 scripts/tests/CI 工具链。

---

## 2. 关键技术约束（已实测）

### 2.1 改名必须重建 client bundle

`lib/client.js` 第 2 行把身份烧死在模块注册 id 里：

```js
window.__ModuleLoader__.load({ id: "@linxin666/dsh-client-ui-task-board", factory: (require) => { ... } })
```

宿主的 `@deepseek-ai/dsh-client-modules` 在 `nearestPackage()` 里按 **package.json 的 `name`** 认领包（`name === expectedPackageName` 才接受）。两者不一致 → 包认领失败 → **浏览器半区（设置页 / 面板）整个不加载**。

> **结论**：不能只改 `package.json`。必须用新的包名重新构建 `lib/client.js`。

### 2.2 构建预设必须移植

6 个包的 `tsdown.config.ts` 全部 `import { clientBundle } from '../../shared/tsdown.client.ts'`，而该文件**不在 npm 包里**。需移植 3 个文件：

| 文件 | 体量 |
|---|---|
| `shared/tsdown.client.ts` | 约 18 KB |
| `shared/web-platform.ts` | 46 行 |
| `shared/types/css-modules.d.ts` | 小型声明 |

### 2.3 源码不依赖仓库根 shared 运行时模块

实测 6 个包 `src/` 对仓库根 `shared/` 的引用数**均为 0**。因此**不需要搬整个 monorepo**，可按包干净 fork。

### 2.4 构建依赖可从 npm 获得

`@deepseek-ai/dsh-*` 的 `0.2.0-rc.2` 在 npm 的 `next` tag 下（`latest` 停在 `0.0.1-rc.1` 是 tag 指向策略，不是缺包）。构建工具：`tsdown@0.22.2`、`typescript@~5.7.2`、`lightningcss@^1.32.0`。

---

## 3. 包名与行 id 映射

| 上游包名 | fork 后包名 | 行 id |
|---|---|---|
| `@linxin666/dsh-client-ui-task-board` | `@fish-under-sea/dsh-client-ui-task-board` | `ui-task-board` |
| `@linxin666/dsh-client-ui-git-graph` | `@fish-under-sea/dsh-client-ui-git-graph` | `ui-git-graph` |
| `@linxin666/dsh-client-ui-model-capabilities` | `@fish-under-sea/dsh-client-ui-model-capabilities` | `ui-model-capabilities` |
| `@linxin666/dsh-ssh` | `@fish-under-sea/dsh-ssh` | `ssh` |
| `@linxin666/dsh-usage` | `@fish-under-sea/dsh-usage` | `usage` |
| `@linxin666/dsh-session-archive` | `@fish-under-sea/dsh-session-archive` | `session-archive` |

- **只换 scope**，其余原样（便于对照上游更新）。
- **版本沿用 `0.4.6`**（= 内容等同上游 0.4.6），NOTICE 写明基线。
- **替换范围包含源码**：`src/` 内的 `@linxin666` 也要换成 `@fish-under-sea`，否则会踩两个坑：
  1. `mountOnce("<包名>", applyImpl)` 的字符串是**进程级挂载守卫标识**（见 `shared/host/mount-once.ts`）。不改则 fork 与上游原版在同一进程被认作同一插件、互相排挤 —— 正是 README 说的「第二个来源为空操作」。
  2. `lib/client.js` 的模块注册 id 由 `clientBundle()` 首参生成，必须在**构建前**改 `tsdown.config.ts`。
  实测各包 `src/` 命中数：task-board 10、usage 16、session-archive 23、model-capabilities 11、git-graph 9、ssh 4。
- **移除遥测上报**（决策）：上游 `shared/client/telemetry.ts` 每日向 `https://dsh-market.com/api/telemetry/event` 上报包名。本 fork **移除该上报**（涉及 `dsh-task-board`、`dsh-git-graph`、`dsh-ssh` 三个包的 `index.ts`：删 import 与 `reportDailyHeartbeat(...)` 调用；`telemetry.ts` 副本一并删除）。另外三个包本就没有遥测。此改动属**行为变更**，须记入 NOTICE。
- 行 id 沿用上游独立包的原始 id，与 `dsh-web-all` 的 `web-ui-*` 前缀**天然不冲突**。

---

## 4. 目录结构

### 4.1 每个 fork 包

```text
packages/dsh-client-ui-task-board/
├── src/                     (86 文件；不含 tests)
├── lib/                     (构建产物，提交进仓库)
├── cordis.patch.yml
├── icon.svg
├── LICENSE                  Apache-2.0 全文
├── NOTICE                   来源 + 修改声明（Apache-2.0 §4b）
├── package.json             改名 + repository 指向本仓库
├── README.md / README.zh.md
├── tsconfig.json
├── tsconfig.build.json
└── tsdown.config.ts
```

### 4.2 仓库根新增

```text
shared/
├── tsdown.client.ts
├── web-platform.ts
└── types/css-modules.d.ts
```

---

## 5. 与 dsh-web-all 的冲突处理

`dsh-web-all` 当前启用并插入了这 6 行：`web-ui-task-board`、`web-ui-ssh`、`web-ui-usage`、`web-ui-session-archive`、`web-ui-git-graph`、`web-ui-model-capabilities`。

fork 后若两者同时挂载，会**重复注册服务、抢同一席位**，导致启动失败或行为异常。

**处理方式（写入 README）**：安装本聚合包的用户，需在自己的 profile 补丁里停用 `dsh-web-all` 的对应 6 行。本包 `cordis.patch.yml` **不主动改写 dsh-web-all 的行**（跨包干预会带来耦合），只做文档说明。

> 备选（更省事但更强硬）：本包 patch 直接对这 6 个 `web-ui-*` id 写 `disabled: true`。代价是「装了本包就动别人的行」，且 id 不存在时 loader 会告警。**默认不采用**，列为可选。

---

## 6. 构建与发布流程

### 6.1 构建

- 根 `package.json` 加 devDependencies：`tsdown@0.22.2`、`typescript@~5.7.2`、`lightningcss@^1.32.0`，以及各包所需的 `@deepseek-ai/*` SDK。
- **`lib/` 提交进仓库**（沿用本仓库既有约定），因此**发布流程照旧无需构建**；仅改源码时才跑 `pnpm -r build`。
- `.github/workflows/release.yml` 的注释「本仓库没有任何构建步骤」需相应更新措辞。

### 6.2 发版顺序（不可逆）

```text
提交 → push main → 6 个子包 npm publish → 根包提版本 0.8.0 → npm publish → 打 tag v0.8.0 触发 Release
```

⚠️ npm 发布**不可撤回**（只能 deprecate）。每个 publish 动作前单独确认。

---

## 7. 许可合规（Apache-2.0 义务）

6 个包均为 Apache-2.0。fork 改名发布必须：

1. 保留 `LICENSE` 全文（Apache-2.0）。
2. 保留原始版权声明。
3. 在 `NOTICE` 写明：来源仓库、来源包名与版本、修改内容（改包名/scope、涉及文件）。
4. 被修改的文件按 §4b 标注「已修改」。

---

## 8. README / CHANGELOG 更新范围

- **成员数**：7 → 13（含 6 个 fork）。实测当前 `cordis.patch.yml` 恰为 7 行 insert。
- **`包含的插件`表**：新增 6 行，注明「上游 `@linxin666/*@0.4.6` 的 Fork」。
- **正文散落的计数表述需同步**（自检发现的遗漏）：README.md 第 26/34/36/72/76/114/154/158/210 行含「七个」「成员数 8 → 7」「四个子包」「第七个成员」等表述，均需按新成员数改写；README.en.md 同构同步。
- **安装章节**：npm 镜像同步清单增加 6 个 `@fish-under-sea/*` 包；GitHub 安装的 `#path:` 列表增加 6 项。
- **新增章节**：`与 dsh-web-all 共存`（说明必须停用哪 6 行）。
- **许可章节**：说明 6 个 fork 包为 Apache-2.0（本仓库自身是 MIT，须区分标注）。
- `CHANGELOG.md` / `CHANGELOG.en.md`：新增 `0.8.0` 条目。

---

## 9. 实现计划交接（步骤）

1. 建 `packages/` 下 6 个子包骨架，移植 3 个 `shared/` 文件。
2. 逐包 fork：`src/` + `lib/` + 配置 + `LICENSE`/`NOTICE`，改 `package.json`。
3. `pnpm install` + `pnpm -r build` 跑通（**最大风险点**；失败则回退产物 fork）。
4. 验证 `lib/client.js` 的 id 与新包名一致（脚本断言）。
5. 更新根 `package.json` 依赖与 `cordis.patch.yml`（插 6 行）。
6. README / CHANGELOG 双语更新。
7. 提交 → push → 提版本 → npm 发布 → 打 tag。

---

## 10. 风险与回退

| 风险 | 影响 | 回退 |
|---|---|---|
| 构建链在本地跑不通 | 无法生成正确 client bundle | **回退产物 fork**：直接用上游 `lib/` + 二进制改 id（脆弱，仅过渡） |
| 与 dsh-web-all 重复挂载 | DSH 起不来 | 停用 dsh-web-all 对应 6 行；README 已写明 |
| npm 发布不可撤回 | 版本号被占 | 发布前逐项确认；必要时发 patch 版本 |
| Apache-2.0 合规遗漏 | 法律风险 | §7 清单逐项核对后才发布 |
| SDK 依赖拉取失败 | 构建失败 | 检查 registry；`0.2.0-rc.2` 在 `next` tag |
