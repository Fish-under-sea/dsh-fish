# @fish-under-sea/dsh-fish

<img src="icon.png" alt="Fish" width="96">

**1.0.2 · 十一个插件，一个聚合入口**

[English](README.en.md)

## 安装

```sh
dsh plugin --profile <profile> add @fish-under-sea/dsh-fish@1.0.2
```

安装后重启 DSH。桌面版无 CLI 时在插件管理器添加同名包。需要 Node `^22.19.0 || >=24`；AgentTeams 推荐宿主 `0.2.0-rc.2`，`0.2.1-rc.2` 保持预览支持。各成员的宿主声明仍分别生效。

## 本次更新

四条扩展命令的图标、中文标题与顺序现由「设置导航顺序」插件统一管理，并随发布包交付。默认顺序为 **智能体团队 `agent-teams` → 视觉伴侣 `companion` → 上下文压缩 `acp` → 缓存统计 `acp-cache`**，ACP 两条说明也跟随界面语言显示。

在 **设置 → 设置导航顺序 → 斜杠菜单顺序** 用 ↑ / ↓ 调整并保存，可单独关闭或恢复命令默认顺序。偏好保存在浏览器与 `$DSH_HOME/dsh-settings-nav-order/state.json`；旧版设置导航的顺序和隐藏偏好继续保留。升级后重启 DSH 即可使用。

所有 **11 个子包均先发布并核对为 1.0.2**，聚合包随后精确固定这些版本。

## 插件清单

以下 11 个成员与聚合包统一为 **1.0.2**。其中 10 个在本仓库，AgentTeams 在独立仓库。聚合依赖精确固定版本。

| 插件 | npm | 功能 |
| --- | --- | --- |
| [审批说明](https://www.npmjs.com/package/@fish-under-sea/dsh-approval-guide) | `@fish-under-sea/dsh-approval-guide` | 为审批弹窗补充中文动作、风险与依据说明；覆盖文件、命令、网络及权限升级等常见请求。 |
| [Git 同步](https://www.npmjs.com/package/@fish-under-sea/dsh-git-sync) | `@fish-under-sea/dsh-git-sync` | 将选定的 DSH 配置同步到私有 Git 仓库，支持预览、提交、拉取和还原；仅在本机将 `$DSH_HOME/.credentials.yaml` 导出到用户指定或动态桌面目录，凭据不随 Git 同步。 |
| [设置导航排序](https://www.npmjs.com/package/@fish-under-sea/dsh-settings-nav-order) | `@fish-under-sea/dsh-settings-nav-order` | 重排和隐藏设置侧栏；管理四条扩展命令的图标、中文标题、说明及默认顺序，偏好持久保存。 |
| [视觉伴侣](https://www.npmjs.com/package/@fish-under-sea/dsh-visual-companion) | `@fish-under-sea/dsh-visual-companion` | 绑定视觉伴侣目录，把网页上提交的选择和备注合并为用户消息并唤醒目标会话；提供 arm、disarm、status 和 wake。 |
| [技能中心](https://www.npmjs.com/package/@fish-under-sea/dsh-skill-lens-fish) | `@fish-under-sea/dsh-skill-lens-fish` | 技能清单、概览、文件浏览和编辑、依赖图、新建、导入与删除；识别目录式 SKILL.md、扁平 .md 和共享引用资源，跟随 DSH_HOME。 |
| [任务看板](https://www.npmjs.com/package/@fish-under-sea/dsh-client-ui-task-board-fish) | `@fish-under-sea/dsh-client-ui-task-board-fish` | Host 权威任务账本、看板与子任务；真实 DSH 会话执行、循环 cron 与单次计划、次数预算、可选目标执行、验收、团队执行和防空闲休眠。 |
| [Git 图谱](https://www.npmjs.com/package/@fish-under-sea/dsh-client-ui-git-graph-fish) | `@fish-under-sea/dsh-client-ui-git-graph-fish` | 可视化提交历史、空白会话分支选择、创建和切换分支、worktree 管理与冲突守卫；可选 git_worktree 模型工具默认关闭。 |
| [SSH 运维](https://www.npmjs.com/package/@fish-under-sea/dsh-ssh-fish) | `@fish-under-sea/dsh-ssh-fish` | 主机管理、持久连接池、Web PTY 终端、SFTP、回环端口转发与集群执行；六个 Agent 工具与 GUI 共享主机配置。 |
| [用量统计](https://www.npmjs.com/package/@fish-under-sea/dsh-usage-fish) | `@fish-under-sea/dsh-usage-fish` | 按渠道和模型展示 token 台账、余额、订阅配额、峰谷成本估算、Token 银行与侧栏速览。 |
| [会话归档](https://www.npmjs.com/package/@fish-under-sea/dsh-session-archive-fish) | `@fish-under-sea/dsh-session-archive-fish` | 集中检索和筛选会话、批量归档和取消归档、受保护的级联物理删除，以及可选自动归档和保留策略。 |
| [团队协作](https://www.npmjs.com/package/@fish-under-sea/dsh-agent-teams-fish) | `@fish-under-sea/dsh-agent-teams-fish` | 审批后派发成员、任务依赖 DAG、信箱通信、质量门与修复轮次、持久恢复；Fish 厂商和岗位美术、十八厂商识别、队长头像跟随模型路由。 |

## 从旧版迁移

- 先安全备份 `$DSH_HOME`、profile 清单和补丁；本地 link 插件源码需另外备份。
- AgentTeams 包名改为 `@fish-under-sea/dsh-agent-teams-fish`。替换旧直接依赖和 bundle 引用；若 profile 覆盖行中写了旧 `name`，一并修改。行 id `agent-teams`、状态目录 `.agent-teams` 和配置键不变。不要把新旧包同时挂载。
- Better Reasoning Effort 不再内置。需要时从 [HaoyueQin 官方仓库](https://github.com/HaoyueQin/dsh-better-reasoning-effort)安装 `dsh-better-reasoning-effort`，不要继续使用 Fish Fork。
- Video Preview 不再提供；OFM 与旧会话标题插件也不在本聚合中，不提供替代依赖。已有用户数据不会因发布本包被删除。
- 更新聚合包不会自动清掉 profile 中单独添加的旧包、bundle 或覆盖行。请在插件管理器核对并移除对应旧项后再重启。
- 历史损坏会话不属于版本号迁移可修复范围；不要为升级手工删除日志事件。

## 共存与数据

不要同时启用同功能的上游 `dsh-web-all` 行和 Fish 行；不同 id 也可能重复注册服务。Skill Lens 与上游版共用 `skill-lens` 行 id，不能重复插入。本聚合只插入自己的 11 行，不停用其他包，也不改变宿主内置标题功能。

配置与业务数据保留在 `$DSH_HOME` 或工作区中，不写死机器路径。SSH 凭据可能明文保存；会话物理删除不可撤回；Git 同步不等于完整备份；调度和团队执行消耗真实模型额度。详见各成员 README 的安全边界。

## 开发与来源

以下检查按需手动执行，不是提交或发布前置门禁。本仓库不配置 push / PR 自动验证；标签发布不运行构建或测试。子包共用本仓库策略，插件运行时的权限与数据保护规则不变。

```sh
pnpm install --frozen-lockfile
pnpm test:release
pnpm -r --if-present typecheck
pnpm -r --if-present test
pnpm -r --if-present build
```

聚合自身是空实现，挂载入口是 `cordis.patch.yml`。成员独立构建、独立发布；浏览器模块必须以实际包名重新构建。1.0.2 是管理版本统一，不是“已同步所有上游 HEAD”的声明。

Fish 原生：审批说明、Git 同步、设置排序、视觉伴侣。Fork 来源：

- [x-feichen/dsh-skill-lens](https://github.com/x-feichen/dsh-skill-lens) · MIT
- [zhu1090093659/dsh-web](https://github.com/zhu1090093659/dsh-web) · Apache-2.0
- [NanmiCoder/dsh-agent-teams](https://github.com/NanmiCoder/dsh-agent-teams) · MIT

原作者版权、各成员 LICENSE 和 NOTICE 保留。聚合入口采用 MIT。历史变更移至 [更新记录](CHANGELOG.md).
