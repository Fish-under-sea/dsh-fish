# 本 fork 的维护说明

本包（`dsh-fish` 单仓的 `packages/dsh-better-reasoning-effort-fish`）是 **dsh-better-reasoning-effort 的个人客制化版（fork）**，不是原创或官方发行版。当前基线为 [HaoyueQin/dsh-better-reasoning-effort](https://github.com/HaoyueQin/dsh-better-reasoning-effort) `master` **v0.5.4**，固定 commit **`2d68b65cc641cd85e95384c859a2bc3de23d9e08`**；前一基线为 v0.5.2 `52b584c`。2.0.0 起源码随 `dsh-fish` 单仓维护，历史独立仓库只保留 0.5.x 的 tag 与已发布版本。

改动范围、素材来源、MIT 许可及身份字段约束见 **[NOTICE.md](NOTICE.md)**；完整用户说明见 [中文 README](README.md) / [English README](README.en.md)。

## 跟随上游：按基线 diff 移植

本包与上游**没有共同历史**（并入单仓前是独立仓库），不能照搬 `git merge upstream/master`；也不应通过 `--allow-unrelated-histories` 将上游全树合并进来。应取得固定提交，审阅旧基线到新基线的 diff，再逐路径移植到本目录，同时保留本 Fork 差异。不要把「上游当前 master」的后续变化混入本次固定同步。

以下仅作维护命令示例，`upstream` remote 已存在则跳过添加；不要求切分支或提交：

```bash
git remote add upstream https://github.com/HaoyueQin/dsh-better-reasoning-effort.git
git fetch upstream

# 本次同步已采用的变更范围
git diff --stat 52b584c 2d68b65cc641cd85e95384c859a2bc3de23d9e08
git diff 52b584c 2d68b65cc641cd85e95384c859a2bc3de23d9e08 -- src tests scripts package.json
```

不要把上述 diff 整体覆盖应用到工作树：逐文件核对交叠改动，将上游行为移入本地实现。下一次同步应从本次 **`2d68b65cc641cd85e95384c859a2bc3de23d9e08`** 到新的固定提交计算 diff，而不是重新从 `52b584c` 起算。

### 必须保留的 Fork 差异

| 路径 / 范围 | 本版约束 |
|-------------|----------|
| `src/client/injection/provider-card-slot.ts` | 保持不使用该席位实现，不恢复对 `settings.models.provider-card` 的注册 |
| `src/client/injection/provider-card.ts` | 请求头编辑器继续挂官方卡片编辑器容器，保留 route 解析与 teardown |
| `src/client/index.ts` / `injection/models-page.ts` | 保留不占席位的装配与扫描接入 |
| `src/constants.ts` | Fish 插件 id；`PROBE_PATH` / `AUTOFILL_CONFIG_PATH` / `HEADERS_CONFIG_PATH` 使用 `/dsh-better-reasoning-effort-fish/*` |
| `package.json` / `cordis.patch.yml` / `src/constants.ts` | 包名与插件行 `name` 一致为 `@fish-under-sea/dsh-better-reasoning-effort-fish`；行 `id` 与 `PLUGIN_ID` 保持 `dsh-better-reasoning-effort-fish`；元数据保留 Fish 身份 |
| `src/client/ComposerSlider.tsx` / `model-theme.ts` / `radiation.ts` / `runner-styles.ts` | 保留八角色、深浅色、辐射效果、拖动加速与 reduced-motion 静态路径；模型 id / name 优先、provider 兜底、未知 DeepSeek |
| Composer 滑块偏好 | 不加角色开关、不强制开启；保留整个滑块的 `dsh-better-reasoning-effort.slider.enabled` 偏好 |
| `scripts/build-client.mjs` / `src/client/assets.d.ts` / `assets/` | 八张运行 PNG 经 esbuild `dataurl` 内嵌，不引入静态资源路由；保留完整第三方 MIT 许可 |
| 六份根目录说明文档 | 用户 README 保持 Fish 说明；两份 `original` 备份保持固定上游提交原文与身份 |

本次同步还包括官方 `modelOverrides` 目录安全写入、未知模型不自动填充，以及默认档守护与活动报告。2.0.0 起本包并入 `dsh-fish` 单仓：DSH 要求 **≥ 0.2.2-rc.1**，peer 与开发依赖统一到 `^0.2.2-rc.1`，发布版本为 `2.0.0`，不要误改为上游包名或版本 `0.5.4`。依赖声明对齐不等于本 Fork 已在真实 DSH 验证。

### 原始 README 备份

每次更新基线时，从**同一固定提交**原样更新两份署名备份；不将其改写成 Fish 身份，不向原文插入 Fork 说明：

```bash
git show 2d68b65:README.md > README.original.md
git show 2d68b65:README.zh.md > README_ZH.original.md
```

原文内相对链接也保留原样；它们是来源快照而不是本 Fork 的用户入口。

## 视觉来源与资源

视觉与相关代码来自 [HanaAyane/dsh-reasoning-effort PR #9](https://github.com/HanaAyane/dsh-reasoning-effort/pull/9)，贡献者 [xihucuyudaichi](https://github.com/xihucuyudaichi)，固定 commit [`651d24edc1ff45fbce5339700b40f32c5ff3ddea`](https://github.com/HanaAyane/dsh-reasoning-effort/commit/651d24edc1ff45fbce5339700b40f32c5ff3ddea)，不是浮动跟随该仓库的 master。

- 八款主题：DeepSeek / OpenAI / Claude / Gemini / Kimi / GLM / Qwen / MiniMax。
- `assets/readme/all-themes.jpg` 是素材 PR 的参考预览，**不是本插件真实 DSH 运行截图**。
- `assets/third-party/dsh-reasoning-effort.LICENSE` 完整保留来源 MIT 版权、授权及免责条款；不得只保留链接或短句替代完整许可。
- `assets/` 的八张 `*-runner-strip.png` 运行素材经 `dataurl` 内嵌进客户端 bundle；不要把参考预览当成运行资源，也不要另开资源路由。

## 发布记录：2.0.0

`2.0.0` 是本包并入 `dsh-fish` 单仓后的首个版本，与其余成员同批构建、同批发布；功能为上游 v0.5.4 同步与八主题。

- **npm**：随聚合包 `@fish-under-sea/dsh-fish@2.0.0` 一同发布，本包独立版本为 `@fish-under-sea/dsh-better-reasoning-effort-fish@2.0.0`。`files` 覆盖 `lib/`、`src/`、`assets/`、`locale/`、`docs/*.svg`、`icon.png`、`cordis.patch.yml` 与各说明文档；`lib/` 已提交，安装方无需构建。
- **GitHub Release**：由单仓 tag `v2.0.0` 触发 `.github/workflows/release.yml`，生成聚合包 `fish-under-sea-dsh-fish-2.0.0.tgz` 附件；成员包不再有各自的独立 Release 仓库。
- **历史版本**：独立仓库的 `v0.5.8` / `v0.5.9` / `v0.5.10` tag 与已发布版本保留为历史，不移动、不覆盖，并在 2.0.0 发布后标记 deprecated 引导升级；未加 scope 的 `0.5.9` 已由作者从 npm 删除。
- **验证边界**：2.0.0 合并时 `npm run typecheck` 与 `npm run build` 通过，`npm pack --dry-run` 覆盖运行所需文件；测试套件需在普通终端运行（见下），浏览器交互与真实 DSH 运行仍未验证。

## 本机开发备注（DSH 文件沙箱）

以下为既有开发环境的排障参考，不是发布流程要求的步骤。遇到权限限制应遵循当前环境审批，不绕过沙箱。

- 依赖由单仓根目录的 `pnpm install` 提供，本包目录没有自己的 `node_modules`。
- 在禁止子进程管道的沙箱里，vitest 加载 vite 配置时会因 Windows 的 `exec("net use")` 报 `EPERM`，esbuild 也无法启动自身服务。测试请换到普通终端；需要在本机沙箱内构建时，可用同版本 esbuild 的 CLI 直接产出 `lib/index.js` 与 `lib/client.js`（参数与 `scripts/build-*.mjs` 一致），再用 `npm run build:types` 生成声明文件。
- 常规构建入口仍是：

  ```bash
  npm run build
  ```

构建中的 `build:client` 包含样式检查；不要为了绕开环境问题跳过项目已有检查。`lib/` 是提交进单仓的构建产物，本包目录不再自带 `.gitignore`（由单仓根忽略 `node_modules/` 与 `*.tgz`）。
