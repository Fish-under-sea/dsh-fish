# Package rules for dsh-session-archive

包特有规则（通用规则见根 [AGENTS.md](../../AGENTS.md) 与 [packages/AGENTS.md](../../packages/AGENTS.md)）。

## 删除语义（本包的核心契约）

- 物理删除管线顺序固定：归档集合 → 工作区 `sessionIds` → 存储（rdb 行 / 会话目录）→
  投影缓存 → 归档台账。中断只会留下"已取消列表但数据还在"的可重试状态，绝不半删除。
- 会话族（直接选中 + 全部后代）中任一成员受保护（运行中 / 当前会话 / 在途操作）→
  整族跳过，reason `family-protected`。
- 归档台账（`$DSH_HOME/dsh-session-archive/archive-ledger.json`）是唯一归档时间事实源；
  台账中没有条目的归档会话按"归档时间未知"处理，永不进入自动删除。
- 删除路径只允许来自 `indexSessionDirs` 的解析结果，`removeSessionDir` 会再次校验
  realpath 在 sessions 根内；任何客户端提交的路径都是非法输入。

## SDK seam 约束

- 归档走公开的 `workspaceRegistry.archiveSession`；取消归档与工作区行清理走
  `requireState`/`setState` 与 entity `mutate`（alpha.2 运行时 seam，`workspace-store.ts`
  中特征检测，缺失时报 `missing-seam`，禁止直接改写 `workspace.json` 文件）。
- 运行中判定 = 宿主 feed 的 `running` 位 ∪ 活跃 SessionStore 成员 ∪ 客户端声明的
  当前会话；三路来源都在 `protectedReason` 里合并。
- 自动归档时间口径 = feed `updatedAt`（`lastActivityReliable`）；自动删除时间口径 =
  归档台账 `archivedAt`。两条口径写死在 `core/auto-rules.ts`，不许改从文件时间推断。

## 测试与门禁

- `pnpm --filter @fish-under-sea/dsh-session-archive-fish test` / `typecheck` / `build`。
- 共享模块（`mount-once.ts`、`dsh-home.ts`、`host/http.ts`、`host/loopback.ts`）是
  sync-shared 生成副本，改 `shared/` 源后 `pnpm sync-shared`。
- 改删除/归档语义必须同步更新 `tests/janitor.spec.ts` 与双语 README 的语义说明。
