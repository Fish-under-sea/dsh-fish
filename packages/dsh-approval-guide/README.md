<div align="center">

# @fish-under-sea/dsh-approval-guide

**给 DSH 审批弹窗补一段中文说明：这次审批会做什么、有什么风险、依据是什么。**

[![npm](https://img.shields.io/npm/v/@fish-under-sea/dsh-approval-guide?style=flat-square&label=npm&color=cb3837)](https://www.npmjs.com/package/@fish-under-sea/dsh-approval-guide)
![license](https://img.shields.io/badge/license-MIT-green?style=flat-square)
![node](https://img.shields.io/badge/node-%5E22.19%20%7C%7C%20%3E%3D24-339933?style=flat-square)
![DSH](https://img.shields.io/badge/DSH-%3E%3D0.2.0--rc.2-4b6ef6?style=flat-square)
![client+host](https://img.shields.io/badge/plugin-client%20%2B%20host-6b7280?style=flat-square)

</div>

## 解决什么问题

审批弹窗的框架文案本来就有中文（「等待审批」「拒绝」「允许一次」），但**审批理由由宿主生成，只有英文**。最常见的一条长这样：

```text
escalate sandbox to danger-full-access: <模型填写的一句英文理由>
```

读者要自己判断「这条命令到底会做什么、放开到什么程度、有什么后果」，而英文句式把这个判断成本抬高了。本插件在审批理由与命令下方插入中文分级说明，把「会做什么 / 风险 / 依据」三件事讲清楚。

## 效果

审批卡片内的详情区会变成：

```text
<原命令>

这次审批会做什么
把这一次 pwsh 调用的文件沙箱范围提升到「完全放开」（danger-full-access）。
只对本次调用生效：不产生长期授权，也不影响之后的命令。
风险
放开后这条命令不再受工作区边界约束：它可以读写本机任意文件，
包括系统目录、其它项目、SSH 密钥与凭据文件，
本次执行也不再逐条征求你的同意。只有在你完全信任这条命令时才应允许。
  · 工具：pwsh
  · 目标权限：完全放开（danger-full-access）
  · 模型给的理由：<原文>
拿不准就先点「拒绝」：拒绝不会中断对话，之后我可以换成只读、
或只写工作区内的方式重试。
```

说明一律中文显示，不跟随界面语言——界面切到英文时，中文提示仍然在。

### 文案分级

中文说明由**静态规则**生成，不额外调用模型、不消耗 API 额度，也不会被请求方自己的说辞带偏。

| 目标权限 | 级别 | 风险文案要点 |
| --- | --- | --- |
| `danger-full-access` | 高危（红色标题） | 不再受工作区边界约束，可读写本机任意文件（含系统目录、其它项目、SSH 密钥与凭据文件），本次执行不再逐条审批。 |
| `workspace-write` | 注意 | 可写当前工作区目录及其子目录、系统临时目录；工作区之外仍不能写入。 |
| 其它模式 | 注意 | 不是 DSH 内置模式，无法给出确切范围，提示按请求权限运行。 |
| 无沙箱参数 | 注意 | 通用兜底：工具请求以更高权限执行本次操作，仅本次有效。 |

## 安装

```sh
# 从 npm 安装（推荐）
dsh plugin --profile <profile> add @fish-under-sea/dsh-approval-guide
```

`--profile` 后跟本机实际的 profile 名：桌面版 `desktop`，Web 版 `web`。

要改源码时才用 `link:` 指向本目录（仓库源码即安装源，改完重启 DSH 即生效）：

```sh
dsh plugin --profile <profile> add "link:<本目录的绝对路径>"
```

安装后需要**重启 DSH 应用并刷新页面**才会生效（Web 端没有原地重启）。

### 卸载

```sh
dsh plugin --profile <profile> remove @fish-under-sea/dsh-approval-guide
```

### 安装后自检

```sh
dsh --profile <profile> --dump-config
```

输出末尾应恰好出现一行 `- id: approval-guide` / `name: @fish-under-sea/dsh-approval-guide`。多行即重复挂载，应用会启动失败。

## 使用

安装后无需任何操作——插件自动占用审批详情的 `conversation.approval.detail` 插槽，在每次审批弹窗里追加中文说明。

说明的取值按「纵深防御」分层：先看工具调用参数 `sandbox_permissions` / `justification`，取不到再解析宿主理由句式（`escalate sandbox to <mode>: <理由>`），再取不到走通用兜底。层层都拿不到时仍然显示通用中文说明。

覆盖范围：

- 所有**带关联工具调用**的交互式审批：沙箱权限升级、hook 触发的 ask、其它插件通过审批通道发起的 ask。

## 配置

**无配置文件。** 本包没有任何配置项，也不读写设置文件——所有规则硬编码在 `lib/client.js` 里。

## 兼容与边界

- 平台：纯浏览器插件（`dsh.client.platform: web`），宿主半区是空实现。
- 占用核心包 `@deepseek-ai/dsh-client-ui-approval` 的 `conversation.approval.detail` 子插槽。该插槽为 `single` 类型，按优先级**升序**排列、**数字最小者渲染**；官方占用者 `ApprovalCommand` 用默认优先级 0，本插件注册 `priority: -1` 覆盖它，并在组件里用同一套逻辑（`useChat` 取关联工具调用、解析 `argsRaw.command`）把命令原文重新渲染回来，不丢信息。
- 组件抛错时，插槽渲染器会回收该条目（abdicate），官方 `ApprovalCommand` 自动恢复渲染——审批卡不会留白，也不会卡住审批流程。
- 兼容 DSH 0.2.0（`useSessionStatus`）与 0.1.x（`useSessionPendingInteraction`）两代选择器。

数据源：

| 数据 | 来源 |
| --- | --- |
| 关联工具调用的命令与参数 | `useChat` 选择器（与官方 `ApprovalCommand` 同款） |
| 工具名与审批理由 | `useSessionPendingInteraction` / `useSessionStatus` 选择器（`kind === 'approval'` 的待办交互） |

### 已知限制

- 审批请求若**不带关联工具调用**（`callId` 缺失），核心不会渲染详情区，本插件也就没有插入位置。这是核心插槽契约决定的，不是本插件可以绕过的。
- 中文说明解释的是「权限范围」这一层风险，不判断命令本身是否安全。命令原文要自己看。
- 宿主若调整理由句式（`escalate sandbox to <mode>: <理由>`），第一层参数取值仍然有效，只有第二层兜底会失效。

## 开发与测试

```sh
node packages/dsh-approval-guide/test/guide.test.mjs
```

当前 12 个用例全部通过。测试装载的是真正会进浏览器的 `lib/client.js`：用 `node:vm` 提供 `window.__ModuleLoader__`，抓住 bundle 注册的 factory，再用假模块表实例化，直接断言纯函数与组件产出的元素树。**零依赖**，不需要安装 React 或 vitest。

> 不要用 `node --test test/`：测试运行器会派生子进程并捕获管道输出，在受限沙箱里会以 `EPERM` 失败。直接运行测试文件即可。

覆盖的用例：两种沙箱模式的分级文案、理由兜底解析、未知模式、通用审批兜底、参数 JSON 损坏、空输入不抛异常、组件保留命令原文、取不到 pending 时降级、插槽注册优先级。

目录结构：

| 路径 | 作用 |
| --- | --- |
| `lib/index.js` | 宿主半区，空实现（纯浏览器插件） |
| `lib/client.js` | 浏览器半区：中文文案、分级逻辑、审批详情组件、插槽注册 |
| `cordis.patch.yml` | bundle 补丁层，把插件行插入 profile 名册 |
| `test/guide.test.mjs` | 零依赖测试 |

## 与聚合包的关系

> 本包是 [`@fish-under-sea/dsh-fish`](https://github.com/Fish-under-sea/dsh-fish) 聚合包的成员之一；单独安装只影响这一项。

## 许可

MIT © Fish-under-sea
