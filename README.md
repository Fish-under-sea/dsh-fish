# @fish-under-sea/dsh-fish

<img src="icon.png" alt="Fish" width="96">

**2.0.0 · 十一个插件，一个聚合入口**

[English](README.en.md)

## 安装

```sh
dsh plugin --profile <profile> add @fish-under-sea/dsh-fish@2.0.0
```

安装后重启 DSH。桌面版无 CLI 时在插件管理器添加同名包。需要 Node `>=24.9`；宿主最低 `0.2.2-rc.1`。各成员的宿主声明分别生效。

## 本次更新

**2.0.0：十一个成员全部收进本仓库，统一版本、统一图标、统一说明。**

- **effort 并入**：`dsh-better-reasoning-effort-fish` 从独立仓库迁入 `packages/`，成为聚合成员。它在「模型」页卡片内编辑每个模型的思考档位与输入模态，带八大模型家族主题。
- **AgentTeams 并入**：`dsh-agent-teams-fish` 从独立仓库迁入 `packages/`，不再作为外部依赖。行 id `agent-teams`、状态目录 `.agent-teams` 与配置键保持不变。
- **开始页命令菜单排序**：设置导航顺序插件把「文件、代码审查和变更、新建终端、Git、浏览器、任务管理、侧边对话、本地模型、会话数据诊断、壁纸引擎」这列做成全量可排序；按分区重排，搜索态不打扰，顺序写入 `state.json`，换机可恢复。
- **空输入发送增强**：审批说明插件新增——输入框为空时点发送按钮，自动填入并发送「继续任务，并梳理进度」，让「继续」不再需要先打字。非空输入、停止按钮、附件、上传中与输入法组合态完全不接管。
- **统一外观**：十一个成员共用聚合包 `icon.png`；每个包补齐 `locale/{zh,en}.json` 的标题与一句话说明，插件列表里显示的是同一套中文定位。
- **版本**：十一个成员与聚合包统一为 **2.0.0**，依赖逐项精确固定。
- **仍不内置**：Git 图谱继续退役；破甲仍需单独安装。

## 插件清单

以下 11 个成员当前均为 **2.0.0**，全部在本仓库 `packages/`。聚合包本身也是 **2.0.0**，依赖逐项精确固定。

| 插件 | npm | 功能 |
| --- | --- | --- |
| 审批说明 | `@fish-under-sea/dsh-approval-guide` | 为审批弹窗补充中文动作、风险与依据说明；空输入点发送自动续跑。 |
| Git 同步 | `@fish-under-sea/dsh-git-sync` | 将选定的 DSH 配置同步到私有 Git 仓库，支持预览、提交、拉取和还原；凭据不随 Git 同步。 |
| 设置导航排序 | `@fish-under-sea/dsh-settings-nav-order` | 重排和隐藏设置侧栏；开始页命令菜单全量排序、跨机恢复；管理扩展命令的图标与中文标题。 |
| 视觉伴侣 | `@fish-under-sea/dsh-visual-companion` | 绑定视觉伴侣目录，把网页上提交的选择和备注合并为用户消息并唤醒目标会话。 |
| 技能中心 | `@fish-under-sea/dsh-skill-lens-fish` | 技能清单、概览、文件浏览和编辑、依赖图、新建、导入与删除。 |
| 任务看板 | `@fish-under-sea/dsh-client-ui-task-board-fish` | Host 权威任务账本、看板与子任务；真实会话执行、cron 与单次计划、验收与团队执行。 |
| SSH 运维 | `@fish-under-sea/dsh-ssh-fish` | 主机管理、持久连接池、Web PTY 终端、SFTP、端口转发与集群执行。 |
| 用量统计 | `@fish-under-sea/dsh-usage-fish` | token 台账、余额、订阅配额、峰谷成本估算与侧栏速览。 |
| 会话归档 | `@fish-under-sea/dsh-session-archive-fish` | 集中检索、批量归档、受保护的级联物理删除与自动保留策略。 |
| 思考强度 | `@fish-under-sea/dsh-better-reasoning-effort-fish` | 每个模型的思考档位与图片输入声明，内置模型知识库与线协议推断，模型卡片内直接编辑。 |
| 团队协作 | `@fish-under-sea/dsh-agent-teams-fish` | 自然语言组队、任务依赖 DAG、信箱通信、质量门与修复轮次、持久恢复与厂商美术。 |

## 可选：单独安装破甲

破甲 `@fish-under-sea/dsh-purge-fish` **不在聚合内**，需要时单独安装。它给所有模型注入可替换的清洗提示词，可按模型分别配置，并带红队演练台与一键回滚。

```sh
dsh plugin --profile <profile> add https://github.com/Fish-under-sea/dsh-purge/archive/refs/heads/master.tar.gz
```

单装时由它自己的 `cordis.patch.yml` 完成宿主提示改写；聚合不再代做这些改写。行 id `dsh-purge` 与数据目录 `$DSH_HOME/redteam` 不变。

## 从旧版迁移

- 先安全备份 `$DSH_HOME`、profile 清单和补丁；本地 link 插件源码需另外备份。
- **effort 与 AgentTeams 已改为聚合成员**：如果 profile 里单独装过 `@fish-under-sea/dsh-better-reasoning-effort-fish`（0.5.x）或 `@fish-under-sea/dsh-agent-teams-fish`（1.1.0），先移除单独安装与对应 bundle 行，避免与聚合重复挂载。包名、行 id、状态目录不变。
- **Git 图谱仍不在聚合**：需要时单装 `@fish-under-sea/dsh-client-ui-git-graph-fish@1.0.2`，不要与聚合同时挂载。
- **破甲仍单装**：`dsh-purge` 四行与 `system-prompt` 改写由它自己负责；聚合不注入。
- 旧版本（`<2.0.0`）已在 npm 上标记 deprecated，安装时请使用 `@fish-under-sea/dsh-fish@2.0.0`。
- 更新聚合包不会自动清掉 profile 中单独添加的旧包、bundle 或覆盖行；请在插件管理器核对并移除对应旧项后再重启。

## 共存与数据

不要同时启用同功能的上游 `dsh-web-all` 行和 Fish 行；不同 id 也可能重复注册服务。Skill Lens 与上游版共用 `skill-lens` 行 id，不能重复插入。本聚合只插入自己的 11 行，不改写宿主 `system-prompt`，也不停用旧独立红队行。不改变宿主内置标题功能。

配置与业务数据保留在 `$DSH_HOME` 或工作区中，不写死机器路径。SSH 凭据可能明文保存；会话物理删除不可撤回；Git 同步不等于完整备份；调度和团队执行消耗真实模型额度。详见各成员 README 的安全边界。

## 开发与来源

以下检查按需手动执行，不是提交或发布前置门禁。标签发布只生成 GitHub Release，不运行构建或测试。

```sh
pnpm install --frozen-lockfile
pnpm test:release
pnpm -r --if-present typecheck
pnpm -r --if-present test
pnpm -r --if-present build
```

聚合自身是空实现，挂载入口是 `cordis.patch.yml`。十一个成员都在 `packages/`，lib 已提交，可独立构建、独立发布；浏览器模块必须以实际包名重新构建。聚合包与成员统一版本 2.0.0。

Fish 原生：审批说明、Git 同步、设置排序、视觉伴侣。Fork 来源：

- [x-feichen/dsh-skill-lens](https://github.com/x-feichen/dsh-skill-lens) · MIT
- [zhu1090093659/dsh-web](https://github.com/zhu1090093659/dsh-web) · Apache-2.0（Git 图谱已跟随上游退役）
- [NanmiCoder/dsh-agent-teams](https://github.com/NanmiCoder/dsh-agent-teams) · MIT
- [HaoyueQin/dsh-better-reasoning-effort](https://github.com/HaoyueQin/dsh-better-reasoning-effort) · MIT
- [YuJunZhiXue/dsh-purge](https://github.com/YuJunZhiXue/dsh-purge) · MIT（破甲单装包的上游，已不在本聚合内）

原作者版权、各成员 LICENSE 和 NOTICE 保留。聚合入口采用 MIT。历史变更移至 [更新记录](CHANGELOG.md).
