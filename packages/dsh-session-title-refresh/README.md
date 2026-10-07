<div align="center">

# @fish-under-sea/dsh-session-title-refresh

**长会话的标题会随着对话轮次自动更新，不再停在第一句话上。**

[![npm](https://img.shields.io/npm/v/@fish-under-sea/dsh-session-title-refresh?style=flat-square&label=npm&color=cb3837)](https://www.npmjs.com/package/@fish-under-sea/dsh-session-title-refresh)
![license](https://img.shields.io/badge/license-MIT-green?style=flat-square)
![node](https://img.shields.io/badge/node-%3E%3D20-339933?style=flat-square)
![DSH](https://img.shields.io/badge/DSH-%3E%3D0.2.0--rc.2-4b6ef6?style=flat-square)
![plugin](https://img.shields.io/badge/plugin-client%20%2B%20host-6b7280?style=flat-square)

**简体中文** · [English](README.en.md)

</div>

> **注意：本插件会停用 DSH 内置的会话标题提供方（`session-title-llm`），由本插件完全接管标题生成。** 通过 `cordis.patch.yml` 在安装时自动生效。

## 解决什么问题

DSH 自带的会话标题机制只在**第一条消息**之后生成一次标题，之后永不重算。长会话的标题长期停留在最初那句话上，看着不认识了只能人工改名。

本插件停用内置标题提供方，作为**唯一提供方**负责所有标题生成（保留首条消息命名 + 新增定期刷新）：聊到第 N 轮时自动总结对话方向并命名，之后每隔 M 轮再刷新一次。N、M 与上下限都在「设置 → 会话标题自动刷新」里调，带推荐档位与可调极限阈值。

## 效果

| 机制 | 说明 |
| --- | --- |
| 触发 | 人类发言计数（插件注入的消息不计）；第 N 轮首次总结，之后每 M 轮一次 |
| 生成 | 一次**独立的辅助模型调用**（`ctx.llm.stream`，`purpose: 'session-title'`） |
| 落库 | 写进 `session/title` 事件，客户端列表行与标题栏据此更新 |
| 影响面 | **不进主对话上下文、不增加主请求 token、不阻塞主回答** |
| 取样 | 首条 + 最近若干条人类发言（默认共 8 条），首条给出起点诉求、尾部给出当前方向 |
| 超限 | 内容超过输入预算时丢中段、截断长文，**永不丢首条与最新一条** |
| 失败 | 超时 / 无路由 / 模型没吐文本 → 保留旧标题，只在设置页记一行，不影响对话 |

三条硬规矩：

1. **尊重人工命名** —— 手动改过名的会话默认停止自动刷新（可开关覆盖）。
2. **不碰子代理会话** —— 子代理对话不会被自动命名。
3. **不补跑历史** —— 触发点对齐绝对网格（第 N、N+M、N+2M… 轮）。插件热加载、恢复旧会话、改参数之后都不会突然发出一串历史命名调用，额度不会被反复烧。

## 安装

```sh
# 从 npm 安装（推荐）
# --profile 后跟本机实际的 profile 名：桌面版是 desktop，Web 版是 web
dsh plugin --profile <profile> add @fish-under-sea/dsh-session-title-refresh
```

装完**重启 DSH**（插件行与设置页都是下次启动生效），然后打开「设置 → 会话标题自动刷新」。

要改源码时才用 `link:` 指向本机 clone（仓库源码即安装源，改完重启 DSH 即生效）：它会把 `link:` 路径写进 `profiles/<profile>/package.json`，换机器前记得先 `remove`。

### 卸载 / 回退

```sh
dsh plugin --profile <profile> remove @fish-under-sea/dsh-session-title-refresh
```

移除后，`cordis.patch.yml` 里那条「停用内置首条消息提供方」的 patch 会随之失效，DSH 自动回到**出厂时的单次首条命名**行为。不需要手工改任何文件。

## 使用

| 区块 | 内容 |
| --- | --- |
| **推荐档位** | 保守 / 均衡（推荐）/ 积极。点一下就把参数填成该档位，再点「保存设置」生效 |
| **滑块** | 首次总结轮次、刷新间隔——滑块上限就是「高级」里设的可调上限 |
| **开关** | 启用自动刷新；「我手动改过名字后仍继续刷新」 |
| **标题模型（可选）** | 一个下拉：`跟随会话当前模型（默认）` / 按 provider 分组的模型列表 / `自定义…（手动填写 provider / model）`。列表与「模型」页**同源**（宿主读 `ctx.llm.listProviders()` + `listModels()`），只作建议、不作约束——目录外的组合用「自定义…」手填照样能用 |
| **高级** | 首轮轮次可调上限、刷新间隔可调上限、取样条数、输入字节预算、输出 token 上限、超时、目标词数/字数 |
| **活动会话** | 每个会话的当前轮次、下次触发轮次、已刷新次数、当前标题，以及逐会话「立即刷新」 |
| **最近自动命名** | 最近 20 条记录（成功给标题，失败给原因） |

### 标题模型下拉

v0.3.0 起，原来埋在「高级」折叠区最底部的 provider / model 两个裸文本框搬到了独立的「标题模型（可选）」卡片里，并新增一个下拉：

- **跟随会话当前模型（默认）** —— 留空即跟随，标题生成与主对话走同一条路由。
- **按 provider 分组的模型列表** —— 与 DSH 官方「模型」页**同源**：宿主调用 `ctx.llm.listProviders()` + `ctx.llm.listModels(provider)`，经新增的只读同源路由 `GET /dsh-session-title-refresh/api/models` 交给界面。实现写法与 DSH 平台自身的 `buildModelCatalog` 一致。
- **自定义…（手动填写 provider / model）** —— 目录只是建议，不是约束：DSH 本身就允许调用未列出的 model id，所以目录外的组合一律落到手填，界面只提示、不拦、不阻止保存。

降级路径（**绝不把设置页打挂**）：

- 单个 provider 的目录读失败 → 只记进 `skipped`，界面提示「这些 provider 的模型目录读不到，仍可用自定义手填」，其余 provider 照常列出。
- 整个 `ctx.llm` 不可用 → 回 `{ ok: false, reason }` 并显示原因，界面退回手填通路。

留空 = 跟随会话当前模型；选了就固定用它生成标题，与主对话走哪个模型无关。

调参提示：本插件这条额外调用按会话轮次计费。均衡档一个长会话（30 轮）大约触发 6 次辅助调用；积极档约 10 次；保守档约 3 次。嫌费额度就往保守档推。

## 配置

配置文件路径：`$DSH_HOME/dsh-session-title-refresh/config.json`，不进任何同步仓库，每台机器各调各的。

### 默认参数（均衡档）

| 参数 | 默认 | 范围 |
| --- | --- | --- |
| 首次总结轮次 | 3 | 1 – 可调上限（默认 10） |
| 刷新间隔 | 5 轮 | 1 – 可调上限（默认 20） |
| 取样条数 | 8 | 2 – 40 |
| 输入字节预算 | 4096 | 256 – 65536 |
| 输出 token 上限 | 64 | 16 – 512 |
| 超时 | 60 s | 5 – 300 s |
| 目标长度 | 5 词 / 10 个汉字 | 1 – 20 词 / 2 – 40 字 |
| 路由 | 跟随会话当前模型 | 「标题模型」下拉里选一个固定组合，或用「自定义…」手填 provider + model |

## 兼容与边界

- **DSH 每个进程只允许一个标题提供方。** 本插件的 `cordis.patch.yml` 会停用内置的 `@deepseek-ai/dsh-session-title-first-prompt-llm`（行 id `session-title-llm`），由本插件接管。行为不变——本插件同样以 `first-prompt` 节奏注册，第 1 轮照样出标题。若同时装了别的标题提供方插件，两者会互相抢位，需要停用其一。
- **标题生成失败时会保留旧标题**，不会清空、也不会退回第一条消息。
- **`enabled: false` 只停自动刷新**，第 1 轮的标题仍由本插件的提供方生成。
- 活动会话列表来自**当前进程**：DSH 重启后恢复的旧会话要等它再发一次言才会重新出现（标题本身是持久的，一直在会话日志里）。
- 第一轮生成标题需要会话已记录过主请求路由；极少数「刚建会话立刻刷新标题」的场景会因为拿不到路由而失败——此时在「标题模型」里固定一个 provider/model 即可。模型目录读不到（llm 服务未就绪）时该卡片会如实显示原因，并保留手填通路，不会把设置页打挂。
- **`FinishReason` 是对象不是字符串**（`{ kind: 'stop' }`）。装配层按 `kind` 解析，`error` / `aborted` 会把 `failure.message` 与 `failure.code` 带进报错文本。测试替身也必须喂对象——0.1.0 的替身喂的是字符串 `'stop'`，正好掩盖了这个缺陷，导致真实会话的自动命名全部报「结束原因异常（[object Object]）」（0.1.1 已修）。

## 开发与测试

```sh
# 跑全部测试（core 18 + host 20 + client 13 = 51 个用例）
node test/run-all.mjs

# 或单独跑某个文件
node test/core.test.mjs
```

> **不要**用 `node --test test/` ——测试运行器会派生子进程并捕获管道输出，在受限沙箱里以 EPERM 失败。

| 文件 | 职责 |
| --- | --- |
| `lib/core.js` | 纯逻辑：配置夹紧、轮次调度、消息取样、流装配、标题清洗、模型目录归一化（`normalizeModelCatalog`） |
| `lib/index.js` | 宿主半边：注册标题提供方、监听会话事件、同源 HTTP API（含只读 `GET /models` 模型目录路由）、`buildModelCatalog` |
| `lib/client.js` | Web 半边：设置页（不用 JSX，只 `require('react')`） |
| `cordis.patch.yml` | bundle 层：停用内置提供方 + 插入本插件行 |
| `test/*.test.mjs` | 测试套件，零依赖（只用 `node:test` 与内置模块） |

设计要点：

- **零 npm 依赖**——宿主 loader 在插件未导出 `Config` schema 时把 `config` 原样透传，所以这里不引入 schemastery；HTTP 请求体解析也是手写的。
- **轮次从会话日志推出**（`session.ownEvents()`，排除分叉继承的前缀），所以重启、恢复、热加载后计数都准确。
- **触发点对齐绝对网格**，中途接管不补跑。
- 改变规则（保存设置）时会把所有活动会话的触发点按新规则重排，同样不补跑历史。
- **模型目录只作建议**——`normalizeModelCatalog` 只做清洗（丢空 id、同 provider 内去重、丢掉一个模型都没有的 provider、`name` 缺失时用 `id` 兜底），不产出任何「拒绝」信息。单个 provider 的 `listModels` 失败只记进 `skipped`，整条 `ctx.llm` 链路失败回 `{ ok: false, reason }`——两种情况界面都退回手填，绝不让设置页打不开。

## 与聚合包的关系

> 本包是 [`@fish-under-sea/dsh-fish`](https://github.com/Fish-under-sea/dsh-fish) 聚合包的成员之一；单独安装只影响这一项。

## 许可

MIT © Fish-under-sea
