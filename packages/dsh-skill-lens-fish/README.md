# @fish-under-sea/dsh-skill-lens-fish

[English](README.en.md) | **简体中文**

> **本插件基于 [x-feichen/dsh-skill-lens](https://github.com/x-feichen/dsh-skill-lens)（MIT）改造。**
> 上游是通用实现，本版按「本机 DSH 的真实技能布局」补了几处必要适配（见下节[与上游的差异](#与上游的差异)）。
> 原作者的著作权与 MIT 许可完整保留。

**Skill Lens（Fish 版）** —— 在 DSH Web GUI 的**会话页签**里浏览、检查并管理本机全部 Agent Skill：技能清单、概览、文件浏览/编辑、**依赖图**、新建/导入/删除。

## 它解决什么

DSH 的技能有两种真实形态，而「技能用了哪些配套文件」往往看不出来：

- **目录式**：`<名称>/SKILL.md`（Claude Code 一类生态的惯例）
- **扁平式**：`<名称>.md`（DSH 用户级技能目录 `$DSH_HOME/skills/` 的常见形态）

技能正文里又常以 `../skill-refs/<文件>` 或裸文件名引用**技能目录之外**的共享资料（方法论细则、脚本、模板）。这些引用散在正文里，不跑一遍根本不知道哪个文件还在、哪个已经失联。

Skill Lens 把这两件事都变成可视的：扫描出全部技能，再把每个技能的引用画成依赖图。

## 功能

- **技能清单**：递归发现 `<名称>/SKILL.md` 与 `<名称>.md` 两种形态（排除 `node_modules`、构建产物、缓存等目录），支持搜索过滤，并标明每个技能来自「项目」还是「全局」扫描根
- **概览**：frontmatter 元数据 + Markdown 渲染的技能正文
- **文件浏览**：**仅目录式技能**提供 —— 真实目录树（可折叠）+ **编辑 / 预览切换**，改动可在右下角保存或取消。扁平技能只有它自己一个文件，该页签无信息量，故整页隐藏（代价：扁平技能在本插件内为只读，正文编辑请直接用编辑器改文件）
- **依赖图**：入口 → 分类节点 → 实际文件叶子。分类为 **文档 / 脚本 / 资产 / 未引用 / 引用资源 / 外部**；支持拖拽平移、滚轮缩放，点击文件节点跳转到文件页（扁平技能无文件页签，点击不跳转）
- **新建 / 导入**：从零创建，或导入 `.md` / `.zip` 技能包，写入项目级 `.dsh/skills` 或全局技能根
- **删除**：目录式技能删除整个目录；扁平式技能只删那一个文件（不误伤同目录其他技能）

## 与上游的差异

| 上游行为 | 本版 |
|---|---|
| 全局技能根硬编码 `~/.dsh` | **跟随 `$DSH_HOME`**：自定义 DSH_HOME 的通道（如 `~/.dsh-beta`）也能扫到；逐级回退 `$DSH_HOME/skills` → `$DSH_HOME` → `~/.dsh/skills` → `~/.dsh` |
| 只识别 `<名称>/SKILL.md` | **同时识别扁平 `<名称>.md`**，并排除 `README.md` / `index.md` 与技能包内部的 `references/*.md`（不会被误报成独立技能） |
| 技能标识 = 技能所在目录 | 扁平技能的标识 = **技能文件本身**。否则同目录下的多个扁平技能会指向同一目录，选择 / 删除 / 元数据全部串位 |
| 依赖图只认技能目录内的文件；目录外的引用直接丢节点 | 新增 **「引用资源」分类**：调用宿主新增的 `resolve-refs` 把引用解析成真实路径后入图，标签显示相对 `$DSH_HOME` 的路径；**解析不到的引用仍然不显示**（沿用上游「磁盘上没有就不画」的口径） |
| `files` / `read` / `delete` / `batch-delete` / `skill-meta` 只支持目录式技能 | 同时支持扁平式技能（删除只删文件；导出 ZIP 时以技能文件名呈现） |
| `lib/client.js` 的注册名硬编码在构建脚本里 | 构建脚本**现读 `package.json` 的 `name`**，改包名不可能漏改 |

原有分类（文档 / 脚本 / 资产 / 未引用 / 外部）与目录式技能的行为**未改动**，回归测试覆盖。

## 安装

本插件是 [`@fish-under-sea/dsh-fish`](https://github.com/Fish-under-sea/dsh-fish) 聚合包的成员之一，装聚合包即随附：

```sh
dsh plugin --profile <profile> add @fish-under-sea/dsh-fish
```

也可以单独安装：

```sh
dsh plugin --profile <profile> add @fish-under-sea/dsh-skill-lens-fish
```

安装后**重启 DSH**，打开任意会话，页签栏出现 **Skill Lens**。

### 验证

```sh
dsh --profile <profile> --dump-config | grep skill-lens
# 出现 - id: skill-lens / name: @fish-under-sea/dsh-skill-lens-fish 即挂载成功
```

### 卸载

```sh
dsh plugin --profile <profile> remove @fish-under-sea/dsh-skill-lens-fish
```

## 扫描哪些目录

| 位置 | 路径 | 说明 |
|---|---|---|
| 项目级 | `<会话工作区>/.dsh/skills` | 跟随当前会话的工作区；不存在时跳过 |
| 全局级 | `$DSH_HOME/skills` | 逐级回退 `$DSH_HOME` → `~/.dsh/skills` → `~/.dsh` |

两者都支持 `<名称>/SKILL.md` 与 `<名称>.md` 两种形态。符号链接一律不跟随（与上游一致）。

## 开发

```sh
pnpm install
pnpm typecheck                    # tsc --noEmit
pnpm build                        # esbuild → lib/index.js + lib/client.js
pnpm test                         # 宿主 + 浏览器半边测试
```

`lib/` 是**构建产物但提交进仓库**（与上游 fork 的常规做法一致），所以克隆下来即可 `npm pack` / 直接以 `link:` 安装。**改完 `src/` 必须重新 `pnpm build`**，且 `lib/` 的改动要一并提交，否则安装方拿到的还是旧产物。

> 客户端注册名由构建脚本从 `package.json` 现读；`test/client.test.mjs` 会断言两者一致。

## 许可

**MIT**。上游 [x-feichen/dsh-skill-lens](https://github.com/x-feichen/dsh-skill-lens) 同样以 MIT 分发，**著作权归原作者**。本版是在其基础上的改造，来源与改动范围见本文件顶部与[与上游的差异](#与上游的差异)。

上游仓库的 README 附有界面截图，可移步查阅；本版 README 未内嵌截图。
