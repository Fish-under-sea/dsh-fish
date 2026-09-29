# @fish-under-sea/dsh-fish

Fish 自建 DSH（DeepSeek Harness）插件聚合包。

一个包，装齐本人自建的全部 DSH 插件。根目录是聚合包，子插件源码在
`packages/` 下，聚合包由自己的 bundle 层（`cordis.patch.yml`）把三个插件的
插件行一次性插入 web profile —— 装一次 `@fish-under-sea/dsh-fish` 等于装齐
三个插件。

npm 包名（`@fish-under-sea/*`）与仓库目录名（`dsh-fish/`）、GitHub 仓库名
（`Fish-under-sea/dsh-fish`）不同：只有包名带 scope。

## 包含的插件

| 子包 | 说明 |
| --- | --- |
| [`@fish-under-sea/dsh-approval-guide`](packages/dsh-approval-guide) | 在审批弹窗里追加中文说明：这次审批会做什么、有什么风险、依据是什么 |
| [`@fish-under-sea/dsh-session-title-refresh`](packages/dsh-session-title-refresh) | 会话标题自动刷新：第 N 轮起总结命名，此后每 M 轮刷新一次 |
| [`@fish-under-sea/dsh-git-sync`](packages/dsh-git-sync) | 一键把插件清单、启用状态、本地设置与会话记录同步到自己的 Git 仓库 |

## 安装

**本包必须连同三个子包一起声明**，不能只装聚合包一个；而且三个子包要写在
`devDependencies` 里。两条原因：

1. **必须显式声明** —— DSH 的浏览器半区扫描器
   （`@deepseek-ai/dsh-client-modules` 的 `locatePkgJson`）按插件行里的**包名**
   去 profile 顶层解析包目录：行名必须是完整的包名
   （`@fish-under-sea/dsh-approval-guide` 这种 `@scope/name` 两段式 scoped 名；
   多带一段子路径会被 `exactPackageSpecifier()` 判为「不是包」直接跳过）。
   子包不被声明时，它不会出现在 profile 顶层的 `node_modules/@fish-under-sea/`
   下，行就解析不到 package.json，插件的设置页与界面也不会加载。
2. **要写在 `devDependencies`** —— `dsh plugin` 每次执行都会对账
   （`@deepseek-ai/dsh` 的 `reconcilePlugins`），把 `dependencies` 里任何
   **声明了 `dsh.bundle` 的包**自动追加进 `dsh.profile.bundles`。三个子包各自
   都声明了 `dsh.bundle`，而聚合包的 patch 已经把三行插行复述了一遍 —— 子包一旦
   被提升为 bundle 层，插行就会叠加成重复行，**重复挂载会让应用启动失败**。
   `devDependencies` 同样会被 pnpm 装到 profile 顶层（`hoisted` linker），行名
   照常解析得到，但不会被对账逻辑提升为 bundle 层。

### 从 GitHub 安装（换机复原 / 同步仓用这套）

```jsonc
// profiles/web/package.json
"dependencies": {
  "@fish-under-sea/dsh-fish": "github:Fish-under-sea/dsh-fish"
},
"devDependencies": {
  "@fish-under-sea/dsh-approval-guide": "github:Fish-under-sea/dsh-fish#path:packages/dsh-approval-guide",
  "@fish-under-sea/dsh-git-sync": "github:Fish-under-sea/dsh-fish#path:packages/dsh-git-sync",
  "@fish-under-sea/dsh-session-title-refresh": "github:Fish-under-sea/dsh-fish#path:packages/dsh-session-title-refresh"
}
```

`#path:` 是 pnpm 的子目录语法，让一个仓库同时提供多个包 —— 这样四个依赖
全部指向同一个仓库，换机 `pnpm install` 后直接从 dsh-fish 下载，不依赖任何
本机绝对路径。`bundles` 里只需列 `"@fish-under-sea/dsh-fish"`（它的 patch
负责插入三行）。

### 本地开发安装

用 `link:` 指向本仓库，改源码即时生效，无需重装：

```jsonc
// profiles/web/package.json
"dependencies": {
  "@fish-under-sea/dsh-fish": "link:D:/Fish-code/DSH/插件安装/dsh-fish"
},
"devDependencies": {
  "@fish-under-sea/dsh-approval-guide": "link:D:/Fish-code/DSH/插件安装/dsh-fish/packages/dsh-approval-guide",
  "@fish-under-sea/dsh-git-sync": "link:D:/Fish-code/DSH/插件安装/dsh-fish/packages/dsh-git-sync",
  "@fish-under-sea/dsh-session-title-refresh": "link:D:/Fish-code/DSH/插件安装/dsh-fish/packages/dsh-session-title-refresh"
}
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

配置目录名仍是不带 scope 的短名（`$DSH_HOME/dsh-git-sync/` 等），与 npm 包名
解耦；改包名不会动到已有配置。

## 仓库结构

```
dsh-fish/                 # 仓库目录名（npm 包名是 @fish-under-sea/dsh-fish）
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

## 改包名时要同步的地方

包名不只是 `package.json` 里的一行字符串，五处必须一起改，漏一处就在运行期炸：

| 位置 | 漏改的后果 |
| --- | --- |
| 四个 `package.json` 的 `name` | 安装方的依赖键对不上 |
| 聚合包与三个子包 `cordis.patch.yml` 里的行 `name` | 行解析不到包，插件整条不加载 |
| **三个子包 `lib/client.js` 里 `__ModuleLoader__.load({ id })` 的 `id`** | **浏览器侧报 `loaded without registering "<包名>"`，插件加载失败** |
| 安装方 profile 的依赖键与 `bundles` | 依赖装不上、bundle 层不展开 |
| 子包在 profile 里的归属 | 必须放 `devDependencies`（见「安装」一节的第 2 条原因） |

第三条最隐蔽：loader 是拿**行里解析出的包名**去 `factories` 里认领 factory 的
（`@deepseek-ai/dsh-client-modules/lib/client.js` 的
`if (!this.factories.has(id)) throw ... loaded without registering`），
所以注册名必须严格等于包名 —— 包名带了 scope，注册名也必须带。
三个子包的客户端测试都断言了这一点，而且断言读的是 `package.json` 的 `name`
而不是硬编码字符串，所以以后再改名漏改会被测试直接抓住。

## 开发

```bash
# 装 workspace 依赖（本地开发用，不会影响安装方的解析）
pnpm install

# 跑测试
node packages/dsh-approval-guide/test/guide.test.mjs
node packages/dsh-session-title-refresh/test/run-all.mjs
node packages/dsh-git-sync/test/client.test.mjs
```

## 许可证

MIT