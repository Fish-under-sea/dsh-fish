# dsh-fish

Fish 自建 DSH（DeepSeek Harness）插件聚合包。

一个包，装齐本人自建的全部 DSH 插件。根目录是聚合包，子插件源码在
`packages/` 下，聚合包由自己的 bundle 层（`cordis.patch.yml`）把三个插件的
插件行一次性插入 web profile —— 装一次 dsh-fish 等于装齐三个插件。

## 包含的插件

| 子包 | 说明 |
| --- | --- |
| [`dsh-approval-guide`](packages/dsh-approval-guide) | 在审批弹窗里追加中文说明：这次审批会做什么、有什么风险、依据是什么 |
| [`dsh-session-title-refresh`](packages/dsh-session-title-refresh) | 会话标题自动刷新：第 N 轮起总结命名，此后每 M 轮刷新一次 |
| [`dsh-git-sync`](packages/dsh-git-sync) | 一键把插件清单、启用状态、本地设置与会话记录同步到自己的 Git 仓库 |

## 安装

**本包必须连同三个子包一起声明**，不能只装聚合包一个。原因是 DSH 的
浏览器半区扫描器（`@deepseek-ai/dsh-client-modules` 的 `locatePkgJson`）
用 `exactPackageSpecifier()` 过滤插件行：非 scoped 的包名只要含 `/` 就判为
「不是包」直接跳过。因此插件行只能写裸包名（`dsh-approval-guide`），而裸包名
要求子包位于 profile 顶层 —— 子包不被声明时，插件的设置页与界面不会加载。

### 从 GitHub 安装（换机复原 / 同步仓用这套）

```jsonc
// profiles/web/package.json 的 dependencies
"dsh-fish": "github:Fish-under-sea/dsh-fish",
"dsh-approval-guide": "github:Fish-under-sea/dsh-fish#path:packages/dsh-approval-guide",
"dsh-git-sync": "github:Fish-under-sea/dsh-fish#path:packages/dsh-git-sync",
"dsh-session-title-refresh": "github:Fish-under-sea/dsh-fish#path:packages/dsh-session-title-refresh"
```

`#path:` 是 pnpm 的子目录语法，让一个仓库同时提供多个包 —— 这样四个依赖
全部指向同一个仓库，换机 `pnpm install` 后直接从 dsh-fish 下载，不依赖任何
本机绝对路径。`bundles` 里只需列 `"dsh-fish"`（它的 patch 负责插入三行）。

### 本地开发安装

用 `link:` 指向本仓库，改源码即时生效，无需重装：

```jsonc
"dsh-fish": "link:D:/Fish-code/DSH/插件安装/dsh-fish",
"dsh-approval-guide": "link:D:/Fish-code/DSH/插件安装/dsh-fish/packages/dsh-approval-guide",
"dsh-git-sync": "link:D:/Fish-code/DSH/插件安装/dsh-fish/packages/dsh-git-sync",
"dsh-session-title-refresh": "link:D:/Fish-code/DSH/插件安装/dsh-fish/packages/dsh-session-title-refresh"
```

不要用 `file:` 指向本仓库：pnpm 会把 `file:` 目录依赖当「无哈希的目录依赖」
缓存，改了源码后 `pnpm install`（连 `--force` 也一样）不会重新复制，必须手动
删掉 `node_modules/dsh-*` 再装。`link:` 没有这个问题。

装完重启 DSH Web。

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
├── cordis.patch.yml      # bundle 层：插入三个插件的插件行
├── pnpm-workspace.yaml   # workspace 声明（本地开发用）
├── lib/                  # 聚合包自身的空实现（本包不注册任何东西）
│   ├── index.js
│   └── client.js
└── packages/
    ├── dsh-approval-guide/
    ├── dsh-session-title-refresh/
    └── dsh-git-sync/
```

聚合包本身不实现功能，也**不把子包声明为自己的 dependencies** ——
那样 pnpm 会把 `file:packages/*` 解析成「相对于安装方目录」的路径，
从 GitHub 安装时直接报 `ERR_PNPM_LINKED_PKG_DIR_NOT_FOUND` 失败。
子包由安装方的 profile 显式声明（见上面的两种安装方式）。

## 开发

```bash
# 装 workspace 依赖（本地开发用，不会影响安装方的解析）
pnpm install

# 跑测试
node packages/dsh-approval-guide/test/guide.test.mjs
node packages/dsh-session-title-refresh/test/run-all.mjs
```

## 许可证

MIT