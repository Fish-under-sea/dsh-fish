# @fish-under-sea/dsh-session-archive-fish

**1.0.2 · 会话归档**

[English](README.en.md)

## 功能

集中检索和筛选会话、批量归档和取消归档、受保护的级联物理删除，以及可选自动归档和保留策略。

## 安装

```sh
dsh plugin --profile <profile> add @fish-under-sea/dsh-session-archive-fish@1.0.2
```

也可安装聚合包 `@fish-under-sea/dsh-fish@1.0.2`。聚合与独立安装不要重复展开相同插件行；安装完成后重启 DSH。桌面环境无 CLI 时使用插件管理器。

## 配置与边界

物理删除不可撤回。运行中、当前会话或在途操作保护整族；归档时间未知的会话不进入自动删除。归档时间以 $DSH_HOME/dsh-session-archive/archive-ledger.json 为准，不能用文件时间代替。

Node 要求: `^22.19.0 || >=24.0.0`. DSH 支持范围以本包声明为准；聚合包不覆盖宿主兼容性检查。

## 维护与来源

1.0.2 统一发布版本，不表示已合并上游所有最新提交。历史说明保留在 Git 历史中；聚合变更见 [聚合变更记录](https://github.com/Fish-under-sea/dsh-fish/blob/main/CHANGELOG.md).

派生自 [zhu1090093659/dsh-web](https://github.com/zhu1090093659/dsh-web). 保留原作者署名、LICENSE 与 NOTICE；Fish 修改包括包名与对应适配。 许可证: Apache-2.0.
