# dsh-fish

Fish 自建 DSH（DeepSeek Harness）插件聚合包。

一个包，装齐本人自建的全部 DSH 插件。结构对齐 `@linxin666/dsh-web-all`：
根目录是聚合包，子插件源码在 `packages/` 下，聚合包通过 workspace 依赖引入它们，
并由自己的 bundle 层把三个插件的宿主行一次性插入 web profile。

## 包含的插件

| 子包 | 说明 |
| --- | --- |
| [`dsh-approval-guide`](packages/dsh-approval-guide) | 在审批弹窗里追加中文说明：这次审批会做什么、有什么风险、依据是什么 |
| [`dsh-session-title-refresh`](packages/dsh-session-title-refresh) | 会话标题自动刷新：第 N 轮起总结命名，此后每 M 轮刷新一次 |
| [`dsh-git-sync`](packages/dsh-git-sync) | 一键把插件清单、启用状态、本地设置与会话记录同步到自己的 Git 仓库 |

## 安装

在任意目录执行：

```bash
dsh plugin --profile web add github:Fish-under-sea/dsh-fish
```

装完重启 DSH Web。三个插件会随聚合包一起生效。

### 为什么不写三行 `insert` 就够了

聚合包相对「直接往 profile 里写三个插件行」多了一层**故障隔离外壳**：
每个子插件都在自己的隔离边界里启动。某个子插件 import 或 start 失败时，
只记录 degraded 状态并跳过它，不会拖垮整个宿主启动。

### 子插件的运行期配置

三个插件的参数都不写在 `cordis.patch.yml` 里，而是存在各自 `$DSH_HOME` 下的
`config.json`，在 GUI 设置页里改：

| 插件 | 设置入口 | 配置文件 |
| --- | --- | --- |
| approval-guide | 无配置项 | — |
| session-title-refresh | 设置 → 会话标题自动刷新 | `$DSH_HOME/dsh-session-title-refresh/config.json` |
| git-sync | 设置 → Git 同步 | `$DSH_HOME/dsh-git-sync/config.json` |

这样每台机器可以有各自的配置，配置文件不会跟着本仓库同步过去。

## 仓库结构

```
dsh-fish/
├── package.json          # 聚合包清单（dsh.bundle.patch 指向 cordis.patch.yml）
├── cordis.patch.yml      # bundle 层：插入三个插件的宿主行
├── pnpm-workspace.yaml   # workspace 声明
├── lib/                  # 聚合包自身的宿主/浏览器半边（故障隔离外壳）
│   ├── index.js
│   ├── client.js
│   └── shells/shell.js   # exports 里各子插件路径共用的外壳入口
└── packages/
    ├── dsh-approval-guide/
    ├── dsh-session-title-refresh/
    └── dsh-git-sync/
```

## 开发

```bash
# 装 workspace 依赖
pnpm install

# 跑单个插件的测试
node packages/dsh-approval-guide/test/guide.test.mjs
node packages/dsh-session-title-refresh/test/run-all.mjs
```

## 许可证

MIT