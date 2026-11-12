# @fish-under-sea/dsh-agent-teams-fish

**2.0.2 · 同步上游 v0.1.29 · dsh-fish 聚合成员 · 持久团队协作与 Fish 厂商美术**

[English](README.en.md)

## 安装与兼容

自 2.0.2 起，本包并入 [Fish-under-sea/dsh-fish](https://github.com/Fish-under-sea/dsh-fish) 聚合仓库，作为工作区成员 `packages/dsh-agent-teams-fish` 与其它成员统一构建、统一版本、统一发布；原独立仓库不再单独演进。

```sh
# 聚合安装（推荐，含全部成员）
dsh plugin --profile <profile> add @fish-under-sea/dsh-fish@2.0.2

# 或单独安装本成员
dsh plugin --profile <profile> add @fish-under-sea/dsh-agent-teams-fish@2.0.2
```

聚合已包含本成员，不要重复挂载。安装后重启 DSH。Node 要求 `>=24.9`。推荐宿主 `0.2.2-rc.1`；`0.2.1-rc.2`、`0.2.1-alpha.2` 等旧版本仍在支持列表内。精确支持列表以 [compatibility.json](compatibility.json) 为唯一事实源，不以桌面应用版本推断核心版本。

## 功能

- 先规划后审批：成员编排、任务依赖 DAG、信箱通信与进度监测。
- 持久成员、失败处理、重派能力凭据、停机与恢复，遵守宿主路由和模型白名单。
- 可选质量门：需求、实现、验证、审查、修复及集成，审查与产物绑定。
- Fish 美术：十八厂商识别，厂商与岗位头像、自定义 artworkDir、商标徽标及队长模型路由头像。缺图按“厂商+岗位 → 厂商 → 岗位”降级，不代表每个厂商都有全部岗位图。
- 新宿主预设型成员组合在子上下文安装人设和工具限制；缺失或损坏的限制在派发前拒绝。

## 迁移与配置

旧 npm 名 `dsh-agent-teams-fish` 改为当前 scoped 名。更新直接依赖、bundle 名和覆盖行的 `name`，保留 `id: agent-teams`；不要同时加载两个来源。状态目录默认是工作区 `.agent-teams`，memberProvider 默认 `spawn`，自定义 artworkDir 使用本机路径。配置字段与团队数据格式不因包名整理或本次并入聚合仓库而改变。

先安全备份再迁移。成员使用真实模型额度；工具策略由部署方声明，不能以改名绕过。不会自动修复损坏日志、删除历史事件或重发中断任务。旧会话损坏应独立诊断。

## 开发检查

构建产物 `lib/` 已随源码提交，发布不依赖本地构建；`src/` 与构建配置完整保留，可随时重建。在聚合仓库中按需手动执行：

```sh
pnpm install --frozen-lockfile
pnpm --filter @fish-under-sea/dsh-agent-teams-fish typecheck
pnpm --filter @fish-under-sea/dsh-agent-teams-fish build
pnpm --filter @fish-under-sea/dsh-agent-teams-fish verify
```

发布前是否构建与检查由维护者决定。插件运行时的权限确认与可选质量任务规则不变。诊断器 `dsh-agent-teams-doctor` 只检查清单和依赖闭包，不证明运行行为或识别当前进程。真实宿主验收与 UI 检查需要另行执行。

## 来源与记录

基于 [NanmiCoder/dsh-agent-teams](https://github.com/NanmiCoder/dsh-agent-teams)（原作者 Relakkes / 程序员阿江）。MIT。保留上游 README、NOTICE 和历史发布说明。源码基线为上游 tag v0.1.29（commit 369c278）；自 2.0.2 起并入 dsh-fish 聚合仓库，版本随聚合统一。

- [2.0.2](release-notes/v2.0.2.md)
- [1.1.0](release-notes/v1.1.0.md)
- [1.0.2](release-notes/v1.0.2.md)
- [1.0.1](release-notes/v1.0.1.md)
- [1.0.0](release-notes/v1.0.0.md)
- [历史记录](https://github.com/Fish-under-sea/dsh-fish/tree/main/packages/dsh-agent-teams-fish/release-notes)
- [NOTICE](NOTICE.md)