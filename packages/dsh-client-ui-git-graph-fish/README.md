# @fish-under-sea/dsh-client-ui-git-graph-fish

**1.0.2 · Git 图谱**

[English](README.en.md)

## 功能

可视化提交历史、空白会话分支选择、创建和切换分支、worktree 管理与冲突守卫；可选 git_worktree 模型工具默认关闭。

## 安装

```sh
dsh plugin --profile <profile> add @fish-under-sea/dsh-client-ui-git-graph-fish@1.0.2
```

也可安装聚合包 `@fish-under-sea/dsh-fish@1.0.2`。聚合与独立安装不要重复展开相同插件行；安装完成后重启 DSH。桌面环境无 CLI 时使用插件管理器。

## 配置与边界

宿主会实际执行 Git 操作。未提交改动、合并冲突及其他 worktree 占用会触发保护；不要用强制重置绕过。托管 worktree 位于 $DSH_HOME/worktrees/。

Node 要求: `^22.19.0 || >=24.0.0`. DSH 支持范围以本包声明为准；聚合包不覆盖宿主兼容性检查。

## 维护与来源

1.0.2 统一发布版本，不表示已合并上游所有最新提交。历史说明保留在 Git 历史中；聚合变更见 [聚合变更记录](https://github.com/Fish-under-sea/dsh-fish/blob/main/CHANGELOG.md).

派生自 [zhu1090093659/dsh-web](https://github.com/zhu1090093659/dsh-web). 保留原作者署名、LICENSE 与 NOTICE；Fish 修改包括包名与对应适配。 许可证: Apache-2.0.
