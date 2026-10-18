<div align="center">

<img src="icon.png" alt="@fish-under-sea/dsh-fish" width="120">

# @fish-under-sea/dsh-fish

**One package to install every Fish-made DSH plugin**

[![npm](https://img.shields.io/npm/v/@fish-under-sea/dsh-fish?style=flat-square&label=npm&color=cb3837)](https://www.npmjs.com/package/@fish-under-sea/dsh-fish)
![license](https://img.shields.io/badge/license-MIT-green?style=flat-square)
![node](https://img.shields.io/badge/node-%3E%3D20-339933?style=flat-square)
![DSH](https://img.shields.io/badge/DSH-%3E%3D0.2.0--rc.2-4b6ef6?style=flat-square)
![bundle](https://img.shields.io/badge/kind-bundle-6b7280?style=flat-square)

[简体中文](README.md) · **English**

</div>

---

> **0.10.4 (2026-10-18):** **Team plugin upgraded to `dsh-agent-teams-fish@0.7.3` — fixes "teams get created but no member can start" on the new host; `dsh-our-free-model-fish` is removed from the bundle. Member count 14 → 13.**
>
> - **Member dispatch fixed**: DSH NEXT 2.0.x's spawn provider declares only `agentPreset` (no persona / toolFilter capability), while the old plugin still passed member personas through `startActivation` — every member failed with `provider "spawn" cannot apply a member persona`. 0.7.3 installs the persona section and tool filter from inside the plugin's own activation hook on such preset-only hosts.
> - **Corrupted child sessions fixed**: the old plugin wrote a `agent-teams/member-composition` event into child session logs; host 2.0.19 does not know that event type and it was not marked ignorable, so reading the child session threw `SessionFormatUnsupportedError: … refusing to interpret the log`. 0.7.3 uses the host's plugin-record channel (`appendPluginRecord`, automatically ignorable) and rebuilds compositions from `team.json` on cold resume. Sessions already corrupted need that one unknown event removed by hand (the new version never writes it, so new sessions are unaffected).
> - **Compatibility matrix**: `0.2.1-rc.2` (the host version bundled with DSH NEXT 2.0.19) is now in the exact-host matrix, and all 21 `@deepseek-ai/dsh-*` peer ranges were widened accordingly.
> - **`dsh-our-free-model-fish` removed from the bundle**: install it separately with `dsh plugin --profile <profile> add dsh-our-free-model-fish` if you need it. Its entry id (`our-free-model`) and data directory (`$DSH_HOME/our-free-model/`) are unchanged, so **existing channel settings, check-ins and ledgers are untouched**.
> - **Why removed**: its 13 channel providers and channel gateway are heavy, opt-in configuration; keeping it in the all-in-one bundle forced that dependency on people who never use free channels, and its release cadence is faster than the bundle's.
> - **Upgrade**: `dsh plugin --profile <profile> add @fish-under-sea/dsh-fish@0.10.4`, then restart DSH. Team data needs no migration.
> **🆕 0.10.2（2026-10-17）**：**团队插件升级至 `dsh-agent-teams-fish@0.7.2`，修复新版宿主上的成员启动、停止与模型调派。**
>
> - **根因**：DSH `0.2.1-alpha.2` 的子代理入口已改为 `startActivation`，旧守卫仍调用已移除的 `startContinuable`，派发报 `Cannot read properties of undefined (reading 'call')`。历史宿主白名单声明不等于这条启动路径已兼容。
> - **修复**：新旧启动与递归停止接口统一适配；保留父级交付、持久化、工具策略和委派预算。成员最终路由与备用路由遵守会话捕获的子代理模型白名单，不再静默继承白名单外的队长模型，也不自动选择替代模型。
> - **验收**：Windows 本机真实成员完成领取、执行与回报，32/32 回归通过，原始请求头确认预选模型和推理档位；团队插件另已通过 Ubuntu / Windows 静态检查及全部 9 个精确宿主的真实运行时矩阵。详见 [团队插件发布说明](https://github.com/Fish-under-sea/dsh-agent-teams-fish/releases/tag/v0.7.2)。
> - **范围**：聚合包仅将团队依赖下限从 `^0.7.1` 提升至 `^0.7.2`，仍为 14 个插件，其他依赖与插件行不变。
> - **升级**：`dsh plugin --profile <profile> add @fish-under-sea/dsh-fish@0.10.2`，完成后重启 DSH。无需迁移团队数据；不会自动重试失败派发或恢复用户暂停的团队。

> **🆕 0.10.1 (2026-10-16):** **`dsh-agent-teams-fish` 0.7.0 → 0.7.1 — fixes "a blank optional field makes team creation impossible".**
>
> - **Symptom**: a captain model that materializes every optional parameter as `""` instead of omitting it could never call `agent_teams_create`: it failed with `profiles.inline-plan.members[0].tool_policy must not be empty`, and switching to the literal `"default"` failed with `unknown tool policy "default" (no toolPolicies are configured in this deployment)`. The model then retried between the two errors (one real session: 34 consecutive failures, 0 successes, before it gave up and called it its own mistake) — **no member ever spawned**.
> - **Root cause**: the `add_member` / `edit_plan` path runs blank strings through `trimmedOptional()`, which normalizes them to `undefined` (accepted), while the inline-plan path uses `optionalNonEmptyString()`, which rejects any blank string — **the two paths disagreed**. The defect lives in `src/profiles.ts` and still exists unfixed in upstream v0.1.23.
> - **Fix**: `optionalNonEmptyString` now returns `undefined` for blank/whitespace-only values, matching the edit path. Required fields (`name`, task `id` / `subject`, `fallback.provider|model`, dependency ids) stay strict, and non-string values remain hard errors. Adds `scripts/inline-plan-blank-optional-tdd.mjs` (23 assertions), wired into `pnpm verify`.
> - **Also fixes two pre-existing `pnpm verify` failures**: `MTIME_TOLERANCE_MS` goes from 1 to 4 (`mtime` and `Date.now()` come from two different clocks; on Windows the filesystem clock runs up to 2.2 ms ahead, so a 1 ms tolerance misread files written *before* a verdict as modified *after* it — the precondition failed about 57.75% of the time); and a new `scripts/symlink-support.mjs` probes symlink permission uniformly so Windows without Developer Mode skips with a stated reason instead of failing outright.
> - **How to upgrade**: `dsh plugin --profile <profile> add @fish-under-sea/dsh-fish` (or any other install route in the README). No config migration from `0.7.0` — this release only relaxes validation.

> **🆕 0.10.0 (2026-10-13):** **six forked sub-packages gain a uniform `-fish` suffix; `dsh-client-ui-model-capabilities` is dropped. Member count 15 → 14.**
>
> - **Why `-fish`**: the derivatives in this repository (**forks** of other people's packages) were named inconsistently — some carried `-fish` (`dsh-skill-lens-fish`), some did not (five upstream forks). The convention is now uniform: **every derivative ends in `-fish`**, while Fish's own original packages (`dsh-approval-guide` / `dsh-git-sync` / `dsh-settings-nav-order` / `dsh-visual-companion` / `dsh-session-title-refresh`) keep their names.
> - **Rename list** (five upstream forks: `0.4.x → 0.5.0`; video-preview: `0.1.5 → 0.2.0`):
>
>   | Old name | New name |
>   |---|---|
>   | `@fish-under-sea/dsh-ssh` | **`@fish-under-sea/dsh-ssh-fish`** |
>   | `@fish-under-sea/dsh-usage` | **`@fish-under-sea/dsh-usage-fish`** |
>   | `@fish-under-sea/dsh-session-archive` | **`@fish-under-sea/dsh-session-archive-fish`** |
>   | `@fish-under-sea/dsh-client-ui-task-board` | **`@fish-under-sea/dsh-client-ui-task-board-fish`** |
>   | `@fish-under-sea/dsh-client-ui-git-graph` | **`@fish-under-sea/dsh-client-ui-git-graph-fish`** |
>   | `@fish-under-sea/dsh-video-preview` | **`@fish-under-sea/dsh-video-preview-fish`** |
>
> - **A rename REQUIRES rebuilding the bundle (important)**: `dsh-client-modules` claims a browser factory by the **package name** resolved from the plugin entry, so a registration id that disagrees with the name throws `loaded without registering "<name>"` and the **entire browser half (settings pages, panels) fails to load**. All five packages with a `src/` tree were rebuilt here with `tsc + tsdown`, so each registration id matches its package name exactly.
> - **Existing user configuration is untouched (equally important)**: the settings namespaces (`ssh` / `dsh-usage` / `usage` / `git-graph`) and each plugin's `name` export are **runtime configuration contracts** that deliberately **do not follow the package name** — so SSH hosts, the usage ledger and Git-graph preferences all survive the rename.
> - **`dsh-client-ui-model-capabilities` dropped**: removed from both the bundle's dependencies and its bundle layer (per-model reasoning efforts and image modality are covered by `dsh-better-reasoning-effort-fish`, which also provides the composer reasoning-effort slider and one-click auto-adaptation).
> - **Old names deprecated**: the six old npm names are `npm deprecate`d and point at their new names, so `npm install` / `pnpm add` prints the rename notice; `dsh-client-ui-model-capabilities` is instead marked as removed from the bundle.

> **🆕 0.9.0 (2026-10-13):** **`dsh-video-preview` (forked) merged in; member count 14 → 15.**
>
> - **1 new upstream fork**: [zemul/dsh-video-preview](https://github.com/zemul/dsh-video-preview) (MIT) is forked into this repository under `packages/dsh-video-preview-fish` and published independently as `@fish-under-sea/dsh-video-preview-fish@0.1.5` — inline video preview in the sidebar (`.mp4` / `.webm` / `.mov` / `.mkv` / `.avi` and more), with its own `/video` route streaming HTTP Range responses so **seeking works**.
> - **Why fork**: same reason as the six existing forks — the package name is baked into the client bundle's module registration id (`dsh-client-modules` claims a factory by `package.json`'s `name`), so renaming is what makes independent releases possible and lets the fork coexist with the upstream package in one process.
> - **⚠️ It also fixes "installs but never activates" (important)**: upstream's host half declares `inject: ['webServer', 'sessions', 'webRuntime']`, but **the `webRuntime` service has been removed from the kernel** (DSH 0.2.1-alpha.2: the `dsh-web-app` web-runtime row no longer provides it; `client-connection` reads its trusted authorities from `webStartup` instead). A missing service in a cordis `inject` list means the row stays **PENDING FOREVER**, so on the new kernel upstream's `apply` never runs: the `/video` route is never registered, video requests fall through to the SPA static handler, and non-GET/HEAD requests get an **empty 405** (the UI shows a bare `HTTP 405`). This fork drops `webRuntime` from `inject` and resolves the trust list **lazily, per request** (`webRuntime` → `connection` → empty array); an empty array means **loopback-only**, so the change can only narrow, **never widen**, the trust boundary. It also removes the long-removed `@deepseek-ai/dsh-client-runtime` from `dsh.client.inject` (keeping it breaks the whole client bundle load).
> - **One compat shim dependency removed**: this machine previously kept upstream alive with the profile-level `dsh-webruntime-shim.mjs` (which also serves `dsh-better-sidebar`). The video-preview half **no longer needs it**; keep the shim if `dsh-better-sidebar` still requires it.
> - **Range semantics and guards untouched**: 200 / 206 / suffix ranges / 416 / HEAD / cross-site 403 / path-escape 403 all behave exactly as upstream, now covered by 28 route regression checks plus 8 identity-contract checks (`packages/dsh-video-preview-fish/test/`).

> **🆕 0.8.2 / 0.8.3 (2026-10-12):** **`dsh-usage` 0.4.7 → 0.4.9 — the scenario line now counts DeepSeek consumption on every API, and its explanatory sub-line is gone.**
>
> - **Why**: the 0.4.7 line counted only the **official family routes** (`deepseek-official` / `deepseek-account`) and therefore dropped DeepSeek usage served by aggregators and free channels entirely. On this machine that omission was large: a single channel, `bailian`, carries **2.74 billion DeepSeek tokens**, against 260 million on the official account.
> - **New scope**: a row counts when its route is in the official family **or** its model id contains `deepseek` (case-insensitive); non-DeepSeek models (MiMo / Qwen / GLM / GPT / Claude …) stay excluded. Relay and aggregator traffic counts — a DeepSeek model served by an aggregator is still DeepSeek consumption.
> - **Aggregated host-side**: the wire caps each provider's model list at `SUMMARY_MODEL_CAP = 12`, so a browser-side sum would silently undercount once an aggregator serves more models than the cap. The host now aggregates over the uncapped per-model maps and the client only reads the result; an older host that does not send it gets **one fewer line** rather than a figure that only ever saw the official account.
> - **How the numbers move** (this machine's real ledger, 2026-09-11 → 10-12): ¥22.06 / ¥11.03 → **¥1478.77 / ¥739.39** (4.93 billion DeepSeek tokens, 57.9% of all traffic).
> - The explanatory sub-line under the scenario line has been **removed** as requested.
> - **Why both 0.8.2 and 0.8.3 exist**: when 0.8.2 was published, `dsh-usage`'s 0.4.8 got stuck in npm's staged state (the registry returned 202 and never finished processing — the version never entered the list, its tarball stayed 404, and re-publishing the same number was refused with `E409 Cannot publish over previously staged version`). `dsh-usage` therefore moved to a clean **0.4.9**, and the bundle published **0.8.3** pointing at it. **0.8.2 cannot be installed (its 0.4.8 dependency never landed) — use 0.8.3.**

---

> **🆕 0.8.1 (2026-10-12):** **three sub-packages updated** (the bundle itself only widens its dependency ranges).
>
> - **`dsh-skill-lens-fish` 0.1.0 → 0.1.1**: fixes two reported problems in the dependency graph. ① Node labels now show the **filename** instead of the full path — the old 24-character truncation turned `skill-refs/ai-asset-forge/...` paths into identical strings, making several nodes in one directory look like duplicates; the full path stays in the hover tooltip. ② **Referenced resources and flat-skill entries are now clickable**: a read-only preview dialog was added (close button, Escape, read-failure state); previously `clickable` hard-excluded those node kinds, so clicking did nothing. In-directory files still open in the editable file tab.
> - **`dsh-usage` 0.4.6 → 0.4.7**: the Token Bank gains a **price-book scenario line** — the **DeepSeek official family's** tokens are repriced at the current Flash book twice, once assuming every call ran in peak hours and once off-peak, giving two figures that bracket the hypothetical cost. It is explicitly labelled **not an actual charge**, counts only the official family (MiMo and relay traffic have no official price book and are excluded), and never reuses the fold-time `cost`.
> - **`dsh-agent-teams-fish` 0.6.1 → 0.7.0**: vendor namespace **17 → 18**, adding **MiMo (Xiaomi MiMo)** in the same tier as `stepfun` / `jev` (a vendor-generic portrait plus an HD one). Recognition matches `mimo` / `mimo-*` / `xiaomi` / 小米, with a **boundary** requirement that `mimo` be followed by a word boundary or separator — avoiding both swallowing `minimax` / `mistral` and misreading ordinary words such as `mimosa`.
>> **🆕 0.8.0 (2026-10-12):** **6 upstream family plugins (forked) + 1 in-house plugin merged in; member count 7 → 14.**
>
> - **6 new upstream forks**: the **task board, Git graph, model capabilities, SSH, usage and session archive** plugins from [zhu1090093659/dsh-web](https://github.com/zhu1090093659/dsh-web) (Apache-2.0) are forked into this repository under `packages/`, published independently as `@fish-under-sea/*`.
>   - **Why fork instead of merely depending**: those upstream packages bake the npm scope and package name into the client bundle's module registration id, while the host claims a package by its `package.json` `name` — when the two disagree, the browser half (settings page, panels) does not load at all. Renaming therefore requires editing sources and rebuilding the bundle, which is also what makes independent releases and future kernel tracking possible.
>   - **What changed**: scope and telemetry only; behaviour is equivalent to upstream `0.4.6`. **Install telemetry has been removed** (upstream reports the package name to `dsh-market.com` once a day); each package's `NOTICE` records the modifications and its origin.
>   - **⚠️ Coexistence with `@linxin666/dsh-web-all`**: see [Coexistence with `dsh-web-all`](#coexistence-with-dsh-web-all-important) below.
> - **1 new in-house plugin**: `@fish-under-sea/dsh-skill-lens-fish` (Skill Lens, Fish edition — based on x-feichen/dsh-skill-lens: follows `$DSH_HOME`, recognises flat skills, resolves `skill-refs/` references into the dependency graph).
> - **Member count 7 → 14** (5 in-house + 6 upstream forks + 3 external companion forks); the bundle patch inserts **14 entries**.
>
> Older releases are recorded in [CHANGELOG.en.md](CHANGELOG.en.md).

---

## What is this

An aggregate package for Fish-made [DSH](https://github.com/Fish-under-sea/DSH) (DeepSeek Harness) plugins. The repository root is the **bundle package**; sub-plugin sources live under `packages/`. The bundle uses its own bundle layer (`cordis.patch.yml`) to **insert all thirteen plugin entries at once** into the profile's roster — eleven are local sub-plugins under `packages/` in this repository, and two are **external companion forks**: `dsh-agent-teams-fish` and `dsh-better-reasoning-effort-fish` (each in its own repository, not sub-packages of this one).

> **Installing `@fish-under-sea/dsh-fish` once = installing all thirteen plugins.**
>
> `dsh-our-free-model-fish` (free models & channel aggregation) is **no longer bundled** since **0.10.4** — install it separately with `dsh plugin --profile <profile> add dsh-our-free-model-fish`; its entry id and data directory stay the same, so existing settings keep working.

**Naming difference (easy to trip on):** npm package names `@fish-under-sea/*` carry a scope, but the repository directory name (`dsh-fish/`) and the GitHub repository name (`Fish-under-sea/dsh-fish`) **do not**.

## Included plugins

| Sub-package | Version | Description |
|-------------|:-------:|-------------|
| [`dsh-approval-guide`](packages/dsh-approval-guide) | 0.2.2 | Appends **Chinese explanations** to approval dialogs: what this approval will do, what risks are involved, and what it is based on |
| [`dsh-git-sync`](packages/dsh-git-sync) | 0.4.0 | **One-click Git sync**: collect the plugin list, enable states, local settings, Skills, the task-board/usage ledgers, the settings-nav-order preference, the **free-model plugin config (when installed separately) and usage ledger**, and the **wallpaper engine whole-machine snapshot** (`$DSH_HOME/FISH.json`, payloads embedded) into your own private git repository. **0.4.0 adds "Export private config"**: copies the credential-bearing files (`channel-pack/` roster / check-in / ledger, `.credentials.yaml`, `our-free-model/eac-user.json`) **purely locally** into a `DSH私钥配置` folder under a chosen directory (Desktop by default), together with an explanatory README — it never touches git, makes no network request, and never logs credential contents. **That path is entirely separate from git sync**, because credentials sit on the sync hard blacklist and never travel with the repository |
| [`dsh-settings-nav-order`](packages/dsh-settings-nav-order) | 0.1.5 | **Settings nav reordering**: arrange the left sidebar menu in the settings panel to your own order and hide items you don't want to see; preferences **restore across machines** via the Git sync plugin |
| [`dsh-visual-companion`](packages/dsh-visual-companion) | 0.1.7 | **Visual Companion wake**: preview prototypes / compare layouts on the web, select + annotate, then press "Submit to assistant" — the session automatically receives a user message and starts a new round, no need to go back to the terminal to repeat; **the selection process is silent, only the submission wakes the session once** (since 0.1.7 the version in the load log is read live from `package.json`, no longer hard-coded) |
| [`dsh-skill-lens-fish`](packages/dsh-skill-lens-fish) | 0.1.1 | **Skill Lens, Fish edition**: browse every Agent Skill on this machine from a session tab. Based on [x-feichen/dsh-skill-lens](https://github.com/x-feichen/dsh-skill-lens) (MIT): upstream only recognises `<name>/SKILL.md` and hard-codes the global root to `~/.dsh` (this machine's DSH_HOME is `~/.dsh-beta`, so its scan is always empty); this edition follows `$DSH_HOME`, recognises flat `<name>.md` skills, and resolves skill references to out-of-directory shared resources such as `skill-refs/` into real paths, shown as a dedicated "referenced resources" group in the dependency graph |
| [`dsh-client-ui-task-board-fish`](packages/dsh-client-ui-task-board-fish) | 0.5.0 | **Task board** (**fork** of upstream `@linxin666/dsh-client-ui-task-board@0.4.6`, Apache-2.0): host-authoritative ledger, five-column board (drag or switch by status), subtask-tree cascading execution, host cron scheduling, an **acceptance gate before execution** (goal form, A/B two-round scoring), Agent Team execution, tags and freeze-snapshot "continuation cards", and a permission confirmation gate for execution. **Install telemetry removed** |
| [`dsh-client-ui-git-graph-fish`](packages/dsh-client-ui-git-graph-fish) | 0.5.0 | **Git graph & branch switching** (**fork** of upstream `@linxin666/dsh-client-ui-git-graph@0.4.6`, Apache-2.0): interactive commit graph plus a branch selector capsule in blank sessions (the host really runs `git switch`), with worktree conflict guards and readable errors; the opt-in `git_worktree` model tool acts on the managed `$DSH_HOME/worktrees/` directory. **Install telemetry removed** |
| [`dsh-ssh-fish`](packages/dsh-ssh-fish) | 0.5.0 | **SSH operations** (**fork** of upstream `@linxin666/dsh-ssh@0.4.6`, Apache-2.0): host library (one-click import of `~/.ssh/config`), persistent connection pool with multi-level jump hosts, exec, an xterm web terminal, SFTP upload/download, local port forwarding and cluster execution; plus six model tools (`ssh_list` / `ssh_exec` / `ssh_upload` / `ssh_download` / `ssh_tunnel` / `ssh_cluster`). Host config lives in `$DSH_HOME/dsh-ssh.json`. **Install telemetry removed** |
| [`dsh-usage-fish`](packages/dsh-usage-fish) | 0.5.0 | **Usage statistics** (**fork** of upstream `@linxin666/dsh-usage@0.4.6`, Apache-2.0): a per-provider/per-model token ledger (input/output/cache-read/cache-write bucketed separately), balances and **coding-plan quotas** (Kimi / GLM / OpenCode Go / MiniMax / Codex), DeepSeek peak/off-peak cost estimates, the "token bank" whale vouchers, and a compact glance card at the bottom of the sidebar. The ledger lives in `$DSH_HOME/dsh-usage/` |
| [`dsh-session-archive-fish`](packages/dsh-session-archive-fish) | 0.5.0 | **Session archive management** (**fork** of upstream `@linxin666/dsh-session-archive@0.4.6`, Apache-2.0): a complete inventory (including subagent sessions and sessions outside any workspace), filter/search/sort, cross-result-set multi-select, batch archive/unarchive, **physical deletion (with cascade and protection rules)**, and optional auto-archive / auto-cleanup policies. **Fixes an upstream dependency-declaration bug** (the source imports the scoped `@deepseek-ai/schemastery`, while upstream's `dependencies` declared the unscoped `schemastery`, breaking type resolution at build time) |
| [`dsh-video-preview-fish`](packages/dsh-video-preview-fish) | 0.2.0 | **Inline video preview in the sidebar** (**fork** of upstream [zemul/dsh-video-preview](https://github.com/zemul/dsh-video-preview), MIT): play `.mp4` / `.webm` / `.mov` / `.mkv` / `.avi` and more directly in the sidebar editor, with its own `/video` prefix route streaming `createReadStream` responses to implement **HTTP Range (206)** so seeking works (the built-in media route reads the whole file into memory, answers plain 200 and is capped at 20MB — wrong for video). **This fork fixes "installs but never activates"** — upstream put the kernel-removed `webRuntime` into `inject`, so on the new kernel `apply` never runs, `/video` is never registered and video requests get an empty 405; this fork resolves the trust list lazily per request (`webRuntime` → `connection` → empty array = loopback-only), narrowing the fence and never widening it |
| [`dsh-agent-teams-fish`](https://github.com/Fish-under-sea/dsh-agent-teams-fish) | 0.7.3 | **0.7.3 fixes "no member can start on preset-only hosts" and "child session logs get corrupted"; 0.7.2 fixed member startup, recursive stop and subagent-model allowlist admission on the new host.** **AgentTeams multi-agent collaboration** (companion fork of upstream [NanmiCoder/dsh-agent-teams](https://github.com/NanmiCoder/dsh-agent-teams)): natural-language team building, member/task dependency DAG, mailbox communication, right-sidebar tree monitoring; **vendor avatar assets shipped in-package** (**17 vendors** × 10 roles + vendor-generic art + portraits + captain + brand SVGs, **286 files / ~29.3 MB**, including a 1024×1024 HD WebP family), available immediately after install, no `artworkDir` dependency across machines; custom directory still overrides the full set; brand SVGs served by extension; **the captain avatar follows the captain's own model route**; `0.5.1` fixed the degradation-chain order (`vendor+role → vendor → role`); `0.6.0` merged upstream v0.1.23 (member tool policies, quality-gate contract and amendment binding, lineage identity across forks, workspace audit, degraded reads of a corrupt `team.json`); **⚠️ `0.6.1` fixes "the plugin gets its whole row disabled after upgrading DSH to 0.2.1-alpha.2"** — that build's host allowlist did not yet declare the new runtime, so DSH judged it incompatible and disabled the plugin row (symptom: shows as broken, team collaboration does nothing); **⚠️ `0.7.1` fixes "a blank optional field makes team creation impossible"** — some models fill **optional** parameters like `tool_policy` / `provider` / `model` with `""` instead of omitting them, and while the `add_member` / `edit_plan` path washed blank strings into `undefined` (accepted), the inline-plan path threw `must not be empty` outright; the two paths disagreed, so the model retried between `""` and `"default"` (one real session: 34 consecutive failures, not a single member spawned). Both paths now treat a blank string as "not provided"; required fields stay strict |
| [`dsh-better-reasoning-effort-fish`](https://github.com/Fish-under-sea/dsh-better-reasoning-effort-fish) | 0.5.8 | **Reasoning effort & input modality** (fork of upstream [HaoyueQin/dsh-better-reasoning-effort](https://github.com/HaoyueQin/dsh-better-reasoning-effort)): edit per-model `reasoningEfforts` and `input` declarations directly in the official Models page edit card, with one-click auto-adaptation; this fork yields the `settings.models.provider-card` slot entirely to the model capabilities panel; 0.5.8 merges upstream's three installation routes (pin a version under the release-age window, the release tarball, GitHub source install) |

## Coexistence with `dsh-web-all` (important)

The 6 new forks in this bundle are **the same plugins** as the upstream aggregate `@linxin666/dsh-web-all`. Enabling both mounts those 6 plugins **twice** (two task boards fighting over one sidebar seat, the same host services registered twice), which misbehaves.

**Entry ids do not collide**, so this does **not** trigger the "same id inserted twice" startup failure:

| Plugin | This bundle's id | `dsh-web-all`'s id |
|---|---|---|
| Task board | `ui-task-board` | `web-ui-task-board` |
| Git graph | `ui-git-graph` | `web-ui-git-graph` |
| SSH | `ssh` | `web-ui-ssh` |
| Usage | `usage` | `web-ui-usage` |
| Session archive | `session-archive` | `web-ui-session-archive` |

**What to do**: when this bundle and `dsh-web-all` are both installed, set the six `web-ui-*` entries in the right-hand column to `disabled: true` **in your own profile patch layer**, keeping only this bundle's six entries:

```yaml
# profiles/<profile>/cordis.patch.yml
- { id: web-ui-task-board,         disabled: true }
- { id: web-ui-git-graph,          disabled: true }
- { id: web-ui-ssh,                disabled: true }
- { id: web-ui-usage,              disabled: true }
- { id: web-ui-session-archive,    disabled: true }
```

> This bundle deliberately **does not rewrite other packages' entries** — cross-package interference creates coupling, and would also produce `entry not found` warnings when the other package is absent (that exact noise was observed on this machine). So this is documentation only; the decision stays with the installer.

## This package no longer disables any built-in plugin

**Behavior change as of 0.7.8** — the bundle used to explicitly disable DSH's built-in session title provider (`session-title-llm`) to make room for `dsh-session-title-refresh` (the session title service accepts only **one provider per process**; a second registration throws immediately).

Now that the plugin has moved out, that disable is **withdrawn as well** and the built-in provider is active again. **This matters**: removing the plugin while keeping the disable would switch the built-in provider off with nothing replacing it, so **sessions would stop being named automatically**.

If you still want the old plugin, install it on its own — its own patch re-disables the built-in provider:

```powershell
dsh plugin --profile <profile> add @fish-under-sea/dsh-session-title-refresh
```

## Installation

### Option 1: Install from npm (recommended, one package is enough)

```powershell
dsh plugin --profile <profile> add @fish-under-sea/dsh-fish
```

The bundle declares all thirteen plugin dependencies. They are installed as transitive dependencies to the profile top level by pnpm (this profile uses `nodeLinker: hoisted`), and plugin entries resolve by package name.

**Why duplicate entries don't appear**: the reconciliation logic (`reconcile` in `dsh-plugin-manager`) only walks **the profile's own `dependencies`**, not transitive dependencies recursively, so sub-packages are not promoted to bundle layers and entries don't stack.

> ⚠️ **If installation reports `[NOT_FOUND]`**: this package and **all thirteen** of its member packages are published to the npm **official registry**. If your machine points the registry at a domestic mirror (e.g. `registry.npmmirror.com`), the mirror's **lazy sync** may not have picked up one of the sub-packages yet, so `dsh plugin add` fails with
> `404 Not Found … {"error":"[NOT_FOUND] @fish-under-sea/<sub-package> not found"}`.
> **This does not mean the package doesn't exist** — pick any of the following:
>
> - **Trigger mirror sync** (public endpoint, idempotent, no login required; wait ~10 seconds then install):
>   ```sh
>   curl.exe -X PUT https://registry.npmmirror.com/-/package/@fish-under-sea/dsh-approval-guide/syncs
>   curl.exe -X PUT https://registry.npmmirror.com/-/package/@fish-under-sea/dsh-git-sync/syncs
>   curl.exe -X PUT https://registry.npmmirror.com/-/package/@fish-under-sea/dsh-settings-nav-order/syncs
>   curl.exe -X PUT https://registry.npmmirror.com/-/package/@fish-under-sea/dsh-visual-companion/syncs
>   curl.exe -X PUT https://registry.npmmirror.com/-/package/@fish-under-sea/dsh-client-ui-task-board-fish/syncs
>   curl.exe -X PUT https://registry.npmmirror.com/-/package/@fish-under-sea/dsh-client-ui-git-graph-fish/syncs
>   curl.exe -X PUT https://registry.npmmirror.com/-/package/@fish-under-sea/dsh-ssh-fish/syncs
>   curl.exe -X PUT https://registry.npmmirror.com/-/package/@fish-under-sea/dsh-usage-fish/syncs
>   curl.exe -X PUT https://registry.npmmirror.com/-/package/@fish-under-sea/dsh-session-archive-fish/syncs
>   curl.exe -X PUT https://registry.npmmirror.com/-/package/dsh-agent-teams-fish/syncs
>   curl.exe -X PUT https://registry.npmmirror.com/-/package/dsh-better-reasoning-effort-fish/syncs
>   curl.exe -X PUT https://registry.npmmirror.com/-/package/@fish-under-sea/dsh-video-preview-fish/syncs
>   ```
>   A response of `{"ok":true,"state":"waiting"}` means accepted; verify with
>   `curl.exe https://registry.npmmirror.com/@fish-under-sea%2Fdsh-approval-guide` — when `"latest"` appears, sync is complete.
> - Or switch the machine's registry to the official source `https://registry.npmjs.org/`.
> - Or use the `link:` local path from [Option 3](#option-3-local-development-install-source-changes-take-effect-immediately).

### Option 2: Install from GitHub (when you don't want to use the npm registry)

```jsonc
// profiles/<profile>/package.json
"dependencies": {
  "@fish-under-sea/dsh-fish": "github:Fish-under-sea/dsh-fish"
},
"devDependencies": {
  "@fish-under-sea/dsh-approval-guide": "github:Fish-under-sea/dsh-fish#path:packages/dsh-approval-guide",
  "@fish-under-sea/dsh-git-sync": "github:Fish-under-sea/dsh-fish#path:packages/dsh-git-sync",

  "@fish-under-sea/dsh-settings-nav-order": "github:Fish-under-sea/dsh-fish#path:packages/dsh-settings-nav-order",
  "@fish-under-sea/dsh-visual-companion": "github:Fish-under-sea/dsh-fish#path:packages/dsh-visual-companion",
  "@fish-under-sea/dsh-skill-lens-fish": "github:Fish-under-sea/dsh-fish#path:packages/dsh-skill-lens-fish",

  "@fish-under-sea/dsh-client-ui-task-board-fish": "github:Fish-under-sea/dsh-fish#path:packages/dsh-client-ui-task-board-fish",
  "@fish-under-sea/dsh-client-ui-git-graph-fish": "github:Fish-under-sea/dsh-fish#path:packages/dsh-client-ui-git-graph-fish",
  "@fish-under-sea/dsh-ssh-fish": "github:Fish-under-sea/dsh-fish#path:packages/dsh-ssh-fish",
  "@fish-under-sea/dsh-usage-fish": "github:Fish-under-sea/dsh-fish#path:packages/dsh-usage-fish",
  "@fish-under-sea/dsh-session-archive-fish": "github:Fish-under-sea/dsh-fish#path:packages/dsh-session-archive-fish",

  "dsh-agent-teams-fish": "github:Fish-under-sea/dsh-agent-teams-fish",
  "dsh-better-reasoning-effort-fish": "github:Fish-under-sea/dsh-better-reasoning-effort-fish"
}
```

`#path:` is pnpm's sub-directory syntax, letting one repository provide multiple packages — the eleven sub-packages point to this repository; the two external companion forks point to their respective repositories: [`dsh-agent-teams-fish`](https://github.com/Fish-under-sea/dsh-agent-teams-fish) and [`dsh-better-reasoning-effort-fish`](https://github.com/Fish-under-sea/dsh-better-reasoning-effort-fish) (both are at their repository root, no `#path:` needed). After `pnpm install` on a new machine, packages download directly from the repository with **no dependency on any machine-specific absolute paths**. Only `"@fish-under-sea/dsh-fish"` needs to be listed in `bundles` (its patch handles inserting all thirteen entries).

### Option 3: Local development install (source changes take effect immediately)

```jsonc
// profiles/<profile>/package.json
"dependencies": {
  "@fish-under-sea/dsh-fish": "link:<this-repo-path>"
},
"devDependencies": {
  "@fish-under-sea/dsh-approval-guide": "link:<this-repo-path>/packages/dsh-approval-guide",
  "@fish-under-sea/dsh-git-sync": "link:<this-repo-path>/packages/dsh-git-sync",

  "@fish-under-sea/dsh-settings-nav-order": "link:<this-repo-path>/packages/dsh-settings-nav-order",
  "@fish-under-sea/dsh-visual-companion": "link:<this-repo-path>/packages/dsh-visual-companion",
  "@fish-under-sea/dsh-skill-lens-fish": "link:<this-repo-path>/packages/dsh-skill-lens-fish",

  "@fish-under-sea/dsh-client-ui-task-board-fish": "link:<this-repo-path>/packages/dsh-client-ui-task-board-fish",
  "@fish-under-sea/dsh-client-ui-git-graph-fish": "link:<this-repo-path>/packages/dsh-client-ui-git-graph-fish",
  "@fish-under-sea/dsh-ssh-fish": "link:<this-repo-path>/packages/dsh-ssh-fish",
  "@fish-under-sea/dsh-usage-fish": "link:<this-repo-path>/packages/dsh-usage-fish",
  "@fish-under-sea/dsh-session-archive-fish": "link:<this-repo-path>/packages/dsh-session-archive-fish",

  "dsh-agent-teams-fish": "link:<dsh-agent-teams-fish repo path>",
  "dsh-better-reasoning-effort-fish": "link:<dsh-better-reasoning-effort-fish repo path>"
}
```

**Do not use `file:` to point at this repository** — pnpm caches `file:` directory dependencies as "directory dependencies without a hash," and after source changes, `pnpm install` (even with `--force`) **will not re-copy**. You must manually delete `node_modules/dsh-*` and reinstall. `link:` does not have this problem.

> **Restart DSH** after installation for changes to take effect.

## Two pitfalls when declaring dependencies manually

> You can skip this section if using Option 1 (npm) — the bundle handles it for you.

**① Sub-packages must be resolvable at the profile top level**

DSH's client-side scanner (`locatePkgJson` in `@deepseek-ai/dsh-client-modules`) resolves plugin directories by the **package name** in the plugin entry at the profile top level. The entry name must be the full package name:

- ✅ Correct: `@fish-under-sea/dsh-approval-guide` (two-segment `@scope/name` scoped name)
- ❌ Wrong: adding a sub-path causes `exactPackageSpecifier()` to judge it as "not a package" and **skip it directly**

When a sub-package is not at the profile top level, the entry cannot resolve to a `package.json`, and **the plugin's settings page and UI will not load**.

**② When declaring manually, sub-packages go in `devDependencies`**

`dsh plugin` reconciles on every run, automatically appending any package in the profile's `dependencies` that declares `dsh.bundle` into `dsh.profile.bundles`. All thirteen packages declare `dsh.bundle`, and the bundle's patch already restates all thirteen entry insertions —

> Once a sub-package is promoted to a bundle layer, entry insertions will **duplicate**, and **duplicate mounting causes application startup failure**.

**`dsh-our-free-model-fish` is no longer part of this bundle** (0.10.4+). When installing it separately, the same rule still applies: if you put it in `dependencies`, reconciliation promotes it to a bundle layer that expands its own patch (inserting the `our-free-model` entry once — fine); just never let two sources insert that same id (`composeEntries` only pushes, it does not dedupe).

Placing them in `devDependencies` still installs them at the profile top level (entry names still resolve correctly), but they won't be promoted to bundle layers by the reconciliation logic.

## Runtime configuration of sub-plugins

The local sub-plugins' parameters are **not written in `cordis.patch.yml`** — they live in their respective `config.json` under `$DSH_HOME` and are modified in the **GUI settings page** (the external companion forks and `dsh-visual-companion` are the opposite: their configuration is written in the plugin entry's `config`):

| Plugin | Settings entry | Config file |
|--------|---------------|-------------|
| `approval-guide` | No configuration | — |

| `git-sync` | Settings → Git sync | `$DSH_HOME/dsh-git-sync/config.json` |
| `settings-nav-order` | Settings → Settings nav order | No config file; preferences live in browser `localStorage` (key `dsh-settings-nav-order/v1`) and are mirrored to `$DSH_HOME/dsh-settings-nav-order/state.json` (collected by `git-sync`) |
| `dsh-visual-companion` | No settings page (configuration is in its own profile patch plugin entry) | Same as above (`watchDir`: visual companion root directory, used for "auto-bind on load") |
| `dsh-agent-teams-fish` | No settings page (configuration is in the bundle's `cordis.patch.yml` plugin entry) | Same as above (`stateDir` / `memberProvider` / `artworkDir`) |
| `dsh-better-reasoning-effort-fish` | No settings page (capabilities embed directly into the official Models page edit card) | Same as above (`autofill` / `modalityAutofill` / `probeTimeoutMs` / `bootRetryDelaysMs` / `defaultGuard`, written in the plugin entry's `config` or the plugin `config` block in `settings.yaml`) |

**Config directory names are unscoped short names** (`$DSH_HOME/dsh-git-sync/` etc.), decoupled from npm package names — so **renaming the package does not affect existing configuration**.

The external companion fork `dsh-agent-teams-fish` is the **exception**: its parameters are written in the bundle's `cordis.patch.yml` plugin entry `config` (`stateDir` / `memberProvider`), with an additional `artworkDir` pointing to a **custom art directory**:

```yaml
- id: agent-teams
  name: 'dsh-agent-teams-fish'
  config:
    stateDir: .agent-teams        # Team state directory (relative to session workspace)
    memberProvider: spawn         # Member spawn mode: spawn or fork
    # artworkDir: <absolute path> # Optional: custom avatar/brand directory (machine-specific, defaults to in-package art)
```

> `artworkDir` is a **machine-specific** absolute path, so it is not written into the bundle (a machine change won't point at someone else's directory). To customize art, override the same `id: agent-teams` entry in **your own profile's patch layer**.

### About `settings-nav-order`

The order of the left column menu in the settings panel (General / Models / Built-in plugins / Agent presets / …) was originally **hard-coded in each plugin's own `settings.section` registration** (an `order` number). The GUI had neither a reorder entry nor a way to collapse unused items. This plugin adds a "Settings nav order" page to solve this:

- **Reorder**: drag the `⋮⋮` handle, or click `↑`/`↓`
- **Hide**: click "Hide" to collapse items you don't want to see
- **How**: applies CSS `order` to nav buttons (container is flex column) and `display:none` to hidden items (**nodes are not deleted, fully reversible**) — neither changes DOM order nor modifies any third-party plugin code, so **plugin upgrades won't wipe these preferences**
- **Data**: primary copy lives in browser `localStorage` (key `dsh-settings-nav-order/v1`), additionally mirrored by the host side to `$DSH_HOME/dsh-settings-nav-order/state.json` — **this file is in `git-sync`'s allowlist**, so order and hidden items restore across machines with the config repo (open the settings page on a new machine and it auto-backfills). This has been the case since 0.1.2; previously these preferences lived only in the browser and didn't travel with the repo
- **Honest reporting after save**: the panel states whether the host file has synced (if it can't write, it says "not synced, will auto-retry next time" — it doesn't pretend success); when there are unsaved reorders and you click the "Enable" toggle, it still shows "unsaved" rather than falsely reporting "saved"
- **Revert**: turn off "Enable manual reorder and hide," or click "Restore default"
- **Self-lock prevention**: the "Settings nav order" page **cannot hide itself** — it is the only entry point that can unhide
- **Identification**: real class names are CSS Modules hashes (`ZiQlkq_navList`), so it matches by `[class*="navList"]` substring — **DSH changing its hash prefix won't break this**

## Repository structure

```text
dsh-fish/                 # Repository directory name (npm package name is @fish-under-sea/dsh-fish)
├── package.json          # Bundle manifest (version 0.10.4, dsh.bundle.patch points to cordis.patch.yml)
├── cordis.patch.yml      # Bundle layer: inserts thirteen plugin entries
├── CHANGELOG.en.md       # Full release history (the README keeps only the latest release)
├── pnpm-workspace.yaml   # Workspace declaration (local development only)
├── lib/                  # Bundle's own empty implementation (this package registers nothing)
│   ├── index.js
│   └── client.js
└── packages/
    ├── dsh-approval-guide/

    ├── dsh-git-sync/
    ├── dsh-settings-nav-order/
    └── dsh-visual-companion/
```

> The two external companion forks are **not** under `packages/` — `dsh-agent-teams-fish` source lives in [its own repository](https://github.com/Fish-under-sea/dsh-agent-teams-fish) and `dsh-better-reasoning-effort-fish` in [another repository](https://github.com/Fish-under-sea/dsh-better-reasoning-effort-fish); both are installed at the profile top level as **npm dependencies** of the bundle. `dsh-our-free-model-fish` is **no longer bundled** since 0.10.4 — install it separately.

> **Why sub-packages are not bundled in the aggregate's `files`**: the bundle only carries `lib/`, `cordis.patch.yml`, and `README*.md`. The eleven sub-packages and two external companion forks are all installed at the profile top level as **npm dependencies** (see Option 1). Only when "one repository provides multiple packages, installed from GitHub" do you need to declare them explicitly with `#path:` in the installer's profile (see Option 2).

## Development

```bash
pnpm install                                                          # Install workspace dependencies

node packages/dsh-approval-guide/test/guide.test.mjs                  # Run tests

node packages/dsh-git-sync/test/client.test.mjs
node packages/dsh-git-sync/test/test-sync-engine.mjs
node packages/dsh-git-sync/test/commit-identity.test.mjs
node packages/dsh-settings-nav-order/test/client.test.mjs
node packages/dsh-settings-nav-order/test/host.test.mjs
node packages/dsh-visual-companion/test/visual-companion.test.mjs
```

> The bundle itself implements no functionality and **registers nothing** — its sole purpose is to carry `cordis.patch.yml`.

## Five places to update when renaming the package

A package name is not just a string in `package.json` — **five places must be updated together**, or it will break at runtime:

| # | Location | Consequence of missing it |
|:-:|----------|--------------------------|
| 1 | `name` in six `package.json` files | Installer's dependency keys won't match |
| 2 | Entry `name` in the bundle and four sub-package `cordis.patch.yml` files | Entry can't resolve the package; plugin doesn't load at all |
| 3 | ⚠️ **`id` in `__ModuleLoader__.load({ id })` inside `lib/client.js` for packages with a client side (eleven sub-packages in this repo + two external companions)** | **Client side reports `loaded without registering "<package name>"`; plugin fails to load** |
| 4 | Installer's profile dependency keys and `bundles` | Dependencies won't install; bundle layer won't expand |
| 5 | Sub-package placement in the profile | Must go in `devDependencies` (see pitfall ② above) |

**#3 is the most insidious**: the loader uses the **package name parsed from the entry** to claim the factory in `factories` (`if (!this.factories.has(id)) throw ... loaded without registering` in `@deepseek-ai/dsh-client-modules/lib/client.js`), so the **registration name must strictly equal the package name** — if the package name has a scope, the registration name must too.

Good news: client tests for the sub-packages with a client side assert this, and the assertions **read `package.json`'s `name`** rather than hard-coded strings — if you rename and miss a spot in the future, **tests will catch it directly**.

**Same applies to external companion forks**: `dsh-agent-teams-fish` ([repository](https://github.com/Fish-under-sea/dsh-agent-teams-fish)), `dsh-better-reasoning-effort-fish` ([repository](https://github.com/Fish-under-sea/dsh-better-reasoning-effort-fish)) all come from independent repositories. When renaming, you must similarly synchronize `package.json`'s `name` / `cordis.patch.yml`'s entry `name` / `lib/client.js`'s registration `id` — the former's art routing chain test asserts "registration name = `package.json`'s `name`", and the latter's constant `PLUGIN_ID` also equals the package name (`src/constants.ts`). Missing a spot will be caught the same way.

## License

**MIT** (consistent across the bundle and all in-house sub-packages).

The two external companion forks are also distributed under **MIT**, with **copyright belonging to their respective upstream original authors**:

- `dsh-agent-teams-fish` → [NanmiCoder/dsh-agent-teams](https://github.com/NanmiCoder/dsh-agent-teams) (程序员阿江 / Relakkes)
- `dsh-better-reasoning-effort-fish` → [HaoyueQin/dsh-better-reasoning-effort](https://github.com/HaoyueQin/dsh-better-reasoning-effort) (**HaoyueQin**)

See each companion fork's `NOTICE.md` for provenance, attribution, and scope of changes.

> A `LICENSE` file is placed at the repository root, consistent with the `license` field in `package.json` (MIT) and the in-house sub-packages.

---

<sub>Bundle <code>@fish-under-sea/dsh-fish</code> v0.10.4 · DSH ≥ 0.2.0-rc.2 · Node ≥ 20</sub>
