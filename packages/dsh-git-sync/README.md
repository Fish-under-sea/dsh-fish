# @fish-under-sea/dsh-git-sync

**1.0.0 · Git 同步**

[English](README.en.md)

## 功能

将选定的 DSH 配置同步到私有 Git 仓库，支持预览、提交、拉取和换机还原；凭据导出与普通同步分开。

## 安装

```sh
dsh plugin --profile <profile> add @fish-under-sea/dsh-git-sync@1.0.0
```

也可安装聚合包 `@fish-under-sea/dsh-fish@1.0.0`。聚合与独立安装不要重复展开相同插件行；安装完成后重启 DSH。桌面环境无 CLI 时使用插件管理器。

## 配置与边界

配置目录为 $DSH_HOME/dsh-git-sync/。同步不是完整备份；密钥、令牌、会话记录和 SSH 密码不能当作普通配置提交。恢复前备份，敏感导出只在本机安全保管。

Node 要求: `>=20`. DSH 支持范围以本包声明为准；聚合包不覆盖宿主兼容性检查。

## 维护与来源

1.0.0 统一发布版本，不表示已合并上游所有最新提交。历史说明保留在 Git 历史中；聚合变更见 [聚合变更记录](https://github.com/Fish-under-sea/dsh-fish/blob/main/CHANGELOG.md).

Fish 原生插件。 许可证: MIT.
