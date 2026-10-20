# @fish-under-sea/dsh-client-ui-task-board-fish

**1.0.0 · 任务看板**

[English](README.en.md)

## 功能

Host 权威任务账本、看板与子任务；真实 DSH 会话执行、循环 cron 与单次计划、次数预算、可选目标执行、验收、团队执行和防空闲休眠。

## 安装

```sh
dsh plugin --profile <profile> add @fish-under-sea/dsh-client-ui-task-board-fish@1.0.0
```

也可安装聚合包 `@fish-under-sea/dsh-fish@1.0.0`。聚合与独立安装不要重复展开相同插件行；安装完成后重启 DSH。桌面环境无 CLI 时使用插件管理器。

## 配置与边界

账本为 $DSH_HOME/task-board/ledger-v2.json。调度会消耗真实模型额度；高于默认权限的绑定只能人工确认。goalRun 同时受全局与卡片开关控制；teamRun 需要 AgentTeams 服务。物理删除、归档、运行状态由 Host 裁定。

Node 要求: `see package.json`. DSH 支持范围以本包声明为准；聚合包不覆盖宿主兼容性检查。

## 维护与来源

1.0.0 统一发布版本，不表示已合并上游所有最新提交。历史说明保留在 Git 历史中；聚合变更见 [聚合变更记录](https://github.com/Fish-under-sea/dsh-fish/blob/main/CHANGELOG.md).

派生自 [zhu1090093659/dsh-web](https://github.com/zhu1090093659/dsh-web). 保留原作者署名、LICENSE 与 NOTICE；Fish 修改包括包名与对应适配。 许可证: Apache-2.0.
