# @fish-under-sea/dsh-video-preview

**dsh-better-sidebar 的侧栏内嵌视频预览（Fish 派生版）** —— 在侧栏编辑器里直接播 `.mp4` / `.webm` / `.mov` / `.mkv` / `.avi` 等，带 HTTP Range（可拖动进度条）。

> 本包是 [zemul/dsh-video-preview](https://github.com/zemul/dsh-video-preview) `0.1.4` 的 **Fork**（MIT，著作权归上游作者 zemul）。改动内容与依据见同目录 [`NOTICE`](NOTICE)；上游 README 见 [`README.original.md`](README.original.md)。

## 解决什么问题

侧栏自带的媒体路由把整个文件读进内存、只回 `200`（没有 `Accept-Ranges`），而且受 20MB `mediaLimit` 限制 —— 看图 / PDF 没问题，**放视频是错的**：没有 206 响应，浏览器直接禁用拖动；超过上限的文件干脆被拒。本插件注册一个独立的 `/video` 前缀路由，用 `createReadStream` 流式发送，并正确处理 `Range`、`If-Range` 与后缀区间（`bytes=-N`）。

## 本 Fork 修了什么（要紧）

**上游版本在 DSH ≥ 0.2.1-alpha.2 上「装上但永不激活」。**

上游宿主半区声明 `inject: ['webServer', 'sessions', 'webRuntime']`，而 **`webRuntime` 服务已在该内核被移除**：`dsh-web-app` 的 web-runtime 行不再 provide 它，`client-connection` 改从 `webStartup` 读取受信 authority。cordis 的 inject 语义是「服务缺失则**永久 pending**」，于是 apply 从不执行：

- `/video` 路由从不注册；
- 视频请求落到 SPA 静态兜底，非 GET/HEAD 得到**空体 405**（界面显示裸的 `HTTP 405`）。

本 Fork 的修法：

1. `inject` 只保留路由真正需要的 `webServer` 与 `sessions`；
2. 受信 authority 列表改为**每请求惰性解析**，优先级为
   `ctx.webRuntime?.trustedHosts`（旧内核或显式兼容垫片）→ `ctx.connection?.trustedHosts`（垫片镜像的同一来源，也覆盖「connection 在插件激活之后才就绪」的情形）→ `[]`；
3. `[]` 等价于**只信任回环**，因此本改动只会收紧、**绝不会放宽信任边界**；
4. `dsh.client.inject` 由 `["@deepseek-ai/dsh-client-runtime"]` 改为空数组 —— 该模块在 DSH 0.1.5 已被移除，留着重则整个浏览器 bundle 加载失败。

**未改动的部分**：Range 语义（200 / 206 / 后缀区间 / 416 / HEAD）、信任栅栏判定、路径越界防护、扩展名与 MIME 映射、侧栏查看器界面，全部与上游一致。

## 安装

作为聚合包成员（推荐）：

```powershell
dsh plugin --profile <profile> add @fish-under-sea/dsh-fish
```

单独安装：

```powershell
dsh plugin --profile <profile> add @fish-under-sea/dsh-video-preview
```

装完**重启 DSH**。

## 使用

在侧栏里打开一个视频文件（`.mp4` / `.webm` / `.mov` / `.qt` / `.m4v` / `.mkv` / `.avi` / `.wmv` / `.flv` / `.ogv` / `.ogg` / `.mpeg` / `.mpg` / `.3gp` / `.3g2` / `.m2ts`）即内嵌播放，可拖动进度、可暂停。

浏览器解不了编码的容器（`mkv` / `avi` / `wmv` 等取决于浏览器）播放器会报错，此时点右下角的**下载**拿原始文件。

## 依赖

需要 [`dsh-better-sidebar`](https://www.npmjs.com/package/dsh-better-sidebar)（客户端半区通过它的 `ctx.betterSidebar.registerFileViewer` 注册查看器）与 DSH ≥ `0.2.0-rc.2`。

## 开发与测试

```bash
node test/route.test.mjs      # 宿主路由：Range / 越界 / 跨站 / HEAD / 405，共 28 项
node test/identity.test.mjs   # 身份契约：包名 = 客户端注册 id = 补丁行名 = 宿主 name
```

两个测试都**零外部依赖**（不需要 ffmpeg 或视频样本，用临时目录里的字节文件冒充视频）。`route.test.mjs` 用 `node:http` 而非 `fetch()` 发请求 —— 信任栅栏是按 `Host` 头判定的，而 `fetch()`（undici）会把 `Host` 当禁止头静默丢弃，那样 authority 断言等于什么都没测。

> 本包**没有构建步骤**：`index.js` / `client.js` 直接提交进仓库，改完即生效（这与本仓库其它需要 `tsdown` 的 Fork 不同）。

## 许可

**MIT**，著作权归上游作者 **zemul**（见 [`LICENSE`](LICENSE)）。本派生版新增代码同样以 MIT 发布；再分发请保留 [`LICENSE`](LICENSE) 与 [`NOTICE`](NOTICE)。
