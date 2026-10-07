<div align="center">

# @fish-under-sea/dsh-visual-companion

**网页上点完就继续 —— 给 DSH 会话配一个视觉伴侣，点选、备注、提交，会话自动起一轮。**

[![npm](https://img.shields.io/npm/v/@fish-under-sea/dsh-visual-companion?style=flat-square&label=npm&color=cb3837)](https://www.npmjs.com/package/@fish-under-sea/dsh-visual-companion)
![license](https://img.shields.io/badge/license-MIT-green?style=flat-square)
![node](https://img.shields.io/badge/node-%5E22.19.0%20%7C%7C%20%3E%3D24.0.0-339933?style=flat-square)
![DSH](https://img.shields.io/badge/DSH-%3E%3D0.2.0--rc.2-4b6ef6?style=flat-square)
![plugin](https://img.shields.io/badge/plugin-host%20only-6b7280?style=flat-square)

**简体中文** · [English](README.en.md)

</div>

## 解决什么问题

用网页看原型、比布局、选方案时，最烦的两件事：

1. **看完还得回终端打字复述**：「我选 B，另外配色再冷一点」—— 看图的人不该兼职打字员；
2. **或者相反，点一下就唤醒一次**：连点三个选项，助手被打断三次，既吵又费 token。

本插件把两件事一起解决：**点选过程完全静默**（只改页面本地状态），**只有按下「提交给助手」才唤醒一次**，并把整组选择连同备注一次性送达。

## 效果

- **点选静默**：任意点选、取消、填备注都不发请求、不叫醒会话；
- **一次提交 = 一次唤醒**：整组选择 + 备注拼成一条用户消息，例如
  `【视觉伴侣】用户在页面上选好了 2 项：A（单栏布局）、C（混合方案），备注：间距再大一点。已同步给你，直接往下走就行（不必再问他）。`
- **自动继续**：会话收到后直接起一轮接着干，不需要用户复述；
- **界面自适应**：单选 / 多选（容器加 `data-multiselect`）、备注框、等待屏；页面没有可选项时自动隐藏提交栏。

## 安装

```sh
# 推荐：从 npm 安装（--profile 后跟本机 profile 名：桌面版 desktop，Web 版 web）
dsh plugin --profile <profile> add @fish-under-sea/dsh-visual-companion

# 改源码时才用 link:（仓库源码即安装源，改完重启 DSH 即生效）
dsh plugin --profile <profile> add "link:<仓库路径>/packages/dsh-visual-companion"
```

装完**重启该 profile 的宿主**（新插件包需要重启才进组合；之后只改 `cordis.patch.yml` 内容可热重载）。

## 使用

本包由**两部分**组成，都不接触模型 API：

- **本地服务**（`bin/visual-companion.mjs`）：零依赖 HTTP 服务，负责渲染页面、接收点击、写 `events.jsonl` 与 `pending.json`；
- **宿主插件**（`lib/index.js`）：观察 `state/pending.json`，一有提交就给目标会话投一条用户消息并起一轮。

### 起本地服务

受管后台任务；目录放工作区内的临时目录：

```sh
node "$DSH_HOME/profiles/<profile>/node_modules/@fish-under-sea/dsh-visual-companion/bin/visual-companion.mjs" \
  --dir "<工作区>/.dsh-visual" --port 0 --session "$DSH_SESSION_ID"
# → 打印 { url, port, key, screenDir, stateDir, pendingFile, session }
```

### 写屏

把 HTML 片段写到 `<dir>/screen/`（语义化文件名、别复用；需要完全控制页面时才写完整文档，即以 `<!DOCTYPE` / `<html` 开头）。

### 打开页面

把 `url` 连同 `?key=` 一起交给用户（DSH 里用 `sidebar_open` 开在右侧栏）。密钥缺失会被 403 拒绝。

### 框架样式

服务自带的框架样式提供这些类，写片段即可用：

| 用途 | 类 |
| --- | --- |
| 选项（单选 / 容器加 `data-multiselect` 变多选） | `.options` > `.option[data-choice]`，点击调 `toggleSelect(this)`；`.cards` > `.card` 同款 |
| 视觉块 | `.mockup`、`.split`、`.pros-cons`、`.mock-nav`、`.mock-sidebar`、`.mock-content`、`.mock-button`、`.mock-input`、`.placeholder` |
| 文字层级 | `h2` / `h3` / `.subtitle` / `.section` / `.label` |

### `visual_companion` 工具

插件注册一个工具 `visual_companion`：

| action | 参数 | 作用 |
| --- | --- | --- |
| `arm` | `dir`、`session_id?` | 绑定目录与目标会话；`session_id` 可省略（之后由 `pending.json` 自带） |
| `disarm` | — | 解绑并关闭观察器 |
| `status` | — | 绑定状态、唤醒次数、最近一次结果、当前 `pending.json` |
| `wake` | `session_id`、`text` | 立刻探测唤醒链路（不经过页面） |

### 落盘文件

落盘文件都在 `<dir>/state/`：

| 文件 | 内容 |
| --- | --- |
| `pending.json` | **只有提交才写**：`{type:"submit", selections:[{choice,text}], note, at, sessionId}`，插件观察它 |
| `events.jsonl` | 逐条追加：`click` 是点选过程（不唤醒），`submit` 是完整提交（唤醒一次） |
| `server-info` / `server-stopped` | 服务启动信息与退出原因 |

### 斜杠命令 `/companion`

在会话里直接输入：

```text
/companion [想看的主题]
```

插件会：**①** 若本地服务没在跑就后台拉起它（零依赖、自动分配端口）；**②** 把带会话密钥的完整 URL 交给当前会话的助手，让它用 `sidebar_open` 开在右侧栏；**③** 让助手绑好观察器并把第一屏原型写进 `screen/`。之后你只管点选 + 写备注 + 按「提交给助手」。

> 命令只负责「起服务 + 交接」，页面上该显示什么仍由助手写 HTML 片段决定 —— 所以它比手敲 `bin/visual-companion.mjs` 省事，但不会替你决定看什么。

## 配置

| 键 | 默认 | 说明 |
| --- | --- | --- |
| `watchDir` | `""` | 非空则**加载即自动绑定**该目录（配置热重载 / 重启都不会掉绑定）；留空则用 `visual_companion` 手动 `arm` |

目标会话**不写进配置**：它由每次提交写入的 `sessionId` 决定（服务启动时的 `--session`），所以同一个服务可以服务不同会话，配置里也不会留机器专属的会话 id。

机器相关的绝对路径不写进共享 bundle，需要自动绑定时在自己的 profile patch 层用同 id 覆盖：

```yaml
- id: visual-companion
  name: '@fish-under-sea/dsh-visual-companion'
  config:
    watchDir: D:/some/workspace/.dsh-visual
```

## 兼容与边界

投递按「越接近公开面越优先」逐个降级，返回真正成功的那条：

1. `agent.followup(createUserMessage(...))` —— 与斜杠命令注入用户消息同一条路径；
2. `agent.steer(...)` —— 目标正在跑时；
3. `ctx.subagents[Symbol.for('dsh.subagent.queuePrompt' | 'deliverPrompt')]` —— 可续期子代理的宿主内部投递钩子。

- **host-only**：宿主插件（不声明 `dsh.client`、没有浏览器半区、没有前端构建）+ 本地服务（零依赖 HTTP 服务，提供带交互的浏览器页面）。那个页面由本地服务自己提供，**不是** DSH 客户端插件；
- 服务零依赖（只用 Node 标准库）、端口自动分配、URL 带会话密钥；`--host 0.0.0.0 --url-host <主机名>` 可用于远程 / 容器，但**必须保留 `?key=`**；
- 服务**闲置 4 小时自动退出**（`--idle-minutes` 可调），原型文件是临时产物，别当交付物；
- 降级链：无 Node → 自包含 HTML + `present`；无侧边栏浏览器 → 把完整 URL 交给用户手动打开；连插件都没装 → 下一轮手工读 `events.jsonl`；
- 需要 Node `^22.19.0 || >=24`、DSH `>=0.2.0-rc.2`；不需要任何 API key；
- **绑定是容错的**（0.1.5 起）：`watchDir` 指向的 `<watchDir>/state` 还不存在时会**递归自建**；万一观察不了（路径不是目录、权限不足），只记一条告警并把状态如实留成「未绑定」——**插件照常加载**，工具与 `/companion` 不会一起消失，修好后 `visual_companion({action:"arm"})` 可重试；
- **已知限制**：宿主插件代码不热重载 —— 改 `lib/index.js` 后要重启宿主；只改 `cordis.patch.yml` 的内容可热重载。

## 开发与测试

```sh
# 全新 clone 需先在包目录 pnpm install（运行时零依赖，但测试需要 devDependencies 里的 3 个 DSH 包）
node packages/dsh-visual-companion/test/visual-companion.test.mjs   # 语料渲染 + 清单契约 + 绑定容错（10 用例）
pnpm pack                                                          # 产物检查：files 覆盖 bin / lib / patch / README
```

`lib/message.js` 是**零依赖纯函数**（语料渲染），所以测试与调用方不装 `@deepseek-ai/*` 也能验证文案；`lib/index.js` 才依赖宿主提供的 `@deepseek-ai/dsh-llm`、`dsh-tools`、`schemastery`（**运行时**是可选 peer，由 DSH 提供；**测试时**同一组包另以 `devDependencies` 声明，所以全新 clone 直接 `pnpm install` 就能跑测试，不必手工往 `node_modules` 里塞）。

## 与聚合包的关系

本包是 [`@fish-under-sea/dsh-fish`](https://github.com/Fish-under-sea/dsh-fish) 聚合包的成员之一：聚合包的 bundle 层会把这一行插进 profile，所以装聚合包等于装齐 Fish 自建插件。单独安装本包则只影响这一项。

## 许可

MIT © Fish-under-sea
