# 来源与署名（NOTICE）

本包（2.0.0 起位于 `dsh-fish` 单仓的 `packages/dsh-better-reasoning-effort-fish`）是 **dsh-better-reasoning-effort** 插件的**个人客制化版（fork）**，**不是原创项目，也不是上游官方发行版**。本版既有兼容修复，也移植了第三方视觉素材与交互代码，不再是「只做一处修复」。

## 原始项目与同步基线

| 项目 | 内容 |
|------|------|
| 插件名 | **dsh-better-reasoning-effort** —— 为第三方模型声明思考强度与输入模态 |
| 原作者 | **HaoyueQin** · [GitHub](https://github.com/HaoyueQin) |
| 原仓库 | <https://github.com/HaoyueQin/dsh-better-reasoning-effort> |
| 上游 npm 包名 | `dsh-better-reasoning-effort`（不属于本 Fork） |
| 许可证 | **MIT**，本仓库 [`LICENSE`](LICENSE) 保留上游原文与版权声明 |
| 本版基线 | 上游 `master` **v0.5.4**，固定 commit [`2d68b65cc641cd85e95384c859a2bc3de23d9e08`](https://github.com/HaoyueQin/dsh-better-reasoning-effort/commit/2d68b65cc641cd85e95384c859a2bc3de23d9e08) |
| 前一基线 | v0.5.2，`52b584c`；本次按两个基线之间的 diff 移植，不以独立仓库直接 merge 代替 |
| 上游原始说明备份 | [`README.original.md`](README.original.md) = `git show 2d68b65:README.md`；[`README_ZH.original.md`](README_ZH.original.md) = `git show 2d68b65:README.zh.md` |

两份备份完整保留该固定提交的原文、上游包名与原始身份，作为署名备份；不是本 Fork 的使用说明，也不将其内容改写为 Fish。

## 本版的改动范围

### 上游同步

从 v0.5.2 同步至上述 v0.5.4，包括：官方 `modelOverrides` 目录安全写入；自动填充仅处理命中精选官方知识库的模型、未知模型须用户确认自动适配；强制思考默认档守护尊重路由级 `reasoning` 默认值，并提供活动计数与最近模型报告。2.0.0 并入 `dsh-fish` 单仓后，DSH 要求与 peer / 开发依赖统一为 `^0.2.2-rc.1`；这是依赖与源码基线的对齐，**不是本 Fork 在真实 DSH 中的验证声明**。

### Fish 身份与 provider-card 兼容修复

保留 Fish 的独立包名 / 插件 id / host 路由，以及既有 DOM 注入方案：**不注册 `settings.models.provider-card` 席位，请求头编辑器改挂官方卡片自身的编辑器容器。**

官方席位为 keyed slot：同一 `(key, priority)` 只接受一个条目，第二个注册会抛错。dsh-web 的 `@linxin666/dsh-client-ui-model-capabilities` 使用同一个 `llm-pi-ai` key 和默认优先级 `0`，两者争用可能让其中一方面板因注册失败而静默缺失。本版让出席位以避免这项注册冲突，不声称本次已在真实 DSH 重测共存效果。

- [`src/client/injection/provider-card.ts`](src/client/injection/provider-card.ts)：锚定官方动作行 `[class*="editorActions"]` 的父元素，并解析 route。
- [`src/client/index.ts`](src/client/index.ts)：不再注册该席位。
- [`src/client/injection/models-page.ts`](src/client/injection/models-page.ts)：接入页面扫描与 fiber teardown。
- 上游席位实现 `src/client/injection/provider-card-slot.ts` 不恢复。
- 既有回归防护见 [`tests/provider-card.spec.tsx`](tests/provider-card.spec.tsx) 与 [`tests/client.spec.tsx`](tests/client.spec.tsx)；列出测试不代表本次文档工作运行过测试。

### 八模型家族视觉移植

Composer 滑块新增 DeepSeek / OpenAI / Claude / Gemini / Kimi / GLM / Qwen / MiniMax 八款角色主题，默认随滑块启用；不新增角色专用开关，尊重用户已关闭的整个滑块偏好。模型 `id` / `name` 优先识别，provider 兜底，未知为 DeepSeek。包括深浅色、辐射效果、拖动奔跑加速和 reduced-motion 静态呈现；仅改变展示，不声明额外模型能力。

| 来源 | 链接 / 说明 |
|------|-------------|
| 原始滑块项目与作者 | [HanaAyane/dsh-reasoning-effort](https://github.com/HanaAyane/dsh-reasoning-effort)，作者 [HanaAyane](https://github.com/HanaAyane) |
| 本次视觉素材与代码来源 | [PR #9](https://github.com/HanaAyane/dsh-reasoning-effort/pull/9)，贡献者 [xihucuyudaichi](https://github.com/xihucuyudaichi) |
| 固定来源提交 | [`651d24edc1ff45fbce5339700b40f32c5ff3ddea`](https://github.com/HanaAyane/dsh-reasoning-effort/commit/651d24edc1ff45fbce5339700b40f32c5ff3ddea) |
| 来源许可 | [该固定提交的 MIT LICENSE](https://github.com/HanaAyane/dsh-reasoning-effort/blob/651d24edc1ff45fbce5339700b40f32c5ff3ddea/LICENSE)；完整本地副本 [`assets/third-party/dsh-reasoning-effort.LICENSE`](assets/third-party/dsh-reasoning-effort.LICENSE)，保留 `Copyright (c) 2026 HanaAyane` 与完整授权 / 免责条款 |
| 运行素材 | `assets/` 下 `chibi-runner-strip.png`、`gpt-runner-strip.png`、`claude-runner-strip.png`、`gemini-runner-strip.png`、`kimi-runner-strip.png`、`glm-runner-strip.png`、`qwen-runner-strip.png`、`minimax-runner-strip.png`，经 esbuild `dataurl` 内嵌，无额外资源路由 |
| 文档参考素材 | [`assets/readme/all-themes.jpg`](assets/readme/all-themes.jpg)，为素材 PR 参考预览，**不是本插件真实 DSH 运行截图** |

感谢 HaoyueQin、HanaAyane 与 xihucuyudaichi。原项目、第三方素材及相应贡献的权利归各自权利人；本 Fork 不主张这些内容为 Fish 原创。新增代码同样以 MIT 提供，再分发须保留相关版权声明、完整许可与来源署名。

## 身份与路由（维护时必须保留）

以下位置必须保持一致，否则可能出现 `loaded without registering`：

| 位置 | 值 |
|------|-----|
| `package.json` 的 `name` | `@fish-under-sea/dsh-better-reasoning-effort-fish` |
| `cordis.patch.yml` 插件行的 `name` | `@fish-under-sea/dsh-better-reasoning-effort-fish` |
| `cordis.patch.yml` 插件行的 `id` | `dsh-better-reasoning-effort-fish` |
| `src/constants.ts` 的 `PLUGIN_ID` | `dsh-better-reasoning-effort-fish` |

host 路由 `PROBE_PATH` / `AUTOFILL_CONFIG_PATH` / `HEADERS_CONFIG_PATH` 继续使用 `/dsh-better-reasoning-effort-fish/*`，与上游区分。包元数据保留 Fish 身份；依赖、上游功能与构建资源规则随此次同步更新，不再声称 `package.json` 仅改身份字段。两版可避免身份与路由碰撞，但实际使用仍建议只启用一个，避免重复 UI 与写入。

浏览器滑块偏好键刻意保留上游的 `dsh-better-reasoning-effort.slider.enabled`，切换版本时沿用用户选择；若两者并存，该开关偏好会共享。八主题不会重置已关闭的偏好。

## 当前发布与验证状态

2.0.0 起本包随 `dsh-fish` 单仓与聚合包 `@fish-under-sea/dsh-fish@2.0.0` 同批发布，独立版本为 npm `@fish-under-sea/dsh-better-reasoning-effort-fish@2.0.0`；独立仓库的 0.5.x 版本保留为历史并标记 deprecated，未加 scope 的旧包 `0.5.9` 已由作者删除。合并时的本地检查为 `npm run typecheck`、`npm run build` 与 `npm pack --dry-run`；测试套件需在普通终端运行。素材预览和上游的验证记录均不能作为本包在真实 DSH 中已验证的证据。
