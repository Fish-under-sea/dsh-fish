# @fish-under-sea/dsh-visual-companion

[![npm](https://img.shields.io/npm/v/@fish-under-sea/dsh-visual-companion?label=npm&color=cb3837)](https://www.npmjs.com/package/@fish-under-sea/dsh-visual-companion)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](#许可)
[![node](https://img.shields.io/badge/node-%5E22.19%20%7C%7C%20%3E%3D24-339933)](https://nodejs.org)
[![DSH](https://img.shields.io/badge/DSH-%3E%3D0.2.0--rc.2-4b6ef6)](https://github.com/deepseek-ai/deepseek-harness)
![host-only](https://img.shields.io/badge/plugin-host--only-6b7280)

> **让「网页上点完就继续」**：用户在视觉伴侣页面选好选项、写两句备注、按下「提交给助手」，
> DSH 会话立刻收到一条用户消息并自动起一轮 —— 不必再回终端把选择复述一遍。

## 解决什么问题

用网页看原型、比布局、选方案时，最烦的两件事：

1. **看完还得回终端打字复述**：「我选 B，另外配色再冷一点」——看图的人不该兼职打字员；
2. **或者相反，点一下就唤醒一次**：连点三个选项，助手被打断三次，既吵又费 token。

本插件把两件事都解决：**点选过程完全静默**（只改页面本地状态），
**只有按下「提交给助手」才唤醒一次**，并把整组选择连同备注一次性送达。

## 组成

| 部分 | 文件 | 作用 |
|---|---|---|
| 宿主插件 | `lib/index.js` | 观察 `pending.json`，把一次提交投成一条用户消息并起一轮（`visual_companion` 工具） |
| 本地服务 | `bin/visual-companion.mjs` | 零依赖 Node 服务：把 HTML 片段渲染成一屏、收集选择与备注、提交时落 `pending.json` |

两者都**不接触模型 API**：服务只写文件，插件只投消息，模型调用仍由 DSH 会话自己完成。

## 安装

```sh
# 单独安装
dsh plugin --profile <profile> add @fish-under-sea/dsh-visual-companion

# 或随聚合包一次装齐（含其他 Fish 自建插件）
dsh plugin --profile <profile> add @fish-under-sea/dsh-fish
```

装完**重启该 profile 的宿主**（新插件包需要重启才进组合；之后 patch 内容变化可热重载）。

## 快速开始

```powershell
# 1) 起本地服务（受管后台任务；目录放工作区内的临时目录）
node "<包目录>/bin/visual-companion.mjs" --dir "<工作区>\.dsh-visual" --port 0 --session "$env:DSH_SESSION_ID"
#    → 打印 { url, port, key, screenDir, stateDir, pendingFile, session }

# 2) 写一屏 HTML 片段到 <dir>\screen\（语义化文件名，别复用）
#    需要完全控制页面时才写完整文档（以 <!DOCTYPE / <html 开头）

# 3) 让会话打开页面（带 ?key=，否则 403）
#    sidebar_open "<url>"
```

用户在页面上点选 + 按 **「提交给助手」** → 会话自动收到：

```text
【视觉伴侣】用户在页面上选好了 2 项：A（单栏布局）、C（混合方案），备注：间距再大一点。已同步给你，直接往下走就行（不必再问他）。
```

## 工具参考

插件注册一个工具 `visual_companion`：

| action | 参数 | 作用 |
|---|---|---|
| `arm` | `dir`、`session_id?` | 绑定目录与目标会话；`session_id` 可省略（之后由 `pending.json` 自带） |
| `disarm` | — | 解绑，关闭观察器 |
| `status` | — | 绑定状态、唤醒次数、最近一次结果、当前 `pending.json` |
| `wake` | `session_id`、`text` | 立刻探测唤醒链路（验证用，不经过页面） |

## 页面上有什么

服务自带一套框架样式与交互，**写内容片段即可**：

- 选择：`.options > .option[data-choice]`（单选）／容器加 `data-multiselect`（多选），
  点击调用 `toggleSelect(this)`；`.cards > .card` 同款；
- 视觉块：`.mockup`（原型容器）、`.split`（并排）、`.pros-cons`、`.mock-nav`、`.mock-sidebar`、
  `.mock-content`、`.mock-button`、`.mock-input`、`.placeholder`、`.section`、`.subtitle`、`.label`；
- 底栏：固定显示「已选 …」、可选备注框、**提交给助手（n 项）**按钮；页面没有可选项时自动隐藏。

落盘文件（都在 `<dir>\state\`）：

| 文件 | 内容 |
|---|---|
| `pending.json` | **只有提交才写**：`{type:"submit", selections:[{choice,text}], note, at, sessionId}`，插件观察它 |
| `events.jsonl` | 逐条追加：`click` 是点选过程（不唤醒），`submit` 是完整提交（唤醒一次） |
| `server-info` / `server-stopped` | 服务的启动信息与退出原因 |

## 工作原理

```text
页面提交 ──► 服务写 pending.json ──► 插件 fs.watch ──► 给目标会话投用户消息 ──► 会话自动起一轮
```

投递按「越接近公开面越优先」逐个降级，返回真正成功的那条：

1. `agent.followup(createUserMessage(...))` —— 与斜杠命令注入用户消息同一条路径；
2. `agent.steer(...)` —— 目标正在跑时；
3. `ctx.subagents[Symbol.for('dsh.subagent.queuePrompt' | 'deliverPrompt')]` ——
   可续期子代理的宿主内部投递钩子。

## 配置

| 键 | 默认 | 说明 |
|---|---|---|
| `watchDir` | `""` | 非空则**加载即自动绑定**该目录（配置热重载/重启都不会掉绑定）；留空则用 `visual_companion` 手动 `arm` |

目标会话**不写进配置**——它由每次提交写入的 `sessionId` 决定（服务启动时的 `--session`），
所以同一个服务可以服务不同会话，配置里也不会留机器专属的会话 id。

机器相关的绝对路径不要写进共享 bundle：需要自动绑定时，在自己的 profile patch 层用同 id 覆盖：

```yaml
- id: visual-companion
  name: '@fish-under-sea/dsh-visual-companion'
  config:
    watchDir: D:/some/workspace/.dsh-visual
```

## 边界与降级

- **host-only**：不声明 `dsh.client`，无前端、无构建；
- 服务零依赖、只用 Node 标准库；端口默认自动分配，URL 含会话密钥 `?key=`（无密钥 403）；
- 侧边栏浏览器不可用 → 把完整 URL 交给用户手动打开；没有 Node → 退回自包含 HTML + `present`；
  连插件都没有 → 下一轮手工读 `events.jsonl`；
- 服务**闲置 4 小时自动退出**（`--idle-minutes` 可调），原型文件是临时产物，别当交付物；
- 需要 Node `^22.19.0 || >=24`；不需要任何 API key。

## 开发与测试

```sh
node --test test/visual-companion.test.mjs   # 语料渲染 + 元数据
pnpm pack                                    # 产物检查：files 覆盖 bin/lib/patch/README
```

改插件的宿主代码后需要重启宿主（host 半区不热重载）；只改 `cordis.patch.yml` 的内容可热重载。

## 与聚合包的关系

本包是 [`@fish-under-sea/dsh-fish`](https://github.com/Fish-under-sea/dsh-fish) 聚合包的成员之一：
聚合包的 bundle 层会把这一行插进 profile，所以装聚合包等于装齐 Fish 自建插件。
单独安装本包则只影响这一项。

## 许可

MIT © Fish-under-sea